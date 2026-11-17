/**
 * aiModelService.js
 * Dịch vụ AI trung tâm tích hợp Google Gemini 3.x (Smart Consultant + Vision + Multi-Turn Memory + RAG).
 *
 * Nâng cấp kiến trúc:
 * 1. Chuỗi Model Gemini 3.x mới nhất, ổn định và đã kiểm chứng hiệu năng thực tế:
 *    gemini-3-flash-preview -> gemini-3.6-flash -> gemini-3.5-flash -> gemini-3.1-flash-lite-preview -> gemini-flash-lite-latest
 *    (Loại bỏ hoàn toàn model 2.5 đã deprecated và tránh lỗi 400 từ thinkingConfig trên các bản lite).
 * 2. Multi-turn Native Gemini `contents` (tối đa 20 lượt gần nhất) + `system_instruction` tách bạch.
 * 3. Tích hợp 3 tầng Memory (Working History + Rolling Summary + User Semantic Profile) & Hybrid RAG Context.
 * 4. Multimodal Vision (`analyzeProductImage`): Nhận diện đa thiết bị trong 1 ảnh, phân biệt rõ ảnh phi công nghệ (hoa/cây/phong cảnh) và ảnh mờ.
 */

const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEPRECATED_MODELS = new Set([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro'
]);

const ENV_MODEL = (process.env.GEMINI_MODEL || '').trim();
const DEFAULT_MODEL = ENV_MODEL && !DEPRECATED_MODELS.has(ENV_MODEL) ? ENV_MODEL : 'gemini-3-flash-preview';

const TEXT_CHAT_MODELS = Array.from(new Set([
    DEFAULT_MODEL,
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
].filter(m => m && !DEPRECATED_MODELS.has(m))));

const NLU_MODELS = Array.from(new Set([
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview'
].filter(m => m && !DEPRECATED_MODELS.has(m))));

const VISION_MODELS = Array.from(new Set([
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite'
].filter(m => m && !DEPRECATED_MODELS.has(m))));

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000);
const NLU_TIMEOUT_MS = Number(process.env.GEMINI_NLU_TIMEOUT_MS || 4500);
const VISION_TIMEOUT_MS = Number(process.env.GEMINI_VISION_TIMEOUT_MS || 15000);
const MAX_HISTORY_TURNS = 20;

const modelCooldownUntil = new Map();

function isApiKeyConfigured() {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    return Boolean(apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'your-gemini-api-key-here');
}

function getApiKey() {
    return (process.env.GEMINI_API_KEY || '').trim();
}

function isModelAvailable(modelName) {
    const until = modelCooldownUntil.get(modelName);
    if (!until) return true;
    if (Date.now() >= until) {
        modelCooldownUntil.delete(modelName);
        return true;
    }
    return false;
}

function markModelCooldown(modelName, status, errorMsg = '') {
    // 404: model ngừng hỗ trợ -> 30m; 429 daily quota -> 15m; 429 RPM -> 90s; 400 -> 10m; timeout/network -> 20s
    let durationMs = 20 * 1000;
    if (status === 404) durationMs = 30 * 60 * 1000;
    else if (status === 400) durationMs = 10 * 60 * 1000;
    else if (status === 429) {
        const isDailyQuota = /per\s*day|daily|limit:\s*20/i.test(String(errorMsg || ''));
        durationMs = isDailyQuota ? 15 * 60 * 1000 : 90 * 1000;
    }
    modelCooldownUntil.set(modelName, Date.now() + durationMs);
}

function extractGeminiResponseText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts
        .filter(p => !p.thought)
        .map(p => p.text || '')
        .join('')
        .trim();
}

function buildGenerationConfigForModel(modelName, { temperature, maxOutputTokens, responseMimeType }) {
    const cfg = {
        temperature,
        topP: 0.9,
        maxOutputTokens
    };
    if (responseMimeType) {
        cfg.responseMimeType = responseMimeType;
    }
    // Áp dụng thinkingLevel minimal cho model 3-flash để phản hồi nhanh, không bị ăn hết token trả lời
    if (/gemini-3(?:\.\d+)?-flash(?:-preview)?$/i.test(modelName) && !/lite/i.test(modelName)) {
        cfg.thinkingConfig = { thinkingLevel: 'minimal' };
    }
    return cfg;
}

function getAiServiceStatus() {
    const hasKey = isApiKeyConfigured();
    const activeModels = TEXT_CHAT_MODELS.filter(isModelAvailable);
    const activeNluModels = NLU_MODELS.filter(isModelAvailable);
    const activeVisionModels = VISION_MODELS.filter(isModelAvailable);
    return {
        configured: hasKey,
        provider: hasKey ? 'gemini' : 'deterministic_engine',
        model: hasKey ? (activeModels[0] || DEFAULT_MODEL) : 'none',
        nluModel: hasKey ? (activeNluModels[0] || NLU_MODELS[0]) : 'none',
        visionModel: hasKey ? (activeVisionModels[0] || VISION_MODELS[0]) : 'none',
        candidateModels: TEXT_CHAT_MODELS,
        nluModels: NLU_MODELS,
        visionModels: VISION_MODELS,
        maxHistoryTurns: MAX_HISTORY_TURNS,
        timeoutMs: REQUEST_TIMEOUT_MS
    };
}

/**
 * Chuẩn hóa đầy đủ thông tin sản phẩm từ MongoDB thành hồ sơ kỹ thuật giàu ngữ cảnh cho AI
 */
