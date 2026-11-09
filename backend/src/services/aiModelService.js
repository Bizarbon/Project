/**
 * aiModelService.js
 * Dịch vụ tích hợp mô hình AI ngôn ngữ lớn (Google Gemini API - Smart Consultant 2.0).
 * 
 * Kiến trúc tách bạch & nâng cấp:
 * 1. Chuỗi Model thông minh (Multi-Model Failover Chain) + Circuit Breaker chống trễ khi 429/404.
 * 2. Bộ nhớ hội thoại đa lượt (Multi-turn Conversation History) giúp AI hiểu ngữ cảnh liền mạch.
 * 3. Nạp 100% thông số kỹ thuật (CPU, GPU, RAM, SSD, Màn hình, Pin, Camera, Trọng lượng, Trả góp 0%).
 * 4. Fallback minh bạch: Nếu không cấu hình GEMINI_API_KEY hoặc xảy ra lỗi mạng/timeout,
 *    hệ thống chuyển sang bộ luật tri thức xác định (deterministic engine).
 */

const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const CANDIDATE_MODELS = Array.from(new Set([
    DEFAULT_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-flash-latest'
]));
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000);

// Bộ nhớ tạm đánh dấu các model đang bị giới hạn quota (429) hoặc không tồn tại (404)
// để các lượt chat tiếp theo chuyển nhánh tức thì (0ms) mà không phải chờ timeout.
const modelCooldownUntil = new Map();

function isModelAvailable(modelName) {
    const until = modelCooldownUntil.get(modelName);
    if (!until) return true;
    if (Date.now() >= until) {
        modelCooldownUntil.delete(modelName);
        return true;
    }
    return false;
}

function markModelCooldown(modelName, status) {
    // 404: model không khả dụng -> khóa 30 phút; 429: quá tải quota -> khóa 90 giây; lỗi khác -> 20 giây
    const durationMs = status === 404 ? 30 * 60 * 1000 : (status === 429 ? 90 * 1000 : 20 * 1000);
    modelCooldownUntil.set(modelName, Date.now() + durationMs);
}

/**
 * Kiểm tra trạng thái sẵn sàng của dịch vụ AI
 */
function getAiServiceStatus() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const hasKey = Boolean(apiKey.trim() && apiKey !== 'your_gemini_api_key_here');
    const activeModels = CANDIDATE_MODELS.filter(isModelAvailable);
    return {
        configured: hasKey,
        provider: hasKey ? 'gemini' : 'deterministic_engine',
        model: hasKey ? (activeModels[0] || DEFAULT_MODEL) : 'none',
        candidateModels: CANDIDATE_MODELS,
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

    // Bổ sung các trường thông số mở rộng khác nếu có trong object specs
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
        .slice(0, 260);

    return `[Sản phẩm ${idx + 1}: ${p.name}]
- Thương hiệu: ${p.brand || 'Chính hãng'} | Danh mục: ${p.category || 'Công nghệ'}
- Giá bán niêm yết: ${price.toLocaleString('vi-VN')} đ${discountAmount > 0 ? ` (Giá gốc: ${compareAtPrice.toLocaleString('vi-VN')} đ - Đang tiết kiệm: ${discountAmount.toLocaleString('vi-VN')} đ)` : ''}
- Trả góp 0% ước tính: Trả trước 30% (~${downPayment30.toLocaleString('vi-VN')} đ), góp 12 tháng chỉ ~${monthly12.toLocaleString('vi-VN')} đ/tháng
- Tồn kho thực tế: ${p.stock > 0 ? `Sẵn hàng (${p.stock} sản phẩm nguyên seal)` : 'Tạm hết hàng (Hỗ trợ đặt trước)'}
- Đánh giá khách hàng: ${p.rating ? `${p.rating}/5 sao` : '5/5 sao'}${p.soldCount ? ` (${p.soldCount} đã bán)` : ''}
- Thông số kỹ thuật chi tiết: ${specLines.length > 0 ? specLines.join(' | ') : 'Tiêu chuẩn chính hãng'}
- Điểm nổi bật / Mô tả: ${cleanDesc || 'Sản phẩm chính hãng nguyên seal, hiệu năng ổn định.'}
- Chính sách bảo hành: ${p.warranty || 'Bảo hành chính hãng 12 - 24 tháng, lỗi 1 đổi 1 trong 30 ngày đầu'}`;
}

