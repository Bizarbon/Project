/**
 * agenticChatService.js
 * Động cơ Chatbot LLM-First Agentic thống nhất hỗ trợ đồng thời 2 chế độ:
 * - Chế độ 1 (`open_ai` — AI Toàn năng): Trả lời 100% tự do mọi lĩnh vực như ChatGPT/Gemini/Claude
 *   không bị ràng buộc bởi kịch bản cứng hay Hard-RAG, đồng thời chủ động gọi Tool khi cần dữ liệu cửa hàng.
 * - Chế độ 2 (`tech_advisor` — Chuyên gia Công nghệ & Mua sắm): LLM-First mở rộng không bị gò bó bởi
 *   kịch bản cố định, chuyên sâu về công nghệ/phần cứng/phần mềm/mua sắm và khéo léo tiết kiệm API trước câu hỏi lạc đề dài.
 */

const aiModelService = require('./aiModelService');
const {
    TOOL_DECLARATIONS,
    TOOL_STATUS_LABELS,
    executeAgenticTool
} = require('./agenticTools');

const MAX_TOOL_ROUNDS = 3;

function normalizeMode(rawMode) {
    const val = String(rawMode || '').trim().toLowerCase();
    if (val === 'open_ai' || val === 'open' || val === 'general' || val === 'free') return 'open_ai';
    if (val === 'tech_advisor' || val === 'tech' || val === 'advisor' || val === 'store') return 'tech_advisor';
    return process.env.DEFAULT_CHAT_MODE === 'open_ai' ? 'open_ai' : 'tech_advisor';
}