function formatVerifiedProduct(p, idx) {
    const s = p.specs || {};
    const price = Number(p.price || 0);
    const compareAtPrice = Number(p.compareAtPrice || 0);
    const discountAmount = compareAtPrice > price ? compareAtPrice - price : 0;
    const downPayment30 = Math.round(price * 0.3);
    const monthly12 = Math.round((price * 0.7) / 12);

    const specLines = [
        s.cpu ? `CPU/Chip: ${s.cpu}` : null,
        s.gpu ? `GPU/Đồ họa: ${s.gpu}` : null,
        s.ram ? `RAM: ${s.ram}` : null,
        s.storage ? `Bộ nhớ/Ổ cứng: ${s.storage}` : null,
        s.screen ? `Màn hình: ${s.screen}` : null,
        s.battery ? `Pin & Sạc: ${s.battery}` : null,
        s.camera ? `Camera: ${s.camera}` : null,
        s.connectivity ? `Kết nối: ${s.connectivity}` : null,
        s.weight ? `Trọng lượng: ${s.weight}` : null,
        s.os ? `Hệ điều hành: ${s.os}` : null
    ].filter(Boolean);

    const knownSpecKeys = new Set(['cpu', 'gpu', 'ram', 'storage', 'screen', 'battery', 'camera', 'connectivity', 'weight', 'os']);
    Object.entries(s).forEach(([k, v]) => {
        if (!knownSpecKeys.has(k) && v && typeof v === 'string') {
            specLines.push(`${k}: ${v}`);
        }
    });

    const cleanDesc = String(p.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320);

    return `[Sản phẩm ${idx + 1}: ${p.name}]
- Thương hiệu: ${p.brand || 'Chính hãng'} | Danh mục: ${p.category || 'Công nghệ'}
- Giá bán niêm yết: ${price.toLocaleString('vi-VN')} đ${discountAmount > 0 ? ` (Giá gốc: ${compareAtPrice.toLocaleString('vi-VN')} đ - Tiết kiệm: ${discountAmount.toLocaleString('vi-VN')} đ)` : ''}
- Trả góp 0%: Trả trước 30% (~${downPayment30.toLocaleString('vi-VN')} đ), góp 12 tháng ~${monthly12.toLocaleString('vi-VN')} đ/tháng
- Tồn kho: ${p.stock > 0 ? `Sẵn hàng (${p.stock} máy nguyên seal)` : 'Tạm hết hàng (Hỗ trợ đặt trước)'}
- Đánh giá: ${p.rating ? `${p.rating}/5 sao` : '5/5 sao'}${p.soldCount ? ` (${p.soldCount} đã bán)` : ''}
- Thông số kỹ thuật: ${specLines.length > 0 ? specLines.join(' | ') : 'Tiêu chuẩn chính hãng'}
- Mô tả / Điểm nổi bật: ${cleanDesc || 'Sản phẩm chính hãng nguyên seal, hiệu năng ổn định.'}
- Bảo hành: ${p.warranty || 'Bảo hành chính hãng 12 - 24 tháng, lỗi 1 đổi 1 trong 30 ngày đầu'}`;
}

/**
 * Chuyển đổi lịch sử hội thoại (tối đa 20 lượt gần nhất) thành mảng `contents` hợp lệ cho Gemini API
 * đảm bảo luân phiên đúng chuẩn user -> model -> user.
 */
function buildGeminiContents(history = [], currentUserText = '') {
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history
            .slice(-MAX_HISTORY_TURNS)
            .filter(item => item && (item.text || item.content));

        for (const item of recent) {
            const rawText = String(item.text || item.content || '').replace(/\s+/g, ' ').trim().slice(0, 900);
            if (!rawText) continue;
            const role = (item.role === 'user' || item.sender === 'user') ? 'user' : 'model';

            // Tránh 2 turn liên tiếp cùng role bằng cách gộp
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += `\n${rawText}`;
            } else {
                contents.push({ role, parts: [{ text: rawText }] });
            }
        }
    }

    // Gemini yêu cầu turn đầu tiên trong contents phải là 'user'
    while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
    }

    // Turn cuối là câu hỏi hiện tại của user
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n\n[TIN NHẮN MỚI NHẤT]:\n${currentUserText}`;
    } else {
        contents.push({ role: 'user', parts: [{ text: currentUserText }] });
    }

    return contents;
}

/**
 * Định dạng Block Memory (Rolling Summary + Semantic User Profile + Visual Search Memory)
 */
function formatLongTermMemoryBlock(context = {}) {
    const profile = context.memoryProfile || {};
    const parts = [];

    if (context.rollingSummary) {
        parts.push(`• Tóm tắt diễn biến các lượt trước đó: ${context.rollingSummary}`);
    }
    if (profile.occupationOrRole) {
        parts.push(`• Nghề nghiệp / Đối tượng khách hàng: ${profile.occupationOrRole}`);
    }
    if (profile.buyingFor) {
        parts.push(`• Người sử dụng cuối / Mục đích mua: ${profile.buyingFor}`);
    }
    if (profile.preferredPaymentMethod) {
        parts.push(`• Hình thức thanh toán quan tâm: ${profile.preferredPaymentMethod}`);
    }
    if (profile.customerMood) {
        parts.push(`• Tâm lý / Trạng thái khách hiện tại: ${profile.customerMood}`);
    }
    if (Array.isArray(profile.objectionsRaised) && profile.objectionsRaised.length > 0) {
        parts.push(`• Rào cản / Băn khoăn khách đã nêu trước đó: ${profile.objectionsRaised.join('; ')} (Lưu ý giải tỏa khéo léo, tận tâm)`);
    }
    if (Array.isArray(profile.ownedDevices) && profile.ownedDevices.length > 0) {
        parts.push(`• Thiết bị khách đang sở hữu: ${profile.ownedDevices.join(', ')} (Ưu tiên tư vấn hệ sinh thái đồng bộ & tương thích)`);
    }
    if (Array.isArray(profile.preferredBrands) && profile.preferredBrands.length > 0) {
        parts.push(`• Thương hiệu khách ưu ái: ${profile.preferredBrands.join(', ')}`);
    }
    const excluded = Array.from(new Set([
        ...(Array.isArray(context.eliminatedBrands) ? context.eliminatedBrands : []),
        ...(Array.isArray(profile.dislikedBrands) ? profile.dislikedBrands : [])
    ])).filter(Boolean);
    if (excluded.length > 0) {
        parts.push(`• Thương hiệu khách KHÔNG THÍCH / đã loại trừ: ${excluded.join(', ')} (Tuyệt đối không gợi ý lại)`);
    }
    if (Array.isArray(profile.keyPriorities) && profile.keyPriorities.length > 0) {
        parts.push(`• Tiêu chí ưu tiên xuyên suốt phiên chat: ${profile.keyPriorities.join(', ')}`);
    }
    if (Array.isArray(profile.shortlistedProducts) && profile.shortlistedProducts.length > 0) {
        parts.push(`• Mẫu khách từng ưng ý / đưa vào cân nhắc: ${profile.shortlistedProducts.map(s => s.name).filter(Boolean).join(', ')}`);
    }
    const visualDevices = context.lastVisualDevices || profile.lastVisualDevices;
    if (Array.isArray(visualDevices) && visualDevices.length > 0) {
        parts.push(`• Thiết bị trong ảnh khách vừa gửi tìm kiếm: ${visualDevices.map(d => `${d.name}${d.brand ? ` (${d.brand})` : ''}`).join(', ')}`);
    }
    if (Array.isArray(context.lastProducts) && context.lastProducts.length > 0) {
        const names = context.lastProducts.slice(0, 5).map((p, idx) => `#${idx + 1}: ${p.name || p}`).join(' | ');
        parts.push(`• Sản phẩm vừa hiển thị/đề cập ngay trước đó: ${names}`);
    }
    if (Number(profile.recurringVisitCount || 1) > 1) {
        parts.push(`• Khách hàng thân thiết quay lại (lần #${profile.recurringVisitCount}) — chào đón ấm áp, liền mạch!`);
    }

    return parts.length > 0 ? parts.join('\n') : 'Chưa có thông tin bộ nhớ dài hạn trước đó.';
}