/**
 * Định dạng lịch sử hội thoại gần nhất để AI hiểu mạch câu chuyện (Multi-turn Context)
 */
function formatConversationHistory(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return 'Chưa có lịch sử trước đó (đây là câu hỏi mở đầu).';
    }
    return history
        .slice(-6)
        .filter(item => item && item.text)
        .map(item => {
            const speaker = item.role === 'user' ? 'Khách hàng' : 'Trợ lý AI';
            const cleanText = String(item.text).replace(/\s+/g, ' ').trim().slice(0, 320);
            return `- ${speaker}: "${cleanText}"`;
        })
        .join('\n');
}

/**
 * Tạo câu trả lời tư vấn có kiểm chứng từ catalog
 * @param {Object} params
 * @param {string} params.userMessage - Câu hỏi của khách hàng
 * @param {string} params.dialogueAct - Loại hành động đối thoại (recommend, clarify, compare, exact_lookup, product_qa, price_objection)
 * @param {Array} params.verifiedProducts - Danh sách sản phẩm thực tế từ MongoDB
 * @param {Object} params.context - Bối cảnh cuộc trò chuyện hiện tại
 * @param {string} params.fallbackText - Câu trả lời mẫu xác định từ consultationCoordinator
 * @returns {Promise<{ reply: string, provider: string, isFallback: boolean, model: string, error?: string }>}
 */
async function generateGroundedConsultation({
    userMessage,
    dialogueAct = 'recommend',
    verifiedProducts = [],
    context = {},
    fallbackText = ''
}) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const isKeyConfigured = Boolean(apiKey && apiKey !== 'your_gemini_api_key_here');

    // Nếu không có khóa API: Chạy deterministic engine minh bạch
    if (!isKeyConfigured) {
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: 'none',
            note: 'Chế độ công cụ tri thức xác định (chưa cấu hình GEMINI_API_KEY ở backend)'
        };
    }

    const catalogContextText = verifiedProducts.map((p, idx) => formatVerifiedProduct(p, idx)).join('\n\n');
    const historyText = formatConversationHistory(context.conversationHistory);

    let actSpecificInstruction = '';
    if (dialogueAct === 'compare') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (SO SÁNH SẢN PHẨM):
