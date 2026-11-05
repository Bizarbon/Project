/**
 * Module Phân loại ý định người dùng (Intent Classifier - Rule-based)
 * TechEcommerce NLU System
 */

const { parseBudget } = require('./budgetParser');
const { SUPPORTED_BRANDS, SUPPORTED_CATEGORIES } = require('./config');

/**
 * Danh sách 11 nhãn ý định chuẩn:
 * - product_search
 * - product_compare
 * - price_question
 * - stock_question
 * - promotion_negotiation
 * - policy_question
 * - order_support
 * - complaint
 * - smalltalk_offtopic
 * - prompt_injection
 * - unknown
 */

// Bảng ánh xạ dòng máy/sản phẩm đặc trưng sang thương hiệu
const PRODUCT_BRAND_MAP = [
    { pattern: /\b(iphone|ipad|macbook|airpods|apple watch|mba|mbp)\b/i, brand: 'Apple' },
    { pattern: /\b(galaxy|samsung|z fold|z flip)\b/i, brand: 'Samsung' },
    { pattern: /\b(thinkpad|legion|loq|ideapad)\b/i, brand: 'Lenovo' },
    { pattern: /\b(zenbook|vivobook|rog|tuf)\b/i, brand: 'Asus' },
    { pattern: /\b(predator|nitro|aspire)\b/i, brand: 'Acer' },
    { pattern: /\b(redmi|poco|xiaomi)\b/i, brand: 'Xiaomi' },
    { pattern: /\b(forerunner|garmin)\b/i, brand: 'Garmin' },
    { pattern: /\b(nintendo|switch oled|switch lite)\b/i, brand: 'Nintendo' },
    { pattern: /\b(playstation|ps5|ps portal|dualsense)\b/i, brand: 'Sony' },
    { pattern: /\b(matepad|watch fit)\b/i, brand: 'Huawei' },
    { pattern: /\b(osmo pocket|dji)\b/i, brand: 'DJI' }
];

/**
 * Trích xuất thực thể thương hiệu từ câu nói
 * @param {string} text - Văn bản chuẩn hóa
 * @returns {string|null}
 */
function extractBrand(text) {
    const s = text.toLowerCase();
    
    // 1. Kiểm tra dòng sản phẩm đặc thù suy luận ra thương hiệu
    for (const item of PRODUCT_BRAND_MAP) {
        if (item.pattern.test(s)) {
            return item.brand;
        }
    }

    // 2. Kiểm tra tên thương hiệu trực tiếp
    for (const brand of SUPPORTED_BRANDS) {
        const b = brand.toLowerCase();
        const regex = new RegExp(`(^|[^a-zA-Z0-9])${b}([^a-zA-Z0-9]|$)`, 'i');
        if (regex.test(s)) {
            return brand;
        }
    }
    return null;
}

/**
 * Trích xuất thực thể danh mục sản phẩm từ câu nói
 * @param {string} text - Văn bản chuẩn hóa
 * @returns {string|null}
 */
function extractCategory(text) {
    const s = text.toLowerCase();
    if (/iphone|điện thoại|dien thoai|smartphone|galaxy s|galaxy z|s\d{2}|redmi|xiaomi 1|oppo find|reno/i.test(s)) {
        return 'Điện thoại';
    }
    if (/laptop|macbook|mac air|mac pro|notebook|máy tính xách tay|may tinh xach tay|thinkpad|legion|zenbook|vivobook|rog strix|nitro|loq/i.test(s)) {
        return 'Laptop';
    }
    if (/tablet|ipad|máy tính bảng|may tinh bang|tab s|matepad|pad 6|poco pad/i.test(s)) {
        return 'Tablet';
    }
    if (/tai nghe|earphone|headphone|airpods|buds|freebuds|loa|audio|earbuds/i.test(s)) {
        return 'Tai nghe';
    }
    if (/đồng hồ|dong ho|smartwatch|apple watch|galaxy watch|forerunner|watch fit|vòng đeo tay|band 9/i.test(s)) {
        return 'Đồng hồ thông minh';
    }
    if (/máy chơi game|may choi game|console|playstation|ps5|switch|nintendo switch|rog ally|legion go|claw/i.test(s)) {
        return 'Máy chơi game';
    }
    if (/chuột|bàn phím|ban phim|củ sạc|cu sac|dây sạc|day sac|cáp|hub usb|gimbal|osmo pocket|phụ kiện|phu kien/i.test(s)) {
        return 'Phụ kiện';
    }
    return null;
}