/**
 * Hàm gọi Gemini Text thống nhất cho toàn bộ hệ thống với Circuit Breaker + Multi-Model Failover
 */
async function callGeminiText({
    systemInstruction = '',
    history = [],
    userPrompt = '',
    temperature = 0.35,
    maxOutputTokens = 2800,
    responseMimeType = '',
    candidateModels = TEXT_CHAT_MODELS,
    timeoutMs = REQUEST_TIMEOUT_MS
}) {
    if (!isApiKeyConfigured()) {
        return { text: null, provider: 'deterministic_engine', model: 'none', isFallback: true };
    }

    const apiKey = getApiKey();
    const availableModels = candidateModels.filter(isModelAvailable);
    const modelsToTry = availableModels.length > 0 ? availableModels : candidateModels.slice(0, 3);
    const contents = buildGeminiContents(history, userPrompt);

    for (const currentModel of modelsToTry) {
        try {
            const payload = {
                contents,
                generationConfig: buildGenerationConfigForModel(currentModel, {
                    temperature,
                    maxOutputTokens,
                    responseMimeType
                })
            };
            if (systemInstruction && systemInstruction.trim()) {
                payload.system_instruction = {
                    parts: [{ text: systemInstruction.trim() }]
                };
            }

            let response;
            try {
                response = await axios.post(
                    `${GEMINI_API_URL}/${currentModel}:generateContent?key=${apiKey}`,
                    payload,
                    {
                        timeout: timeoutMs,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            } catch (firstErr) {
                // Nếu endpoint 400 do thinkingConfig, thử lại 1 lần bỏ thinkingConfig
                if (firstErr.response?.status === 400 && payload.generationConfig.thinkingConfig) {
                    delete payload.generationConfig.thinkingConfig;
                    response = await axios.post(
                        `${GEMINI_API_URL}/${currentModel}:generateContent?key=${apiKey}`,
                        payload,
                        {
                            timeout: timeoutMs,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                } else {
                    throw firstErr;
                }
            }

            const generatedText = extractGeminiResponseText(response.data);
            if (generatedText) {
                return {
                    text: generatedText,
                    provider: 'gemini',
                    model: currentModel,
                    isFallback: false
                };
            }
        } catch (err) {
            const status = err.response?.status;
            const errMsg = err.response?.data?.error?.message || err.message;
            markModelCooldown(currentModel, status, errMsg);
            console.warn(`[aiModelService] Model ${currentModel} failed (status=${status || 'timeout'}): ${errMsg}`);
        }
    }

    return {
        text: null,
        provider: 'deterministic_engine',
        model: modelsToTry[0] || DEFAULT_MODEL,
        isFallback: true
    };
}

/**
 * Phân tích ngữ nghĩa câu hỏi tự nhiên bằng LLM tốc độ cao (Gemini 3.1 Flash-Lite)
 * Hiểu ngôn ngữ đời thường, tiếng lóng Việt ("củ", "xị", "bỏ cốp xe", "con thứ 2", "màu đen còn không")
 */
async function understandCustomerQuery({ message, context = {}, history = [] }) {
    if (!isApiKeyConfigured() || !message || String(message).trim().length < 2) {
        return null;
    }

    const memoryBlock = formatLongTermMemoryBlock(context);
    const lastProductsSummary = Array.isArray(context.lastProducts) && context.lastProducts.length > 0
        ? context.lastProducts.slice(0, 5).map((p, i) => `#${i + 1}: ${p.name} (${p.category || ''}, ${Number(p.price || 0).toLocaleString('vi-VN')}đ)`).join('\n')
        : 'Không có';

    const systemInstruction = `Bạn là bộ phân tích ngữ nghĩa NLU cho Trợ lý bán hàng cửa hàng công nghệ Việt Nam (7 danh mục chuẩn: "Điện thoại", "Laptop", "Tablet", "Tai nghe", "Đồng hồ thông minh", "Phụ kiện", "Máy chơi game").
Nhiệm vụ: Đọc câu hỏi của khách hàng + bộ nhớ + các sản phẩm vừa hiển thị để hiểu chính xác khách đang muốn gì và trả về DUY NHẤT 1 object JSON hợp lệ (không thêm markdown).
Quy tắc:
- Quy đổi tiếng Việt tự nhiên/lóng: "củ"/"củ rưỡi"/"tr"/"m" -> triệu VND (1 củ = 1000000), "xị" -> trăm nghìn (5 xị = 500000).
- Nếu khách hỏi nối tiếp về sản phẩm vừa xem ("con đầu", "mẫu 2", "cái đó", "màu khác", "pin trâu không?"), đặt "referencedProductIndex" (1..5).
- "rewrittenSearchQuery": viết chuỗi từ khóa tìm kiếm giàu ngữ nghĩa (VD: "đi grab ngoài trời nắng" -> "điện thoại màn hình sáng pin trâu 5000mAh", "nhẹ bỏ cốp xe" -> "laptop 13 14 inch mỏng nhẹ").
- Nếu là "objection"/"hesitation" (ngại đắt, so sánh sàn TMĐT, về hỏi gia đình, lo hàng lỗi), đặt đúng intent để tư vấn viên xử lý khéo léo.`;

    const userPrompt = `[NGỮ CẢNH BỘ NHỚ]:
${memoryBlock}
- Danh mục đang mở: ${context.category || context.pageCategory || 'Tất cả'}

[SẢN PHẨM VỪA HIỂN THỊ]:
${lastProductsSummary}

[TIN NHẮN KHÁCH HÀNG]:
"${String(message).slice(0, 500)}"

Trả về đúng JSON schema:
{
  "intent": "recommend|compare|product_qa|objection|installment|trade_in|policy_service|compatibility|hesitation|chit_chat|clarify",
  "category": "Điện thoại|Laptop|Tablet|Tai nghe|Đồng hồ thông minh|Phụ kiện|Máy chơi game|",
  "brand": "",
  "excludedBrand": "",
  "budgetVnd": 0,
  "budgetType": "hard|flexible|unspecified",
  "useCase": "",
  "priorities": [],
  "buyingFor": "",
  "paymentPreference": "",
  "objection": "",
  "referencedProductIndex": 0,
  "rewrittenSearchQuery": "",
  "customerMood": "normal|hesitant|price_sensitive|urgent|curious|grateful"
}`;

    const res = await callGeminiText({
        systemInstruction,
        history: (history || []).slice(-6),
        userPrompt,
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        candidateModels: NLU_MODELS,
        timeoutMs: NLU_TIMEOUT_MS
    });

    if (!res || !res.text) return null;
    try {
        const cleanJson = res.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const match = cleanJson.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (!parsed || typeof parsed !== 'object') return null;

        const validCategories = new Set(['Điện thoại', 'Laptop', 'Tablet', 'Tai nghe', 'Đồng hồ thông minh', 'Phụ kiện', 'Máy chơi game']);
        return {
            model: res.model,
            intent: String(parsed.intent || 'recommend').trim(),
            category: validCategories.has(parsed.category) ? parsed.category : '',
            brand: String(parsed.brand || '').trim(),
            excludedBrand: String(parsed.excludedBrand || '').trim(),
            budgetVnd: Number.isFinite(Number(parsed.budgetVnd)) && Number(parsed.budgetVnd) >= 100000 ? Math.round(Number(parsed.budgetVnd)) : 0,
            budgetType: ['hard', 'flexible', 'unspecified'].includes(parsed.budgetType) ? parsed.budgetType : 'unspecified',
            useCase: String(parsed.useCase || '').trim(),
            priorities: Array.isArray(parsed.priorities) ? parsed.priorities.map(x => String(x || '').trim()).filter(Boolean).slice(0, 6) : [],
            buyingFor: String(parsed.buyingFor || '').trim(),
            paymentPreference: String(parsed.paymentPreference || '').trim(),
            objection: String(parsed.objection || '').trim(),
            referencedProductIndex: Number.isInteger(Number(parsed.referencedProductIndex)) ? Number(parsed.referencedProductIndex) : 0,
            rewrittenSearchQuery: String(parsed.rewrittenSearchQuery || '').trim(),
            customerMood: String(parsed.customerMood || 'normal').trim()
        };
    } catch (_) {
        return null;
    }
}

/**
 * Phân tích ảnh bằng Gemini Multimodal Vision (hỗ trợ nhiều thiết bị trong 1 ảnh + phân biệt non-tech/unclear)
 */
async function analyzeProductImage({ base64Data, mimeType = 'image/jpeg', hint = '' }) {
    if (!isApiKeyConfigured() || !base64Data) {
        return { ok: false, reason: 'api_unavailable' };
    }

    const apiKey = getApiKey();
    const availableModels = VISION_MODELS.filter(isModelAvailable);
    const modelsToTry = availableModels.length > 0 ? availableModels : VISION_MODELS.slice(0, 3);

    const prompt = `Bạn là chuyên gia AI Computer Vision cho hệ thống bán lẻ thiết bị công nghệ (chỉ kinh doanh 7 danh mục: "Điện thoại", "Laptop", "Tablet", "Tai nghe", "Đồng hồ thông minh", "Phụ kiện", "Máy chơi game").
${hint ? `\nGhi chú đi kèm của khách hàng: "${hint.slice(0, 200)}"\n` : ''}
NHIỆM VỤ: Quan sát CHÍNH XÁC bức ảnh thật này. TUYỆT ĐỐI KHÔNG suy đoán thiết bị công nghệ nếu trong ảnh không hề có!

QUY TẮC PHÂN LOẠI NGHIÊM NGẶT:
1. Nếu trong ảnh THẬT SỰ CÓ thiết bị công nghệ / phụ kiện điện tử (điện thoại, laptop/MacBook, tablet/iPad, tai nghe/loa, đồng hồ thông minh/Apple Watch/Garmin, máy chơi game/PS5/Switch/Steam Deck, chuột/bàn phím/sạc/hub/gimbal):
   - "status": "matched"
   - Liệt kê TẤT CẢ các thiết bị công nghệ bạn nhìn thấy rõ vào mảng "devices" (tối đa 5 thiết bị).
   - Phân loại "category" CHÍNH XÁC vào 1 trong 7 giá trị: "Điện thoại", "Laptop", "Tablet", "Tai nghe", "Đồng hồ thông minh", "Phụ kiện", "Máy chơi game".
   - Nhận diện ĐÚNG ĐỜI MÁY / KIỂU DÁNG THỰC TẾ trong ảnh (VD: nếu là máy đời cũ có nút Home như iPhone 8 / iPhone 8 Plus / SE, máy màn hình gập hoặc ảnh Concept Apple gập, iPhone 13/14, Samsung Galaxy S22/Z Flip, Apple Watch Ultra, Google Pixel...) thì GHI ĐÚNG tên đó trong "name", TUYỆT ĐỐI KHÔNG tự ý đổi thành model đời mới hơn để cho khớp cửa hàng.
2. Nếu ảnh KHÔNG chứa thiết bị công nghệ (ví dụ: hoa cỏ, thiên nhiên, cây cối, đồ ăn, thú cưng, quần áo, xe cộ, sách vở, người, phong cảnh...):
   - "status": "non_tech"
   - "devices": []
   - "sceneDescription": Mô tả chính xác bằng tiếng Việt tự nhiên những gì bạn nhìn thấy trong ảnh (ví dụ: "bức ảnh cánh đồng hoa rực rỡ nhiều màu sắc ngoài trời").
   - "helpfulSuggestion": 1 câu gợi ý duyên dáng liên quan nếu phù hợp (ví dụ: nếu là hoa/cảnh đẹp -> gợi ý tìm điện thoại camera chụp ảnh đẹp hoặc gimbal chống rung để quay chụp; nếu là bàn học trống -> gợi ý setup laptop/phụ kiện).
3. Nếu ảnh quá mờ, tối đen, mất nét hoàn toàn hoặc bị che khuất không nhận diện được vật thể:
   - "status": "unclear", "devices": [], "sceneDescription": "Ảnh bị mờ hoặc thiếu sáng nên AI chưa nhận dạng rõ vật thể."

Trả về DUY NHẤT JSON hợp lệ theo đúng schema sau:
{
  "status": "matched" | "non_tech" | "unclear",
  "sceneDescription": "Mô tả ngắn bằng tiếng Việt về nội dung bức ảnh",
  "helpfulSuggestion": "Gợi ý hữu ích nếu là ảnh phi công nghệ (có thể để chuỗi rỗng)",
  "devices": [
    {
      "name": "Tên dòng thiết bị nhận diện (VD: iPhone 16 Pro / MacBook Pro / Apple Watch)",
      "category": "Điện thoại | Laptop | Tablet | Tai nghe | Đồng hồ thông minh | Phụ kiện | Máy chơi game",
      "brand": "Apple | Samsung | Sony | ASUS | Dell | Lenovo | Logitech | Garmin | Nintendo | ...",
      "visualFeatures": "Đặc điểm nhận dạng thấy trong ảnh (VD: màu bạc kim loại, 3 camera sau, màn tràn viền)",
      "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
    }
  ]
}`;

    for (const currentModel of modelsToTry) {
        try {
            const response = await axios.post(
                `${GEMINI_API_URL}/${currentModel}:generateContent?key=${apiKey}`,
                {
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: mimeType, data: base64Data } }
                            ]
                        }
                    ],
                    generationConfig: {
                        response_mime_type: 'application/json',
                        temperature: 0.1,
                        maxOutputTokens: 2048
                    }
                },
                {
                    timeout: VISION_TIMEOUT_MS,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const parts = response.data?.candidates?.[0]?.content?.parts || [];
            let rawText = parts.map(p => p.text || '').join('').trim();
            if (!rawText) continue;

            // Tách JSON an toàn phòng khi model bọc trong ```json ... ``` hoặc có lời dẫn
            rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) continue;

            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed && typeof parsed.status === 'string') {
                return {
                    ok: true,
                    model: currentModel,
                    parsed
                };
            }
        } catch (err) {
            const status = err.response?.status;
            markModelCooldown(currentModel, status);
            console.warn(`[aiModelService Vision] Model ${currentModel} failed (status=${status || 'timeout'}): ${err.message}`);
        }
    }

    return { ok: false, reason: 'all_vision_models_failed' };
}

