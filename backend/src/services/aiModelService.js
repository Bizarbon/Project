/**
 * aiModelService.js
 * Dịch vụ tích hợp mô hình AI ngôn ngữ lớn (Google Gemini API).
 * 
 * Kiến trúc tách bạch:
 * 1. AI Model: Hỗ trợ sinh ngôn ngữ tự nhiên, giải thích thông số cho người không rành kỹ thuật.
 * 2. Backend Coordinator: Quản lý bối cảnh, tracking slot, truy vấn MongoDB, kiểm tra quyền và tham số.
 * 3. Fallback minh bạch: Nếu không cấu hình GEMINI_API_KEY hoặc xảy ra lỗi mạng/timeout,
 *    hệ thống chuyển sang bộ luật tri thức xác định (deterministic engine) và ghi rõ provider thực tế,
 *    tuyệt đối KHÔNG giả vờ đã gọi AI thành công.
 */

const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 8000);

/**
 * Kiểm tra trạng thái sẵn sàng của dịch vụ AI
 */
function getAiServiceStatus() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const hasKey = Boolean(apiKey.trim() && apiKey !== 'your_gemini_api_key_here');
    return {
        configured: hasKey,
        provider: hasKey ? 'gemini' : 'deterministic_engine',
        model: hasKey ? DEFAULT_MODEL : 'none',
        timeoutMs: REQUEST_TIMEOUT_MS
    };
}

/**
 * Tạo câu trả lời tư vấn có kiểm chứng từ catalog
 * @param {Object} params
 * @param {string} params.userMessage - Câu hỏi của khách hàng
 * @param {string} params.dialogueAct - Loại hành động đối thoại (recommend, clarify, compare, exact_lookup)
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

    // Chuẩn bị thông tin sản phẩm thực tế đã xác minh
    const catalogContextText = verifiedProducts.map((p, idx) => {
        const s = p.specs || {};
        return `[Sản phẩm ${idx + 1}]
- Tên: ${p.name}
- Giá bán niêm yết: ${p.price?.toLocaleString('vi-VN')} đ
- Tồn kho thực tế: ${p.stock > 0 ? `${p.stock} máy sẵn sàng` : 'Hết hàng'}
- CPU: ${s.cpu || 'Không có dữ liệu'}
- RAM: ${s.ram || 'Không có dữ liệu'}
- Ổ cứng: ${s.storage || 'Không có dữ liệu'}
- Màn hình: ${s.screen || 'Không có dữ liệu'}
- Trọng lượng: ${s.weight || 'Không có dữ liệu'}
- Bảo hành: ${p.warranty || 'Chính hãng'}`;
    }).join('\n\n');

    const systemInstruction = `Bạn là Trợ lý Tư vấn Mua sắm Công nghệ chuyên nghiệp của cửa hàng.
NGUYÊN TẮC BẮT BUỘC KHÔNG ĐƯỢC VI PHẠM:
1. Bạn CHỈ ĐƯỢC PHÉP nói về các sản phẩm, giá bán, tồn kho và thông số ĐÃ ĐƯỢC CUNG CẤP trong mục [DỮ LIỆU CATALOG XÁC MINH].
2. TUYỆT ĐỐI KHÔNG tự bịa ra giá bán, tồn kho, thời lượng pin, benchmark, hoặc chính sách ưu đãi không có trong dữ liệu.
3. Khi so sánh hoặc đề xuất, phải chỉ rõ:
   - Ưu điểm của từng lựa chọn
   - Điểm phải ĐÁNH ĐỔI (ví dụ: máy hiệu năng cao hơn thì nặng hơn / pin ngắn hơn; máy mỏng nhẹ pin trâu thì không tối ưu đồ họa nặng)
   - Kết luận có điều kiện: "Nếu bạn ưu tiên X thì chọn A, nếu ưu tiên Y thì chọn B".
4. Nếu khách hàng không rành cấu hình, giải thích ngắn gọn, dễ hiểu, tránh thuật ngữ hàn lâm.
5. Không chào lại lặp đi lặp lại nếu đang trong mạch hội thoại.
6. Trả lời bằng tiếng Việt tự nhiên, lịch sự, trọng tâm, không lan man.
7. Khi nhắc đến nơi bán hàng, chỉ xưng là "cửa hàng tụi mình"; không đọc hoặc viết tên thương hiệu hệ thống.`;

    const promptText = `BỐI CẢNH KHÁCH HÀNG:
- Danh mục quan tâm: ${context.category || 'Chưa rõ'}
- Ngân sách: ${context.budget ? `${context.budget.toLocaleString('vi-VN')} đ` : 'Chưa nói'} (Loại: ${context.budgetType || 'mềm'})
- Nhu cầu/ngành học: ${context.useCase || context.major || 'Chưa rõ'}
- Thương hiệu đã loại: ${(context.eliminatedBrands || []).join(', ') || 'Không có'}
- Bước hội thoại: ${dialogueAct}

[DỮ LIỆU CATALOG XÁC MINH]:
${catalogContextText || 'Không có sản phẩm nào.'}

CÂU NÓI CỦA KHÁCH HÀNG:
"${userMessage}"

Hãy viết câu trả lời tư vấn hoàn chỉnh dựa trên dữ liệu thật trên.`;

    try {
        const response = await axios.post(
            `${GEMINI_API_URL}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
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
                    temperature: 0.3,
                    topP: 0.8,
                    maxOutputTokens: 800
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
                model: DEFAULT_MODEL
            };
        }

        // Nếu model trả về rỗng -> dùng fallback
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: DEFAULT_MODEL,
            note: 'Model trả về kết quả rỗng, dùng engine xác định'
        };
    } catch (err) {
        console.warn(`[aiModelService] Gemini call failed: ${err.message}. Safely falling back to deterministic engine.`);
        return {
            reply: fallbackText,
            provider: 'deterministic_engine',
            isFallback: true,
            model: DEFAULT_MODEL,
            error: err.message
        };
    }
}

module.exports = {
    generateGroundedConsultation,
    getAiServiceStatus
};
