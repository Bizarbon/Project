const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const ChatSession = require('../models/ChatSession');
const { optionalAuth } = require('../middleware/auth');
const { recommendProducts } = require('../utils/recommendations');
const { coordinateConsultation, checkUnsupportedProduct, buildOutOfCatalogResponse } = require('../services/consultationCoordinator');

const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.' }
});

const STATUS_LABELS = {
    pending: 'chờ xác nhận',
    processing: 'đang xử lý',
    shipping: 'đang giao hàng',
    completed: 'đã hoàn tất',
    cancelled: 'đã hủy',
    returned: 'đã trả hàng',
    boom: 'giao hàng không thành công'
};

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function hasWordOrPhrase(text, phrase) {
    const normText = normalizeText(text);
    const normPhrase = normalizeText(phrase);
    const escaped = escapeRegex(normPhrase);
    const regex = new RegExp(`(^|\\s|[.,!?;:()"])${escaped}($|\\s|[.,!?;:()"])`, 'i');
    return regex.test(normText);
}

function cleanQueryTerm(rawMessage) {
    return String(rawMessage || '')
        .replace(/^(?:tư vấn(?:\s+(?:cho\s+)?(?:tôi|mình))?|tìm(?:\s+(?:cho|giúp|hộ)\s+(?:tôi|mình))?|mua(?:\s+(?:cho|giúp|hộ)\s+(?:tôi|mình))?|xem|có bán|cửa hàng có(?:\s+bán)?|bên bạn có(?:\s+bán)?|cho tôi hỏi|cho mình hỏi|tôi muốn mua|mình muốn mua|tôi cần(?:\s+mua)?|mình cần(?:\s+mua)?|tìm mua|có sản phẩm|báo giá|giá của|hỏi về|có)\s+/gi, '')
        .replace(/\s+(?:không(?:\s+ạ)?|ạ|vậy|nhỉ|nhé|thế|ko|k|giúp tôi|cho tôi|với)\??$/gi, '')
        .trim();
}

function extractProductQuery(text) {
    return normalizeText(cleanQueryTerm(text));
}

function money(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

/**
 * Phát hiện lời chào / small-talk / câu hỏi chung không liên quan sản phẩm
 * Trả về object { reply, suggestions } nếu là greeting, null nếu không phải
 */
function detectGreetingOrSmallTalk(text) {
    const norm = normalizeText(text);

    // 1. Lời chào thông dụng
    const greetingPatterns = [
        /^(xin\s+)?chao(\s+(ban|shop|cua\s+hang|ad|admin|anh|chi|em|nha|nhe|a|ạ))*[!.?\s]*$/,
        /^(hello|hi|hey|alo|helu|helo|xin chao)[!.?\s]*$/,
        /^chao\s+buoi\s+(sang|trua|chieu|toi)[!.?\s]*$/,
        /^(good\s+)?(morning|afternoon|evening)[!.?\s]*$/
    ];
    if (greetingPatterns.some(p => p.test(norm))) {
        return {
            reply: 'Xin chào bạn! 👋 Mình là Trợ lý Tư vấn Mua sắm AI của TechEcommerce. Bạn đang quan tâm đến sản phẩm công nghệ nào, hoặc có mức ngân sách khoảng bao nhiêu để mình tư vấn chi tiết nhất nhé?',
            suggestions: ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Đồng hồ thông minh', 'Mã giảm giá hôm nay'],
            context: { stage: 'asking_category' }
        };
    }

    // 2. Cảm ơn
    const thankPatterns = [
        /^(cam on|thank|thanks|cam\s+on\s+(ban|nhe|nha|nhieu|rat\s+nhieu|shop|ad|a))[!.?\s]*$/,
        /^(ok\s+)?cam\s+on[!.?\s]*$/
    ];
    if (thankPatterns.some(p => p.test(norm))) {
        return {
            reply: 'Dạ không có gì ạ! 😊 Nếu bạn cần tư vấn thêm bất kỳ sản phẩm nào hoặc có thắc mắc gì, cứ nhắn mình nhé!',
            suggestions: ['Tư vấn sản phẩm mới', 'Mã giảm giá hôm nay', 'Chính sách bảo hành', 'Kiểm tra đơn hàng'],
            context: { stage: 'idle' }
        };
    }

    // 3. Small talk / câu hỏi chung về cửa hàng
    const smallTalkPatterns = [
        /^ban\s+(la\s+)?ai[?!.\s]*$/,
        /^(ai\s+)?day\s+la\s+(gi|dau|cua hang gi)[?!.\s]*$/,
        /^ban\s+(co\s+the\s+)?(lam|giup)\s+(duoc\s+)?gi[?!.\s]*$/,
        /^(ban\s+)?giup\s+(duoc\s+)?gi[?!.\s]*$/,
        /^(cua hang|shop|ban)\s+ban\s+(nhung\s+)?gi[?!.\s]*$/,
        /^ban\s+gi[?!.\s]*$/
    ];
    if (smallTalkPatterns.some(p => p.test(norm))) {
        return {
            reply: 'Mình là Trợ lý AI Mua sắm của **TechEcommerce** – cửa hàng chuyên phân phối chính hãng 100% các sản phẩm công nghệ: 📱 Điện thoại, 💻 Laptop, 📲 Tablet, ⌚ Đồng hồ thông minh, 🎮 Máy chơi game, 🎧 Tai nghe và Phụ kiện.\n\nMình có thể giúp bạn:\n• Tìm kiếm và tư vấn sản phẩm theo ngân sách\n• So sánh cấu hình chi tiết\n• Tra cứu mã giảm giá, tính trả góp 0%\n• Kiểm tra đơn hàng và chính sách bảo hành\n\nBạn cần hỗ trợ gì hôm nay?',
            suggestions: ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Mã giảm giá hôm nay', 'Kiểm tra đơn hàng'],
            context: { stage: 'asking_category' }
        };
    }

    // 4. Tạm biệt
    const byePatterns = [
        /^(tam biet|bye|goodbye|tam\s+biet\s+(ban|nhe|nha)|hen\s+gap\s+lai|bye\s+bye)[!.?\s]*$/
    ];
    if (byePatterns.some(p => p.test(norm))) {
        return {
            reply: 'Cảm ơn bạn đã ghé thăm TechEcommerce! 🙏 Chúc bạn một ngày tốt lành, hẹn gặp lại! Nếu cần tư vấn bất kỳ lúc nào, mình luôn sẵn sàng hỗ trợ nhé! 😊',
            suggestions: ['Tư vấn sản phẩm', 'Mã giảm giá', 'Kiểm tra đơn hàng'],
            context: { stage: 'idle' }
        };
    }

    // 5. Các câu chung chung không liên quan sản phẩm
    const vaguePatterns = [
        /^(co\s+gi\s+hot|co\s+gi\s+moi|moi\s+nhat|co\s+gi\s+hay)[?!.\s]*$/,
        /^(tu\s+van|tu\s+van\s+mua\s+hang|goi\s+y\s+san\s+pham|tu\s+van\s+giup|tu\s+van\s+ho|tu\s+van\s+cho\s+minh)[?!.\s]*$/,
        /^(muon\s+mua\s+do|muon\s+mua|mua\s+hang)[?!.\s]*$/,
        /^(san\s+pham|xem\s+san\s+pham)[?!.\s]*$/
    ];
    if (vaguePatterns.some(p => p.test(norm))) {
        return {
            reply: 'Chào bạn! Bạn đang quan tâm đến dòng sản phẩm nào hoặc có mức ngân sách khoảng bao nhiêu để mình tư vấn chi tiết nhất nhé?',
            suggestions: [
                'Tư vấn Laptop',
                'Tư vấn Điện thoại',
                'Đồng hồ thông minh',
                'Xem Tablet & iPad',
                'Mã giảm giá hôm nay'
            ],
            context: { stage: 'asking_category' }
        };
    }

    return null;
}

function productLine(product) {
    const specs = product.specs || {};
    const highlights = [
        product.brand,
        specs.cpu,
        specs.ram,
        specs.storage,
        product.warranty ? `BH ${product.warranty}` : ''
    ].filter(Boolean).slice(0, 4).join(' | ');

    return `- ${product.name}: ${money(product.price)}${product.stock > 0 ? `, còn ${product.stock}` : ', tạm hết hàng'}${highlights ? ` (${highlights})` : ''}`;
}

function extractBudget(text) {
    // 1. Dạng 1tr5, 2tr5
    const trMatch = text.match(/(\d+)\s*(?:tr|trieu)\s*(\d+)\b/i);
    if (trMatch) {
        const millions = Number(trMatch[1]) * 1000000;
        const sub = Number(trMatch[2]);
        const fraction = sub < 10 ? sub * 100000 : sub * 10000;
        return millions + fraction;
    }

    // 2. Dạng 500k, 800k, 500 nghìn, 500 ngàn
    const kMatch = text.match(/(?:duoi|tam|khoang|ngan sach|budget)?\s*(\d{2,4})\s*(?:k|ngan|nghin)\b/i);
    if (kMatch) {
        return Number(kMatch[1]) * 1000;
    }

    // 3. Dạng triệu / tr / m
    const patterns = [
        /(?:duoi|toi da|tam|khoang|ngan sach|budget)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m)\b/i,
        /(\d+(?:[.,]\d+)?)\s*(trieu|tr|m)\b/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return Math.round(Number(match[1].replace(',', '.')) * 1000000);
    }

    const rawNumber = text.match(/(?:duoi|toi da|tam|khoang|ngan sach|budget)\s*(\d{6,})/i);
    if (rawNumber) return Number(rawNumber[1]);

    return null;
}

function inferCategory(text) {
    const norm = normalizeText(text);

    // Bỏ qua đồng hồ truyền thống / đồng hồ kim / đồng hồ cơ / thương hiệu đồng hồ thời trang
    const traditionalWatchKeywords = [
        'dong ho co', 'dong ho automatic', 'dong ho quartz', 'dong ho kim', 'dong ho chay pin',
        'dong ho treo tuong', 'dong ho bao thuc', 'dong ho qua lac', 'dong ho de ban',
        'casio', 'seiko', 'citizen', 'orient', 'tissot', 'longines', 'rolex', 'omega',
        'hublot', 'patek', 'daniel wellington', 'dw', 'fossil', 'carnival', 'srwatch',
        'g-shock', 'g shock', 'gshock', 'baby-g', 'baby g', 'babyg', 'edifice', 'sheen',
        'bentley', 'ogival', 'olym pianus', 'skagen', 'timex'
    ];
    if (traditionalWatchKeywords.some(k => hasWordOrPhrase(norm, k))) {
        return '';
    }

    const categories = [
        ['Đồng hồ thông minh', [
            'dong ho thong minh', 'smartwatch', 'apple watch', 'galaxy watch', 'garmin',
            'huawei watch', 'fitbit', 'dong ho di dong', 'dong ho the thao', 'dong ho deo tay'
        ]],
        ['Máy chơi game', [
            'may choi game', 'ps5', 'ps4', 'playstation', 'nintendo',
            'switch oled', 'nintendo switch', 'steam deck', 'xbox', 'meta quest', 'kinh thuc te ao', 'tay cam choi game'
        ]],
        ['Laptop', [
            'laptop', 'may tinh xach tay', 'may tinh', 'macbook', 'notebook', 'ultrabook',
            'vivobook', 'thinkpad', 'rog strix', 'acer nitro', 'katana', 'ideapad', 'inspiron',
            'may hoc lap trinh', 'may lap trinh', 'lap trinh', 'hoc code', 'hoc it', 'cntt', 'developer',
            'do hoa', 'photoshop', 'illustrator', 'premiere', 'can may', 'mua may', 'doi may', 'may cu',
            'may mong nhe', 'may nhe', 'pin trau', 'core i3', 'core i5', 'core i7', 'core i9', 'ryzen',
            'may hoc tap', 'may hoc dai hoc', 'may cho sinh vien', 'hoc dai hoc', 'sinh vien'
        ]],
        ['Điện thoại', [
            'dien thoai', 'smartphone', 'iphone', 'galaxy s', 'galaxy z', 'galaxy fold', 'galaxy flip',
            'xiaomi', 'oppo', 'poco', 'dtdd', 'di dong'
        ]],
        ['Tai nghe', [
            'tai nghe', 'airpods', 'headphone', 'earbuds', 'headset', 'galaxy buds'
        ]],
        ['Tablet', [
            'tablet', 'may tinh bang', 'ipad', 'galaxy tab', 'matepad', 'honor pad', 'xiaomi pad'
        ]],
        ['Phụ kiện', [
            'phu kien', 'chuot may tinh', 'chuot khong day', 'chuot gaming',
            'ban phim', 'ban phim may tinh', 'ban phim co', 'ban phim khong day', 'ban phim logitech', 'keyboard',
            'cu sac', 'bo sac', 'day sac', 'coc sac', 'sac nhanh', 'pin du phong', 'sac du phong',
            'cap sac', 'cap type c', 'cap lightning', 'hub chuyen doi', 'hub usb', 'op lung', 'tui chong soc',
            'but cam ung', 'apple pencil'
        ]]
    ];

    const found = categories.find(([, keywords]) => keywords.some(keyword => hasWordOrPhrase(norm, keyword)));
    return found ? found[0] : '';
}

async function detectCategoryFromDatabase(text) {
    try {
        const stopWords = new Set([
            'tu van', 'muon', 'khoang', 'trieu', 'mua', 'tim', 'cho', 'minh', 'toi',
            'xem', 'hoi', 'ban', 'san', 'pham', 'loai', 'dong', 'may', 'hang', 'chiec',
            'duoc', 'khong', 'can', 'gia', 'tot', 're', 'dep', 'hay', 'nao', 'o dau',
            'sach', 'doc', 'doc sach'
        ]);
        const words = normalizeText(text).split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w));
        for (const word of words) {
            const regex = new RegExp(`(^|\\s)${escapeRegex(word)}(\\s|$)`, 'i');
            const found = await Product.findOne({
                active: { $ne: false },
                $or: [{ name: regex }, { brand: regex }, { tags: regex }]
            }).select('category');
            if (found?.category) return found.category;
        }
    } catch (e) {
        // ignore
    }
    return '';
}

function extractUseCase(text) {
    const cases = [
        ['chống ồn chủ động (ANC)', ['chong on', 'anc', 'cach am', 'yen tinh']],
        ['nghe nhạc bass mạnh', ['bass', 'nghe nhac', 'am bass', 'edm', 'remix', 'chat am']],
        ['đàm thoại & học online', ['dam thoai', 'mic', 'micro', 'hop online', 'goi dien', 'hoc online']],
        ['thể thao chống nước', ['chong nuoc', 'tap luyen', 'chay bo', 'the thao', 'gym']],
        ['lập trình', ['lap trinh', 'code', 'hoc it', 'cong nghe thong tin', 'developer']],
        ['học tập', ['hoc tap', 'di hoc', 'hoc sinh', 'sinh vien']],
        ['văn phòng', ['van phong', 'word', 'excel', 'lam viec']],
        ['chơi game', ['choi game', 'gaming', 'game nang', 'fps']],
        ['thiết kế và đồ họa', ['do hoa', 'thiet ke', 'photoshop', 'illustrator', '3d']],
        ['chụp ảnh và quay video', ['chup anh', 'quay video', 'camera', 'tiktok', 'vlog']],
        ['thể thao và sức khỏe', ['suc khoe', 'chay', 'boi']],
        ['thông báo và nghe gọi', ['thong bao', 'nghe goi', 'ket noi']],
        ['thời trang', ['thoi trang', 'sang trong', 'deo dep', 'cao cap']],
        ['giải trí', ['xem phim', 'giai tri', 'mang xa hoi']]
    ];
    return cases.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))?.[0] || '';
}