/**
 * Tạo câu trả lời tư vấn có kiểm chứng từ catalog + Multi-Source RAG + 3-Tier Memory
 */
async function generateGroundedConsultation({
    userMessage,
    dialogueAct = 'recommend',
    verifiedProducts = [],
    context = {},
    fallbackText = ''
}) {
    if (!isApiKeyConfigured()) {
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: 'none',
            note: 'Chế độ công cụ tri thức xác định (chưa cấu hình GEMINI_API_KEY ở backend)'
        };
    }

    const catalogContextText = verifiedProducts.map((p, idx) => formatVerifiedProduct(p, idx)).join('\n\n');
    const longTermMemoryText = formatLongTermMemoryBlock(context);
    const ragEvidenceText = context.ragEvidenceText || '';

    let actSpecificInstruction = '';
    if (dialogueAct === 'compare') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (SO SÁNH SẢN PHẨM):
- Mở đầu bằng 1 - 2 câu dẫn nhập ngắn gọn, tự nhiên (không dùng gạch đầu dòng ở đoạn mở đầu), sau đó BẮT BUỘC in nguyên văn dòng tiêu đề:
  ⚖️ **BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT & GIÁ BÁN THỰC TẾ**
- Tiếp theo kẻ bảng chuẩn Markdown Table (| Tiêu chí so sánh | Tên Máy 1 | Tên Máy 2 | và dòng | :--- | :--- | :--- |) dùng đúng số liệu thực tế.
- Sau bảng, BẮT BUỘC dùng dòng tiêu đề in hoa:
  🔍 **PHÂN TÍCH ĐÁNH ĐỔI & ĐIỂM KHÁC BIỆT:**
  và đưa ra "**KẾT LUẬN CHỌN MUA RÕ RÀNG**".`;
    } else if (dialogueAct === 'product_qa') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TRẢ LỜI TRỰC DIỆN CÂU HỎI KỸ THUẬT / ĐỘ BỀN / CHI TIẾT VỀ SẢN PHẨM ĐANG XEM):
- Trả lời THẲNG và CHÍNH XÁC ngay ở 1–2 câu đầu tiên vào đúng câu hỏi cụ thể của khách hàng ("${userMessage}"), tuyệt đối KHÔNG nói chung chung né câu hỏi hoặc lặp lại nguyên bài giới thiệu quảng cáo dài dòng!
- Đối chiếu kỹ [DỮ LIỆU CATALOG XÁC MINH] và [DỮ LIỆU TRI THỨC RAG CỬA HÀNG]:
  + Nếu khách hỏi một thông số kỹ thuật sâu mà nhà sản xuất KHÔNG công bố định mức chính thức bằng con số (ví dụ: số vòng quay tối đa của con lăn chuột, số lần gập/mở chính xác của bản lề laptop phổ thông, số lần cắm rút cổng...), BẮT BUỘC phải nói rõ trung thực rằng nhà sản xuất không công bố định mức con số đó (tuyệt đối KHÔNG tự bịa ra con số), đồng thời giải thích cơ chế cấu tạo thực tế của linh kiện đó và cung cấp các thông số độ bền được hãng công bố liên quan (ví dụ: độ bền switch phím nhấn, chất liệu feet, cảm biến/IPS, độ bền pin sạc, chuẩn kháng nước IP...).
  + Giải thích dễ hiểu bằng tiếng Việt về tuổi thọ sử dụng thực tế nhiều năm, mẹo giữ bền và chính sách bảo hành chính hãng / lỗi 1 đổi 1 trong 30 ngày tại cửa hàng em.
- Độ dài súc tích 120–240 từ, kết thúc bằng 1 câu gợi mở thân thiện.`;
    } else if (dialogueAct === 'exact_lookup') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TƯ VẤN CHUYÊN SÂU & THUYẾT PHỤC VỀ SẢN PHẨM):
