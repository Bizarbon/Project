/**
 * Module Kiểm soát an toàn Đầu vào & Đầu ra (Guardrails)
 * TechEcommerce NLU System
 */

const { HOTLINE_SUPPORT, ZALO_SUPPORT } = require('./config');
const { maskPII } = require('./masker');

/**
 * Kiểm tra Guardrails TRƯỚC KHI xử lý hoặc gọi Gemini
 * @param {object} params
 * @param {object} params.nluResult - Kết quả từ classifyIntent
 * @param {string} params.rawMessage - Tin nhắn gốc
 * @param {object} params.context - Ngữ cảnh hội thoại
 * @returns {{ intercepted: boolean, action?: string, response?: object } | null}
 */
function applyPreGuardrails({ nluResult, rawMessage, context = {} }) {
    if (!nluResult || !Array.isArray(nluResult.intents)) {
        return null;
    }

    const primaryIntent = nluResult.intents[0];

    // 1. Chặn PROMPT INJECTION / JAILBREAK
    if (nluResult.intents.includes('prompt_injection')) {
        console.warn(`[Guardrails Alert] Phát hiện Prompt Injection từ tin nhắn: "${maskPII(rawMessage)}"`);
        return {
            intercepted: true,
            action: 'block_prompt_injection',
            response: {
                reply: 'Dạ em là Trợ lý AI Mua sắm của TechEcommerce ạ! Em luôn sẵn sàng hỗ trợ bạn tìm kiếm và tư vấn các thiết bị công nghệ chính hãng tốt nhất. Bạn đang cần tìm sản phẩm nào để em giúp nhé! 😊',
                suggestions: ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Máy chơi game', 'Mã giảm giá hôm nay'],
                context: { ...(context || {}), stage: 'safe_redirection' }
            }
        };
    }

    // 2. Chặn KHIẾU NẠI & ĐIỀU HƯỚNG CSKH
    if (primaryIntent === 'complaint') {
        console.warn(`[Guardrails Notice] Chuyển tiếp khiếu nại khách hàng sang hotline: "${maskPII(rawMessage)}"`);
        return {
            intercepted: true,
            action: 'route_to_support',
            response: {
                reply: `Dạ TechEcommerce thành thật xin lỗi vì trải nghiệm chưa trọn vẹn của bạn ạ! 🙏 Để hỗ trợ xử lý vấn đề của bạn nhanh nhất, bạn vui lòng liên hệ trực tiếp hotline CSKH: ${HOTLINE_SUPPORT} (miễn phí) hoặc Zalo hỗ trợ kỹ thuật (${ZALO_SUPPORT}) để chuyên viên xử lý ngay cho bạn nhé!`,
                suggestions: ['Kiểm tra đơn hàng', 'Chính sách bảo hành', 'Gặp tư vấn viên'],
                context: { ...(context || {}), stage: 'support_escalation' }
            }
        };
    }

    // 3. Xử lý MẶT HÀNG NGOÀI DANH MỤC (Out of catalog: Thú cưng / Hamster / Gia dụng / Xe cộ...)
    if (nluResult.entities?.isPetHamster) {
        return {
            intercepted: true,
            action: 'out_of_catalog_pet_hamster',
            response: {
                reply: 'Dạ TechEcommerce là cửa hàng chuyên về thiết bị công nghệ chính hãng nên em chưa có chuột hamster hay thú cưng đâu ạ! 🐹\n\nTuy nhiên, nếu bạn đang cần tìm **chuột máy tính** (chuột văn phòng không dây, chuột gaming) để phục vụ học tập và làm việc thì em luôn có sẵn những mẫu rất xịn nhé!',
                products: [],
                suggestions: ['Chuột gaming Logitech', 'Chuột văn phòng không dây', 'Xem tất cả phụ kiện', 'Mã giảm giá hôm nay'],
                context: {
                    ...(context || {}),
                    stage: 'out_of_catalog_redirect',
                    category: 'Phụ kiện',
                    productType: 'mouse',
                    lastQuestionKey: 'pet_hamster_redirect'
                }
            }
        };
    }

    if (nluResult.intents.includes('out_of_catalog')) {
        return {
            intercepted: true,
            action: 'out_of_catalog_general',
            response: {
                reply: 'Dạ TechEcommerce chỉ chuyên kinh doanh các thiết bị công nghệ chính hãng (Điện thoại, Laptop, Tablet, Phụ kiện, Máy chơi game...) nên em chưa có mặt hàng này đâu ạ! 🙏 Nếu bạn cần tìm thiết bị công nghệ nào thì cứ bảo em nhé.',
                products: [],
                suggestions: ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Xem Phụ kiện công nghệ', 'Mã giảm giá hôm nay'],
                context: {
                    ...(context || {}),
                    stage: 'out_of_catalog_redirect',
                    lastQuestionKey: 'out_of_catalog_general'
                }
            }
        };
    }

    // 4. Xử lý TỪ MƠ HỒ ("chuột" đứng một mình)
    if (nluResult.intents.includes('clarify_ambiguous_mouse') || nluResult.entities?.isAmbiguousMouse) {
        return {
            intercepted: true,
            action: 'clarify_ambiguous_mouse',
            response: {
                reply: 'Dạ bạn đang tìm **chuột máy tính** (như chuột văn phòng không dây hay chuột gaming) để dùng cho máy tính/laptop phải không ạ? Bạn chia sẻ thêm nhu cầu để em gửi mẫu phù hợp nhất nhé! 😊',
                products: [],
                suggestions: ['Chuột văn phòng không dây', 'Chuột gaming Logitech', 'Chuột dưới 1 triệu', 'Tất cả chuột máy tính'],
                context: {
                    ...(context || {}),
                    stage: 'qualifying_needs',
                    category: 'Phụ kiện',
                    productType: 'mouse',
                    lastQuestionKey: 'clarify_ambiguous_mouse'
                }
            }
        };
    }

    // 5. Khóa cờ không cho phép Gemini tự ý hứa giảm giá riêng
    if (nluResult.intents.includes('promotion_negotiation')) {
        context.prohibitUnauthorizedDiscount = true;
    }

    return null;
}