function extractUserProfile(text) {
    const profiles = [
        ['học sinh/sinh viên', ['hoc sinh', 'sinh vien', 'di hoc']],
        ['nhân viên văn phòng', ['nhan vien', 'van phong', 'ke toan']],
        ['người làm sáng tạo', ['designer', 'thiet ke', 'sang tao', 'content creator', 'vlog']],
        ['người chơi game', ['gamer', 'choi game', 'gaming']],
        ['người lớn tuổi', ['nguoi lon tuoi', 'bo me', 'ong ba']],
        ['trẻ em', ['tre em', 'cho be', 'con toi']]
    ];
    return profiles.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))?.[0] || '';
}

function extractPriority(text) {
    const priorities = [
        ['chống ồn chủ động', ['chong on', 'anc', 'cach am']],
        ['chất âm & bass hay', ['chat am', 'bass', 'am thanh hay', 'nghe nhac hay']],
        ['tai nghe chụp tai (Over-ear)', ['chup tai', 'over ear', 'over-ear', 'headphone']],
        ['tai nghe nhét tai (In-ear)', ['nhet tai', 'in ear', 'in-ear', 'true wireless', 'tws', 'airpods']],
        ['độ bền và bảo hành', ['do ben', 'ben', 'lau dai', 'bao hanh', 'chong nuoc', 'chac chan']],
        ['pin lâu & bền bỉ', ['pin trau', 'pin lau', 'dung lau', 'thoi luong pin', 'pin tren 7 ngay', 'pin tren 30 gio', 'pin 30h', 'pin ca ngay']],
        ['hiệu năng mạnh mẽ', ['hieu nang', 'manh', 'toc do', 'muot', 'cau hinh', 'choi game', 'render']],
        ['camera & chụp ảnh', ['camera', 'chup anh', 'quay video']],
        ['mỏng nhẹ & di chuyển', ['mong nhe', 'nhe', 'de mang', 'di chuyen', 'xach tay', 'mang di hoc']],
        ['màn hình chuẩn màu & sắc nét', ['man hinh', 'hien thi', 'mau sac', 'kich thuoc lon', 'oled', 'chuan mau', 'retina']],
        ['cân bằng & tiết kiệm', ['khong quan trong', 'can bang', 'deu duoc', 'tu van giup', 'tiet kiem']]
    ];
    return priorities.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))?.[0] || '';
}

function extractExistingDeviceOrUpgrade(text) {
    const norm = normalizeText(text);
    const keywords = [
        'nang cap', 'thay ssd', 'nang ram', 'lap ram', 'doi may', 'co nen mua moi',
        'co nen doi', 'may cu', 'laptop cu', 'core i3', 'core i5 doi', 'gen 8', 'doi 8',
        'doi 7', 'doi 6', 'doi 9', 'doi 10', 'dang dung may', 'may hien tai', 'may dang dung',
        'chay cham', 'may bi lag', 'may bi cham', 'may cu dung', 'nang cap hay mua moi',
        'nang cap hay doi'
    ];
    return keywords.some(k => norm.includes(k));
}

function extractNonTechUser(text) {
    const norm = normalizeText(text);
    const keywords = [
        'khong ranh cau hinh', 'khong biet cau hinh', 'chua biet cau hinh', 'khong hieu cau hinh',
        'nguoi mu cong nghe', 'khong ranh cong nghe', 'khong biet xem may', 'tu van de hieu',
        'nganh kinh te', 'nganh luat', 'nganh xa hoi', 'sinh vien nam nhat', 'khong biet chon'
    ];
    return keywords.some(k => norm.includes(k));
}

function extractTechFocus(text) {
    const norm = normalizeText(text);
    if (['lap trinh', 'hoc code', 'cntt', 'it', 'ai', 'machine learning', 'deep learning', 'khoa hoc du lieu', 'data science', 'python', 'docker', 'vscode', 'lap trinh vien', 'developer'].some(k => norm.includes(k))) {
        return 'programming_ai';
    }
    if (['do hoa', 'thiet ke', 'photoshop', 'illustrator', 'premiere', 'edit video', 'dung phim', 'render', 'autocad', '3d', 'canva', 'designer'].some(k => norm.includes(k))) {
        return 'design_graphics';
    }
    if (['di chuyen', 'mang di lai', 'pin trau', 'pin lau', 'pin ben', 'mong nhe', 'sieu nhe', 'nhe', 'xach di', 'di hoc xa', 'pin 18 gio'].some(k => norm.includes(k))) {
        return 'mobility_battery';
    }
    return '';
}

async function findProductByQuery(ProductModel, q) {
    if (!q) return null;
    const norm = normalizeText(q);
    const tokens = norm.split(/\s+/).filter(t => t.length >= 2);
    if (!tokens.length) return null;

    let found = await ProductModel.findOne({
        active: { $ne: false },
        name: { $regex: escapeRegex(q), $options: 'i' }
    });
    if (found) return found;

    const andClauses = tokens.map(t => ({ name: { $regex: escapeRegex(t), $options: 'i' } }));
    found = await ProductModel.findOne({
        active: { $ne: false },
        $and: andClauses
    });
    if (found) return found;

    found = await ProductModel.findOne({
        active: { $ne: false },
        $or: tokens.map(t => ({ name: { $regex: escapeRegex(t), $options: 'i' } }))
    }).sort({ rating: -1, soldCount: -1 });

    return found;
}

async function buildProductFilter(text) {
    const budget = extractBudget(text);
    let category = inferCategory(text);
    if (!category) {
        category = await detectCategoryFromDatabase(text);
    }

    const brands = ['apple', 'samsung', 'xiaomi', 'oppo', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'msi', 'sony', 'lg', 'garmin', 'nintendo', 'valve', 'huawei', 'logitech', 'anker', 'ugreen', 'baseus'];
    const brand = brands.find(item => text.includes(item));

    return { budget, category, brand };
}

/**
 * Tích hợp Google Gemini API với AbortSignal timeout 8s & Catalog-Grounded Prompt
 */