- Mở đầu bằng 1 - 2 câu trả lời trực tiếp, tự nhiên và giàu tính thuyết phục vào câu hỏi của khách hàng ("${userMessage}").
- Tiếp theo, phân tích bằng gạch đầu dòng rõ ràng:
  + **Ưu điểm & Hiệu năng thực tế**: Chip/cảm biến, màn hình, pin hoặc tính năng cốt lõi mang lại trải nghiệm mượt mà 4 - 5 năm ra sao.
  + **Đối tượng & Nhu cầu phù hợp**: Thích hợp cho ai, công việc/tác vụ gì.
  + **Quyền lợi & Giá trị đầu tư**: Giá bán ưu đãi, trả góp 0%, mã giảm giá (nếu có trong dữ liệu RAG) và bảo hành 1 đổi 1 trong 30 ngày.
  + **Đánh giá khách quan**: Điểm đánh đổi chân thực để khách an tâm quyết định.
- Kết luận bằng câu gợi mở thân thiện.`;
    } else if (dialogueAct === 'nearest_budget_recommend' || context.isNearestMatch) {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TƯ VẤN SẢN PHẨM CÓ GIÁ GẦN NHẤT KHI KHÔNG CÓ GIÁ KHÁCH HỎI):
- Mở đầu bằng sự đồng cảm, giải thích chân thành rằng máy mới chính hãng trong danh mục hiện có giá khởi điểm cao hơn con số khách dự kiến ("${userMessage}").
- Khẳng định em xin phép **hiển thị các mẫu máy có mức giá gần bằng và tối ưu nhất** hiện có tại cửa hàng.
- Dùng danh sách đánh số trình bày từng máy: tên máy, giá thực tế, cấu hình nổi bật và phương án trả góp 0% (trả trước 30%).`;
    } else if (dialogueAct === 'rag_consultative') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TƯ VẤN CHUYÊN SÂU ĐA NGUỒN RAG & TRÍ NHỚ):