- Mở đầu bằng 1 - 2 câu dẫn nhập ngắn gọn, tự nhiên (không dùng gạch đầu dòng ở đoạn mở đầu này) để hệ thống phát giọng nói cho khách, sau đó xuống dòng kẻ bảng so sánh chuẩn Markdown Table (| Tiêu chí | Tên Máy 1 | Tên Máy 2 | và dòng phân cách | :--- | :--- | :--- |).
- Sau bảng, phân tích sâu "ĐIỂM ĐƯỢC & ĐIỂM ĐÁNH ĐỔI" thực tế bằng gạch đầu dòng và đưa ra "KẾT LUẬN CHỌN MUA RÕ RÀNG".`;
    } else if (dialogueAct === 'exact_lookup' || dialogueAct === 'product_qa') {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TƯ VẤN CHUYÊN SÂU & THUYẾT PHỤC VỀ SẢN PHẨM):
- Mở đầu bằng 1 - 2 câu trả lời trực tiếp, tự nhiên và giàu tính thuyết phục vào câu hỏi của khách hàng ("${userMessage}"). Nêu bật lý do sản phẩm này rất đáng sở hữu hoặc điểm sáng nổi trội nhất trong phân khúc.
- Tiếp theo, phân tích bằng gạch đầu dòng rõ ràng:
  + **Ưu điểm & Hiệu năng thực tế**: Chip xử lý, màn hình, RAM, pin mang lại trải nghiệm mượt mà, bền bỉ 4 - 5 năm ra sao.
  + **Đối tượng & Nhu cầu phù hợp**: Rất thích hợp cho ai (học tập, làm việc, ghi chú, giải trí, đồ họa, chơi game...).
  + **Quyền lợi & Giá trị đầu tư**: Nêu bật giá bán ưu đãi, chương trình trả góp 0%, quà tặng hoặc chính sách bảo hành chính hãng lỗi 1 đổi 1 trong 30 ngày.
  + **Đánh giá khách quan**: Điểm cần lưu ý chân thực để khách an tâm ra quyết định.
- Kết luận bằng câu gợi mở thân thiện xem khách có muốn xem màu sắc sẵn có, phụ kiện kèm hoặc tính chi tiết bảng góp 0% không.`;
    } else if (dialogueAct === 'nearest_budget_recommend' || context.isNearestMatch) {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (TƯ VẤN SẢN PHẨM CÓ GIÁ GẦN NHẤT KHI KHÔNG CÓ GIÁ KHÁCH HỎI):
- Mở đầu bằng sự đồng cảm và giải thích chân thành rằng các dòng sản phẩm mới chính hãng trong danh mục hiện tại có giá khởi điểm cao hơn con số khách dự kiến ("${userMessage}").
- Khẳng định rõ ràng: Em xin phép **hiển thị ngay trên trang sản phẩm có mức giá gần bằng và tốt nhất** hiện có sẵn tại cửa hàng để bạn tiện quan sát và cân nhắc.
- Xuống dòng dùng danh sách đánh số trình bày chi tiết sản phẩm được đề xuất: tên máy, giá bán thực tế, cấu hình nổi bật và lý do máy này tối ưu nhất cho chi phí.
- Gợi ý giải pháp tài chính linh hoạt như Trả góp 0% lãi suất (chỉ cần trả trước 30%) hoặc áp mã giảm giá để khách dễ dàng sở hữu.`;
    } else {
        actSpecificInstruction = `NHIỆM VỤ CỤ THỂ (ĐỀ XUẤT & TƯ VẤN THEO NHU CẦU):
- Mở đầu bằng 1 - 2 đoạn văn ngắn gọn, thân thiện (không dùng số thứ tự hay gạch đầu dòng ở đoạn mở đầu) dẫn dắt vào nhu cầu/ngân sách của khách hàng để hệ thống đọc giọng nói.
- Tiếp theo, xuống dòng dùng danh sách đánh số (1., 2., 3.) và gạch đầu dòng để trình bày từng sản phẩm, phân tích rõ ưu điểm nổi bật và "Điểm đánh đổi" để khách hàng quan sát trên màn hình.
- Ở phần cuối, bắt buộc có tiêu đề "**GỢI Ý QUYẾT ĐỊNH CHO BẠN:**" đưa ra lời khuyên chọn mua có điều kiện rõ ràng (Ví dụ: Nếu bạn ưu tiên... -> Chọn Máy 1; Nếu bạn ưu tiên... -> Chọn Máy 2) để khách hàng dễ dàng ra quyết định.`;
    }

    const systemInstruction = `Bạn là Chuyên gia Tư vấn Mua sắm Công nghệ cấp cao (AI Smart Consultant) của hệ thống bán lẻ TechEcommerce.
Phong cách của bạn: Thông minh, am hiểu sâu sắc phần cứng công nghệ, tận tâm, trung thực, nói chuyện tự nhiên và cuốn hút như một chuyên viên tư vấn thực thụ.

NGUYÊN TẮC CỐT LÕI BẮT BUỘC:
1. CHỈ ĐƯỢC PHÉP sử dụng tên sản phẩm, giá bán, tồn kho và thông số kỹ thuật có trong mục [DỮ LIỆU CATALOG XÁC MINH].
2. TUYỆT ĐỐI KHÔNG tự bịa ra sản phẩm ngoài danh sách, không tự chế giá bán hay tồn kho sai lệch.
3. Khi giải thích cấu hình (CPU, GPU, RAM, màn hình, pin...), hãy quy đổi sang trải nghiệm thực tế dễ hiểu cho khách hàng (học tập, code, đồ họa, FPS khi chơi game, độ bền 4-5 năm, mang đi lại...).
4. Bám sát [LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY] để hiểu mạch hội thoại và các đại từ quy chiếu ("máy này", "mẫu trên", "con thứ 2", "còn pin thì sao"...).
5. Trình bày bằng tiếng Việt tự nhiên, rõ ràng, có điểm nhấn (in đậm **tên máy**, **giá tiền**), sử dụng gạch đầu dòng gọn gàng và emoji tinh tế. Độ dài khoảng 180 - 350 từ, hoàn chỉnh trọn vẹn câu.
6. Quy tắc xưng hô nhất quán: Luôn xưng là "em" và gọi khách hàng là "bạn" một cách lịch sự, tận tâm và chuyên nghiệp. Tuyệt đối KHÔNG xưng "tụi mình", "chúng mình", không tự xưng "mình".

${actSpecificInstruction}`;

    const promptText = `[LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY]:
${historyText}

[HỒ SƠ & BỐI CẢNH KHÁCH HÀNG]:
- Danh mục đang xem: ${context.category || context.pageCategory || 'Tất cả danh mục'}
- Ngân sách dự kiến: ${context.budget ? `${Number(context.budget).toLocaleString('vi-VN')} đ (${context.budgetType === 'hard' ? 'Ngân sách cứng tối đa' : 'Linh hoạt'})` : 'Chưa giới hạn'}
- Nhu cầu / Mục đích chính: ${context.useCase || context.major || 'Đang tìm hiểu'}
- Tiêu chí ưu tiên: ${context.preference || 'Cân bằng hiệu năng & độ bền'}
- Thương hiệu yêu thích: ${context.brand || 'Mọi thương hiệu chính hãng'}
- Thương hiệu đã loại trừ: ${(context.eliminatedBrands || []).join(', ') || 'Không có'}
- Hành động đối thoại (Dialogue Act): ${dialogueAct}

[DỮ LIỆU CATALOG XÁC MINH TỪ KHO TECHECOMMERCE]:
${catalogContextText || 'Không có sản phẩm nào.'}

[TIN NHẮN HIỆN TẠI CỦA KHÁCH HÀNG]:
"${userMessage}"

Hãy phản hồi khách hàng một cách thông minh, sắc sảo và hữu ích nhất dựa trên dữ liệu thật ở trên:`;

    const availableModels = CANDIDATE_MODELS.filter(isModelAvailable);
    const modelsToTry = availableModels.length > 0 ? availableModels : [DEFAULT_MODEL, 'gemini-flash-lite-latest'];

    for (const currentModel of modelsToTry) {
        try {
            const response = await axios.post(
                `${GEMINI_API_URL}/${currentModel}:generateContent?key=${apiKey}`,
                {
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: `${systemInstruction}\n\n${promptText}` }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.35,
                        topP: 0.88,
                        maxOutputTokens: 2048
                    }
                },
                {
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const candidate = response.data?.candidates?.[0];
            const generatedText = candidate?.content?.parts?.[0]?.text;

            if (generatedText && generatedText.trim()) {
                return {
                    reply: generatedText.trim(),
                    provider: 'gemini',
                    isFallback: false,
                    model: currentModel
                };
            }
        } catch (err) {
            const status = err.response?.status;
            markModelCooldown(currentModel, status);
            console.warn(`[aiModelService] Model ${currentModel} failed (status=${status || 'timeout'}): ${err.message}. Trying next candidate...`);
        }
    }

    return {
        reply: fallbackText,
        provider: 'deterministic_engine',
        isFallback: true,
        model: DEFAULT_MODEL,
        note: 'Tất cả model Gemini đều bận, chuyển sang engine xác định an toàn'
    };
}

/**
 * Tạo câu trả lời tự nhiên, hóm hỉnh cho câu hỏi giao lưu, hỏi vui, toán học,
 * hoặc khi khách hỏi câu khó/lạ/ngoài phạm vi công nghệ.
 */
async function generateConversationalResponse({
    userMessage,
    context = {},
    fallbackText = ''
}) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const isKeyConfigured = Boolean(apiKey && apiKey !== 'your_gemini_api_key_here');

    if (!isKeyConfigured) {
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: 'none'
        };
    }

    const historyText = formatConversationHistory(context.conversationHistory);
    const systemInstruction = `Bạn là Trợ lý AI Mua sắm thông minh, hóm hỉnh và tận tâm của hệ thống bán lẻ công nghệ TechEcommerce.
THÔNG TIN VỀ TECHECOMMERCE:
• Showroom: 135 Nguyễn Thị Thập, P. Tân Hưng, Quận 7, TP.HCM & 78 Thái Hà, P. Trung Liệt, Đống Đa, Hà Nội (Mở cửa 08:30 – 21:30 hàng ngày).
• Hotline tư vấn & kỹ thuật: 0842.331.606 | Zalo: https://zalo.me/0842331606.
• Cam kết: 100% hàng mới chính hãng nguyên seal (mã VN/A với Apple), lỗi 1 đổi 1 trong 30 ngày, bảo hành chính hãng 12 - 24 tháng.
• Dịch vụ: Xuất hóa đơn VAT điện tử công ty, Thu cũ đổi mới trợ giá đến 2.000.000 đ, Trả góp 0% qua thẻ tín dụng và qua CCCD gắn chip (không cần thẻ). Đồng kiểm mở hộp khi nhận hàng. Giao hỏa tốc 2 giờ nội thành.

TÍNH CÁCH VÀ PHONG CÁCH GIAO TIẾP GIỐNG NGƯỜI THẬT:
1. Cực kỳ tự nhiên, hóm hỉnh, ấm áp và gần gũi như một người bạn hoặc chuyên viên tư vấn công nghệ trẻ trung, am hiểu tâm lý khách hàng. Tuyệt đối KHÔNG trả lời máy móc, lặp lại hay spam bán hàng gượng gạo.
2. Khi khách hỏi vui, đố mẹo, hỏi toán, hỏi thăm đời thường (ăn cơm chưa, mệt mỏi, thời tiết, người yêu, cà phê hay trà sữa...): Hãy đối đáp thông minh, dí dỏm, thấu hiểu cảm xúc của khách, sau đó có thể khéo léo dẫn dắt hoặc mở lời sẵn sàng hỗ trợ nếu khách có nhu cầu.
3. Khi khách hỏi mẹo công nghệ (sạc qua đêm, dán cường lực, laptop nóng, chụp màn hình...): Giải thích ngắn gọn, dễ hiểu, thực tế, kèm mẹo hữu ích.
4. Quy tắc xưng hô nhất quán: Luôn xưng là "em" và gọi khách hàng là "bạn" một cách lịch sự, tận tâm và thân thiện. Tuyệt đối KHÔNG xưng "mình", "tụi mình", "chúng mình".
5. Không bịa đặt giá bán hoặc tồn kho nếu không có trong dữ liệu. Sử dụng tiếng Việt chuẩn 100% có dấu, ngắt câu mượt mà, chèn emoji tinh tế. Trả lời súc tích, duyên dáng (từ 2 đến 4 câu).`;

    const promptText = `[LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY]:
${historyText}

[NGỮ CẢNH TRANG HIỆN TẠI]:
- Khách đang xem: ${context.pageCategory || context.category || 'Trang chủ TechEcommerce'}
${context.pageProductId ? `- Mã sản phẩm đang xem: ${context.pageProductId}` : ''}

[TIN NHẮN CỦA KHÁCH HÀNG]:
"${userMessage}"

Hãy phản hồi khách hàng một cách thông minh, tự nhiên, hóm hỉnh và chân thành nhất:`;

    const availableModels = CANDIDATE_MODELS.filter(isModelAvailable);
    const modelsToTry = availableModels.length > 0 ? availableModels : ['gemini-flash-lite-latest'];

    for (const currentModel of modelsToTry) {
        try {
            const response = await axios.post(
                `${GEMINI_API_URL}/${currentModel}:generateContent?key=${apiKey}`,
                {
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: `${systemInstruction}\n\n${promptText}` }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.95,
                        maxOutputTokens: 1024
                    }
                },
                {
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const candidate = response.data?.candidates?.[0];
            const generatedText = candidate?.content?.parts?.[0]?.text;

            if (generatedText && generatedText.trim()) {
                return {
                    reply: generatedText.trim(),
                    provider: 'gemini',
                    isFallback: false,
                    model: currentModel
                };
            }
        } catch (err) {
            const status = err.response?.status;
            markModelCooldown(currentModel, status);
            console.warn(`[aiModelService] Conversational model ${currentModel} failed: ${err.message}`);
        }
    }

    return {
        reply: fallbackText,
        provider: 'deterministic_engine',
        isFallback: true,
        model: 'none'
    };
}

module.exports = {
    generateGroundedConsultation,
    generateConversationalResponse,
    getAiServiceStatus
};