function buildAgenticSystemPrompt(mode, context = {}) {
    const nowVietnam = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date());
    const currentYear = new Date().getFullYear();

    const softMemoryBlock = aiModelService.formatLongTermMemoryBlock(context);
    const pageInfo = context.pageCategory
        ? `Khách đang mở danh mục "${context.pageCategory}" trên website${context.pageProductId ? ` (đang xem sản phẩm #${context.pageProductId})` : ''}.`
        : (context.pageProductId ? `Khách đang xem trang chi tiết sản phẩm #${context.pageProductId}.` : 'Khách đang ở trang cửa hàng.');

    const storeFacts = `THỜI GIAN THỰC TẾ HIỆN TẠI:
- Hôm nay là **${nowVietnam}** (năm hiện tại là **${currentYear}**). Lưu ý dữ liệu huấn luyện nội tại của bạn có thể cũ hơn ngày hôm nay — KHÔNG BAO GIỜ dựa vào trí nhớ cũ để nói sự kiện năm 2025 hay đầu 2026 là "chưa ra mắt" hoặc khẳng định 1 sản phẩm mới là "không tồn tại"!

THÔNG TIN CỬA HÀNG (chỉ nhắc khi liên quan đến mua sắm/hỗ trợ, không ép chèn vào câu hỏi kiến thức thuần túy):
- Showroom: 78 Nguyễn Văn Khối, Quận Gò Vấp, TP.HCM (08:30 – 21:30 hàng ngày) · Hotline/Zalo: 0842.331.606.
- Phạm vi hàng hóa: Cửa hàng **CHỈ kinh doanh thiết bị PHẦN CỨNG công nghệ chính hãng** thuộc 7 danh mục: Điện thoại, Laptop, Tablet, Tai nghe/Loa, Đồng hồ thông minh, Máy chơi game cầm tay/Console (Nintendo Switch, PS5, ROG Ally, MSI Claw, Legion Go...), và Phụ kiện. **TUYỆT ĐỐI KHÔNG bịa rằng cửa hàng bán băng/thẻ/đĩa game lẻ (như băng Pokémon, đĩa GTA 6...), phần mềm bản quyền lẻ, thú bông hay đồ chơi!** Khi khách hỏi mua tựa game (Pokémon, GTA 6, Zelda...), nói rõ shop không bán băng/đĩa game lẻ mà chỉ bán **máy chơi game chính hãng** để chơi tựa game đó.
- Cam kết: 100% hàng mới chính hãng nguyên seal, lỗi 1 đổi 1 trong 30 ngày, bảo hành chính hãng 12–24 tháng, giao hỏa tốc 2H nội thành TP.HCM, hỗ trợ trả góp 0% (thẻ tín dụng / CCCD), xuất hóa đơn VAT điện tử.
- Tuyệt đối gọi cửa hàng bằng tiếng Việt tự nhiên ("cửa hàng em", "shop em", "bên em"), KHÔNG lặp từ "TechEcommerce". Luôn xưng "em", gọi khách là "bạn" (tuyệt đối không xưng "mình", "tụi mình", "chúng mình").`;

    const toolRules = `NGUYÊN TẮC 2 VÙNG TRI THỨC & SỬ DỤNG CÔNG CỤ (TOOLS):
1. VÙNG TRI THỨC MỞ & CẬP NHẬT THỜI GIAN THỰC (KHÔNG BỊ RÀNG BUỘC BỞI RAG):
   - Bạn hoàn toàn tự do dùng trí tuệ và kiến thức nền sâu rộng của mình để trả lời cặn kẽ, sắc sảo mọi câu hỏi giải thích kỹ thuật, nguyên lý hoạt động, tư vấn thực chiến, so sánh công nghệ, khắc phục lỗi...
   - **QUY TẮC BẮT BUỘC VỚI THÔNG TIN MỚI / SẢN PHẨM MỚI RA MẮT (${currentYear}):**
     • BẤT KỲ KHI NÀO khách hỏi về sản phẩm/game/dòng máy *"mới ra mắt"*, *"gần đây"*, *"hiện nay"*, *"hôm nay"*, tin tức năm ${currentYear}, hoặc nêu một tên sản phẩm/game bạn không thấy quen trong trí nhớ cũ (ví dụ: *iPhone Duo, iPhone 18, Galaxy Z Fold8, GTA 6, PS6, RTX 50-series, chip mới...*) -> **BẮT BUỘC GỌI NGAY \`web_search\`** để cập nhật thông tin thực tế mới nhất tính đến **${nowVietnam}**!
     • Nếu khách đồng thời hỏi *"shop có bán [tên sản phẩm mới] không?"* -> GỌI SONG SONG cả **\`web_search\`** (để hiểu đúng sản phẩm mới đó là gì & tình trạng ra mắt thực tế) VÀ **\`search_products\`** (để kiểm tra kho cửa hàng đã nhập hàng chưa; chú ý trường \`exactModelFound\`).
     • TUYỆT ĐỐI KHÔNG khẳng định *"Apple không có dòng sản phẩm đó"* hay nói lịch phát hành cũ năm 2025 khi chưa gọi \`web_search\`!
2. VÙNG SỰ THẬT CỬA HÀNG & THAO TÁC GIỎ HÀNG (BẮT BUỘC DÙNG TOOL — KHÔNG ĐƯỢC BỊA):
   - **THÊM VÀO GIỎ HÀNG TRỰC TIẾP:** Hệ thống giỏ hàng trực tuyến **ĐÃ ĐƯỢC TÍCH HỢP ĐỒNG BỘ 100%** với khung chat! BẤT KỲ KHI NÀO khách yêu cầu *"thêm vào giỏ"*, *"thêm vô giỏ"*, *"bỏ vào giỏ"*, *"cho vào giỏ"*, *"đặt mua"*, *"mua ngay"*, *"lấy cho tôi máy A và máy B"* -> **BẮT BUỘC GỌI NGAY \`add_to_cart\`** với đầy đủ mảng \`items\` (kể cả khách yêu cầu 2–3 sản phẩm cùng lúc như Switch Lite và iPhone 17 Pro!). TUYỆT ĐỐI KHÔNG bao giờ nói *"hệ thống giỏ hàng chưa tích hợp"* và KHÔNG tự đoán 1 dòng máy (như iPhone 17 Pro) chưa ra mắt mà chưa gọi Tool kiểm tra kho!
   - Khi khách hỏi tìm mua, xem giá, kiểm tra còn hàng, lọc sản phẩm theo ngân sách/cổng cắm/kiểu dáng -> BẮT BUỘC gọi \`search_products\`. Nếu \`exactModelFound === false\`, phải thành thật báo cửa hàng hiện **chưa nhập sẵn mẫu đích danh đó**, cập nhật thông tin thực tế từ \`web_search\` rồi mới gợi ý mẫu sẵn hàng gần nhất nếu hữu ích.
   - Khi khách hỏi thông số/giá chi tiết 1 mẫu máy bán tại shop -> gọi \`get_product_detail\`.
   - Khi khách muốn so sánh 2–3 mẫu máy (kể cả "so sánh 2 máy vừa rồi") -> gọi \`compare_products\` và trình bày bảng Markdown gọn rõ (| Tiêu chí | Mẫu 1 | Mẫu 2 |) + phân tích ưu/nhược & điểm đánh đổi.
   - Khi khách hỏi trả góp 0% -> gọi \`calculate_installment\`.
   - Khi khách hỏi mã giảm giá / voucher -> gọi \`get_active_coupons\`.
   - Khi khách hỏi tra cứu đơn hàng -> gọi \`lookup_order\`.
   - Khi khách hỏi chính sách bảo hành, đổi trả, giao hàng, thu cũ đổi mới, chuyển Zalo, mang pin lên máy bay, mẹo tương thích -> gọi \`search_store_knowledge\`.
   - TUYỆT ĐỐI không bịa giá bán tại shop, không bịa tồn kho, không tự chế mã giảm giá ngoài kết quả Tool.
   - Với danh mục **Tai nghe**: phân biệt cực kỳ rõ tai nghe thuần có dây vs tai nghe Bluetooth có hỗ trợ cắm dây Jack 3.5mm; nhắc rõ tương thích cổng cắm (Apple EarPods Lightning KHÔNG cắm được iPhone 15/16/17 USB-C; Sony Inzone H3 dùng 3.5mm + USB Audio Box cho PC/Laptop/PS5).
3. QUY TẮC BỘ NHỚ MỀM (SOFT MEMORY — KHÔNG KHÓA CỨNG):
   - Phần [NGỮ CẢNH THAM KHẢO MỀM] bên dưới chỉ giúp bạn nhớ sở thích khách (như có dây, cổng 3.5mm, tránh nhét tai bí tai, ngân sách, thiết bị đang dùng) khi khách đang nói tiếp mạch cũ.
   - Nếu tin nhắn hiện tại của khách chuyển sang chủ đề hoàn toàn mới (ví dụ đang hỏi tai nghe bỗng hỏi code Python, toán học, tin tức mới, hay đổi sang mua iPhone), HÃY ƯU TIÊN 100% TIN NHẮN HIỆN TẠI và tự nhiên bỏ qua chủ đề cũ.`;

    if (mode === 'open_ai') {
        return `Bạn là **Trợ lý AI Toàn năng** (chế độ Open AI tương tự ChatGPT / Gemini / Claude) tích hợp ngay trên website cửa hàng công nghệ.

PHẠM VI HOẠT ĐỘNG (CHẾ ĐỘ 1 — TỰ DO 100%):
- Bạn trả lời **MỌI câu hỏi thuộc MỌI lĩnh vực**: công nghệ, lập trình/code (viết code sạch trong khối \`\`\`ngon_ngu ... \`\`\`), toán học, khoa học, dịch thuật, viết nội dung/email, học tập, nấu ăn, sức khỏe thường thức, tư vấn đời sống, giải trí, phân tích chiến lược...
- **KHÔNG từ chối** câu hỏi ngoài phạm vi bán hàng; **KHÔNG ép quảng cáo sản phẩm** khi khách chỉ đang hỏi kiến thức chung, học tập hay viết code.
- Khi khách hỏi về mua sắm thiết bị công nghệ, giá bán, tồn kho, bảo hành, mã giảm giá hoặc đơn hàng -> chủ động gọi các Tool đã cấp để lấy dữ liệu thật 100% và tư vấn tận tâm như chuyên viên bán hàng xuất sắc.
- Với các câu hỏi kiến thức thuần túy hoặc đời sống, bạn KHÔNG cần gọi Tool cửa hàng để phản hồi nhanh nhất.

${storeFacts}

${toolRules}

[NGỮ CẢNH TRANG]: ${pageInfo}
[NGỮ CẢNH THAM KHẢO MỀM TỪ CÁC LƯỢT TRƯỚC]:
${softMemoryBlock}`;
    }

    return `Bạn là **Chuyên gia Tư vấn Công nghệ & Mua sắm AI** (chế độ Tech Advisor mở rộng) của cửa hàng thiết bị công nghệ chính hãng.

PHẠM VI HOẠT ĐỘNG (CHẾ ĐỘ 2 — CHUYÊN GIA CÔNG NGHỆ & MUA SẮM MỞ RỘNG):
- Bạn tự do vận dụng toàn bộ kiến thức công nghệ chuyên sâu (phần cứng, cảm biến, switch, chip, GPU, màn hình, âm thanh Hi-Res/ANC, tương thích cổng kết nối, hệ điều hành, khắc phục sự cố, so sánh kỹ thuật, tư vấn chọn máy theo ngành học/công việc/ngân sách) — KHÔNG bị bó hẹp bởi kịch bản cứng.
- Phong cách tư vấn như nhân viên kỳ cựu đứng trực tiếp tại quầy: thẳng thắn nêu cả ưu điểm lẫn **điểm đánh đổi**, ngắn gọn có cấu trúc rõ ràng, dễ hiểu với cả người không rành kỹ thuật.
- Nếu khách gửi yêu cầu **hoàn toàn ngoài lĩnh vực công nghệ & mua sắm** (ví dụ: nhờ làm bài văn nghị luận, giải bài tập lịch sử/văn học dài, sáng tác truyện dài, viết bài luận không liên quan công nghệ): hãy phản hồi thân thiện, lịch sự trong 2–3 câu ngắn gọn rằng bạn đang ở chế độ **Chuyên gia Công nghệ** để tập trung tư vấn thiết bị nhanh & chuẩn nhất, và **gợi ý khách bật chế độ "✨ AI Toàn năng" ngay trên thanh tiêu đề chat** nếu muốn hỏi tự do mọi lĩnh vực!
- Nếu khách hỏi mua mặt hàng cửa hàng không kinh doanh (thú cưng, quần áo, xe máy, đồ gia dụng ngoài công nghệ): giải thích hóm hỉnh/lịch sự rằng cửa hàng chuyên thiết bị công nghệ chính hãng, chưa có mặt hàng đó và gợi ý đúng nhóm sản phẩm công nghệ gần nhất nếu liên quan (ví dụ "chuột hamster" -> giải thích hóm hỉnh và nhắc chuột máy tính).

${storeFacts}

${toolRules}

[NGỮ CẢNH TRANG]: ${pageInfo}
[NGỮ CẢNH THAM KHẢO MỀM TỪ CÁC LƯỢT TRƯỚC]:
${softMemoryBlock}`;
}