- Kết hợp linh hoạt [BỘ NHỚ NGƯỜI DÙNG & PHIÊN CHAT], [DỮ LIỆU TRI THỨC RAG CỬA HÀNG] và [DỮ LIỆU CATALOG XÁC MINH] để giải đáp trọn vẹn mọi thắc mắc của khách hàng ("${userMessage}").
- Nếu khách hỏi về kinh nghiệm chọn mua, tương thích hệ sinh thái, chính sách hay câu hỏi tình huống thực tế -> giải thích rõ ràng, chuyên nghiệp như chuyên gia phần cứng có tâm, đồng thời gắn kết khéo léo tới sản phẩm phù hợp nhất trong catalog (nếu có).
- Mở đầu bằng 1-2 câu dẫn nhập súc tích (tránh gạch đầu dòng ở câu đầu), sau đó phân tích bằng các gạch đầu dòng ngắn gọn dễ đọc.`;
    } else {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (ĐỀ XUẤT & TƯ VẤN THEO NHU CẦU):
- Mở đầu bằng 1 - 2 đoạn văn ngắn gọn, thân thiện (không dùng số thứ tự hay gạch đầu dòng ở đoạn mở đầu) dẫn dắt vào nhu cầu/ngân sách của khách hàng.
- Tiếp theo, xuống dòng dùng danh sách đánh số (1., 2., 3.) và gạch đầu dòng trình bày từng sản phẩm, phân tích rõ ưu điểm nổi bật và "**Điểm đánh đổi**".
- Phần cuối bắt buộc có tiêu đề "**GỢI Ý QUYẾT ĐỊNH CHO BẠN:**" đưa ra lời khuyên có điều kiện rõ ràng (Nếu ưu tiên A -> Chọn Máy 1; Nếu ưu tiên B -> Chọn Máy 2).`;
    }

    const systemInstruction = `Bạn là Nhân viên Tư vấn Công nghệ giỏi nghề, tận tâm và giàu kinh nghiệm thực tế đứng tại showroom (AI Senior Store Consultant). Luôn gọi cửa hàng bằng tiếng Việt tự nhiên như 'cửa hàng em', 'shop em', 'bên em'. Tuyệt đối KHÔNG dùng từ tiếng Anh 'TechEcommerce' trong câu trả lời khách hàng.
THÔNG TIN CỐ ĐỊNH CỦA CỬA HÀNG:
• Showroom: 78 Nguyễn Văn Khối, Quận Gò Vấp, TP.HCM (Mở cửa 08:30 – 21:30 hàng ngày). Hotline/Zalo: 0842.331.606.
• Cam kết & Dịch vụ: 100% hàng mới nguyên seal (mã VN/A với Apple), lỗi 1 đổi 1 trong 30 ngày, bảo hành chính hãng 12–24 tháng, giao hỏa tốc 2H nội thành, đồng kiểm mở hộp COD, xuất hóa đơn VAT, trả góp 0% qua thẻ tín dụng hoặc CCCD, chuyển dữ liệu Zalo/ảnh & cài app miễn phí, gói quà tặng miễn phí, giữ máy showroom 24h không cọc.

NGUYÊN TẮC CỐT LÕI BẮT BUỘC:
1. CHỈ ĐƯỢC PHÉP sử dụng tên sản phẩm, giá bán, tồn kho, mã giảm giá và thông số kỹ thuật có trong [DỮ LIỆU CATALOG XÁC MINH] và [DỮ LIỆU TRI THỨC RAG CỬA HÀNG].
2. TUYỆT ĐỐI KHÔNG tự bịa sản phẩm ngoài danh sách, không bịa mã giảm giá hay thông số sai lệch.
3. Tận dụng triệt để [BỘ NHỚ DÀI HẠN CỦA KHÁCH HÀNG] + lịch sử nhiều lượt: nhớ khách mua cho ai (buyingFor), làm nghề gì (occupationOrRole), đang sở hữu máy gì (ownedDevices), từng băn khoăn gì (objectionsRaised), mẫu từng ưng (shortlistedProducts), hãng không thích (dislikedBrands), hoặc hỏi tiếp về "con đầu / mẫu 2 / ảnh vừa gửi". Tuyệt đối KHÔNG tự bịa/gán ghép nghề nghiệp cho khách nếu khách chưa tự nói.
4. Tư vấn có tâm như nhân viên thực thụ: quy đổi thông số thành lợi ích đời thực (độ sáng đi nắng, trọng lượng bỏ cốp xe/balo, FPS game, độ bền 4–5 năm, chống mỏi mắt), nói thật cả điểm mạnh lẫn đánh đổi, nhắc dịch vụ miễn phí phù hợp hoàn cảnh (chuyển dữ liệu, gói quà, trả góp, hỏa tốc 2H).
5. Quy tắc xưng hô nhất quán: Luôn xưng là "em" và gọi khách hàng là "bạn" (hoặc "anh/chị" nếu khách tự xưng anh/chị). Tuyệt đối KHÔNG xưng "mình", "tụi mình", "chúng mình".
6. Trình bày tiếng Việt chuẩn, có emoji tinh tế, in đậm **tên máy**, **giá tiền**, độ dài khoảng 160–340 từ trọn vẹn câu.

${actSpecificInstruction}`;

    const userPrompt = `[BỘ NHỚ DÀI HẠN & HỒ SƠ KHÁCH HÀNG]:
${longTermMemoryText}

[BỐI CẢNH HIỆN TẠI]:
- Danh mục đang xem: ${context.category || context.pageCategory || 'Tất cả danh mục'}
- Ngân sách dự kiến: ${context.budget ? `${Number(context.budget).toLocaleString('vi-VN')} đ (${context.budgetType === 'hard' ? 'Ngân sách cứng tối đa' : 'Linh hoạt'})` : 'Chưa giới hạn'}
- Nhu cầu / Mục đích chính: ${context.useCase || context.major || 'Đang tìm hiểu'}
- Tiêu chí ưu tiên: ${context.preference || context.priority || 'Cân bằng hiệu năng & độ bền'}
- Thương hiệu yêu thích: ${context.brand || 'Mọi thương hiệu chính hãng'}
- Hành động đối thoại: ${dialogueAct}

${ragEvidenceText ? `[DỮ LIỆU TRI THỨC RAG & ƯU ĐÃI TỪ CỬA HÀNG]:\n${ragEvidenceText}\n\n` : ''}[DỮ LIỆU CATALOG XÁC MINH TỪ MONGODB]:
${catalogContextText || 'Không có sản phẩm cụ thể đính kèm.'}

[CÂU HỎI HIỆN TẠI CỦA KHÁCH HÀNG]:
"${userMessage}"

Hãy trả lời chuyên nghiệp, tận tâm, bám sát trí nhớ và dữ liệu xác minh ở trên:`;

    const aiResult = await callGeminiText({
        systemInstruction,
        history: context.conversationHistory || [],
        userPrompt,
        temperature: 0.35,
        maxOutputTokens: 2800
    });

    if (aiResult.text) {
        let finalReply = aiResult.text;

        // Structural completeness guards: ensure rich AI replies preserve exact comparison tables,
        // trade-off/decision sections, and verified model prices/names when applicable.
        if (dialogueAct === 'compare' && fallbackText) {
            const hasTable = /\|[\s\S]*\|/.test(finalReply);
            const hasCompareTitle = finalReply.includes('BẢNG SO SÁNH THÔNG SỐ');
            const hasTradeoffTitle = finalReply.includes('ĐÁNH ĐỔI');
            if (!hasTable || !hasCompareTitle || !hasTradeoffTitle) {
                finalReply = fallbackText;
            }
        } else if (dialogueAct === 'recommend' && fallbackText) {
            if (!/điểm đánh đổi/i.test(finalReply) && /điểm đánh đổi/i.test(fallbackText)) {
                finalReply = `${finalReply}\n\n• **Điểm đánh đổi cần cân nhắc:** Nếu ưu tiên hiệu năng tối đa -> chọn cấu hình cao hơn; nếu ưu tiên tối ưu ngân sách và sự gọn nhẹ -> chọn phương án kinh tế hơn.`;
            }
            if (!/GỢI Ý QUYẾT ĐỊNH/i.test(finalReply) && Array.isArray(verifiedProducts) && verifiedProducts.length >= 2) {
                finalReply = `${finalReply}\n\n📌 **GỢI Ý QUYẾT ĐỊNH:**\n• Nếu bạn ưu tiên **${verifiedProducts[0].name}** với cấu hình nổi bật -> hãy chọn ngay mẫu này.\n• Nếu bạn muốn **tối ưu chi phí hoặc cân bằng nhu cầu** -> **${verifiedProducts[1].name}** là lựa chọn rất đáng cân nhắc.`;
            }
        } else if (dialogueAct === 'exact_lookup' && Array.isArray(verifiedProducts) && verifiedProducts.length === 1 && fallbackText) {
            const targetName = verifiedProducts[0].name || '';
            const modelPrefix = targetName.split(/\s+/).slice(0, 3).join(' ');
            if (modelPrefix && !finalReply.toLowerCase().includes(modelPrefix.toLowerCase())) {
                finalReply = fallbackText;
            } else if (!/giá/i.test(finalReply)) {
                finalReply = `${finalReply}\n\n• 💰 **Giá bán hiện tại:** **${Number(verifiedProducts[0].price || 0).toLocaleString('vi-VN')} ₫**`;
            }
        } else if ((dialogueAct === 'nearest_budget_recommend' || context.isNearestMatch) && Array.isArray(verifiedProducts) && verifiedProducts.length > 0 && fallbackText) {
            const targetProd = verifiedProducts[0];
            const exactDotPrice = Number(targetProd.price || 0).toLocaleString('de-DE');
            const hasNameOrPrice = finalReply.includes(targetProd.name) || finalReply.includes(exactDotPrice);
            const hasInstallmentOrSeal = /(trả góp|góp 0%|nguyên seal)/i.test(finalReply);
            if (!hasNameOrPrice || !hasInstallmentOrSeal) {
                finalReply = fallbackText;
            }
        }

        return {
            reply: finalReply,
            provider: 'gemini',
            isFallback: false,
            model: aiResult.model
        };
    }

    return {
        reply: fallbackText,
        provider: 'deterministic_engine',
        isFallback: true,
        model: aiResult.model || DEFAULT_MODEL,
        note: 'Model Gemini tạm thời bận, chuyển sang engine xác định an toàn'
    };
}