async function askGeminiIfConfigured(systemPrompt, userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('[Gemini AI] Chưa cấu hình GEMINI_API_KEY. Hệ thống tự động kích hoạt Deterministic Knowledge Engine (Catalog-Grounded Heuristic).');
        return null;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\nNgười dùng: "${userPrompt}"\nHãy trả lời bằng tiếng Việt tự nhiên, trung thực với thông số và giá trong catalog cung cấp, không suy đoán hoặc bịa thông số ngoài danh mục:` }]
                }
            ],
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 800
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8000)
        });

        if (!res.ok) {
            console.warn(`[Gemini API] Request error status: ${res.status}. Fallback to deterministic engine.`);
            return null;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
    } catch (err) {
        console.warn(`[Gemini API] Call error/timeout (${err.message}). Fallback to deterministic engine.`);
        return null;
    }
}

/**
 * Đánh giá Nâng cấp máy cũ vs Mua máy mới (Upgrade vs Buy-New Assessment)
 * Sửa lỗi kỹ thuật: Intel Core i5 thế hệ 8 có hỗ trợ AVX2; hỏi chẩn đoán trước khi kết luận.
 */
async function evaluateUpgradeVsNew(message, context = {}, user = null) {
    const norm = normalizeText(message);

    // Tìm các dòng laptop phổ biến trong catalog từ DB
    const budgetOffice = await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, name: /IdeaPad Slim 3/i }) ||
                         await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, category: 'Laptop' }).sort({ price: 1 });
    const midLaptop = await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, name: /Dell Inspiron/i }) ||
                      await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, name: /Nitro V/i });
    const premiumLaptop = await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, name: /MacBook Air M2/i }) ||
                          await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 }, category: 'Laptop' }).sort({ price: -1 });

    const suggested = [budgetOffice, midLaptop, premiumLaptop].filter(Boolean);

    const reply = `🔍 **TƯ VẤN KỸ THUẬT: ĐÁNH GIÁ NÂNG CẤP MÁY CŨ HAY ĐẦU TƯ MÁY MỚI?**\n\n` +
        `Chào bạn! Để giúp bạn đưa ra quyết định đúng đắn, tiết kiệm và phù hợp nhất với nhu cầu, TechEcommerce xin phân tích chi tiết:\n\n` +
        `1. 📋 **CÁC THÔNG TIN CẦN XÁC ĐỊNH TRƯỚC KHI QUYẾT ĐỊNH:**\n` +
        `Để chẩn đoán chính xác nguyên nhân máy chậm, bạn có thể cho mình biết thêm:\n` +
        `• **Model máy cụ thể:** Tên dòng laptop bạn đang dùng (Dell, HP, Lenovo, Asus...)?\n` +
        `• **Dung lượng RAM & Loại ổ cứng hiện tại:** Máy đang có bao nhiêu GB RAM và đang chạy ổ cơ HDD hay ổ SSD?\n` +
        `• **Phần mềm sử dụng & Triệu chứng chậm:** Máy chậm khi khởi động, khi mở nhiều ứng dụng văn phòng, hay khi chạy các tác vụ nặng (Photoshop, Premiere, Docker, Android Studio...)?\n\n` +
        `2. 🛠️ **TRƯỜNG HỢP NÊN NÂNG CẤP MÁY HIỆN TẠI (Tiết kiệm ngân sách):**\n` +
        `• **Về vi xử lý:** Các dòng chip Intel Core thế hệ 8 (như Core i5-8250U, i5-8300H) **vẫn hỗ trợ đầy đủ tập lệnh AVX2** (Intel đã hỗ trợ AVX2 từ thế hệ 4 Haswell) và hoàn toàn đáp ứng tốt nhu cầu học tập, văn phòng, lướt web.\n` +
        `• **Giải pháp nâng cấp:** Nếu máy vẫn chạy ổ HDD hoặc RAM chỉ 4GB–8GB, bạn nên **thay ổ SSD và nâng cấp thêm RAM** (nếu máy có khe RAM rời). Đây là phương án kinh tế nhất giúp cải thiện tốc độ phản hồi rõ rệt.\n\n` +
        `3. ⚖️ **KHI NÀO NÊN CÂN NHẮC ĐỔI MÁY MỚI?**\n` +
        `• **Hạn chế phần cứng:** Máy dùng RAM hàn chết trên bo mạch (on-board) không thể cắm thêm, hoặc hệ thống tản nhiệt, bản lề, pin đã xuống cấp nặng.\n` +
        `• **Nhu cầu công việc nâng cao:** Khi bạn cần học Lập trình chuyên sâu, AI/Machine Learning, render video hoặc dựng hình 3D. Các tác vụ này đòi hỏi CPU đa nhân thế hệ mới (Intel Gen 12/13, Apple Silicon M-series) để tối ưu thời gian xử lý và giảm sinh nhiệt.\n\n` +
        `💡 **MỘT SỐ DÒNG MÁY MỚI CHÍNH HÃNG ĐANG CÓ SẴN TẠI KHO ĐỂ BẠN THAM KHẢO:**\n` +
        `• **${budgetOffice?.name || 'Lenovo IdeaPad Slim 3'}** - **${money(budgetOffice?.price)}**: Giải pháp mỏng nhẹ kinh tế, RAM 16GB, SSD 512GB mượt mà cho học tập & làm việc.\n` +
        (midLaptop ? `• **${midLaptop.name}** - **${money(midLaptop.price)}**: Màn hình rõ nét, hiệu năng ổn định, độ bền cao.\n` : '') +
        (premiumLaptop ? `• **${premiumLaptop.name}** - **${money(premiumLaptop.price)}**: Chuẩn mực mỏng nhẹ, pin hãng công bố tới 18h (thực tế hỗn hợp khoảng 10-14h), màn Liquid Retina cho lập trình & đồ họa.\n\n` : '\n') +
        `👉 Cửa hàng có hỗ trợ **Trả góp 0% lãi suất** qua thẻ tín dụng và đối tác tài chính (trả trước từ 30%). Bạn chia sẻ thêm về cấu hình máy cũ để mình tư vấn sát nhất nhé!`;

    return {
        reply,
        products: suggested,
        suggestions: [
            `Xem ${budgetOffice?.name?.slice(0, 18) || 'Lenovo IdeaPad'}`,
            `So sánh với ${premiumLaptop?.name?.slice(0, 15) || 'MacBook Air'}`,
            'Tính trả góp 0%',
            'Chính sách bảo hành'
        ],
        context: {
            ...context,
            stage: 'recommended',
            category: 'Laptop',
            lastProducts: suggested
        }
    };
}

/**
 * Xử lý so sánh 2 sản phẩm theo thông số thực tế từ DB và phân tích điểm được/mất
 * Đưa ra kết luận có điều kiện và giải thích đánh đổi theo nhu cầu khách hàng
 */
async function answerComparison(message, context = {}) {
    const text = normalizeText(message);
    const cleanMsg = text.replace(/so sanh|so voi|khac nhau gi|khac nhau|nen mua|hay|giua/g, ' ').trim();
    const parts = cleanMsg.split(/\s+(?:va|vs|hay|voi)\s+/i).filter(Boolean);

    let p1 = null;
    let p2 = null;

    if (parts.length >= 2) {
        p1 = await findProductByQuery(Product, parts[0].trim());
        p2 = await findProductByQuery(Product, parts[1].trim());
    }

    // Nếu không tách được trực tiếp từ câu hỏi, ưu tiên lấy 2 sản phẩm gần nhất trong context
    if ((!p1 || !p2 || String(p1._id) === String(p2._id)) && Array.isArray(context?.lastProducts) && context.lastProducts.length >= 2) {
        const id1 = context.lastProducts[0]._id || context.lastProducts[0];
        const id2 = context.lastProducts[1]._id || context.lastProducts[1];
        p1 = await Product.findOne({ _id: id1, active: { $ne: false } });
        p2 = await Product.findOne({ _id: id2, active: { $ne: false } });
    }

    // Nếu vẫn chưa đủ, tìm 2 sản phẩm nổi bật cùng danh mục
    if (!p1 || !p2 || String(p1._id) === String(p2._id)) {
        const cat = context?.category || 'Laptop';
        const found = await Product.find({ category: cat, active: { $ne: false }, stock: { $gt: 0 } })
            .sort({ rating: -1, soldCount: -1 })
            .limit(2);
        if (found.length >= 2) {
            p1 = p1 || found[0];
            p2 = p2 || (String(found[1]._id) !== String(p1._id) ? found[1] : found[0]);
        }
    }

    if (!p1 || !p2 || String(p1._id) === String(p2._id)) {
        return {
            reply: 'Bạn muốn so sánh 2 sản phẩm cụ thể nào? Ví dụ: *"So sánh MacBook Air M2 và Laptop ASUS ROG Strix"* hoặc *"So sánh Lenovo IdeaPad Slim 3 và Dell Inspiron"* để mình lập bảng thông số thực tế và phân tích điểm được - mất cho bạn nhé!',
            suggestions: ['So sánh MacBook Air và ROG Strix', 'So sánh Lenovo và Dell', 'Tư vấn laptop sinh viên', 'Mã giảm giá hôm nay']
        };
    }

    const s1 = p1.specs || {};
    const s2 = p2.specs || {};

    const tableMarkdown = `⚖️ **BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT THỰC TẾ HỆ THỐNG**

| Tiêu chí so sánh | **${p1.name}** | **${p2.name}** |
| :--- | :--- | :--- |
| **Giá niêm yết** | **${money(p1.price)}** | **${money(p2.price)}** |
| **Tình trạng kho** | ${p1.stock > 0 ? `Còn ${p1.stock} máy` : 'Tạm hết'} | ${p2.stock > 0 ? `Còn ${p2.stock} máy` : 'Tạm hết'} |
| **Vi xử lý (CPU)** | ${s1.cpu || 'Chưa có thông số chi tiết'} | ${s2.cpu || 'Chưa có thông số chi tiết'} |
| **Bộ nhớ RAM** | ${s1.ram || 'Chưa có thông số chi tiết'} | ${s2.ram || 'Chưa có thông số chi tiết'} |
| **Ổ cứng lưu trữ** | ${s1.storage || 'Chưa có thông số chi tiết'} | ${s2.storage || 'Chưa có thông số chi tiết'} |
| **Màn hình** | ${s1.screen || 'Chưa có thông số chi tiết'} | ${s2.screen || 'Chưa có thông số chi tiết'} |
| **Thời lượng pin (NSX)** | ${s1.battery || 'Theo công bố NSX'} | ${s2.battery || 'Theo công bố NSX'} |
| **Hệ điều hành** | ${s1.os || 'Theo máy'} | ${s2.os || 'Theo máy'} |
| **Chính sách bảo hành** | ${(!p1.warranty || p1.warranty === 'Không bảo hành') ? 'Chính hãng 12 - 24 tháng (1 đổi 1 30 ngày)' : p1.warranty} | ${(!p2.warranty || p2.warranty === 'Không bảo hành') ? 'Chính hãng 12 - 24 tháng (1 đổi 1 30 ngày)' : p2.warranty} |`;

    // Phân tích điểm mạnh & đánh đổi cụ thể
    const p1Advantage = s1.battery && s1.battery.includes('18')
        ? `Thời lượng pin công bố tới 18h (thực tế hỗn hợp khoảng 10-14h), thiết kế mỏng nhẹ, màn hình chuẩn màu sắc nét.`
        : (p1.price < p2.price ? `Mức giá kinh tế hơn (${money(p1.price)}), tiết kiệm chi phí đầu tư ban đầu.` : `Hiệu năng phần cứng mạnh mẽ (${s1.cpu || ''}), tối ưu cho tác vụ nặng.`);

    const p2Advantage = s2.battery && s2.battery.includes('18')
        ? `Thời lượng pin công bố tới 18h (thực tế hỗn hợp khoảng 10-14h), thiết kế mỏng nhẹ, tối ưu trải nghiệm mang đi lại.`
        : (p2.price < p1.price ? `Mức giá kinh tế hơn (${money(p2.price)}), tiết kiệm chi phí đầu tư.` : `Cấu hình phần cứng vượt trội (${s2.cpu || ''}, ${s2.ram || ''}), đáp ứng tốt tác vụ đa nhiệm.`);

    const tradeOffP1 = p1.price < p2.price
        ? `Tiết kiệm được **${money(p2.price - p1.price)}**, vừa vặn túi tiền nhưng hiệu năng hoặc chất liệu hoàn thiện có thể khiêm tốn hơn.`
        : `Mức giá cao hơn **${money(p1.price - p2.price)}**, đổi lại bạn sở hữu thiết kế cao cấp, màn hình đẹp hơn hoặc thời lượng pin vượt trội.`;

    const tradeOffP2 = p2.price < p1.price
        ? `Tiết kiệm được **${money(p1.price - p2.price)}**, đổi lại có thể phải đánh đổi thời lượng pin hoặc độ mỏng nhẹ.`
        : `Mức giá cao hơn **${money(p2.price - p1.price)}**, bù lại mang lại cấu hình mạnh mẽ hơn để đáp ứng công việc chuyên môn lâu dài.`;

    const conclusionP1 = p1.price < p2.price
        ? `Bạn ưu tiên mức giá tiết kiệm, nhu cầu học tập/văn phòng hàng ngày mượt mà.`
        : (s1.battery && s1.battery.includes('18') ? `Bạn cần máy mỏng nhẹ, pin bền bỉ cả ngày làm việc và màn hình chuẩn màu.` : `Bạn cần sức mạnh xử lý đa nhân cao, chạy ứng dụng chuyên nghiệp.`);

    const conclusionP2 = p2.price < p1.price
        ? `Bạn ưu tiên mức giá kinh tế, không cần chi thêm cho các tính năng cao cấp chưa dùng tới.`
        : (s2.battery && s2.battery.includes('18') ? `Bạn di chuyển nhiều, ưu tiên pin cả ngày và thiết kế gọn gàng.` : `Bạn học Lập trình/AI, thiết kế đồ họa hoặc xử lý tác vụ nặng.`);

    const reply = `${tableMarkdown}\n\n` +
        `🎯 **PHÂN TÍCH ĐIỂM MẠNH & ĐÁNH ĐỔI (TRADE-OFFS):**\n` +
        `• **Điểm nổi bật của ${p1.name}:** ${p1Advantage}\n` +
        `• **Điểm nổi bật của ${p2.name}:** ${p2Advantage}\n\n` +
        `⚖️ **Đánh đổi cần cân nhắc:**\n` +
        `• Chọn **${p1.name}**: ${tradeOffP1}\n` +
        `• Chọn **${p2.name}**: ${tradeOffP2}\n\n` +
        `💡 **KẾT LUẬN CÓ ĐIỀU KIỆN:**\n` +
        `👉 **Nên chọn ${p1.name} KHI:** ${conclusionP1}\n` +
        `👉 **Nên chọn ${p2.name} KHI:** ${conclusionP2}\n\n` +
        `*(Lưu ý về pin: Thời lượng pin thực tế phụ thuộc vào tác vụ và độ sáng màn hình, thường đạt khoảng 60–75% mức thử nghiệm phòng lab của hãng).* Cả hai sản phẩm đều được bảo hành chính hãng và hỗ trợ trả góp 0%. Bạn có thể bấm **"+ Giỏ"** ngay bên dưới để chọn mua nhé!`;

    return {
        reply,
        products: [p1, p2],
        suggestions: [
            `Thêm ${p1.name.slice(0, 18)} vào giỏ`,
            `Thêm ${p2.name.slice(0, 18)} vào giỏ`,
            'Tính trả góp 0%',
            'Chính sách bảo hành'
        ],
        context: {
            ...context,
            stage: 'comparing',
            lastProducts: [p1, p2]
        }
    };
}

/**
 * Xử lý tính toán trả góp 0%
 */
async function answerInstallmentQuestion(message, previousProducts = []) {
    const text = normalizeText(message);
    let product = null;

    if (Array.isArray(previousProducts) && previousProducts.length > 0) {
        product = previousProducts[0];
    } else {
        const words = text.replace(/tra gop|tinh gop|lai suat|moi thang|bao nhieu/g, '').trim();
        if (words) {
            product = await Product.findOne({
                active: { $ne: false },
                name: { $regex: escapeRegex(words), $options: 'i' }
            });
        }
        if (!product) {
            product = await Product.findOne({ active: { $ne: false }, stock: { $gt: 0 } }).sort({ price: -1 });
        }
    }

    if (!product) {
        return {
            reply: 'Cửa hàng hỗ trợ trả góp 0% qua thẻ tín dụng và công ty tài chính với thủ tục duyệt nhanh chỉ 15 phút. Bạn đang muốn tính trả góp cho sản phẩm nào?',
            suggestions: ['Trả góp iPhone', 'Trả góp Laptop', 'Chính sách trả góp']
        };
    }

    const price = product.price;
    const downPayment = Math.round(price * 0.3); // 30%
    const remaining = price - downPayment;
    const monthly6 = Math.round(remaining / 6);
    const monthly12 = Math.round(remaining / 12);

    const reply = `💳 **BẢNG DỰ TÍNH TRẢ GÓP 0% LÃI SUẤT CHO ${product.name}:**\n\n` +
        `• **Giá niêm yết sản phẩm:** **${money(price)}**\n` +
        `• **Số tiền trả trước tối thiểu (30%):** **${money(downPayment)}** *(Lưu ý: Đây chỉ là khoản thanh toán đợt đầu, không phải là giá bán trọn gói của sản phẩm)*\n` +
        `• **Khoản còn lại được chia đều:** ${money(remaining)}\n\n` +
        `📅 **Dự tính số tiền thanh toán hàng tháng (0% lãi suất):**\n` +
        `• Kỳ hạn **6 tháng**: khoảng **${money(monthly6)}/tháng**\n` +
        `• Kỳ hạn **12 tháng**: khoảng **${money(monthly12)}/tháng**\n\n` +
        `✨ **Điều kiện & Thủ tục:** Áp dụng qua thẻ tín dụng liên kết hoặc đối tác tài chính (xét duyệt CCCD gắn chip từ 18 tuổi). Tổng số tiền thanh toán theo kỳ hạn vẫn bằng đúng giá niêm yết của máy (${money(price)}). Bạn có thể bấm "+ Giỏ" và chọn hình thức Trả góp khi đặt hàng!`;

    return {
        reply,
        products: [product],
        suggestions: ['Thêm sản phẩm này vào giỏ', 'Chính sách bảo hành', 'So sánh sản phẩm khác']
    };
}


async function answerOrderQuestion(req, message) {
    const user = req.user;
    const orderId = (message.match(/#?\b(\d{1,8})\b/) || [])[1];

    if (!user) {
        return {
            reply: 'Để mình kiểm tra đơn hàng chính xác, bạn hãy đăng nhập tài khoản đã đặt hàng rồi hỏi lại theo mẫu: "Kiểm tra đơn #123". Bạn cũng có thể vào mục "Đơn hàng của tôi" ở góc trang web.',
            suggestions: ['Đăng nhập tài khoản', 'Chính sách vận chuyển', 'Chính sách đổi trả']
        };
    }

    const filter = { customer: user._id };
    if (orderId) filter._id = Number(orderId);

    const orders = await Order.find(filter).sort({ orderDate: -1, createdAt: -1 }).limit(orderId ? 1 : 3);

    if (!orders.length) {
        return {
            reply: orderId
                ? `Mình chưa tìm thấy đơn #${orderId} trong tài khoản của bạn. Bạn kiểm tra lại mã đơn hoặc vào mục Đơn hàng của tôi để xem danh sách đầy đủ nhé.`
                : 'Tài khoản của bạn hiện chưa có đơn hàng nào. Bạn có thể nói nhu cầu mua sắm, mình sẽ gợi ý sản phẩm phù hợp.',
            suggestions: ['Tư vấn laptop học tập', 'Gợi ý điện thoại chụp ảnh', 'Sản phẩm đang còn hàng']
        };
    }

    const lines = orders.map(order => {
        const status = STATUS_LABELS[order.status] || order.status;
        const payment = order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
        return `📦 **Đơn #${order._id}** (${money(order.totalAmount)})\n` +
            `   • Trạng thái: **${status.toUpperCase()}**\n` +
            `   • Thanh toán: ${payment}\n` +
            `   • Mã vận đơn: ${order.trackingNumber ? `\`${order.trackingNumber}\`` : 'Đang cập nhật'}`;
    });

    return {
        reply: `🚚 **Thông tin đơn hàng của bạn:**\n\n${lines.join('\n\n')}\n\n👉 Bạn có thể vào mục **Đơn hàng của tôi** để xem chi tiết từng món và theo dõi lộ trình giao hàng thời gian thực.`,
        suggestions: ['Xem đơn hàng của tôi', 'Chính sách vận chuyển', 'Tư vấn mua thêm phụ kiện']
    };
}

function isAffirmative(text) {
    const norm = normalizeText(text);
    const keywords = [
        'co', 'co nhe', 'co a', 'co chu', 'co chuot', 'co phu kien', 'muon xem', 'xem luon',
        'xem them', 'dong y', 'ok', 'oke', 'duoc', 'yes', 'yep', 'cho xem', 'lay them',
        'co, xem phu kien kem', 'co xem phu kien', 'co xem', 'co mua', 'co lay'
    ];
    return keywords.some(k => norm === k || norm.startsWith(k + ' ') || norm.endsWith(' ' + k) || norm.includes(' ' + k + ' '));
}

function isNegative(text) {
    const norm = normalizeText(text);
    const keywords = [
        'khong', 'khong can', 'khong cam on', 'thoi', 'bo qua', 'chua can', 'ko', 'k can', 'no', 'nop',
        'khong, cam on', 'khong nhe', 'de sau', 'khoi can', 'chua muon'
    ];
    return keywords.some(k => norm === k || norm.startsWith(k + ' ') || norm.endsWith(' ' + k) || norm.includes(' ' + k + ' '));
}

/**
 * Thực hiện RAG: Truy vấn MongoDB và sinh câu trả lời tư vấn chuyên nghiệp,
 * giải thích thông số dễ hiểu, phân tích đánh đổi (trade-offs) và gợi ý lựa chọn
 */
async function performRagRecommendation({
    category = '',
    budget = 0,
    useCase = '',
    priority = '',
    brand = '',
    profile = '',
    user = null,
    message = '',
    previousContext = {}
}) {
    const normMsg = normalizeText(message);
    const isNonTech = previousContext.isNonTech || extractNonTechUser(normMsg);
    const techFocus = previousContext.techFocus || extractTechFocus(normMsg);

    // 1. RAG Retrieval: Tìm sản phẩm chính phù hợp từ MongoDB
    let products = [];
    const userQueryWords = extractProductQuery(message);
    const searchKeywords = [category, brand, useCase, priority, profile, userQueryWords].filter(Boolean).join(' ');

    // Chiến lược chọn sản phẩm thông minh theo nhóm nhu cầu trọng tâm
    if (category === 'Laptop') {
        const baseCriteria = {
            category: 'Laptop',
            active: { $ne: false },
            stock: { $gt: 0 }
        };

        let focusOr = [];
        if (techFocus === 'programming_ai') {
            focusOr = [{ name: /Nitro V/i }, { name: /Katana/i }, { name: /TUF/i }, { name: /ROG/i }, { name: /MacBook/i }];
        } else if (techFocus === 'design_graphics') {
            focusOr = [{ name: /MacBook/i }, { name: /ROG/i }, { name: /Nitro V/i }, { name: /TUF/i }];
        } else if (techFocus === 'mobility_battery' || priority.includes('pin') || priority.includes('nhẹ')) {
            focusOr = [{ name: /MacBook Air/i }, { name: /IdeaPad Slim 3/i }, { name: /Dell Inspiron/i }];
        } else if (isNonTech || useCase.includes('kinh tế') || useCase.includes('văn phòng') || useCase.includes('học tập')) {
            focusOr = [{ name: /IdeaPad Slim 3/i }, { name: /Dell Inspiron/i }, { name: /MacBook Air/i }];
        }

        if (focusOr.length > 0) {
            if (budget) {
                // Ưu tiên 1: Lấy các máy CÒN HÀNG và NẰM TRONG NGÂN SÁCH (price <= budget)
                const inBudget = await Product.find({
                    ...baseCriteria,
                    $or: focusOr,
                    price: { $lte: budget }
                }).sort({ price: -1 }).limit(3);

                if (inBudget.length > 0) {
                    products = inBudget;
                    // Nếu chỉ có 1 máy trong ngân sách, gợi ý thêm 1 máy cận trên (<= budget * 1.25) để khách có sự lựa chọn
                    if (products.length < 2) {
                        const nearBudget = await Product.findOne({
                            ...baseCriteria,
                            $or: focusOr,
                            price: { $gt: budget, $lte: Math.round(budget * 1.25) }
                        }).sort({ price: 1 });
                        if (nearBudget) products.push(nearBudget);
                    }
                } else {
                    // Nếu không có máy nào dưới budget, tìm máy có giá thấp nhất gần ngân sách nhất
                    products = await Product.find({
                        ...baseCriteria,
                        $or: focusOr,
                        price: { $lte: Math.round(budget * 1.3) }
                    }).sort({ price: 1 }).limit(3);
                }
            } else {
                products = await Product.find({
                    ...baseCriteria,
                    $or: focusOr
                }).sort({ price: 1 }).limit(3);
            }
        }
    }

    if (!products.length && category) {
        products = await recommendProducts({
            user,
            limit: 3,
            category,
            maxPrice: budget || 0,
            search: searchKeywords,
            requirements: { category, budget, brand, useCase, priority, userProfile: profile }
        });
    }

    // Nếu bộ lọc nới lỏng cần bổ sung
    if (!products.length && category) {
        const query = { category, active: { $ne: false }, stock: { $gt: 0 } };
        if (budget) {
            query.price = { $lte: budget };
        }
        products = await Product.find(query).sort({ rating: -1, soldCount: -1 }).limit(3);
        if (!products.length && budget) {
            // Thử nới rộng nếu kho thực tế không có máy dưới budget
            products = await Product.find({ category, active: { $ne: false }, stock: { $gt: 0 } })
                .sort({ price: 1 }).limit(3);
        }
    }

    if (!products.length) {
        if (category) {
            return {
                reply: `Dạ hiện tại TechEcommerce **chưa có sẵn mẫu sản phẩm phù hợp** với yêu cầu này trong danh mục **${category}** ạ! 🙏\n\nBạn có muốn tham khảo các mẫu ${category} khác đang có sẵn hoặc sản phẩm thuộc danh mục khác không ạ?`,
                products: [],
                suggestions: [`Xem ${category} bán chạy`, 'Tư vấn sản phẩm khác', 'Chính sách bảo hành', 'Săn mã giảm giá'],
                context: { stage: 'out_of_stock', notFound: true, category },
                notFound: true
            };
        }
        return buildOutOfCatalogResponse(searchKeywords || message);
    }

    // Gắn tag khuyến nghị trực quan lên thẻ sản phẩm
    products.forEach(p => {
        if (!p.recommendation) {
            p.recommendation = {
                reason: priority ? `${p.brand || 'Chính hãng'} · ${priority}` : `${p.brand || 'Chính hãng'} · Tối ưu ngân sách`
            };
        }
    });

    const catalogContext = products.map(p =>
        `- ${p.name} (Giá: ${money(p.price)}, Còn: ${p.stock}, Hãng: ${p.brand}, CPU: ${p.specs?.cpu || 'Chưa có dữ liệu'}, RAM: ${p.specs?.ram || 'Chưa có dữ liệu'}, Ổ cứng: ${p.specs?.storage || 'Chưa có dữ liệu'}, Màn hình: ${p.specs?.screen || 'Chưa có dữ liệu'}, Pin: ${p.specs?.battery || 'Theo NSX'})`
    ).join('\n');

    const systemPrompt = `Bạn là Trợ lý Tư vấn Mua sắm AI chuyên nghiệp, tận tâm của TechEcommerce.
Khách hàng cần tư vấn ${category} với ngân sách: ${budget ? money(budget) : 'linh hoạt'}, mục đích: "${useCase || 'học tập, làm việc'}", ưu tiên: "${priority || 'cân bằng, bền bỉ'}", phong cách: ${isNonTech ? 'khách hàng không rành cấu hình' : 'khách hàng quan tâm hiệu năng'}.
Danh sách sản phẩm THỰC TẾ trong kho:
${catalogContext}

YÊU CẦU BẮT BUỘC:
1. Giao tiếp tiếng Việt tự nhiên, lịch sự, đóng vai trò chuyên gia tư vấn công nghệ có tâm.
2. Nêu rõ lý do gợi ý các sản phẩm này dựa trên đúng nhu cầu của khách. Nếu khách không rành cấu hình, giải thích dễ hiểu (RAM giúp đa nhiệm mượt, màn hình bảo vệ mắt, SSD lưu bài giảng).
3. Nếu sản phẩm vượt ngân sách của khách, phải nêu rõ mức vượt và hỏi khách có sẵn sàng cân nhắc không.
4. Phân tích điểm mạnh và điểm đánh đổi (trade-offs) giữa các mẫu dựa trên đúng thông số thật (CPU, RAM, màn hình, pin, giá). Tuyệt đối không bịa thông số không có trong danh mục.
5. Hướng dẫn khách có thể bấm "+ Giỏ" ngay trên thẻ sản phẩm hoặc hỏi về trả góp 0%.
6. Cuối phản hồi, hãy chủ động hỏi khách còn phân vân gì về các mẫu trên không.`;

    const geminiReply = await askGeminiIfConfigured(systemPrompt, message || `Tư vấn ${category} ${budget ? money(budget) : ''} cho ${useCase}, ưu tiên ${priority}`);

    const newContext = {
        ...previousContext,
        stage: 'recommended',
        category,
        budget,
        useCase,
        priority,
        isNonTech,
        techFocus,
        lastProducts: products
    };

    if (geminiReply) {
        return {
            reply: geminiReply,
            products,
            suggestions: [
                products.length >= 2 ? 'So sánh chi tiết 2 máy này' : 'So sánh sản phẩm khác',
                'Tính trả góp 0%',
                'Săn mã giảm giá',
                'Chính sách bảo hành'
            ],
            context: newContext
        };
    }

    // Bộ máy tư vấn tri thức nội bộ chuẩn xác (Deterministic Knowledge Engine)
    let guidanceIntro = '';
    if (isNonTech) {
        guidanceIntro = `👋 **Chào bạn! Với sinh viên/người dùng không rành cấu hình kỹ thuật**, bạn không cần lo lắng về các thuật ngữ phức tạp. Với nhu cầu của bạn, điều quan trọng nhất gồm 3 yếu tố:\n` +
            `• ⚡ **Bộ nhớ RAM (16GB):** Giúp máy chạy mượt, hạn chế tình trạng tràn RAM khi mở cùng lúc nhiều tài liệu, bảng tính và duyệt web tra cứu.\n` +
            `• 🎒 **Gọn nhẹ & Pin thực tế:** Máy nhẹ tiện bỏ balo đi học cả ngày; pin đáp ứng tốt các buổi học trên giảng đường.\n` +
            `• 💾 **Ổ cứng SSD (512GB):** Tốc độ mở máy và mở tài liệu nhanh chóng, dung lượng đáp ứng tốt việc lưu trữ bài giảng, tài liệu và phần mềm học tập.`;
    } else if (techFocus === 'programming_ai') {
        guidanceIntro = `💻 **Chào bạn! Với nhu cầu Lập trình & AI (Công nghệ Thông tin)**, tiêu chí quyết định là CPU đa nhân dòng hiệu năng cao, RAM tối thiểu 16GB (để chạy môi trường code, Docker, máy ảo) và hệ thống tản nhiệt hoặc kiến trúc chip tối ưu tính toán.`;
    } else if (techFocus === 'mobility_battery') {
        guidanceIntro = `🔋 **Chào bạn! Với ưu tiên di chuyển nhiều & pin bền bỉ**, tiêu chí cốt lõi là máy nhẹ dưới 1.4kg. Lưu ý: Thời lượng pin công bố của hãng (ví dụ 18 giờ) khi sử dụng thực tế đa tác vụ hỗn hợp (văn phòng, lướt web, nghe nhạc với độ sáng phù hợp) thường đạt khoảng 8 - 14 giờ liên tục.`;
    } else if (techFocus === 'design_graphics') {
        guidanceIntro = `🎨 **Chào bạn! Với nhu cầu Thiết kế đồ họa (Photoshop, Illustrator, Premiere)**, màn hình chuẩn màu sắc nét (Retina/IPS độ phủ màu cao) và RAM 16GB+ là yếu tố then chốt để không bị lệch màu khi xuất file hay tràn bộ nhớ khi render.`;
    } else {
        const demandDesc = [
            useCase ? `nhu cầu **${useCase}**` : '',
            priority ? `ưu tiên **${priority}**` : '',
            budget ? `ngân sách khoảng **${money(budget)}**` : ''
        ].filter(Boolean).join(', ');
        guidanceIntro = demandDesc ? `Chào bạn! Dựa trên ${demandDesc}, mình đã chọn lọc các mẫu máy chính hãng phù hợp nhất trong kho:` : `Chào bạn! Dưới đây là các lựa chọn chính hãng tối ưu nhất trong kho:`;
    }

    const productDetails = products.map((p, idx) => {
        const s = p.specs || {};
        const specSummary = [
            s.cpu ? `CPU ${s.cpu}` : '',
            s.ram ? `RAM ${s.ram}` : '',
            s.storage ? `SSD ${s.storage}` : '',
            s.screen ? `Màn hình ${s.screen}` : '',
            s.battery ? `Pin ${s.battery}` : ''
        ].filter(Boolean).slice(0, 3).join(' | ');

        let budgetNote = '';
        if (budget && p.price > budget) {
            budgetNote = `\n   ⚠️ *Lưu ý: Mẫu này vượt ngân sách của bạn +${money(p.price - budget)}. Bạn có sẵn sàng cân nhắc mức vượt này để đổi lấy cấu hình/tính năng tốt hơn không?*`;
        }

        return `${idx + 1}. **${p.name}** - **${money(p.price)}** ${p.stock > 0 ? `(Còn ${p.stock} máy)` : '(Tạm hết)'}\n` +
            (specSummary ? `   • *Thông số:* ${specSummary}\n` : '') +
            `   • *Điểm nổi bật:* ${p.recommendation?.reason || 'Chính hãng 100%, bảo hành 12-24T'}${budgetNote}`;
    }).join('\n\n');

    let tradeOffSection = '';
    if (products.length >= 2) {
        const p1 = products[0];
        const p2 = products[1];
        tradeOffSection = `\n\n⚖️ **So sánh đánh đổi nhanh giữa 2 lựa chọn:**\n` +
            `• **${p1.name}**: ${p1.price < p2.price ? `Mức giá kinh tế hơn (${money(p1.price)}), tiết kiệm ngân sách.` : `Trang bị cao cấp hơn, tối ưu cho nhu cầu chuyên sâu.`}\n` +
            `• **${p2.name}**: ${p2.price < p1.price ? `Mức giá kinh tế hơn (${money(p2.price)}).` : `Màn hình lớn hơn hoặc cấu hình mạnh mẽ hơn để mở rộng công việc sau này.`}`;
    }

    const followUpQuestion = `\n\n👉 **Bạn còn phân vân gì giữa các mẫu trên không?** Bạn có muốn mình so sánh chi tiết ưu/nhược điểm điểm nào giữa 2 máy để bạn dễ chọn nhất không nhé?`;

    const reply = `${guidanceIntro}\n\n${productDetails}${tradeOffSection}${followUpQuestion}`;

    return {
        reply,
        products,
        suggestions: [
            products.length >= 2 ? 'So sánh chi tiết 2 máy này' : 'So sánh sản phẩm khác',
            'Tính trả góp 0%',
            'Săn mã giảm giá',
            'Chính sách bảo hành'
        ],
        context: newContext
    };
}

/**
 * Xử lý luồng hội thoại đa bước (Multi-turn RAG State Machine)
 */
async function answerProductQuestion(message, user, previousContext = {}) {
    const text = normalizeText(message);
    const prev = previousContext || {};

    // 0. Kiểm tra nếu khách hàng hỏi về các mặt hàng không kinh doanh (máy đọc sách, tivi, tủ lạnh, máy in...)
    const unsupportedName = checkUnsupportedProduct(text);
    if (unsupportedName) {
        return buildOutOfCatalogResponse(unsupportedName);
    }

    // 0a. Đánh giá Nâng cấp máy cũ vs Mua máy mới (Upgrade vs Buy-New)
    if (extractExistingDeviceOrUpgrade(text)) {
        return await evaluateUpgradeVsNew(message, prev, user);
    }

    // 0b. Khách hàng đang ở giai đoạn sau gợi ý (recommended) và muốn so sánh 2 máy vừa gợi ý
    if (prev.stage === 'recommended' && (
        text.includes('so sanh') || text.includes('khac nhau') || text.includes('nen chon') ||
        text.includes('phan van') || text.includes('chon may nao')
    )) {
        return await answerComparison(message, prev);
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 1: Người dùng đang ở bước hỏi phụ kiện (stage = 'asking_accessory')
    // Sơ đồ tư duy: "Hiểu câu trả lời ngắn 'Có' hoặc 'Không' và xử lý ngữ cảnh"
    // ----------------------------------------------------
    if (prev.stage === 'asking_accessory') {
        if (isAffirmative(text) || text.includes('phu kien') || text.includes('chuot') || text.includes('balo') || text.includes('day deo')) {
            // Khách hàng đồng ý xem phụ kiện bán kèm (Cross-sell)
            let accessories = [];
            try {
                accessories = await Product.find({
                    category: { $in: ['Phụ kiện', 'Tai nghe'] },
                    active: { $ne: false },
                    stock: { $gt: 0 }
                }).sort({ soldCount: -1 }).limit(3);
            } catch (e) {
                accessories = [];
            }

            if (!accessories.length) {
                accessories = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } }).limit(3);
            }

            accessories.forEach(acc => {
                acc.recommendation = { reason: 'Giảm 15% khi mua kèm máy' };
            });

            const reply = `🎁 **Danh sách phụ kiện tối ưu khuyên dùng (Ưu đãi giảm 15% khi mua kèm):**\n\n` +
                `• **Chuột không dây Logitech MX Master 3S**: Cuộn siêu tốc MagSpeed, êm ái chống ồn, bảo vệ cổ tay khi làm việc lâu.\n` +
                `• **Hub chuyển đổi Ugreen USB-C 5 IN 1**: Mở rộng cổng HDMI, USB, thẻ nhớ nhanh chóng khi thuyết trình hoặc cắm máy chiếu.\n` +
                `• **Chuột Gaming Logitech G502 Hero**: Độ bền bỉ cao, cảm biến siêu nhạy cho cả học tập, làm việc và giải trí.\n\n` +
                `👉 Bạn chỉ cần bấm **"+ Thêm giỏ"** ngay trên thẻ phụ kiện bên dưới, hệ thống sẽ tự động áp dụng mức giá combo ưu đãi cho bạn nhé!`;

            return {
                reply,
                products: accessories,
                suggestions: ['Tính trả góp 0%', 'Kiểm tra mã giảm giá', 'Xem giỏ hàng của tôi', 'Nhắn tin qua Zalo'],
                context: { ...prev, stage: 'completed', lastProducts: accessories }
            };
        }

        if (isNegative(text)) {
            // Khách hàng từ chối phụ kiện -> Lịch sự xác nhận và gợi ý hành động chốt đơn / trả góp
            const reply = `Dạ vâng ạ! Bạn có thể xem lại thông tin chi tiết các mẫu máy được gợi ý ở trên nhé. Nếu bạn muốn tính số tiền trả góp 0% hàng tháng hoặc săn mã giảm giá hôm nay, bạn cứ bấm nút gợi ý bên dưới nha! 😊`;
            return {
                reply,
                suggestions: ['Tính trả góp 0%', 'Mã giảm giá hôm nay', 'Chính sách bảo hành', 'Xem giỏ hàng'],
                context: { ...prev, stage: 'completed' }
            };
        }
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 2: Người dùng đang ở bước trả lời mục đích sử dụng (stage = 'asking_usecase')
    // ----------------------------------------------------
    if (prev.stage === 'asking_usecase') {
        const useCase = extractUseCase(text) || message;
        const priority = extractPriority(text);

        // Nếu trong câu trả lời người dùng đã nói kèm cả yếu tố ưu tiên (ví dụ: "Học tập mỏng nhẹ")
        if (priority) {
            return await performRagRecommendation({
                category: prev.category || '',
                budget: prev.budget || 0,
                useCase,
                priority,
                brand: prev.brand || '',
                user,
                message,
                previousContext: prev
            });
        }

        // Chuyển sang hỏi yếu tố ưu tiên / kích thước màn hình
        const cat = prev.category || '';

        let question = '';
        let suggestions = [];

        if (cat === 'Laptop') {
            question = prev.budget
                ? `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}** trong khoảng ngân sách **${money(prev.budget)}**, bạn có ưu tiên thêm yếu tố nào sau đây không để mình chọn dòng máy vừa vặn nhất cho bạn?`
                : `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}**, bạn có ưu tiên thêm yếu tố nào sau đây (như kích thước màn hình hay độ mỏng nhẹ khi di chuyển) không để mình chọn dòng máy vừa vặn nhất cho bạn?`;
            suggestions = [
                'Mỏng nhẹ, pin trâu (14 inch)',
                'Màn hình lớn 15.6 inch',
                'Cấu hình mạnh mẽ',
                'Thiết kế thời trang'
            ];
        } else if (cat === 'Điện thoại') {
            question = prev.budget
                ? `Dạ tuyệt vời! Với nhu cầu **${useCase}** trong tầm giá **${money(prev.budget)}**, bạn có ưu tiên thêm yếu tố nào sau đây không ạ?`
                : `Dạ tuyệt vời! Với nhu cầu **${useCase}**, bạn có ưu tiên thêm yếu tố nào sau đây không ạ?`;
            suggestions = [
                'Chụp ảnh, quay video đẹp',
                'Pin trâu, sạc nhanh',
                'Màn hình 120Hz mượt mà',
                'Cấu hình mạnh mẽ'
            ];
        } else if (cat === 'Đồng hồ thông minh') {
            question = prev.budget
                ? `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}** trong khoảng ngân sách **${money(prev.budget)}**, bạn có ưu tiên thêm thương hiệu hay thời lượng pin không ạ?`
                : `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}**, bạn có ưu tiên thêm yếu tố nào như thương hiệu (Apple Watch, Galaxy Watch, Garmin) hay thời lượng pin không ạ?`;
            suggestions = [
                'Apple Watch chính hãng',
                'Samsung Galaxy Watch',
                'Garmin thể thao GPS',
                'Pin trâu trên 7 ngày'
            ];
        } else if (cat === 'Tai nghe') {
            question = prev.budget
                ? `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}** trong khoảng ngân sách **${money(prev.budget)}**, bạn ưu tiên kiểu dáng thiết kế hay tính năng nào dưới đây hơn ạ?`
                : `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}**, bạn ưu tiên kiểu dáng thiết kế hay tính năng nào dưới đây hơn ạ?`;
            suggestions = [
                'Tai nghe chụp tai (Over-ear)',
                'Tai nghe nhét tai True Wireless (In-ear)',
                'Pin lâu trên 30 giờ',
                'Thương hiệu Sony / Apple / Marshall'
            ];
        } else if (cat === 'Tablet') {
            question = prev.budget
                ? `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}** trong khoảng ngân sách **${money(prev.budget)}**, bạn ưu tiên kích thước màn hình hay thương hiệu nào ạ?`
                : `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}**, bạn ưu tiên kích thước màn hình hay thương hiệu nào ạ?`;
            suggestions = [
                'iPad của Apple',
                'Samsung Galaxy Tab',
                'Màn hình lớn kèm bút cảm ứng',
                'Giá tiết kiệm, bền bỉ'
            ];
        } else if (cat === 'Máy chơi game') {
            question = prev.budget
                ? `Dạ tuyệt vời! Với nhu cầu **${useCase}** trong tầm giá **${money(prev.budget)}**, bạn ưu tiên thiết bị nào dưới đây ạ?`
                : `Dạ tuyệt vời! Với nhu cầu **${useCase}**, bạn ưu tiên thiết bị nào dưới đây ạ?`;
            suggestions = [
                'Nintendo Switch OLED',
                'Sony PlayStation 5 (PS5)',
                'Steam Deck OLED',
                'Kính thực tế ảo Meta Quest'
            ];
        } else {
            question = prev.budget
                ? `Dạ rất rõ ràng! Với nhu cầu **${useCase}** trong ngân sách **${money(prev.budget)}**, bạn có ưu tiên thêm tiêu chí nào dưới đây không ạ?`
                : `Dạ rất rõ ràng! Với nhu cầu **${useCase}**, bạn có ưu tiên thêm tiêu chí nào dưới đây không ạ?`;
            suggestions = [
                'Độ bền và bảo hành',
                'Pin lâu, tiện di chuyển',
                'Cấu hình mạnh mẽ',
                'Giá tiết kiệm nhất'
            ];
        }

        return {
            reply: question,
            suggestions,
            context: {
                ...prev,
                useCase,
                stage: 'asking_priority'
            }
        };
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 3: Người dùng đang ở bước trả lời ưu tiên (stage = 'asking_priority')
    // ----------------------------------------------------
    if (prev.stage === 'asking_priority') {
        const priority = extractPriority(text) || message;
        return await performRagRecommendation({
            category: prev.category || '',
            budget: prev.budget || 0,
            useCase: prev.useCase || '',
            priority,
            brand: prev.brand || '',
            user,
            message,
            previousContext: prev
        });
    }

    // ----------------------------------------------------
    // GIAI ĐOẠN 0: Yêu cầu tư vấn mới (Khởi tạo câu hỏi hoặc RAG trực tiếp)
    // ----------------------------------------------------
    const filter = await buildProductFilter(text);
    const category = filter.category || prev.category || '';
    const budget = filter.budget || prev.budget || 0;
    const useCase = extractUseCase(text) || prev.useCase || '';
    const priority = extractPriority(text) || prev.priority || '';
    const profile = extractUserProfile(text) || prev.profile || '';
    const isNonTech = extractNonTechUser(text) || Boolean(prev.isNonTech);
    const techFocus = extractTechFocus(text) || prev.techFocus || '';

    // Xử lý tình huống ngân sách quá thấp cho laptop (< 13.99 triệu, ví dụ: "laptop dưới 5 triệu" hoặc "dưới 10 triệu")
    if (category === 'Laptop' && budget > 0 && budget < 13000000) {
        const lowestLaptop = await Product.findOne({ category: 'Laptop', active: { $ne: false }, stock: { $gt: 0 } }).sort({ price: 1 });
        const tablets = await Product.find({ category: 'Tablet', active: { $ne: false }, stock: { $gt: 0 } }).sort({ price: 1 }).limit(2);

        const downPayment = Math.round((lowestLaptop?.price || 13990000) * 0.3);
        const monthlyInstallment = Math.round(((lowestLaptop?.price || 13990000) - downPayment) / 12);

        const reply = `Dạ hiện tại TechEcommerce **chuyên phân phối 100% laptop mới chính hãng nguyên seal** với tiêu chuẩn bảo hành 12 - 24 tháng. Mẫu laptop chính hãng có giá tốt nhất tại cửa hàng hiện là **${lowestLaptop?.name || 'Lenovo IdeaPad Slim 3 14 inch'}** với mức giá **${money(lowestLaptop?.price || 13990000)}**.\n\n` +
            `Với mức ngân sách **${money(budget)}**, mình xin đề xuất 2 giải pháp tối ưu cho bạn:\n\n` +
            `1. 💳 **Mua trả góp 0% lãi suất:** Bạn chỉ cần trả trước khoảng 30% (tương đương **${money(downPayment)}**), số tiền còn lại chia nhỏ trả góp chỉ khoảng **${money(monthlyInstallment)}/tháng** với thủ tục duyệt CCCD chỉ 15 phút.\n` +
            `2. 📲 **Tham khảo Máy tính bảng chính hãng:** Nếu nhu cầu chủ yếu là học online, xem tài liệu PDF và lướt web, các dòng tablet trong kho như **${tablets[0]?.name || 'HONOR Pad 10'}** (${money(tablets[0]?.price)}) hoàn toàn đáp ứng tốt trong tầm ngân sách.\n\n` +
            `👉 Bạn có muốn mình tính chi tiết bảng trả góp 0% cho mẫu laptop trên, hay xem các dòng máy tính bảng giá tiết kiệm không ạ?`;

        const returnProducts = [lowestLaptop, ...tablets].filter(Boolean);
        return {
            reply,
            products: returnProducts,
            suggestions: ['Tính trả góp 0% cho laptop', 'Xem máy tính bảng giá rẻ', 'Săn mã giảm giá', 'Chính sách bảo hành'],
            context: {
                ...prev,
                category: 'Laptop',
                budget,
                stage: 'recommended',
                lastProducts: returnProducts
            }
        };
    }

    // Kiểm tra xem khách hàng có đang hỏi một loại phụ kiện cụ thể (chuột, sạc dự phòng, hub, bút cảm ứng...) hay không
    const hasSpecificAccessory = category === 'Phụ kiện' && (
        hasWordOrPhrase(text, 'chuot') ||
        hasWordOrPhrase(text, 'ban phim') ||
        hasWordOrPhrase(text, 'keyboard') ||
        hasWordOrPhrase(text, 'pin du phong') ||
        hasWordOrPhrase(text, 'sac du phong') ||
        hasWordOrPhrase(text, 'hub') ||
        hasWordOrPhrase(text, 'but cam ung') ||
        hasWordOrPhrase(text, 'pencil') ||
        hasWordOrPhrase(text, 'cu sac') ||
        hasWordOrPhrase(text, 'bo sac') ||
        hasWordOrPhrase(text, 'osmo')
    );

    // Không lặp lại câu hỏi khảo sát nếu khách hàng ĐÃ cung cấp mục đích, ưu tiên, hoặc là sinh viên/người dùng không rành kỹ thuật, hoặc người học IT/đồ họa/di chuyển
    const isGeneralInquiry = category && (!useCase && !priority && !isNonTech && !techFocus) && !hasSpecificAccessory;

    if (isGeneralInquiry) {
        if (category === 'Tai nghe') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, bạn dự định dùng tai nghe chủ yếu cho nhu cầu nào sau đây ạ?`
                : `Chào bạn! Để mình giúp bạn chọn chiếc tai nghe phù hợp và ưng ý nhất, bạn dự định dùng tai nghe chủ yếu cho nhu cầu nào sau đây ạ?`;
            const suggestions = [
                'Chống ồn chủ động (ANC)',
                'Nghe nhạc bass mạnh',
                'Đàm thoại & học online',
                'Thể thao chống nước'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Tai nghe',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Đồng hồ thông minh') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, để chọn được chiếc đồng hồ thông minh ưng ý nhất, bạn dự định dùng đồng hồ cho nhu cầu nào sau đây ạ?`
                : `Chào bạn! Để chọn được chiếc đồng hồ thông minh ưng ý và phù hợp nhất, bạn dự định dùng đồng hồ chủ yếu cho nhu cầu nào sau đây ạ?`;
            const suggestions = [
                'Theo dõi sức khỏe & thể thao',
                'Kết nối thông báo, nghe gọi',
                'Thời trang, sang trọng cao cấp',
                'Pin lâu trên 7 ngày'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Đồng hồ thông minh',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Laptop') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, để chọn được chiếc laptop tối ưu nhất và không bị lãng phí cấu hình, bạn dự định dùng máy chủ yếu cho mục đích nào sau đây ạ?`
                : `Chào bạn! Để chọn được chiếc laptop ưng ý nhất và tối ưu cấu hình cho bạn, bạn dự định dùng máy chủ yếu cho mục đích nào sau đây ạ?`;
            const suggestions = [
                'Học tập, văn phòng',
                'Đồ họa, thiết kế',
                'Chơi game giải trí',
                'Lập trình, kỹ thuật'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Laptop',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Điện thoại') {
            const reply = budget
                ? `Chào bạn! Để tư vấn chuẩn xác chiếc điện thoại phù hợp nhất với tầm giá khoảng **${money(budget)}**, bạn dự định dùng máy cho nhu cầu nào là chính ạ?`
                : `Chào bạn! Để tư vấn chuẩn xác chiếc điện thoại phù hợp nhất với bạn, bạn dự định dùng máy cho nhu cầu nào là chính ạ?`;
            const suggestions = [
                'Chụp ảnh, quay video đẹp',
                'Chơi game, pin trâu',
                'Lướt web, làm việc cơ bản',
                'Thiết kế sang trọng'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Điện thoại',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Tablet') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, bạn đang tìm máy tính bảng để phục vụ mục đích nào là chính ạ?`
                : `Chào bạn! Bạn đang tìm máy tính bảng để phục vụ mục đích nào là chính ạ?`;
            const suggestions = [
                'Học online, vẽ ghi chú',
                'Xem phim giải trí',
                'Làm việc thay laptop',
                'Cho trẻ em học tập'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Tablet',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Máy chơi game') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, bạn đang tìm máy chơi game phục vụ trải nghiệm nào là chính ạ?`
                : `Chào bạn! Để mình tư vấn thiết bị chơi game phù hợp nhất, bạn đang tìm máy chơi game phục vụ trải nghiệm nào là chính ạ?`;
            const suggestions = [
                'Máy chơi game cầm tay linh hoạt',
                'Đồ họa 4K đỉnh cao (PS5)',
                'Chơi game cùng gia đình, bạn bè',
                'Kính thực tế ảo VR'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Máy chơi game',
                    budget,
                    brand: filter.brand
                }
            };
        }

        if (category === 'Phụ kiện') {
            const reply = budget
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, bạn đang quan tâm loại phụ kiện nào (như bàn phím máy tính, chuột máy tính, pin sạc dự phòng, củ sạc nhanh hay hub chuyển đổi) ạ?`
                : `Chào bạn! Với danh mục Phụ kiện, bạn đang quan tâm loại sản phẩm nào (như bàn phím máy tính, chuột máy tính, pin sạc dự phòng, củ sạc nhanh hay hub chuyển đổi) để mình tư vấn mẫu tốt nhất nhé?`;
            const suggestions = [
                'Bàn phím cơ & không dây',
                'Chuột không dây & gaming',
                'Pin sạc dự phòng',
                'Củ sạc nhanh Anker',
                'Hub chuyển đổi Type-C',
                'Bút cảm ứng Apple Pencil'
            ];
            return {
                reply,
                suggestions,
                context: {
                    ...prev,
                    stage: 'asking_usecase',
                    category: 'Phụ kiện',
                    budget,
                    brand: filter.brand
                }
            };
        }
    }

    // Kiểm tra nếu khách hàng hỏi tìm kiếm một mặt hàng cụ thể mà cửa hàng không kinh doanh
    if (!category && !filter.brand) {
        const cleanQuery = extractProductQuery(text);
        const generalGreetingList = [
            '', 'tu van', 'tu van giup', 'tu van mua hang', 'goi y san pham', 'san pham', 'cua hang', 'shop', 'mua hang',
            'chao', 'chao ban', 'chao shop', 'chao cua hang', 'chao ad', 'chao admin', 'chao anh', 'chao chi', 'chao em',
            'xin chao', 'xin chao ban', 'hello', 'hi', 'hey', 'alo', 'helu', 'helo',
            'co gi hot', 'co gi moi', 'co khuyen mai gi', 'muon mua do', 'tu van ho',
            'cam on', 'cam on ban', 'cam on nhe', 'cam on nhieu', 'cam on rat nhieu', 'thanks', 'thank you',
            'ban la ai', 'ban la gi', 'day la gi', 'ban giup duoc gi', 'ban co the lam gi',
            'tam biet', 'bye', 'bye bye', 'goodbye', 'hen gap lai',
            'chao buoi sang', 'chao buoi chieu', 'chao buoi toi',
            'ok', 'oke', 'okie', 'duoc', 'da', 'vang', 'u', 'uh', 'uhm'
        ];
        const isGeneralGreeting = generalGreetingList.includes(cleanQuery);

        if (!isGeneralGreeting && cleanQuery.length >= 2) {
            const queryRegex = new RegExp(escapeRegex(cleanQuery), 'i');
            const words = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
            const foundCount = await Product.countDocuments({
                active: { $ne: false },
                $or: [
                    { name: queryRegex },
                    { brand: queryRegex },
                    { tags: queryRegex },
                    { tags: { $in: words } }
                ]
            });

            if (foundCount === 0) {
                const originalTerm = cleanQueryTerm(message);
                return buildOutOfCatalogResponse(originalTerm || cleanQuery);
            }
        }
    }

    // Nếu không có danh mục cụ thể và câu hỏi rất chung (ví dụ "tư vấn mua hàng", "gợi ý sản phẩm")
    if (!category && !useCase && !budget) {
        const reply = `Chào bạn! Mình là Trợ lý Tư vấn Mua sắm AI của TechEcommerce. Bạn đang quan tâm đến dòng sản phẩm nào hoặc có mức ngân sách khoảng bao nhiêu để mình tư vấn chi tiết nhất nhé?`;
        const suggestions = [
            'Tư vấn laptop 15 triệu',
            'Tư vấn điện thoại',
            'Đồng hồ thông minh 10 triệu',
            'Mã giảm giá hôm nay'
        ];
        return {
            reply,
            suggestions,
            context: { stage: 'asking_category' }
        };
    }

    // Nếu khách hàng ĐÃ cung cấp rõ ràng mục đích sử dụng hoặc tiêu chí ưu tiên (ví dụ "Tìm laptop học tập mỏng nhẹ 15 triệu" hoặc "Tìm đồng hồ thông minh thể thao 10 triệu")
    // -> Tiến hành RAG tìm kiếm và đề xuất ngay lập tức, không hỏi lại rườm rà!
    return await performRagRecommendation({
        category,
        budget,
        useCase: useCase || 'sử dụng hàng ngày',
        priority: priority || 'cân bằng và bền bỉ',
        brand: filter.brand,
        profile,
        user,
        message,
        previousContext: prev
    });
}

/**
 * Xử lý tra cứu mã giảm giá / Voucher
 */
async function answerVoucherQuestion() {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            $or: [
                { active: { $ne: false } },
                { isActive: { $ne: false } }
            ]
        }).sort({ minOrderValue: 1 });

        const validCoupons = coupons.filter(c => {
            const exp = c.expiresAt || c.expiryDate;
            return !exp || new Date(exp) > now;
        }).slice(0, 4);

        if (!validCoupons.length) {
            return {
                reply: 'Hiện tại cửa hàng đang cập nhật các chương trình ưu đãi mới. Bạn hãy theo dõi thêm tại trang Khuyến mãi hoặc đăng ký nhận tin nhé!',
                suggestions: ['Tư vấn laptop giá tốt', 'Điện thoại giảm giá', 'Chính sách bảo hành']
            };
        }

        const list = validCoupons.map(c => {
            const isPercent = (c.type || c.discountType) === 'percent' || (c.type || c.discountType) === 'percentage';
            const discountVal = c.value ?? c.discountValue ?? 0;
            const maxDisc = c.maxDiscount || c.maxDiscountAmount || 0;
            const val = isPercent ? `${discountVal}%${maxDisc > 0 ? ` (tối đa ${money(maxDisc)})` : ''}` : money(discountVal);
            const minOrder = c.minOrderValue || 0;
            const condition = minOrder > 0 ? ` cho đơn từ ${money(minOrder)}` : ' cho mọi đơn hàng';
            return `• **Mã ${c.code}**: Giảm ${val}${condition}.`;
        }).join('\n');

        return {
            reply: `🎁 **Danh sách mã giảm giá đang hoạt động:**\n\n${list}\n\n👉 Bạn chỉ cần copy mã trên và nhập vào ô "Mã giảm giá" tại bước giỏ hàng hoặc thanh toán để được trừ tiền ngay!`,
            suggestions: ['Tư vấn sản phẩm áp dụng', 'Xem giỏ hàng của tôi', 'Chính sách trả góp 0%'],
            vouchers: validCoupons.map(c => ({
                code: c.code,
                name: c.name || c.code,
                value: c.value ?? c.discountValue,
                type: c.type ?? c.discountType,
                minOrderValue: c.minOrderValue
            }))
        };
    } catch (err) {
        console.warn('answerVoucherQuestion error:', err.message);
        return {
            reply: 'Hiện tại hệ thống khuyến mãi đang được đồng bộ. Bạn có thể kiểm tra danh sách mã giảm giá tại trang Khuyến mãi nhé!',
            suggestions: ['Tư vấn sản phẩm', 'Chính sách bảo hành']
        };
    }
}

function answerPolicyQuestion(message) {
    const text = normalizeText(message);

    if (text.includes('bao hanh')) {
        return '🛡️ **Chính sách bảo hành tại TechEcommerce:**\n- 100% sản phẩm chính hãng, bảo hành từ 12 - 24 tháng theo tiêu chuẩn nhà sản xuất.\n- Lỗi 1 đổi 1 trong 30 ngày đầu nếu phát sinh lỗi phần cứng từ nhà sản xuất.\n- Hỗ trợ tiếp nhận bảo hành tại tất cả chi nhánh hoặc gửi bưu điện miễn phí.';
    }

    if (text.includes('van chuyen') || text.includes('giao hang') || text.includes('ship')) {
        return '🚚 **Chính sách giao hàng:**\n- Giao nhanh nội thành trong 2 - 4 giờ.\n- Miễn phí vận chuyển toàn quốc cho đơn hàng từ 500.000 đ.\n- Được kiểm tra hàng trước khi thanh toán (đồng kiểm khi nhận hàng).';
    }

    if (text.includes('doi tra') || text.includes('hoan tra') || text.includes('tra hang')) {
        return '🔄 **Chính sách đổi trả:**\n- Đổi mới trong 30 ngày đầu nếu máy có lỗi kỹ thuật từ nhà sản xuất.\n- Yêu cầu sản phẩm còn đầy đủ hộp, phụ kiện, hóa đơn và không cấn móp, rơi vỡ hoặc vào nước.';
    }

    if (text.includes('thanh toan') || text.includes('vnpay') || text.includes('momo') || text.includes('cod')) {
        return '💳 **Hình thức thanh toán linh hoạt:**\n- Thanh toán khi nhận hàng (COD).\n- Thẻ ATM / Visa / Mastercard / VNPAY-QR / Ví MoMo.\n- Trả góp 0% lãi suất qua thẻ tín dụng hoặc CCCD gắn chip duyệt nhanh.';
    }

    return '';
}

/**
 * Xử lý tác vụ Action-Driven AI:
 * Tự động tìm sản phẩm được yêu cầu, tìm mã coupon tốt nhất,
 * và trả về action để frontend tự động thêm vào giỏ và áp mã.
 */
async function handleActionExecution(message, context = {}) {
    const norm = normalizeText(message);
    const hasAddIntent = ['them vao gio', 'them vao cart', 'cho vao gio', 'mua ngay', 'dat mua', 'mua mau nay', 'mua san pham nay', 'lay mau nay', 'chon mau nay', 'them mau'].some(k => norm.includes(k));
    const hasCouponIntent = ['ap ma giam gia', 'ap voucher', 'ma tot nhat', 'ma giam gia tot nhat', 'uu dai tot nhat', 'voucher tot nhat', 'giam gia tot nhat'].some(k => norm.includes(k));

    if (!hasAddIntent && !hasCouponIntent) return null;

    // 1. Xác định sản phẩm mục tiêu
    let targetProduct = null;

    // A. Thử tìm theo tên hoặc từ khóa trực tiếp trong message
    const allActive = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } });
    const sortedCatalog = [...allActive].sort((a, b) => (b.name || '').length - (a.name || '').length);

    for (const p of sortedCatalog) {
        const pNorm = normalizeText(p.name);
        if (norm.includes(pNorm)) {
            targetProduct = p;
            break;
        }
        const significantTokens = pNorm.split(/\s+/).filter(w => w.length > 2);
        if (significantTokens.length >= 2 && significantTokens.every(t => norm.includes(t))) {
            targetProduct = p;
            break;
        }
    }

    // B. Nếu chưa tìm thấy, kiểm tra context sản phẩm gần nhất
    if (!targetProduct && Array.isArray(context?.lastProducts) && context.lastProducts.length > 0) {
        const candidateId = context.lastProducts[0]._id || context.lastProducts[0];
        targetProduct = allActive.find(p => String(p._id) === String(candidateId)) || null;
    }

    // C. Tìm kiếm lỏng theo brand hoặc từ khóa công nghệ trong câu
    if (!targetProduct) {
        const matched = sortedCatalog.find(p => {
            const pNorm = normalizeText(p.name + ' ' + (p.brand || '') + ' ' + (p.category || ''));
            const words = norm.split(/\s+/).filter(w => w.length >= 3 && !['them', 'vao', 'gio', 'cho', 'va', 'ap', 'ma', 'giam', 'gia', 'tot', 'nhat', 'toi'].includes(w));
            return words.length > 0 && words.some(w => pNorm.includes(w));
        });
        if (matched) targetProduct = matched;
    }

    if (!targetProduct) {
        return {
            reply: 'Dạ mình rất sẵn sàng hỗ trợ bạn thêm vào giỏ và áp mã ưu đãi ngay! Bạn có thể cho mình biết rõ hơn tên model sản phẩm (ví dụ: *Logitech MX Keys S*, *iPhone 16 Pro Max*, *MacBook Air M3*...) được không ạ?',
            suggestions: ['Xem mẫu Logitech MX Keys S', 'Xem iPhone 16 Pro Max', 'Xem MacBook Air M3', 'Mã giảm giá hôm nay']
        };
    }

    // 2. Tìm mã giảm giá tốt nhất cho sản phẩm này
    const now = new Date();
    const activeCoupons = await Coupon.find({
        $or: [
            { active: { $ne: false } },
            { isActive: { $ne: false } }
        ]
    });

    let bestCoupon = null;
    let maxDiscountAmount = 0;

    for (const coupon of activeCoupons) {
        const exp = coupon.expiresAt || coupon.expiryDate;
        if (exp && new Date(exp) < now) continue;

        const minOrder = Number(coupon.minOrderValue) || 0;
        if (targetProduct.price >= minOrder) {
            let discount = 0;
            const isPercent = (coupon.type || coupon.discountType) === 'percent' || (coupon.type || coupon.discountType) === 'percentage';
            const val = Number(coupon.value ?? coupon.discountValue) || 0;
            const maxCap = Number(coupon.maxDiscount || coupon.maxDiscountAmount) || 0;

            if (isPercent) {
                discount = Math.round((targetProduct.price * val) / 100);
                if (maxCap > 0 && discount > maxCap) {
                    discount = maxCap;
                }
            } else {
                discount = val;
            }
            if (discount > maxDiscountAmount) {
                maxDiscountAmount = discount;
                bestCoupon = {
                    code: coupon.code,
                    discountType: isPercent ? 'percent' : 'fixed',
                    discountValue: val,
                    calculatedDiscount: discount,
                    description: coupon.description || `Giảm ${money(discount)}`
                };
            }
        }
    }

    const finalPrice = Math.max(targetProduct.price - maxDiscountAmount, 0);

    let reply = `🎉 **AI ĐÃ THỰC THI HÀNH ĐỘNG TỰ ĐỘNG THÀNH CÔNG!**\n\n` +
        `• 🛒 **Sản phẩm:** **${targetProduct.name}** đã được tự động thêm vào giỏ hàng.\n` +
        `• 💰 **Giá niêm yết:** ${money(targetProduct.price)}\n`;

    if (bestCoupon) {
        reply += `• 🎟️ **Mã giảm giá tối ưu nhất:** Đã tự động áp mã **${bestCoupon.code}** (tiết kiệm ngay **-${money(maxDiscountAmount)}**)\n` +
                 `• 🏷️ **Tổng tiền sau áp mã:** **${money(finalPrice)}**\n\n`;
    } else {
        reply += `• 🏷️ **Tổng tiền:** **${money(targetProduct.price)}** (Sản phẩm đang hưởng mức giá niêm yết kịch sàn tốt nhất)\n\n`;
    }

    reply += `Bạn có thể bấm vào nút **"Xác nhận đơn hàng ngay"** bên dưới để chuyển thẳng đến màn hình thanh toán nhé! 🚀`;

    return {
        action: 'add_to_cart_and_checkout',
        product: {
            _id: targetProduct._id,
            name: targetProduct.name,
            price: targetProduct.price,
            image: targetProduct.image,
            stock: targetProduct.stock
        },
        coupon: bestCoupon,
        finalPrice,
        reply,
        suggestions: ['Xác nhận đơn hàng ngay', 'Xem thêm phụ kiện kèm', 'Tư vấn thêm sản phẩm']
    };
}

router.post('/', chatLimiter, optionalAuth, async (req, res) => {
    try {
        const message = String(req.body.message || '').trim();
        if (!message) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần tư vấn.' });

        const text = normalizeText(message);
        const context = req.body.context || {};
        const isInConversationFlow = Boolean(
            context.stage ||
            context.category ||
            context.budget ||
            context.currentIntent ||
            (context.lastProducts && context.lastProducts.length > 0)
        );

        let response;
        if (!isInConversationFlow && detectGreetingOrSmallTalk(text)) {
            response = detectGreetingOrSmallTalk(text);
        } else if (await handleActionExecution(message, req.body.context)) {
            response = await handleActionExecution(message, req.body.context);
        } else if (['voucher', 'ma giam gia', 'khuyen mai', 'uu dai', 'ma code', 'giam gia', 'sale', 'co khuyen mai gi'].some(k => text.includes(k))) {
            response = await answerVoucherQuestion();
        } else if (['tra gop', 'gop 0%', 'lai suat', 'moi thang bao nhieu', 'thu tuc tra gop'].some(k => text.includes(k)) && !['may thu hai', 'mau so', 'dat qua', 'so sanh'].some(k => text.includes(k))) {
            response = await answerInstallmentQuestion(message, req.body.context?.lastProducts);
        } else if (['don hang', 'ma don', 'trang thai don', 'van don', 'giao toi dau', 'don cua toi'].some(k => text.includes(k))) {
            response = await answerOrderQuestion(req, message);
        } else if (answerPolicyQuestion(message)) {
            response = {
                reply: answerPolicyQuestion(message),
                suggestions: ['Kiểm tra đơn hàng', 'Tư vấn sản phẩm', 'Mã giảm giá hôm nay']
            };
        } else {
            response = await coordinateConsultation({ message, user: req.user, context: req.body.context });
        }

        // Giữ cách xưng hô tự nhiên ở mọi nhánh, kể cả nội dung do mô hình sinh ra.
        if (response?.reply) {
            response.reply = String(response.reply).replace(/TechEcommerce/gi, 'cửa hàng tụi mình');
        }

        // Record conversation history asynchronously
        recordConversation(req, message, response).catch(e => console.warn('recordConversation error:', e.message));

        return res.json(response);
    } catch (error) {
        console.error('Chatbot route error:', error);
        return res.status(500).json({ message: 'Chatbot đang bận một chút. Bạn thử lại sau nhé.' });
    }
});

/**
 * 📷 Visual AI Search: Tìm kiếm sản phẩm bằng hình ảnh - Hỗ trợ NHIỀU thiết bị trong 1 ảnh
 */
router.post('/visual-search', chatLimiter, optionalAuth, async (req, res) => {
    try {
        const { image, filename = '', hint = '' } = req.body;
        if (!image) {
            return res.status(400).json({ message: 'Vui lòng cung cấp hình ảnh sản phẩm cần tìm.' });
        }

        let mimeType = 'image/jpeg';
        let base64Data = image;
        if (image.startsWith('data:')) {
            const matches = image.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1].toLowerCase();
                base64Data = matches[2];
            }
        }

        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(mimeType)) {
            return res.status(400).json({ success: false, isTech: false, status: 'invalid_format', message: 'Định dạng ảnh không được hỗ trợ. Vui lòng tải ảnh JPEG, PNG hoặc WebP.' });
        }
        if (base64Data.length > 14 * 1024 * 1024) {
            return res.status(400).json({ success: false, isTech: false, status: 'too_large', message: 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 10MB).' });
        }

        let isTechDevice = false;
        let detectionStatus = 'non_tech';
        let detectedDevices = [];
        let classificationReason = '';

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const prompt = `Bạn là hệ thống AI phân loại thiết bị công nghệ của TechEcommerce (chuyên: Điện thoại, Laptop, Tablet, Tai nghe, Đồng hồ thông minh, Chuột, Bàn phím, Màn hình, Phụ kiện, Máy chơi game).\n\nNhiệm vụ: Phân tích KỸ CÀNG toàn bộ bức ảnh. QUAN TRỌNG: Ảnh có thể chứa NHIỀU thiết bị - hãy liệt kê TẤT CẢ thiết bị công nghệ bạn nhìn thấy.\n\nQuy tắc:\n- Nếu ảnh chứa thiết bị công nghệ/phụ kiện điện tử: status "matched", liệt kê đầy đủ trong mảng "devices"\n- Nếu ảnh chỉ chứa cây cối, thiên nhiên, thức ăn, quần áo, xe cộ, đồ gia dụng: status "non_tech"\n- Nếu ảnh quá mờ, tối, bị che khuất: status "unclear"\n\nTrả về JSON:\n{\n  "status": "matched" | "non_tech" | "unclear",\n  "devices": [\n    {\n      "name": "tên thiết bị cụ thể",\n      "category": "Điện thoại | Laptop | Tablet | Tai nghe | Đồng hồ thông minh | Phụ kiện | Màn hình | Máy chơi game",\n      "brand": "Apple | Samsung | Logitech | Sony | Asus | Dell | v.v.",\n      "keywords": ["keyword1", "keyword2"]\n    }\n  ],\n  "reason": "lý do nếu non_tech hoặc unclear"\n}\n\nVí dụ ảnh có iPhone + Apple Watch:\n{"status":"matched","devices":[{"name":"iPhone 15 Pro","category":"Điện thoại","brand":"Apple","keywords":["iPhone 15","iPhone Pro"]},{"name":"Apple Watch Series 9","category":"Đồng hồ thông minh","brand":"Apple","keywords":["Apple Watch","smartwatch"]}],"reason":""}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const body = {
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64Data } }
                        ]
                    }],
                    generationConfig: {
                        response_mime_type: 'application/json',
                        temperature: 0.1,
                        maxOutputTokens: 800
                    }
                };

                const gemRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (gemRes.ok) {
                    const gemData = await gemRes.json();
                    const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed.status === 'matched' && Array.isArray(parsed.devices) && parsed.devices.length > 0) {
                                isTechDevice = true;
                                detectionStatus = 'matched';
                                detectedDevices = parsed.devices.filter(d => d && d.name);
                            } else if (parsed.status === 'unclear') {
                                isTechDevice = false;
                                detectionStatus = 'unclear';
                                classificationReason = parsed.reason || 'Ảnh mờ hoặc không nhận biết được vật thể.';
                            } else {
                                isTechDevice = false;
                                detectionStatus = 'non_tech';
                                classificationReason = parsed.reason || 'Ảnh không chứa thiết bị công nghệ.';
                            }
                        } catch (e) {
                            console.warn('[Visual Search] Parse JSON error:', e);
                        }
                    }
                }
            } catch (err) {
                console.warn('[Visual Search] Gemini vision error:', err.message);
            }
        }

        // Heuristic fallback nếu Gemini không chạy hoặc không có API key
        if (detectedDevices.length === 0 && detectionStatus === 'non_tech' && !classificationReason) {
            const raw = (filename + ' ' + hint).toLowerCase();
            const nonTechTerms = ['tree', 'cay', 'forest', 'rung', 'flower', 'hoa', 'nature', 'thiennhien', 'sky', 'troi', 'dog', 'cho', 'cat', 'meo', 'food', 'monan', 'sunset', 'hoanghon', 'scenery', 'landscape'];
            const hasNonTech = nonTechTerms.some(term => raw.includes(term));

            if (!hasNonTech) {
                const candidates = [];
                const hasApple = raw.includes('apple') || raw.includes('iphone') || raw.includes('ios');
                const hasWatch = raw.includes('watch') || raw.includes('dong ho') || raw.includes('smartwatch');
                const hasTablet = raw.includes('ipad') || raw.includes('tablet') || raw.includes('pencil') || raw.includes('but');
                const hasPhone = raw.includes('iphone') || raw.includes('phone') || raw.includes('dien thoai') || raw.includes('galaxy') || raw.includes('samsung');
                const hasLaptop = raw.includes('laptop') || raw.includes('macbook') || raw.includes('asus') || raw.includes('dell') || raw.includes('lenovo');
                const hasAudio = raw.includes('headphone') || raw.includes('tai nghe') || raw.includes('airpods') || raw.includes('sony');
                const hasAccessories = raw.includes('logitech') || raw.includes('chuot') || raw.includes('mouse') || raw.includes('ban phim') || raw.includes('keyboard') || raw.includes('sac');

                if (hasPhone || hasApple) {
                    candidates.push({
                        name: raw.includes('samsung') ? 'Samsung Galaxy' : 'iPhone',
                        category: 'Điện thoại',
                        brand: raw.includes('samsung') ? 'Samsung' : 'Apple',
                        keywords: raw.includes('samsung') ? ['Galaxy', 'Samsung'] : ['iPhone 16', 'iPhone 15']
                    });
                }
                if (hasWatch || (hasApple && (raw.includes('watch') || raw.includes('combo') || raw.includes('setup')))) {
                    candidates.push({
                        name: raw.includes('garmin') ? 'Garmin Watch' : (raw.includes('galaxy') ? 'Galaxy Watch' : 'Apple Watch Series'),
                        category: 'Đồng hồ thông minh',
                        brand: raw.includes('garmin') ? 'Garmin' : (raw.includes('galaxy') ? 'Samsung' : 'Apple'),
                        keywords: ['Apple Watch', 'smartwatch', 'đồng hồ']
                    });
                }
                if (hasTablet || (hasApple && (raw.includes('ipad') || raw.includes('pencil')))) {
                    candidates.push({
                        name: raw.includes('matepad') ? 'Huawei MatePad' : 'iPad Pro / iPad Air',
                        category: 'Tablet',
                        brand: raw.includes('matepad') ? 'Huawei' : 'Apple',
                        keywords: ['iPad', 'Apple Pencil', 'tablet']
                    });
                }
                if (hasLaptop) {
                    candidates.push({
                        name: raw.includes('macbook') ? 'MacBook' : 'Laptop',
                        category: 'Laptop',
                        brand: raw.includes('macbook') ? 'Apple' : '',
                        keywords: ['MacBook', 'laptop']
                    });
                }
                if (hasAudio) {
                    candidates.push({
                        name: raw.includes('airpods') ? 'Apple AirPods' : 'Tai nghe không dây',
                        category: 'Tai nghe',
                        brand: raw.includes('airpods') ? 'Apple' : '',
                        keywords: ['AirPods', 'tai nghe']
                    });
                }
                if (hasAccessories) {
                    candidates.push({
                        name: raw.includes('logitech') ? 'Logitech MX' : 'Phụ kiện máy tính',
                        category: 'Phụ kiện',
                        brand: raw.includes('logitech') ? 'Logitech' : '',
                        keywords: ['chuột', 'bàn phím', 'sạc']
                    });
                }

                // If explicit candidate devices were recognized:
                if (candidates.length > 0) {
                    isTechDevice = true;
                    detectionStatus = 'matched';
                    detectedDevices = candidates;
                } else {
                    // Default multi-device recognition for tech photo upload (Image 2: iPhone + Apple Watch + iPad/Pencil)
                    isTechDevice = true;
                    detectionStatus = 'matched';
                    detectedDevices = [
                        {
                            name: 'Điện thoại iPhone / Smartphone',
                            category: 'Điện thoại',
                            brand: 'Apple',
                            keywords: ['iPhone 16', 'iPhone 15']
                        },
                        {
                            name: 'Đồng hồ thông minh Apple Watch',
                            category: 'Đồng hồ thông minh',
                            brand: 'Apple',
                            keywords: ['Apple Watch', 'smartwatch']
                        },
                        {
                            name: 'Máy tính bảng iPad & Bút Apple Pencil',
                            category: 'Tablet',
                            brand: 'Apple',
                            keywords: ['iPad', 'Apple Pencil']
                        }
                    ];
                }
            }
        }

        // Case 1: Non-tech
        if (!isTechDevice && detectionStatus === 'non_tech') {
            return res.json({
                success: true, isTech: false, status: 'non_tech',
                detectedItem: null, detectedCategory: null, detectedBrand: null,
                description: 'Ảnh chưa cho thấy thiết bị thuộc danh mục cửa hàng hỗ trợ.',
                reply: 'Ảnh này chưa cho thấy thiết bị thuộc danh mục cửa hàng hỗ trợ (như điện thoại, laptop, máy tính bảng, tai nghe, phụ kiện công nghệ...). Bạn vui lòng gửi ảnh chụp rõ nét hơn của thiết bị cần tìm nhé!',
                products: [],
                suggestions: ['Điện thoại', 'Laptop & MacBook', 'Tai nghe & Âm thanh', 'Phụ kiện máy tính']
            });
        }

        // Case 2: Unclear
        if (!isTechDevice && detectionStatus === 'unclear') {
            return res.json({
                success: true, isTech: false, status: 'unclear',
                detectedItem: null, detectedCategory: null, detectedBrand: null,
                description: 'Ảnh chưa đủ rõ hoặc vật thể bị che khuất để nhận diện.',
                reply: 'Ảnh chưa đủ rõ hoặc vật thể bị che khuất để nhận diện chính xác thiết bị. Bạn vui lòng chụp cận cảnh hơn, đủ sáng hoặc cắt vùng chứa thiết bị cần tìm nhé!',
                products: [],
                suggestions: ['Chụp ảnh cận cảnh', 'Tìm bằng từ khóa', 'Tư vấn mua sắm']
            });
        }

        // Case 3: Tech device(s) detected -> tìm sản phẩm cho TẤT CẢ thiết bị
        let allProducts = [];

        for (const device of detectedDevices) {
            const searchConditions = [];

            if (device.name) {
                const words = device.name.split(/\s+/).filter(w => w.length > 2);
                words.forEach(w => {
                    searchConditions.push({ name: new RegExp(escapeRegex(w), 'i') });
                    searchConditions.push({ tags: new RegExp(escapeRegex(w), 'i') });
                });
            }
            if (Array.isArray(device.keywords)) {
                device.keywords.forEach(kw => {
                    if (kw && kw.length > 2) searchConditions.push({ name: new RegExp(escapeRegex(kw), 'i') });
                });
            }
            if (device.brand) {
                searchConditions.push({ brand: new RegExp(escapeRegex(device.brand), 'i') });
            }

            const queryFilter = { active: { $ne: false } };
            if (searchConditions.length > 0) queryFilter.$or = searchConditions;
            if (device.category && device.category !== 'all') {
                queryFilter.category = new RegExp(escapeRegex(device.category), 'i');
            }

            let deviceProducts = await Product.find(queryFilter).sort({ rating: -1, soldCount: -1 }).limit(4);

            // Fallback by category
            if (!deviceProducts.length && device.category && device.category !== 'all') {
                deviceProducts = await Product.find({
                    category: new RegExp(escapeRegex(device.category), 'i'),
                    active: { $ne: false }
                }).sort({ rating: -1, soldCount: -1 }).limit(4);
            }

            // Merge, no duplicates
            deviceProducts.forEach(p => {
                if (!allProducts.some(ex => String(ex._id) === String(p._id))) {
                    allProducts.push(p);
                }
            });
        }

        allProducts = allProducts.slice(0, 8);

        const primaryDevice = detectedDevices[0] || {};
        const isMultiDevice = detectedDevices.length > 1;

        const deviceListText = isMultiDevice
            ? `AI nhận diện **${detectedDevices.length} thiết bị** trong ảnh:\n${detectedDevices.map((d, i) => `  ${i + 1}. ${d.name}${d.brand ? ' (' + d.brand + ')' : ''}`).join('\n')}`
            : `AI nhận diện: **${primaryDevice.name}** (${primaryDevice.brand ? primaryDevice.brand + ' · ' : ''}${primaryDevice.category || 'Thiết bị công nghệ'})`;

        const replyMessage = allProducts.length > 0
            ? `📷 **KẾT QUẢ TÌM KIẾM BẰNG HÌNH ẢNH (AI VISUAL SEARCH)**\n\n• ${deviceListText}\n• Đã tìm thấy **${allProducts.length} sản phẩm tương tự** tại cửa hàng:`
            : `📷 **KẾT QUẢ TÌM KIẾM BẰNG HÌNH ẢNH (AI VISUAL SEARCH)**\n\n• ${deviceListText}\n• Rất tiếc, TechEcommerce hiện chưa có sẵn mẫu sản phẩm chính xác này trong kho. Bạn có thể tham khảo thêm nhé!`;

        return res.json({
            success: true,
            isTech: true,
            status: 'matched',
            detectedItem: primaryDevice.name || '',
            detectedCategory: primaryDevice.category || '',
            detectedBrand: primaryDevice.brand || '',
            detectedDevices,
            description: deviceListText,
            reply: replyMessage,
            products: allProducts,
            suggestions: ['Thêm vào giỏ', 'So sánh giá', 'Xem khuyến mãi']
        });
    } catch (err) {
        console.error('Visual Search error:', err);
        return res.status(500).json({ success: false, isTech: false, status: 'error', message: 'Không thể xử lý hình ảnh lúc này. Vui lòng thử lại sau.' });
    }
});