/**
 * Kiểm tra Guardrails SAU KHI Gemini hoặc Coordinator trả về kết quả
 * @param {object} params
 * @param {object} params.response - Phản hồi từ coordinator hoặc Gemini
 * @param {object} params.nluResult - Kết quả NLU
 * @param {object} params.context - Ngữ cảnh hội thoại
 * @returns {object} Phản hồi đã được làm sạch và đảm bảo an toàn
 */
function applyPostGuardrails({ response, nluResult, context = {} }) {
    if (!response || typeof response !== 'object') {
        return response;
    }

    let reply = response.reply || '';
    if (!reply || typeof reply !== 'string') {
        return response;
    }

    // 1. Kiểm tra các cụm từ hứa hẹn giảm giá vô căn cứ của AI
    const dangerousPromises = [
        /(?:mình|em|shop)\s*(?:sẽ|se)?\s*(?:giảm riêng|giam rieng|bớt riêng|bot rieng)\s*(?:cho bạn|cho anh|cho chị|cho em)?/gi,
        /(?:bớt thêm|bot them)\s*(?:cho bạn|cho anh|cho chị)?\s*\d+\s*(?:k|nghìn|triệu|tr|đ)/gi,
        /(?:tặng riêng|tang rieng)\s*(?:bạn|anh|chị)?\s*(?:mã|voucher)\s*\d+%/gi,
        /(?:cam kết 100% còn sẵn hàng|hứa chắc chắn còn hàng)/gi
    ];

    let modified = false;
    for (const pattern of dangerousPromises) {
        if (pattern.test(reply)) {
            console.warn(`[Guardrails Warning] Phát hiện câu hứa hẹn không hợp lệ trong phản hồi AI: ${pattern}`);
            // Làm mềm câu hứa hẹn thành câu thông tin chính sách chuẩn
            reply = reply.replace(pattern, 'Mức giá niêm yết tại TechEcommerce đã là giá ưu đãi tốt nhất thị trường');
            modified = true;
        }
    }

    // 2. Kiểm tra SKU nếu AI nhắc đến mã TECH-XXXXX
    const skuMatches = reply.match(/\bTECH-\d{5}\b/gi) || [];
    if (skuMatches.length > 0) {
        const verifiedSkus = new Set();
        if (Array.isArray(response.products)) {
            response.products.forEach(p => {
                if (p.sku) verifiedSkus.add(String(p.sku).toUpperCase());
                if (Array.isArray(p.variants)) {
                    p.variants.forEach(v => { if (v.sku) verifiedSkus.add(String(v.sku).toUpperCase()); });
                }
            });
        }
        
        for (const sku of skuMatches) {
            const upperSku = sku.toUpperCase();
            if (verifiedSkus.size > 0 && !verifiedSkus.has(upperSku)) {
                console.warn(`[Guardrails Warning] AI nhắc đến SKU không có trong danh sách xác minh: ${upperSku}`);
            }
        }
    }

    if (modified) {
        response.reply = reply;
    }

    return response;
}

module.exports = {
    applyPreGuardrails,
    applyPostGuardrails
};