/**
 * Tạo câu trả lời tự nhiên, hóm hỉnh cho câu hỏi giao lưu, hỏi vui, toán học,
 * hoặc câu hỏi đa dạng ngoài khung kịch bản cứng (vẫn kèm Bộ nhớ & Tri thức cửa hàng!).
 */
async function generateConversationalResponse({
    userMessage,
    context = {},
    fallbackText = ''
}) {
    if (!isApiKeyConfigured()) {
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: 'none'
        };
    }

    const longTermMemoryText = formatLongTermMemoryBlock(context);
    const ragEvidenceText = context.ragEvidenceText || '';

    const systemInstruction = `Bạn là Nhân viên Tư vấn Công nghệ giỏi nghề, tận tâm và giàu kinh nghiệm thực chiến đứng trực tiếp tại cửa hàng (AI Senior Store Consultant). Luôn gọi cửa hàng bằng tiếng Việt tự nhiên như 'cửa hàng em', 'shop em', 'bên em'. Tuyệt đối KHÔNG dùng từ 'TechEcommerce' trong câu trả lời khách hàng.
THÔNG TIN CỐ ĐỊNH CỦA CỬA HÀNG:
• Showroom: 78 Nguyễn Văn Khối, Quận Gò Vấp, TP.HCM (Mở cửa 08:30 – 21:30 hàng ngày). Hotline/Zalo: 0842.331.606.
• Cam kết: 100% hàng mới chính hãng nguyên seal (mã VN/A với Apple), lỗi 1 đổi 1 trong 30 ngày, bảo hành chính hãng 12–24 tháng, hỗ trợ chuyển dữ liệu & cài app miễn phí tại quầy hoặc từ xa.

PHONG CÁCH TƯ VẤN NHƯ NHÂN VIÊN THẬT TẠI QUẦY:
1. Lắng nghe & thấu hiểu cảm xúc thật của khách hàng từ [BỘ NHỚ DÀI HẠN] (mua tặng ai, từng băn khoăn giá/độ bền, cần gấp, đang dùng máy gì) trước khi tư vấn.
2. Tư vấn có tâm — nói rõ ưu điểm VÀ điểm cân nhắc để khách thấy đáng tin, tuyệt đối không ép mua hay văn mẫu sáo rỗng.
3. Chủ động nhắc dịch vụ gia tăng thiết thực khi đúng tình huống (chuyển danh bạ Zalo miễn phí, gói quà tặng kèm thiệp, giữ hàng showroom 24h, trả góp 0% thẻ/CCCD, xuất VAT).
4. Khi khách hỏi vui, đố mẹo, hỏi toán: đối đáp thông minh, dí dỏm rồi nhẹ nhàng quay lại hỗ trợ nếu khách cần.
5. Luôn xưng "em", gọi khách là "bạn" (hoặc "anh/chị" nếu khách xưng tương ứng). Chỉ nêu tên máy, giá tiền và mã giảm giá có trong [DỮ LIỆU] / [TRI THỨC RAG]. Trả lời súc tích, dễ đọc.`;

    const userPrompt = `[BỘ NHỚ DÀI HẠN]:
${longTermMemoryText}

${ragEvidenceText ? `[TRI THỨC RAG CỬA HÀNG]:\n${ragEvidenceText}\n\n` : ''}[NGỮ CẢNH TRANG HIỆN TẠI]:
- Khách đang xem: ${context.pageCategory || context.category || 'Trang chủ cửa hàng'}
${context.pageProductId ? `- Mã sản phẩm đang xem: ${context.pageProductId}` : ''}

[TIN NHẮN CỦA KHÁCH HÀNG]:
"${userMessage}"

Hãy phản hồi tự nhiên, thông minh và hữu ích nhất:`;

    const aiResult = await callGeminiText({
        systemInstruction,
        history: context.conversationHistory || [],
        userPrompt,
        temperature: 0.65,
        maxOutputTokens: 2400
    });

    if (aiResult.text) {
        return {
            reply: aiResult.text,
            provider: 'gemini',
            isFallback: false,
            model: aiResult.model
        };
    }

    return {
        reply: fallbackText,
        provider: 'deterministic_engine',
        isFallback: true,
        model: 'none'
    };
}

module.exports = {
    TEXT_CHAT_MODELS,
    NLU_MODELS,
    VISION_MODELS,
    MAX_HISTORY_TURNS,
    isApiKeyConfigured,
    callGeminiText,
    understandCustomerQuery,
    analyzeProductImage,
    generateGroundedConsultation,
    generateConversationalResponse,
    getAiServiceStatus
};