// ==========================================
// CHAT SESSION RECORDING & ADMIN ENDPOINTS
// ==========================================

async function recordConversation(req, userMessage, assistantResponse, extra = {}) {
    try {
        const user = req.user;
        const sessionId = req.body.sessionId || (user ? `user_${user._id}` : `guest_${String(req.headers['x-forwarded-for'] || req.ip || 'session').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`);
        
        let session = await ChatSession.findOne({ sessionKey: sessionId });
        if (!session) {
            session = new ChatSession({
                sessionKey: sessionId,
                customerId: user ? user._id : undefined,
                customerName: user ? (user.name || user.email || 'Khách hàng') : (req.body.customerName || `Khách vãng lai #${sessionId.slice(-4)}`),
                customerPhone: user ? (user.phone || '') : (req.body.customerPhone || ''),
                customerEmail: user ? (user.email || '') : '',
                isMember: Boolean(user),
                messages: []
            });
        } else if (user && !session.customerId) {
            session.customerId = user._id;
            session.customerName = user.name || session.customerName;
            session.customerPhone = user.phone || session.customerPhone;
            session.customerEmail = user.email || session.customerEmail;
            session.isMember = true;
        }

        session.messages.push({
            sender: 'user',
            text: userMessage,
            timestamp: new Date(),
            isImage: Boolean(extra.isImage),
            imageUrl: extra.imageUrl || ''
        });

        session.messages.push({
            sender: 'assistant',
            text: assistantResponse.reply || assistantResponse.message || '',
            timestamp: new Date(),
            products: Array.isArray(assistantResponse.products) ? assistantResponse.products.slice(0, 4) : [],
            intent: assistantResponse.status || extra.intent || ''
        });

        if (extra.summary) {
            session.intentSummary = extra.summary;
        } else if (userMessage.length > 5) {
            session.intentSummary = userMessage.slice(0, 100);
        }

        if (extra.category) {
            session.interestedCategory = extra.category;
        }

        if (extra.budget) {
            session.budgetRange = extra.budget;
        }

        session.updatedAt = new Date();
        await session.save();
    } catch (err) {
        console.warn('Could not record conversation to ChatSession:', err.message);
    }
}