function buildContextAwareSuggestions({ mode, collectedProducts = [], toolsUsed = [], userMessage = '' }) {
    if (collectedProducts.length >= 2) {
        return [
            'So sánh 2 mẫu vừa gợi ý',
            `Xem chi tiết ${String(collectedProducts[0].name || '').slice(0, 24)}`,
            'Tính trả góp 0%',
            'Mã giảm giá hôm nay'
        ];
    }
    if (collectedProducts.length === 1) {
        const p = collectedProducts[0];
        const shortName = String(p.name || '').slice(0, 22);
        if (p.category === 'Phụ kiện' || Number(p.price || 0) < 2000000) {
            return [
                `Ưu nhược điểm ${shortName}`,
                'Chính sách bảo hành 1 đổi 1',
                'Mã giảm giá hôm nay',
                'Xem mẫu cùng phân khúc'
            ];
        }
        return [
            `Tính trả góp 0% ${shortName}`,
            'Mã giảm giá hôm nay',
            'So sánh mẫu cùng tầm giá',
            'Giữ hàng tại showroom Gò Vấp'
        ];
    }
    if (mode === 'open_ai') {
        if (/\b(code|python|javascript|java|html|css|sql|thuật toán|hàm)\b/i.test(userMessage)) {
            return [
                'Giải thích chi tiết từng dòng',
                'Tối ưu hiệu năng thêm',
                'Viết thêm test case mẫu',
                'Tư vấn laptop lập trình'
            ];
        }
        return [
            'Giải thích sâu hơn ý này',
            'Cho ví dụ thực tế dễ hiểu',
            'Tư vấn tai nghe có dây',
            'Săn mã giảm giá hôm nay'
        ];
    }
    if (toolsUsed.includes('get_active_coupons')) {
        return ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Tư vấn Tai nghe', 'Tính trả góp 0%'];
    }
    return [
        'Tư vấn Tai nghe có dây',
        'Tư vấn Laptop học tập & làm việc',
        'So sánh 2 mẫu điện thoại chụp đẹp',
        'Săn mã giảm giá hôm nay'
    ];
}