/**
 * Phân loại ý định từ câu nói chuẩn hóa của khách
 * @param {string} normalizedText - Văn bản đã qua normalizeText
 * @param {string} unaccentedText - Văn bản không dấu
 * @returns {{ intents: string[], confidence: number, entities: { budget: object|null, brand: string|null, category: string|null } }}
 */
function classifyIntent(normalizedText, unaccentedText) {
    const text = String(normalizedText || '').toLowerCase().trim();
    const noAcc = String(unaccentedText || '').toLowerCase().trim();

    const entities = {
        budget: parseBudget(text) || parseBudget(noAcc),
        brand: extractBrand(text) || extractBrand(noAcc),
        category: extractCategory(text) || extractCategory(noAcc)
    };

    const detectedIntents = [];

    // 1. Kiểm tra PROMPT INJECTION / JAILBREAK (Ưu tiên an toàn tuyệt đối)
    const injectionPatterns = [
        /quên\s+(?:hết|tat ca|tất cả)?\s*(?:các|cac|mọi|moi)?\s*(?:hướng dẫn|huong dan|quy tắc|quy tac|lệnh|lenh)/i,
        /quen\s+(?:het|tat ca)?\s*(?:cac|moi)?\s*(?:huong dan|quy tac|lenh)/i,
        /ignore\s+(?:all|previous|any)\s+(?:instructions|rules|prompts|commands)/i,
        /(?:bạn là ai thật|ban la ai that|tiết lộ|tiet lo|in ra|show|xem)\s*(?:system prompt|prompt|hướng dẫn hệ thống|huong dan he thong|hướng dẫn bảo mật|huong dan bao mat|câu lệnh bí mật|cau lenh bi mat)/i,
        /(?:đóng vai|dong vai|hãy đóng vai|hay dong vai|bạn là|ban la)\s*(?:hệ thống bán hàng|he thong ban hang|admin|root|dan|chủ shop).*(?:giá 0|gia 0|0 đồng|0 dong|0đ|0d|miễn phí|mien phi)/i,
        /(?:bán|ban|cho|tang|tặng).*(?:giá 0|gia 0|0 đồng|0 dong|0đ|0d|miễn phí|mien phi)/i,
        /(?:bỏ qua|bo qua)\s+(?:mọi|moi|tất cả|tat ca)\s+(?:quy tắc|quy tac|ràng buộc|rang buoc|hạn chế)/i,
        /(?:bạn không còn là|ban khong con la)\s*(?:nhân viên|tro ly)/i,
        /\b(?:dan mode|jailbreak|prompt injection)\b/i
    ];
    if (injectionPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('prompt_injection');
        return {
            intents: detectedIntents,
            confidence: 0.98,
            entities
        };
    }

    // 2. Kiểm tra KHIẾU NẠI / BỰC BỘI (Complaint)
    const complaintPatterns = [
        /(?:như|giao tiếp như|nói chuyện như|tra loi nhu|rep nhu)\s*robot/i,
        /(?:làm ăn|lam an)\s*(?:như lừa đảo|nhu lua dao|tệ|te|chán|chan|bực|buc|vớ vẩn|vo van)/i,
        /\b(?:chán quá|chan qua|tệ quá|te qua|quá tệ|qua te)\b/i,
        /\b(?:bực cả mình|buc ca minh|bực quá|buc qua|bực mình|buc minh|bực ghê|buc ghe)\b/i,
        /chờ\s*(?:mãi|ca tieng|cả tiếng|lâu|lau)\s*(?:không|khong|chưa|chua)?\s*(?:ai|thấy)?\s*(?:rep|phản hồi|phan hoi|trả lời|tra loi)/i,
        /(?:thái độ|thai do)\s*(?:nhân viên|quá tệ|qua te|tệ|te|kém|kem)/i,
        /(?:máy|may|sản phẩm|san pham).*(?:bị lỗi|bi loi|hỏng|hong).*(?:không ai|khong ai|chẳng ai|chang ai).*(?:hỗ trợ|ho tro|giải quyết|giai quyet)/i,
        /(?:thất vọng|that vong)\s*(?:về dịch vụ|ve dich vu|về shop|ve shop)/i,
        /(?:chậm như rùa|cham nhu rua|trả lời chậm|tra loi cham|chậm chạp|cham chap)/i,
        /\b(?:lừa đảo à|lua dao a|lừa gạt|lua gat)\b/i
    ];
    if (complaintPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('complaint');
        return {
            intents: detectedIntents,
            confidence: 0.95,
            entities
        };
    }

    // 3. Kiểm tra MẶC CẢ / XIN GIẢM GIÁ / KHUYẾN MÃI (Promotion / Negotiation)
    const bargainPatterns = [
        /(?:bớt|bot|giảm|giam)\s*(?:giá|gia)?\s*(?:thêm|nữa|ko|không|dc ko|được không|chút|ti|tí|được ko)/i,
        /(?:bớt|bot)\s*(?:cho mình|cho em|cho anh)?\s*(?:chút đỉnh|chut dinh|chút|ti|tí|\d+)/i,
        /giá (?:này là|do la)?\s*(?:giá cuối|gia cuoi|chốt chưa|chot chua|có bớt|co bot)/i,
        /(?:xin|có|co)\s*(?:mã giảm giá|ma giam gia|voucher|mã code|coupon|khuyến mãi|khuyen mai|ưu đãi|uu dai)/i,
        /(?:có quà|co qua|tặng kèm|tang kem|quà tặng|qua tang|combo|được tặng|duoc tang|tặng|tang)\s*(?:gì|gi|phụ kiện|phu kien|quà|qua)?/i,
        /(?:mua 2|mua nhiều|sinh viên|sinh vien).*(?:giảm|chiết khấu|bớt|ưu đãi)/i,
        /\b(?:deal gì|deal hot|sale gì|sale hot|xin voucher)\b/i
    ];
    if (bargainPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('promotion_negotiation');
    }

    // 4. Kiểm tra SO SÁNH SẢN PHẨM (Product Compare)
    const comparePatterns = [
        /(?:so sánh|so sanh|so với|so voi)/i,
        /(?:khác nhau|khac nhau|khác gì|khac gi)\s*(?:điểm nào|ở đâu|giữa|như thế nào)?/i,
        /(?:nên mua|nen mua|chọn con nào|chon con nao|phân vân|phan van)\s*(?:giữa|giua)?.*(?:hay|hoặc|hoac)/i,
        /(?:máy nào|may nao|con nào|con nao)\s*(?:ngon hơn|mạnh hơn|tốt hơn|đáng mua hơn|hơn)/i
    ];
    if (comparePatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('product_compare');
    }

    // 5. Kiểm tra HỎI GIÁ (Price Question)
    const pricePatterns = [
        /(?:bao nhiêu tiền|bao nhieu tien|nhiêu tiền|nhieu tien|giá bao nhiêu|gia bao nhieu|giá sao|gia sao|giá mấy|gia may|giá bn|gia bn|bnhieu|bnh)/i,
        /(?:xin giá|xin gia|báo giá|bao gia|giá niêm yết|gia niem yet)/i,
        /(?:bán giá|ban gia)\s*(?:nhiêu|bao nhiêu|sao)/i
    ];
    if (pricePatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('price_question');
    }

    // 6. Kiểm tra HỎI TỒN KHO / MÀU SẴN (Stock Question)
    const stockPatterns = [
        /(?:còn hàng|con hang|sẵn hàng|san hang|sẵn máy|san may)\s*(?:không|ko|hông|k)?/i,
        /(?:còn màu|con mau)\s*(?:trắng|đen|xanh|vàng|hồng|gold|titan|xam|gray|bac|silver)?/i,
        /(?:khi nào có hàng|khi nao co hang|bao giờ về hàng|bao gio ve hang)/i,
        /(?:có sẵn ở|co san o)\s*(?:hcm|hà nội|ha noi|đà nẵng|da nang|shop|cửa hàng)/i,
        /(?:hết hàng chưa|het hang chua)/i
    ];
    if (stockPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('stock_question');
    }

    // 7. Kiểm tra HỎI CHÍNH SÁCH BÁN HÀNG (Policy Question)
    const policyPatterns = [
        /(?:bảo hành|bao hanh|thời hạn bảo hành|trung tâm bảo hành)/i,
        /(?:đổi trả|doi tra|1 đổi 1|1 doi 1|đổi mới|doi moi|lỗi.*đổi|chính sách đổi|chinh sach doi)/i,
        /(?:giao hàng|giao hang|ship|phí ship|phi ship|mất mấy ngày|mat may ngay|ship cod|giao hỏa tốc|giao hoa toc)/i,
        /(?:trả góp|tra gop|góp 0%|gop 0%|lãi suất|lai suat|thủ tục trả góp|thu tuc tra gop|qua thẻ tín dụng|qua cccd)/i,
        /(?:hóa đơn|hoa don|hóa đơn đỏ|hoa don do|xuất vat|xuat vat|hóa đơn điện tử|hoa don dien tu)/i,
        /(?:hàng chính hãng|hang chinh hang|vn\/a|xách tay|xach tay|nguồn gốc|nguon goc|xuất xứ|xuat xu)/i
    ];
    if (policyPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('policy_question');
    }

    // 8. Kiểm tra TRA CỨU ĐƠN HÀNG (Order Support)
    const orderPatterns = [
        /(?:kiểm tra đơn|kiem tra don|tra cứu đơn|tra cuu don|tình trạng đơn|tinh trang don|mã đơn|ma don|mã vận đơn)/i,
        /(?:đơn của tôi|don cua toi|đơn hàng của mình|don hang cua minh|giao tới đâu rồi|giao toi dau roi)/i,
        /(?:hủy đơn|huy don|đổi địa chỉ nhận|doi dia chi nhan)/i
    ];
    if (orderPatterns.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.push('order_support');
    }

    // 9. Kiểm tra TÌM KIẾM / TƯ VẤN SẢN PHẨM (Product Search)
    const searchPatterns = [
        /(?:tư vấn|tu van|tìm|tim|cần mua|can mua|giới thiệu|gioi thieu|mua con nào|mua con nao|máy nào ngon|may nao ngon)/i,
        /(?:có con nào|co con nao|có mẫu nào|co mau nao|có loại nào|co loai nao)/i,
        /(?:cho sinh viên|cho sinh vien|văn phòng|van phong|đồ họa|do hoa|chơi game|choi game|gaming|mỏng nhẹ|mong nhe|pin trâu|pin trau|chụp ảnh đẹp|chup anh dep)/i
    ];
    const hasSearchKeywords = searchPatterns.some(p => p.test(text) || p.test(noAcc));
    if (hasSearchKeywords || (entities.budget && !detectedIntents.length) || (entities.category && !detectedIntents.length)) {
        if (!detectedIntents.includes('product_search')) {
            // Nếu câu có ý định tư vấn cụ thể, ưu tiên đưa product_search lên đầu
            if (hasSearchKeywords) {
                detectedIntents.unshift('product_search');
            } else {
                detectedIntents.push('product_search');
            }
        }
    }

    // 10. Kiểm tra TÁN GẪU / LẠC ĐỀ (Smalltalk / Off-topic)
    const smalltalkPatterns = [
        /^(?:chào|chao|hello|hi|alo|hé lô|he lo|ê shop|shop ơi|shop oi)\b/i,
        /^(?:cảm ơn|cam on|thanks|tks|thx|cmon)\b/i,
        /^(?:tạm biệt|tam biet|bye|bye bye)\b/i,
        /\b(?:1\s*\+\s*1|2\s*\+\s*2|mấy cộng mấy)\b/i,
        /\b(?:bạn là ai|ban la ai|tên gì|ten gi|mấy tuổi|may tuoi)\b/i,
        /\b(?:bạn là nam hay nữ|ban la nam hay nu|giới tính|gioi tinh)\b/i,
        /\b(?:người yêu|nguoi yeu|thời tiết|thoi tiet|kể chuyện cười|ke chuyen cuoi|ke mot cau chuyen cuoi)\b/i
    ];
    // Chỉ gán smalltalk nếu KHÔNG có nhu cầu tìm kiếm cụ thể
    if (smalltalkPatterns.some(p => p.test(text) || p.test(noAcc))) {
        if (!detectedIntents.includes('product_search')) {
            detectedIntents.push('smalltalk_offtopic');
        }
    }

    // 11. Xử lý sản phẩm ngoài danh mục hoặc không xác định (Unknown)
    const outOfCatalogKeywords = [
        /tủ lạnh|tu lanh|máy giặt|may giat|điều hòa|dieu hoa|máy lạnh|may lanh|nồi cơm|noi com/i,
        /xe máy|xe may|ô tô|o to|xe đạp|xe dap|vé máy bay|ve may bay|khách sạn|khach san/i,
        /quần áo|quan ao|giày dép|giay dep|mỹ phẩm|my pham|thức ăn|thuc an|thực phẩm|thuc pham|sách kinh tế|sach kinh te/i
    ];
    if (outOfCatalogKeywords.some(p => p.test(text) || p.test(noAcc))) {
        detectedIntents.length = 0;
        detectedIntents.push('unknown');
    }

    // Nếu vẫn rỗng
    if (detectedIntents.length === 0) {
        if (entities.brand || entities.category || entities.budget) {
            detectedIntents.push('product_search');
        } else {
            detectedIntents.push('unknown');
        }
    }

    return {
        intents: detectedIntents,
        confidence: detectedIntents[0] === 'unknown' ? 0.3 : 0.88,
        entities
    };
}

module.exports = {
    classifyIntent,
    extractBrand,
    extractCategory
};