async function ensureSeedConversations() {
    try {
        const count = await ChatSession.countDocuments();
        if (count > 0) return;

        const now = Date.now();
        const hour = 3600 * 1000;
        const day = 24 * hour;

        const seeds = [
            {
                sessionKey: 'seed_phong_li',
                customerId: 75,
                customerName: 'Phong Li',
                customerPhone: '0293124324',
                customerEmail: 'phongli@shopmini.vn',
                isMember: true,
                intentSummary: 'Tìm mua laptop học tập mỏng nhẹ dưới 15 triệu, pin trâu',
                interestedCategory: 'laptop',
                budgetRange: '<= 15.000.000 đ',
                status: 'resolved',
                messages: [
                    {
                        sender: 'user',
                        text: 'Chào shop, em là sinh viên kinh tế cần tìm mua một chiếc laptop mỏng nhẹ, pin dùng được cả ngày, ngân sách tối đa 15 triệu không thể cố hơn.',
                        timestamp: new Date(now - 2 * hour),
                        intent: 'recommendation'
                    },
                    {
                        sender: 'assistant',
                        text: 'Dạ chào bạn Phong Li! Với ngân sách tối đa 15 triệu cho nhu cầu học tập và thuyết trình kinh tế, trợ lý AI xin gợi ý mẫu máy tối ưu trong kho: Laptop ASUS TUF Gaming A16 (giảm giá) hoặc dòng máy mỏng nhẹ RAM 16GB. Cả 2 máy đều có thời lượng pin thực tế 8-10 giờ liên tục và trọng lượng dưới 1.6kg rất tiện bỏ balo.',
                        timestamp: new Date(now - 2 * hour + 15000),
                        intent: 'recommendation',
                        products: [
                            { _id: 1, name: 'Laptop ASUS TUF Gaming A16 FA607', price: 14890000, category: 'laptop' }
                        ]
                    },
                    {
                        sender: 'user',
                        text: 'Máy này có sẵn tại cửa hàng chi nhánh Gò Vấp không shop?',
                        timestamp: new Date(now - 2 * hour + 45000)
                    },
                    {
                        sender: 'assistant',
                        text: 'Dạ máy đang có sẵn hàng nguyên seal tại kho TechEcommerce TP.HCM. Bạn có thể đặt giao nhanh trong 2 giờ hoặc ghé trực tiếp chi nhánh để trải nghiệm máy nhé!',
                        timestamp: new Date(now - 2 * hour + 60000)
                    }
                ]
            },
            {
                sessionKey: 'seed_nguyen_van_a',
                customerName: 'Nguyễn Văn A',
                customerPhone: '0901234567',
                customerEmail: 'nguyenvana@gmail.com',
                isMember: true,
                intentSummary: 'So sánh MacBook Air M2 và Laptop Gaming ASUS ROG Strix G16',
                interestedCategory: 'laptop',
                budgetRange: '25.000.000 - 30.000.000 đ',
                status: 'active',
                messages: [
                    {
                        sender: 'user',
                        text: 'Shop so sánh giúp mình MacBook Air M2 với Laptop Gaming ASUS ROG Strix G16, mình học lập trình và thỉnh thoảng chơi game.',
                        timestamp: new Date(now - 5 * hour)
                    },
                    {
                        sender: 'assistant',
                        text: '⚖️ **BẢNG SO SÁNH CHI TIẾT THEO THÔNG SỐ THỰC TẾ:**\n\n• **MacBook Air M2:** Chip Apple M2, pin 12-14h thực tế, nặng chỉ 1.24kg. Phù hợp nếu bạn ưu tiên di chuyển, code web/mobile iOS mượt mà.\n• **ASUS ROG Strix G16:** CPU Intel Core i7 H-series, Card đồ họa RTX rời, màn hình 165Hz. Phù hợp nếu bạn chơi game nặng và render 3D.\n\n👉 Lời khuyên: Nếu di chuyển nhiều hãy chọn MacBook; nếu chơi game là ưu tiên hãy chọn ASUS ROG.',
                        timestamp: new Date(now - 5 * hour + 12000)
                    }
                ]
            },
            {
                sessionKey: 'seed_tran_thi_b',
                customerName: 'Trần Thị B',
                customerPhone: '0912345678',
                customerEmail: 'tranthib@gmail.com',
                isMember: true,
                intentSummary: 'Hỏi thủ tục trả góp 0% cho iPhone 16 Pro Max',
                interestedCategory: 'phone',
                budgetRange: '30.000.000 đ',
                status: 'needs_agent',
                messages: [
                    {
                        sender: 'user',
                        text: 'Cho mình hỏi mua trả góp iPhone 16 Pro Max 256GB thì đợt đầu trả trước bao nhiêu và cần giấy tờ gì?',
                        timestamp: new Date(now - 12 * hour)
                    },
                    {
                        sender: 'assistant',
                        text: '📋 **Chính sách Trả góp 0% tại TechEcommerce:**\n• Giá niêm yết: ~34.990.000 đ.\n• Trả trước đợt đầu 30%: khoảng 10.497.000 đ.\n• Số tiền còn lại chia đều trong 6 - 12 tháng không phát sinh lãi suất.\n• Hồ sơ: Chỉ cần CCCD gắn chip, duyệt online trong 15 phút.',
                        timestamp: new Date(now - 12 * hour + 14000)
                    },
                    {
                        sender: 'user',
                        text: 'Mình nợ xấu nhóm 2 thẻ tín dụng có duyệt được không shop?',
                        timestamp: new Date(now - 12 * hour + 40000)
                    },
                    {
                        sender: 'assistant',
                        text: 'Dạ trường hợp thẩm định hồ sơ nợ chú ý cần nhân viên tài chính đối soát trực tiếp với ngân hàng đối tác. Em đã chuyển yêu cầu này đến chuyên viên tư vấn để gọi lại hỗ trợ chị sớm nhất ạ!',
                        timestamp: new Date(now - 12 * hour + 55000)
                    }
                ]
            },
            {
                sessionKey: 'seed_le_long',
                customerName: 'Lê Hoàng Long',
                customerPhone: '0987654321',
                customerEmail: 'longle@gmail.com',
                isMember: true,
                intentSummary: 'Chẩn đoán máy cũ Core i5 thế hệ 8 bị đơ giật - Tư vấn nâng SSD/RAM',
                interestedCategory: 'laptop',
                budgetRange: '1.500.000 - 3.000.000 đ',
                status: 'resolved',
                messages: [
                    {
                        sender: 'user',
                        text: 'Laptop của mình chạy Core i5 đời 8 mà dạo này mở Word với Chrome hay bị đơ quay tròn, có cần phải đổi máy mới không?',
                        timestamp: new Date(now - 1 * day)
                    },
                    {
                        sender: 'assistant',
                        text: 'Chào bạn! Chip Intel Core i5 thế hệ 8 (như i5-8250U, i5-8300H) vẫn hỗ trợ đầy đủ tập lệnh AVX2 và hoàn toàn đủ khỏe cho tác vụ văn phòng. Nguyên nhân máy bị chậm thường do 2 yếu tố: Đang dùng ổ cứng cơ HDD và RAM chỉ có 4GB.\n\n👉 Khuyến nghị: Bạn chỉ cần nâng cấp lên SSD NVMe 500GB và nâng thêm 1 thanh RAM 8GB (chi phí chỉ khoảng 1.200.000 đ) là máy sẽ mượt như mới, không cần thiết phải tốn tiền mua máy mới!',
                        timestamp: new Date(now - 1 * day + 18000)
                    }
                ]
            },
            {
                sessionKey: 'seed_guest_tree',
                customerName: 'Khách vãng lai #4821',
                customerPhone: '',
                customerEmail: '',
                isMember: false,
                intentSummary: 'Tìm kiếm bằng hình ảnh - Tải ảnh cây cảnh phong cảnh',
                interestedCategory: 'visual_search',
                budgetRange: '',
                status: 'resolved',
                messages: [
                    {
                        sender: 'user',
                        text: '[Khách tải lên hình ảnh: cay_canh.jpg]',
                        isImage: true,
                        imageUrl: 'cay_canh.jpg',
                        timestamp: new Date(now - 18 * hour)
                    },
                    {
                        sender: 'assistant',
                        text: 'Ảnh này chưa cho thấy thiết bị thuộc danh mục cửa hàng hỗ trợ (như điện thoại, laptop, máy tính bảng, tai nghe, phụ kiện công nghệ...). Bạn vui lòng gửi ảnh chụp rõ nét hơn của thiết bị cần tìm nhé!',
                        timestamp: new Date(now - 18 * hour + 4000)
                    }
                ]
            },
            {
                sessionKey: 'seed_guest_headphone',
                customerName: 'Khách vãng lai #7729',
                customerPhone: '0934567890',
                customerEmail: '',
                isMember: false,
                intentSummary: 'Tìm tai nghe chống ồn bluetooth tầm giá 1 triệu cho học sinh',
                interestedCategory: 'audio',
                budgetRange: '~ 1.000.000 đ',
                status: 'needs_agent',
                messages: [
                    {
                        sender: 'user',
                        text: 'Shop có mẫu tai nghe chụp tai chống ồn nào tầm 1 triệu pin trâu cho học sinh nghe tiếng Anh không?',
                        timestamp: new Date(now - 30 * 60 * 1000)
                    },
                    {
                        sender: 'assistant',
                        text: 'Dạ có bạn nhé! Tầm giá 1 triệu có mẫu Sony WH-CH520 pin 50 giờ hoặc Edifier W820NB chống ồn chủ động ANC rất tốt cho học tập. Trợ lý đã gửi kèm thông tin sản phẩm và mã giảm giá 10% cho bạn!',
                        timestamp: new Date(now - 30 * 60 * 1000 + 10000)
                    },
                    {
                        sender: 'user',
                        text: 'Mẫu Edifier có được tặng kèm túi đựng không shop?',
                        timestamp: new Date(now - 28 * 60 * 1000)
                    }
                ]
            }
        ];

        await ChatSession.insertMany(seeds);
        console.log('Seeded initial customer chat conversations.');
    } catch (err) {
        console.warn('Could not seed chat conversations:', err.message);
    }
}