function emitTextInSmoothChunks(text, onDelta) {
    if (!text || typeof onDelta !== 'function') return;
    // Chia theo cụm nhỏ (~18-28 ký tự theo ranh giới từ) để UI SSE luôn hiển thị mượt mà
    const tokens = text.match(/\S+\s*/g) || [text];
    let buf = '';
    for (const tok of tokens) {
        buf += tok;
        if (buf.length >= 22) {
            onDelta(buf);
            buf = '';
        }
    }
    if (buf) onDelta(buf);
}

/**
 * Chạy phiên tư vấn LLM-First Agentic (hỗ trợ cả JSON chuẩn và SSE Streaming)
 */
async function runAgenticChat({
    message,
    mode = 'tech_advisor',
    context = {},
    req = null,
    streamFinal = false,
    onStatus = null,
    onDelta = null,
    signal = null
}) {
    if (!aiModelService.isApiKeyConfigured()) {
        return null;
    }

    const activeMode = normalizeMode(mode || context.chatMode);
    const systemInstruction = buildAgenticSystemPrompt(activeMode, context);
    const history = Array.isArray(context.conversationHistory) ? context.conversationHistory : [];

    // Xây dựng contents hội thoại tự nhiên (giữ tới 28 lượt gần nhất)
    const contents = aiModelService.buildGeminiContents(history, message);

    const runtimeCtx = {
        userMessage: message,
        req,
        mode: activeMode,
        memoryProfile: context.memoryProfile || {},
        lastProducts: Array.isArray(context.lastProducts) ? context.lastProducts : [],
        collectedProducts: [],
        cartActions: [],
        openCartAfter: false,
        ragSources: []
    };

    const toolsUsed = [];
    let lastModel = '';
    let finalReply = '';
    let aborted = false;

    const temperature = activeMode === 'open_ai' ? 0.65 : 0.45;
    const maxOutputTokens = activeMode === 'open_ai' ? 3500 : 2800;

    if (typeof onStatus === 'function') {
        onStatus(activeMode === 'open_ai' ? '✨ AI đang suy luận...' : '🧠 Chuyên gia AI đang phân tích...');
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (signal?.aborted) {
            aborted = true;
            break;
        }

        const isLastRound = round === MAX_TOOL_ROUNDS - 1;
        const step = await aiModelService.callGeminiWithTools({
            systemInstruction,
            contents,
            tools: isLastRound ? [] : [{ functionDeclarations: TOOL_DECLARATIONS }],
            temperature,
            maxOutputTokens,
            enableWebSearch: activeMode === 'open_ai',
            signal
        });

        if (step.aborted) {
            aborted = true;
            break;
        }
        if (step.isFallback) {
            return null; // Caller sẽ fallback an toàn sang consultationCoordinator
        }

        lastModel = step.model || lastModel;

        // Trường hợp model trả lời trực tiếp không cần gọi Tool
        if (!step.functionCalls || step.functionCalls.length === 0) {
            finalReply = step.text || '';
            if (streamFinal && finalReply) {
                emitTextInSmoothChunks(finalReply, onDelta);
            }
            break;
        }

        // Bảo toàn NGUYÊN VẸN rawModelParts (bao gồm thoughtSignature & id cho Gemini 3.x)
        contents.push({
            role: 'model',
            parts: step.rawModelParts
        });

        // Thực thi song song toàn bộ function calls trong vòng này
        const fnResponses = [];
        for (const fc of step.functionCalls) {
            toolsUsed.push(fc.name);
            if (typeof onStatus === 'function') {
                onStatus(TOOL_STATUS_LABELS[fc.name] || '🔎 Đang tra cứu dữ liệu cửa hàng...');
            }
            let toolResult;
            try {
                toolResult = await executeAgenticTool(fc.name, fc.args || {}, runtimeCtx);
            } catch (err) {
                toolResult = { error: err.message || 'Lỗi truy vấn dữ liệu tạm thời.' };
            }
            const responsePart = {
                functionResponse: {
                    name: fc.name,
                    response: { result: toolResult }
                }
            };
            if (fc.id) {
                responsePart.functionResponse.id = fc.id;
            }
            fnResponses.push(responsePart);
        }

        contents.push({
            role: 'user',
            parts: fnResponses
        });

        // Nếu đang ở chế độ SSE Streaming và đã có kết quả Tool -> tổng hợp & stream trực tiếp vòng cuối!
        if (streamFinal && (round >= 0)) {
            if (typeof onStatus === 'function') {
                onStatus('✍️ Đang tổng hợp câu trả lời...');
            }
            const streamed = await aiModelService.streamGeminiContent({
                systemInstruction,
                contents,
                temperature,
                maxOutputTokens,
                onDelta,
                signal
            });
            if (streamed.aborted) {
                aborted = true;
                finalReply = streamed.text || finalReply;
                break;
            }
            if (!streamed.isFallback && streamed.text) {
                lastModel = streamed.model || lastModel;
                finalReply = streamed.text;
                break;
            }
            // Nếu stream lỗi bất ngờ -> tiếp tục vòng non-stream dự phòng
        }
    }

    if (!finalReply && !aborted) {
        return null;
    }

    // Nếu AI vừa gọi add_to_cart thành công -> giữ trọn tất cả các sản phẩm đã thêm (kể cả khác danh mục như Switch Lite + iPhone 17 Pro!)
    const hasCartBatch = Array.isArray(runtimeCtx.cartActions) && runtimeCtx.cartActions.length > 0;
    let products = runtimeCtx.collectedProducts.slice(0, 6);
    if (!hasCartBatch && products.length > 1 && finalReply) {
        const replyLower = finalReply.toLowerCase();
        const explicitlyMentioned = products.filter(p => {
            const tokens = String(p.name || '').toLowerCase()
                .replace(/điện thoại|laptop|máy chơi game|tai nghe|đồng hồ thông minh|chính hãng|chụp tai|không dây|bluetooth/g, ' ')
                .split(/\s+/).filter(t => t.length >= 3);
            const sig = tokens.slice(0, 2);
            return sig.length > 0 && sig.every(t => replyLower.includes(t));
        });
        if (explicitlyMentioned.length > 0) {
            const primaryCat = explicitlyMentioned[0].category;
            products = explicitlyMentioned.filter(p => !primaryCat || p.category === primaryCat).slice(0, 4);
        } else {
            const primaryCat = products[0]?.category;
            if (primaryCat) {
                products = products.filter(p => p.category === primaryCat).slice(0, 4);
            }
        }
    } else if (!hasCartBatch) {
        products = products.slice(0, 4);
    }
    const inferredCat = products[0]?.category || (activeMode === 'tech_advisor' ? (context.category || '') : '');
    const suggestions = hasCartBatch
        ? [
            'Mã giảm giá hôm nay',
            'Tính trả góp 0% cho giỏ hàng',
            'Chính sách giao hỏa tốc 2H',
            'Tư vấn thêm phụ kiện đi kèm'
        ]
        : buildContextAwareSuggestions({
            mode: activeMode,
            collectedProducts: products,
            toolsUsed,
            userMessage: message
        });

    const totalCartAddedAmount = hasCartBatch
        ? runtimeCtx.cartActions.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0)
        : 0;

    return {
        reply: finalReply,
        products: hasCartBatch ? [] : products,
        ...(hasCartBatch ? {
            action: 'add_to_cart_batch',
            cartItems: runtimeCtx.cartActions,
            openCartAfter: Boolean(runtimeCtx.openCartAfter),
            totalCartAddedAmount
        } : {}),
        suggestions,
        context: {
            ...context,
            chatMode: activeMode,
            stage: products.length > 0 ? 'recommended' : 'agentic_open',
            currentIntent: toolsUsed.length > 0 ? `agentic_${toolsUsed[0]}` : `agentic_${activeMode}`,
            ...(inferredCat ? { category: inferredCat } : {}),
            ...(products.length > 0 ? { lastProducts: products, topProduct: products[0] } : {})
        },
        meta: {
            provider: 'gemini',
            model: lastModel || aiModelService.TEXT_CHAT_MODELS[0],
            isFallback: false,
            engine: 'agentic_llm_first',
            mode: activeMode,
            toolsUsed: Array.from(new Set(toolsUsed)),
            ragSources: runtimeCtx.ragSources,
            aborted
        }
    };
}

module.exports = {
    normalizeMode,
    runAgenticChat
};