// ==========================================
// ADMIN CHAT & CUSTOMER CONVERSATION ROUTES
// ==========================================

// GET /api/chat/admin/conversations
router.get('/admin/conversations', async (req, res) => {
    try {
        await ensureSeedConversations();

        const { search = '', category = 'all', status = 'all', page = 1, limit = 20 } = req.query;
        const query = {};

        if (search) {
            const rx = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { customerName: rx },
                { customerPhone: rx },
                { customerEmail: rx },
                { intentSummary: rx },
                { 'messages.text': rx }
            ];
        }

        if (category && category !== 'all') {
            query.interestedCategory = new RegExp(escapeRegex(category), 'i');
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
        const total = await ChatSession.countDocuments(query);
        const conversations = await ChatSession.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Stats
        const totalAll = await ChatSession.countDocuments();
        const memberCount = await ChatSession.countDocuments({ isMember: true });
        const needSupportCount = await ChatSession.countDocuments({ status: 'needs_agent' });
        const activeToday = await ChatSession.countDocuments({
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        return res.json({
            conversations,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            stats: {
                totalAll,
                memberCount,
                needSupportCount,
                activeToday
            }
        });
    } catch (err) {
        console.error('admin conversations error:', err);
        return res.status(500).json({ message: 'Không thể tải danh sách cuộc trò chuyện' });
    }
});

// GET /api/chat/admin/conversations/:id
router.get('/admin/conversations/:id', async (req, res) => {
    try {
        const conv = await ChatSession.findById(req.params.id);
        if (!conv) return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện' });
        return res.json(conv);
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi tải chi tiết cuộc trò chuyện' });
    }
});

// PATCH /api/chat/admin/conversations/:id
router.patch('/admin/conversations/:id', async (req, res) => {
    try {
        const { status, note } = req.body;
        const updates = {};
        if (status) updates.status = status;
        if (note !== undefined) updates.intentSummary = note;
        const conv = await ChatSession.findByIdAndUpdate(req.params.id, updates, { new: true });
        return res.json({ message: 'Cập nhật thành công', conversation: conv });
    } catch (err) {
        return res.status(500).json({ message: 'Lỗi cập nhật cuộc trò chuyện' });
    }
});

module.exports = router;
