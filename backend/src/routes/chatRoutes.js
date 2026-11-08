const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const ChatSession = require('../models/ChatSession');
const KnowledgeArticle = require('../models/KnowledgeArticle');
const { findKnowledgeArticle } = require('../services/knowledgeService');
const { optionalAuth, protect, admin } = require('../middleware/auth');
const { recommendProducts } = require('../utils/recommendations');
const { coordinateConsultation, checkUnsupportedProduct, buildOutOfCatalogResponse, extractBudget } = require('../services/consultationCoordinator');
const nlu = require('../services/nlu');

const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.' }
});

router.get('/knowledge', protect, admin, async (req, res) => {
    const query = {};
    if (req.query.type) query.type = String(req.query.type);
    if (req.query.active !== undefined) query.active = req.query.active === 'true';
    const articles = await KnowledgeArticle.find(query).sort({ updatedAt: -1 }).limit(200).lean();
    return res.json({ articles });
});

router.post('/knowledge', protect, admin, async (req, res) => {
    const { title, slug, type, category, keywords, answer, source, active } = req.body || {};
    if (!title || !slug || !answer) return res.status(400).json({ message: 'Thiếu title, slug hoặc answer.' });
    const article = await KnowledgeArticle.create({
        title: String(title).trim(), slug: String(slug).trim().toLowerCase(),
        type: type || 'faq', category: category || 'all',
        keywords: Array.isArray(keywords) ? keywords.map(item => String(item).trim().toLowerCase()).filter(Boolean) : [],
        answer: String(answer).trim(), source: source || 'admin', active: active !== false,
        updatedBy: req.user?._id || null
    });
    return res.status(201).json({ article });
});

router.patch('/knowledge/:id', protect, admin, async (req, res) => {
    const allowed = ['title', 'slug', 'type', 'category', 'keywords', 'answer', 'source', 'active'];
    const updates = {};
    allowed.forEach(key => {
        if (req.body?.[key] !== undefined) updates[key] = key === 'keywords'
            ? (Array.isArray(req.body[key]) ? req.body[key].map(item => String(item).trim().toLowerCase()).filter(Boolean) : [])
            : req.body[key];
    });
    updates.updatedBy = req.user?._id || null;
    const article = await KnowledgeArticle.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!article) return res.status(404).json({ message: 'Không tìm thấy bài knowledge.' });
    return res.json({ article });
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
            reply: 'Xin chào bạn! 👋 Em là Trợ lý Tư vấn Mua sắm AI của TechEcommerce. Bạn đang quan tâm đến sản phẩm công nghệ nào, hoặc có mức ngân sách khoảng bao nhiêu để em tư vấn chi tiết nhất nhé?',
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
            reply: 'Dạ không có gì ạ! 😊 Nếu bạn cần tư vấn thêm bất kỳ sản phẩm nào hoặc có thắc mắc gì, cứ nhắn em nhé!',
            suggestions: ['Tư vấn sản phẩm mới', 'Mã giảm giá hôm nay', 'Chính sách bảo hành', 'Kiểm tra đơn hàng'],
            context: { stage: 'idle' }
        };
    }

    // 3. Small talk / câu hỏi chung về cửa hàng
    const storeInquiryPatterns = [
        /(?:cua hang|shop|ben ban|ben shop|ben minh|ban|cac ban)\s+(?:ban|co|kinh doanh|phan phoi)\s+(?:nhung\s+)?(?:gi|mat hang gi|san pham gi|do gi|thiet bi gi)/i,
        /^(?:shop|cua hang)\s+ban\s+(?:nhung\s+)?gi[?!.\s]*$/i,
        /^(?:ban|co)\s+(?:ban\s+)?(?:nhung\s+)?gi[?!.\s]*$/i,
        /^(?:o day|cho nay)\s+(?:ban|co)\s+gi[?!.\s]*$/i,
        /^(?:danh muc|cac loai)\s+san pham[?!.\s]*$/i
    ];
    if (storeInquiryPatterns.some(p => p.test(norm))) {
        return {
            reply: 'Dạ chào bạn! 👋 **TechEcommerce** là hệ sinh thái bán lẻ thiết bị công nghệ chính hãng 100%, bảo hành 1 đổi 1 trong 30 ngày và hỗ trợ trả góp 0% lãi suất.\n\n' +
                'Hiện tại TechEcommerce phân phối đầy đủ 7 nhóm sản phẩm công nghệ hàng đầu:\n' +
                '• 📱 **Điện thoại:** iPhone (Apple), Samsung Galaxy, Xiaomi, POCO, OPPO, HONOR.\n' +
                '• 💻 **Laptop & MacBook:** MacBook Air/Pro, Asus ROG Strix, Acer Nitro, Lenovo, Dell, HP.\n' +
                '• 📲 **Tablet (Máy tính bảng):** iPad Pro M4, iPad Air, iPad Gen 10, Samsung Galaxy Tab, Surface Pro.\n' +
                '• ⌚ **Đồng hồ thông minh:** Apple Watch Series 10/SE, Samsung Galaxy Watch, Garmin, Huawei, Xiaomi Band.\n' +
                '• 🎮 **Máy chơi game:** Sony PS5 Slim, Nintendo Switch OLED/Lite, ASUS ROG Ally, MSI Claw, Legion Go.\n' +
                '• 🎧 **Tai nghe cao cấp:** Apple AirPods, Samsung Galaxy Buds 3 Pro, Marshall, Sony chống ồn.\n' +
                '• 🔌 **Phụ kiện & Đồ chơi công nghệ:** Củ sạc nhanh Anker, Hub Ugreen, Gimbal DJI Pocket 3, Chuột & Bàn phím Logitech.\n\n' +
                '👉 Bạn đang quan tâm đến dòng sản phẩm nào hoặc có mức ngân sách dự kiến bao nhiêu để em tư vấn chi tiết cho bạn nhé! 😊',
            suggestions: ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Máy chơi game', 'Tablet & iPad', 'Mã giảm giá hôm nay'],
            context: { stage: 'asking_category' }
        };
    }

    const smallTalkPatterns = [
        /^ban\s+(la\s+)?ai[?!.\s]*$/,
        /^(ai\s+)?day\s+la\s+(gi|dau|cua hang gi)[?!.\s]*$/,
        /^ban\s+(co\s+the\s+)?(lam|giup)\s+(duoc\s+)?gi[?!.\s]*$/,
        /^(ban\s+)?giup\s+(duoc\s+)?gi[?!.\s]*$/
    ];
    if (smallTalkPatterns.some(p => p.test(norm))) {
        return {
            reply: 'Em là Trợ lý AI Mua sắm của **TechEcommerce** – cửa hàng chuyên phân phối chính hãng 100% các sản phẩm công nghệ: 📱 Điện thoại, 💻 Laptop, 📲 Tablet, ⌚ Đồng hồ thông minh, 🎮 Máy chơi game, 🎧 Tai nghe và Phụ kiện.\n\nEm có thể hỗ trợ bạn:\n• Tìm kiếm và tư vấn sản phẩm theo ngân sách\n• So sánh cấu hình chi tiết\n• Tra cứu mã giảm giá, tính trả góp 0%\n• Kiểm tra đơn hàng và chính sách bảo hành\n\nBạn cần hỗ trợ gì hôm nay?',
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
            reply: 'Cảm ơn bạn đã ghé thăm TechEcommerce! 🙏 Chúc bạn một ngày tốt lành, hẹn gặp lại! Nếu cần tư vấn bất kỳ lúc nào, em luôn sẵn sàng hỗ trợ nhé! 😊',
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
            reply: 'Chào bạn! Bạn đang quan tâm đến dòng sản phẩm nào hoặc có mức ngân sách khoảng bao nhiêu để em tư vấn chi tiết nhất nhé?',
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
 * Tích hợp Google Gemini API với AbortSignal timeout 10s, Multi-Model Failover & Catalog-Grounded Prompt
 */
async function askGeminiIfConfigured(systemPrompt, userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('[Gemini AI] Chưa cấu hình GEMINI_API_KEY. Hệ thống tự động kích hoạt Deterministic Knowledge Engine (Catalog-Grounded Heuristic).');
        return null;
    }

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    const modelsToTry = [preferredModel, 'gemini-flash-lite-latest', 'gemini-flash-latest'];

    for (const model of modelsToTry) {
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
                    temperature: 0.35,
                    maxOutputTokens: 1024
                }
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000)
            });

            if (!res.ok) {
                console.warn(`[Gemini API] Model ${model} returned status: ${res.status}. Trying next...`);
                continue;
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim()) return text.trim();
        } catch (err) {
            console.warn(`[Gemini API] Model ${model} call error (${err.message}). Trying next...`);
        }
    }

    return null;
}

/**
 * Trò chuyện tự nhiên mở (Open-ended Chit-chat & Smart Assistance)
 * Trả lời thông minh, thân thiện các câu hỏi xã giao, toán học, hỏi vui mà không bao giờ spam hay lặp lại.
 */
async function askGeminiOpenChat(message, context = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const systemPrompt = `Bạn là Trợ lý AI Mua sắm thông minh, hóm hỉnh và am hiểu công nghệ của cửa hàng TechEcommerce.
TechEcommerce chuyên bán chính hãng 100%: Điện thoại (iPhone, Samsung, Xiaomi...), Laptop (MacBook, ROG, Dell...), Tablet (iPad, Galaxy Tab...), Máy chơi game (PS5, Nintendo Switch, ROG Ally...), Smartwatch (Apple Watch, Garmin...), Tai nghe và Phụ kiện cao cấp.
Chính sách: Bảo hành 12-24 tháng, lỗi 1 đổi 1 trong 30 ngày, trả góp 0% lãi suất.

NGUYÊN TẮC TRẢ LỜI:
1. Giao tiếp tự nhiên, tận tâm và chuyên nghiệp. Luôn xưng là "em" và gọi khách là "bạn". Tuyệt đối KHÔNG tự xưng "mình", "tụi mình", "chúng mình".
2. Nếu khách hỏi vui, chào hỏi, đố vui, toán học (ví dụ: "1+1", "bạn có người yêu chưa", "kể chuyện cười"), hãy trả lời dí dỏm, khéo léo và tự nhiên. Tuyệt đối không spam kịch bản bán hàng máy móc!
3. Nếu khách hỏi câu hỏi khó hoặc nằm ngoài khả năng, hãy nhẹ nhàng thông báo: "Dạ câu này em chưa hiểu rõ ý bạn lắm nè 😅" và gợi ý khách diễn đạt lại nhu cầu công nghệ để hỗ trợ tốt nhất.
4. Giữ câu trả lời ngắn gọn, súc tích (khoảng 2 - 4 câu), có thể kèm emoji phù hợp.`;

    return await askGeminiIfConfigured(systemPrompt, message);
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
        `Để chẩn đoán chính xác nguyên nhân máy chậm, bạn có thể cho em biết thêm:\n` +
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
        `👉 Cửa hàng có hỗ trợ **Trả góp 0% lãi suất** qua thẻ tín dụng và đối tác tài chính (trả trước từ 30%). Bạn chia sẻ thêm về cấu hình máy cũ để em tư vấn sát nhất nhé!`;

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
        const id1 = context.lastProducts[0]._id || context.lastProducts[0].id || (typeof context.lastProducts[0] === 'number' || typeof context.lastProducts[0] === 'string' ? context.lastProducts[0] : null);
        const id2 = context.lastProducts[1]._id || context.lastProducts[1].id || (typeof context.lastProducts[1] === 'number' || typeof context.lastProducts[1] === 'string' ? context.lastProducts[1] : null);
        if (id1) p1 = await Product.findOne({ _id: id1, active: { $ne: false } });
        if (id2) p2 = await Product.findOne({ _id: id2, active: { $ne: false } });
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
            reply: 'Bạn muốn so sánh 2 sản phẩm cụ thể nào? Ví dụ: *"So sánh MacBook Air M2 và Laptop ASUS ROG Strix"* hoặc *"So sánh Lenovo IdeaPad Slim 3 và Dell Inspiron"* để em lập bảng thông số thực tế và phân tích điểm được - mất cho bạn nhé!',
            suggestions: ['So sánh MacBook Air và ROG Strix', 'So sánh Lenovo và Dell', 'Tư vấn laptop sinh viên', 'Mã giảm giá hôm nay']
        };
    }

    const s1 = p1.specs || {};
    const s2 = p2.specs || {};

    const diffPrice = Math.abs(p1.price - p2.price);
    const p1Saving = p1.price < p2.price ? ` *(Tiết kiệm ${money(diffPrice)})*` : '';
    const p2Saving = p2.price < p1.price ? ` *(Tiết kiệm ${money(diffPrice)})*` : '';

    const tableMarkdown = `⚖️ **BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT & GIÁ BÁN THỰC TẾ**

| Tiêu chí so sánh | **${p1.name}** | **${p2.name}** |
| :--- | :--- | :--- |
| **Giá niêm yết** | **${money(p1.price)}**${p1Saving} | **${money(p2.price)}**${p2Saving} |
| **Tình trạng kho** | ${p1.stock > 0 ? `Còn ${p1.stock} máy` : 'Tạm hết'} | ${p2.stock > 0 ? `Còn ${p2.stock} máy` : 'Tạm hết'} |
| **Vi xử lý (CPU)** | ${s1.cpu || 'Chưa có thông số chi tiết'} | ${s2.cpu || 'Chưa có thông số chi tiết'} |
| **Bộ nhớ RAM** | ${s1.ram || 'Chưa có thông số chi tiết'} | ${s2.ram || 'Chưa có thông số chi tiết'} |
| **Ổ cứng lưu trữ** | ${s1.storage || 'Chưa có thông số chi tiết'} | ${s2.storage || 'Chưa có thông số chi tiết'} |
| **Màn hình** | ${s1.screen || 'Chưa có thông số chi tiết'} | ${s2.screen || 'Chưa có thông số chi tiết'} |
| **Thời lượng pin (NSX)** | ${s1.battery || 'Theo công bố NSX'} | ${s2.battery || 'Theo công bố NSX'} |
| **Hệ điều hành** | ${s1.os || 'Theo máy'} | ${s2.os || 'Theo máy'} |
| **Chính sách bảo hành** | ${(!p1.warranty || p1.warranty === 'Không bảo hành') ? 'Chính hãng 12-24 tháng (Lỗi 1 đổi 1 30 ngày)' : p1.warranty} | ${(!p2.warranty || p2.warranty === 'Không bảo hành') ? 'Chính hãng 12-24 tháng (Lỗi 1 đổi 1 30 ngày)' : p2.warranty} |`;

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
        `🎯 **PHÂN TÍCH ĐIỂM MẠNH & ĐÁNH ĐỔI THỰC TẾ:**\n` +
        `• **Điểm nổi bật của ${p1.name}:** ${p1Advantage}\n` +
        `• **Điểm nổi bật của ${p2.name}:** ${p2Advantage}\n\n` +
        `⚖️ **Đánh đổi cần cân nhắc:**\n` +
        `• Chọn **${p1.name}**: ${tradeOffP1}\n` +
        `• Chọn **${p2.name}**: ${tradeOffP2}\n\n` +
        `💡 **LỜI KHUYÊN CHỌN MUA ĐÚNG NHU CẦU:**\n` +
        `👉 **Nên chọn ${p1.name} KHI:** ${conclusionP1}\n` +
        `👉 **Nên chọn ${p2.name} KHI:** ${conclusionP2}\n\n` +
        `🛡️ **QUYỀN LỢI ĐẢM BẢO KHI MUA TẠI TECHECOMMERCE:**\n` +
        `• Hàng chính hãng mới 100%, bảo hành chính hãng toàn quốc.\n` +
        `• Lỗi 1 đổi 1 trong 30 ngày đầu tiên nếu có lỗi kỹ thuật.\n` +
        `• Hỗ trợ trả góp 0% lãi suất — xét duyệt nhanh chỉ 3 phút.\n\n` +
        `Bạn có thể bấm **"Chọn máy này"** trên bảng hoặc bấm **"+ Giỏ"** ngay bên dưới để đặt mua nhé!`;

    return {
        reply,
        products: [p1, p2],
        suggestions: [
            `Chọn mua ${p1.name.slice(0, 20)}`,
            `Chọn mua ${p2.name.slice(0, 20)}`,
            'Tính trả góp 0%',
            'Mã giảm giá hôm nay'
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
        const words = text.replace(/tra gop|tinh gop|lai suat|moi thang|bao nhieu|thu tuc|co khong|the nao|huong dan|dieu kien|giay to/g, '').trim();
        if (words && words.length >= 3) {
            product = await Product.findOne({
                active: { $ne: false },
                name: { $regex: escapeRegex(words), $options: 'i' }
            });
        }
    }

    // Nếu khách hỏi thủ tục trả góp chung mà chưa chọn máy cụ thể
    const isGeneralInquiry = !product || /thu tuc|the nao|can gi|co the tin dung|khong co the|cccd|cmnd|bao nhieu tuoi|co tra gop|lai suat|dieu kien/i.test(text);

    if (!product || (isGeneralInquiry && (!previousProducts || previousProducts.length === 0))) {
        const reply = `💳 **CHÍNH SÁCH & THỦ TỤC TRẢ GÓP TẠI TECHECOMMERCE:**\n\n` +
            `Cửa hàng hỗ trợ **2 hình thức trả góp linh hoạt**, cực kỳ nhanh chóng và an tâm:\n\n` +
            `1. 🪪 **Trả góp qua CCCD gắn chip (Không cần thẻ tín dụng):**\n` +
            `   • **Đối tượng:** Công dân Việt Nam từ 18 tuổi trở lên.\n` +
            `   • **Thủ tục:** Chỉ cần CCCD gắn chip chính chủ. Xét duyệt hồ sơ online trong **15 phút** qua các công ty tài chính uy tín (FE Credit, Home Credit, HD SAISON).\n` +
            `   • **Khoản trả trước:** Chỉ từ **10% - 30%** giá trị máy, số tiền còn lại chia góp linh hoạt 6 - 12 tháng.\n\n` +
            `2. 💳 **Trả góp 0% lãi suất qua Thẻ tín dụng (Credit Card):**\n` +
            `   • **Ngân hàng hỗ trợ:** Hơn 25 ngân hàng liên kết (Techcombank, Vietcombank, VPBank, Sacombank, HSBC, TPBank, MB Bank...).\n` +
            `   • **Ưu điểm:** **0% lãi suất**, không cần chứng minh thu nhập hay duyệt hồ sơ, trả trước 0 đồng, kỳ hạn 3 - 6 - 9 - 12 tháng.\n\n` +
            `👉 Bạn đang quan tâm mẫu máy nào (ví dụ: *iPhone 15*, *Laptop ASUS TUF*, *MacBook Air*...) để em tính bảng trả góp và số tiền thanh toán hàng tháng chi tiết cho bạn nhé! 😊`;

        return {
            reply,
            products: [],
            suggestions: ['Trả góp iPhone', 'Trả góp Laptop', 'Chính sách bảo hành', 'Săn mã giảm giá']
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
        `✨ **Điều kiện & Thủ tục:** Áp dụng qua thẻ tín dụng liên kết (0% lãi suất) hoặc đối tác tài chính (xét duyệt CCCD gắn chip từ 18 tuổi trong 15 phút). Bạn có thể bấm "+ Giỏ" và chọn hình thức Trả góp khi thanh toán nhé!`;

    return {
        reply,
        products: [product],
        suggestions: ['Thêm sản phẩm này vào giỏ', 'Chính sách bảo hành', 'So sánh sản phẩm khác']
    };
}

/**
 * Đánh giá khả năng chơi game và chạy tác vụ nặng (Genshin, Valorant, Capcut, Premiere 4K...)
 */
async function evaluateGameOrTaskCapability(message, context = {}) {
    const norm = normalizeText(message);
    const hasGameOrTask = /\b(genshin|valorant|lien minh|lol|lmht|fo4|fifa|cs2|csgo|pubg|lien quan|toc chien|gta|cyberpunk|wukong|capcut|premiere|photoshop|blender|autocad|do hoa 3d|render 4k)\b/i.test(norm);
    const hasCapabilityIntent = /\b(muot khong|choi duoc|chay duoc|on khong|keo duoc|chay noi|co lag|fps|bao nhieu fps|co nong|co muot|edit duoc|dung duoc|render duoc)\b/i.test(norm);

    if (!hasGameOrTask && !hasCapabilityIntent) return null;

    // Tìm sản phẩm mục tiêu (từ message hoặc context)
    let targetProduct = null;
    const allActive = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } });
    for (const p of allActive) {
        const pNorm = normalizeText(p.name);
        if (norm.includes(pNorm)) {
            targetProduct = p;
            break;
        }
        const significant = pNorm.split(/\s+/).filter(w => w.length > 2);
        if (significant.length >= 2 && significant.every(t => norm.includes(t))) {
            targetProduct = p;
            break;
        }
    }
    if (!targetProduct && Array.isArray(context?.lastProducts) && context.lastProducts.length > 0) {
        const cand = context.lastProducts[0];
        const candId = cand?._id || cand;
        targetProduct = allActive.find(p => String(p._id) === String(candId) || (cand?.name && p.name === cand.name)) || (cand?.name ? cand : null);
    }

    // Nếu không có sản phẩm chỉ định, nhưng khách hỏi chung (ví dụ: "Laptop nào chơi Genshin mượt tầm 15-20 triệu")
    if (!targetProduct) {
        const budget = extractBudget(message) || 0;
        const gamingLaptops = allActive.filter(p => p.category === 'Laptop' && (/Nitro|TUF|ROG|Katana|Victus|Gaming/i.test(p.name) || (p.specs?.gpu && !/intel|iris|uhd|radeon 6/i.test(p.specs.gpu))));
        const matched = gamingLaptops.filter(p => budget > 0 ? p.price <= budget * 1.15 : true).slice(0, 3);
        if (matched.length > 0) {
            const list = matched.map(p => `• **${p.name}** — **${money(p.price)}** (Card đồ họa: **${p.specs?.gpu || 'GPU rời mạnh mẽ'}**, Màn hình: **${p.specs?.screen || '144Hz'}**)`).join('\n');
            return {
                reply: `🎮 **TƯ VẤN CẤU HÌNH CHIẾN GAME & ĐỒ HỌA MƯỢT MÀ:**\n\n` +
                    `Để chơi tốt các tựa game như Genshin Impact, Valorant, CS2 hay dựng phim Capcut / Premiere 4K, bạn nên chọn các dòng máy có **Card đồ họa rời NVIDIA GeForce RTX** và hệ thống tản nhiệt kép.\n\n` +
                    `Dưới đây là các mẫu máy tối ưu nhất đang có sẵn tại kho cửa hàng:\n\n${list}\n\n` +
                    `👉 Bạn đang quan tâm mức ngân sách khoảng bao nhiêu triệu để em tư vấn chi tiết cấu hình và mức FPS thực tế nhé! 😊`,
                products: matched,
                suggestions: matched.map(p => `Xem chi tiết ${p.name.replace(/(Laptop|Điện thoại)\s*/gi, '').slice(0, 18)}`)
            };
        }
        return null;
    }

    // Đánh giá dựa trên thông số thực tế của targetProduct
    const s = targetProduct.specs || {};
    const pName = targetProduct.name;
    const isMacBook = /macbook/i.test(pName);
    const isLaptop = targetProduct.category === 'Laptop';
    const isPhone = targetProduct.category === 'Điện thoại';
    const gpu = s.gpu || '';
    const cpu = s.cpu || '';
    const ram = s.ram || '';
    const hasDedicatedGpu = /RTX|GTX|Radeon RX/i.test(gpu) || /RTX|GTX/i.test(pName);

    let evaluation = '';

    if (isMacBook) {
        evaluation = `🍏 **Đánh giá hiệu năng thực tế trên ${pName} (${cpu || 'Apple Silicon'}):**\n\n` +
            `• 🎬 **Đồ họa & Dựng phim:** Siêu mượt mà! Chip Apple tối ưu phần cứng cực đỉnh cho **Capcut, Final Cut Pro, Adobe Premiere 4K**. Máy chạy êm ái, mát rượi và pin trâu 12 - 18 tiếng.\n` +
            `• ⚔️ **Liên Minh Huyền Thoại (LOL):** Chơi rất mượt mà ở mức **60 - 90 FPS** trực tiếp trên macOS.\n` +
            `• ⚠️ **Lưu ý về Valorant / FO4 / Genshin Impact:**\n` +
            `   - **Valorant & FIFA Online 4:** Chưa hỗ trợ hệ điều hành macOS (do hệ thống chống hack Vanguard / nProtect chặn).\n` +
            `   - **Genshin Impact:** Chưa có bản cài chính thức cho macOS (cần chơi qua công cụ giả lập thứ ba PlayCover).\n\n` +
            `💡 **Lời khuyên chân thành:** Nếu bạn mua máy ưu tiên học tập, lập trình, làm việc văn phòng và làm video thì MacBook là số 1. Nhưng nếu **chơi game PC (Valorant, CS2, FO4, Genshin)** là ưu tiên chính, bạn nên chọn sang dòng Laptop Gaming Windows có card rời RTX nhé!`;
    } else if (isLaptop && hasDedicatedGpu) {
        evaluation = `🚀 **Đánh giá hiệu năng thực tế trên ${pName}:**\n\n` +
            `Máy sở hữu cấu hình vi xử lý **${cpu}**, RAM **${ram}** cùng card đồ họa rời **${gpu}**:\n\n` +
            `• 🌟 **Genshin Impact:** Chiến cực mượt ở thiết lập **High / Highest 60 FPS**, combat đồ họa mãn nhãn không drop fps.\n` +
            `• 🎯 **Valorant / CS2 / LOL / FO4:** Cực kỳ mượt mà, FPS ổn định từ **140 - 220+ FPS**, kết hợp màn hình tần số quét cao ngắm bắn siêu chuẩn.\n` +
            `• 🎬 **Edit video Capcut / Premiere 4K & Đồ họa 3D:** Nhân đồ họa NVIDIA CUDA hỗ trợ render nhanh gấp nhiều lần máy văn phòng.\n` +
            `• ⚖️ **Điểm cần lưu ý:** Vì là dòng máy hiệu năng cao nên khi chơi game bạn nên cắm sạc để hệ thống tản nhiệt và GPU hoạt động hết công suất nhé!`;
    } else if (isLaptop) {
        evaluation = `💼 **Đánh giá hiệu năng thực tế trên ${pName}:**\n\n` +
            `Máy sử dụng vi xử lý **${cpu}** kết hợp chip đồ họa **${gpu || 'Intel Iris Xe / AMD Radeon'}**:\n\n` +
            `• 🎮 **Game Esports (LOL, FO4, Valorant):** Chơi mượt mà ở thiết lập đồ họa Trung bình (Medium), mức FPS duy trì ổn định từ **60 - 85 FPS**.\n` +
            `• 🌟 **Genshin Impact:** Chơi được ở mức đồ họa Thấp (Low/Lowest), duy trì khoảng **35 - 50 FPS** (máy sẽ hơi ấm lên khi chơi lâu).\n` +
            `• 🎬 **Capcut / Photoshop 2D:** Rất mượt mà, xuất video Full HD và 4K ngắn trơn tru.\n\n` +
            `💡 **Gợi ý:** Nếu bạn có kế hoạch cày game nặng hoặc render 3D thường xuyên, bạn có thể tham khảo thêm dòng máy có card đồ họa rời chuyên dụng để máy bền bỉ và mát hơn nhé!`;
    } else if (isPhone) {
        evaluation = `📱 **Đánh giá trải nghiệm game trên ${pName}:**\n\n` +
            `Máy trang bị vi xử lý **${cpu || 'hiệu năng cao'}**, RAM **${ram}** và viên pin **${s.battery || 'dung lượng lớn'}**:\n\n` +
            `• ⚔️ **Liên Quân Mobile, Tốc Chiến, Free Fire:** Cực kỳ mượt mà, bật max 60 - 120 FPS không giật lag.\n` +
            `• 🌟 **Genshin Impact / Honkai Star Rail:** Chơi mượt mà và ổn định, hình ảnh sắc nét.\n` +
            `• 🔋 **Thời lượng pin & nhiệt độ:** Máy kiểm soát nhiệt độ tốt, sạc nhanh giúp nạp lại pin nhanh chóng khi chiến game.`;
    } else {
        evaluation = `Dạ mẫu **${pName}** sở hữu cấu hình rất tốt trong tầm giá, đáp ứng trơn tru các tác vụ giải trí và công việc hàng ngày của bạn!`;
    }

    return {
        reply: evaluation,
        products: [targetProduct],
        suggestions: [
            `Xem chi tiết ${targetProduct.name.replace(/(Laptop|Điện thoại)\s*/gi, '').slice(0, 18)}`,
            'Tính trả góp 0%',
            'So sánh máy khác',
            'Chính sách bảo hành'
        ]
    };
}


async function answerOrderQuestion(req, message) {
    const user = req.user;
    const orderId = (message.match(/#?\b(\d{1,8})\b/) || [])[1];

    if (!user) {
        return {
            reply: 'Để em kiểm tra đơn hàng chính xác, bạn hãy đăng nhập tài khoản đã đặt hàng rồi hỏi lại theo mẫu: "Kiểm tra đơn #123". Bạn cũng có thể vào mục "Đơn hàng của tôi" ở góc trang web.',
            suggestions: ['Đăng nhập tài khoản', 'Chính sách vận chuyển', 'Chính sách đổi trả']
        };
    }

    const filter = { customer: user._id };
    if (orderId) filter._id = Number(orderId);

    const orders = await Order.find(filter).sort({ orderDate: -1, createdAt: -1 }).limit(orderId ? 1 : 3);

    if (!orders.length) {
        return {
            reply: orderId
                ? `Em chưa tìm thấy đơn #${orderId} trong tài khoản của bạn. Bạn kiểm tra lại mã đơn hoặc vào mục Đơn hàng của tôi để xem danh sách đầy đủ nhé.`
                : 'Tài khoản của bạn hiện chưa có đơn hàng nào. Bạn có thể nói nhu cầu mua sắm, em sẽ gợi ý sản phẩm phù hợp.',
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
        guidanceIntro = demandDesc ? `Chào bạn! Dựa trên ${demandDesc}, em đã chọn lọc các mẫu máy chính hãng phù hợp nhất trong kho:` : `Chào bạn! Dưới đây là các lựa chọn chính hãng tối ưu nhất trong kho:`;
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

    const followUpQuestion = `\n\n👉 **Bạn còn phân vân gì giữa các mẫu trên không?** Bạn có muốn em so sánh chi tiết ưu/nhược điểm điểm nào giữa 2 máy để bạn dễ chọn nhất không nhé?`;

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
                ? `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}** trong khoảng ngân sách **${money(prev.budget)}**, bạn có ưu tiên thêm yếu tố nào sau đây không để em chọn dòng máy phù hợp nhất cho bạn?`
                : `Dạ rất rõ ràng ạ! Với nhu cầu **${useCase}**, bạn có ưu tiên thêm yếu tố nào sau đây (như kích thước màn hình hay độ mỏng nhẹ khi di chuyển) không để em chọn dòng máy phù hợp nhất cho bạn?`;
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

        const reply = `Dạ hiện tại TechEcommerce **chuyên phân phối 100% laptop mới chính hãng** với tiêu chuẩn bảo hành 12 - 24 tháng. Mẫu laptop chính hãng có giá tốt nhất tại cửa hàng hiện là **${lowestLaptop?.name || 'Lenovo IdeaPad Slim 3 14 inch'}** với mức giá **${money(lowestLaptop?.price || 13990000)}**.\n\n` +
            `Với mức ngân sách **${money(budget)}**, em xin đề xuất 2 giải pháp tối ưu cho bạn:\n\n` +
            `1. 💳 **Mua trả góp 0% lãi suất:** Bạn chỉ cần trả trước khoảng 30% (tương đương **${money(downPayment)}**), số tiền còn lại chia nhỏ trả góp chỉ khoảng **${money(monthlyInstallment)}/tháng** với thủ tục duyệt CCCD chỉ 15 phút.\n` +
            `2. 📲 **Tham khảo Máy tính bảng chính hãng:** Nếu nhu cầu chủ yếu là học online, xem tài liệu PDF và lướt web, các dòng tablet trong kho như **${tablets[0]?.name || 'HONOR Pad 10'}** (${money(tablets[0]?.price)}) hoàn toàn đáp ứng tốt trong tầm ngân sách.\n\n` +
            `👉 Bạn có muốn em tính chi tiết bảng trả góp 0% cho mẫu laptop trên, hay xem các dòng máy tính bảng giá tiết kiệm không ạ?`;

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
                : `Chào bạn! Để em giúp bạn chọn chiếc tai nghe phù hợp và ưng ý nhất, bạn dự định dùng tai nghe chủ yếu cho nhu cầu nào sau đây ạ?`;
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
                : `Chào bạn! Để em tư vấn thiết bị chơi game phù hợp nhất, bạn đang tìm máy chơi game phục vụ trải nghiệm nào là chính ạ?`;
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
                : `Chào bạn! Với danh mục Phụ kiện, bạn đang quan tâm loại sản phẩm nào (như bàn phím máy tính, chuột máy tính, pin sạc dự phòng, củ sạc nhanh hay hub chuyển đổi) để em tư vấn mẫu tốt nhất nhé?`;
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
        const reply = `Chào bạn! Em là Trợ lý Tư vấn Mua sắm AI của TechEcommerce. Bạn đang quan tâm đến dòng sản phẩm nào hoặc có mức ngân sách khoảng bao nhiêu để em tư vấn chi tiết nhất nhé?`;
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

async function answerPolicyQuestion(message) {
    const text = normalizeText(message);

    try {
        const article = await findKnowledgeArticle(message, { type: 'policy' });
        if (article?.answer) return article.answer;
    } catch (error) {
        console.warn('KnowledgeBase lookup skipped:', error.message);
    }

    // 1. Địa chỉ showroom / Cửa hàng xem máy trực tiếp
    if (['shop o dau', 'cua hang o dau', 'o dau vay', 'dia chi cua hang', 'dia chi shop', 'dia chi o dau', 'o dau', 'showroom', 'chi nhanh', 'den xem truc tiep', 'xem may o dau', 'co showroom khong', 'dia chi'].some(k => text.includes(k))) {
        return '📍 **HỆ THỐNG SHOWROOM & ĐỊA CHỈ TRẢI NGHIỆM TECHECOMMERCE:**\n\n' +
            'Cửa hàng mở cửa từ **08:30 – 21:30** tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật & ngày lễ):\n\n' +
            '• **Showroom 1 (TP.HCM):** 135 Nguyễn Thị Thập, P. Tân Hưng, Quận 7, TP.HCM\n' +
            '• **Showroom 2 (Hà Nội):** 78 Thái Hà, P. Trung Liệt, Q. Đống Đa, Hà Nội\n\n' +
            '✨ **Đặc quyền khi ghé Showroom:**\n' +
            '- Trải nghiệm thực tế 100% các dòng máy demo (test camera, gõ thử phím cơ, thử màn hình 144Hz...). \n' +
            '- Kỹ thuật viên hỗ trợ cài đặt phần mềm, chuyển dữ liệu và dán màn hình miễn phí tại chỗ.\n' +
            '- Bãi đỗ xe ô tô và xe máy rộng rãi, an toàn, có nhân viên hướng dẫn nhiệt tình.';
    }

    // 2. Chính sách đồng kiểm khi nhận hàng (BẮT BUỘC ĐẶT TRƯỚC "doi tra" / "tra hang")
    if (['kiem tra hang', 'dong kiem', 'xem hang', 'mo hop', 'check hang', 'xem may truoc', 'kiem tra truoc', 'kiem hang', 'co duoc kiem tra'].some(k => text.includes(k))) {
        return '📦 **CHÍNH SÁCH ĐỒNG KIỂM KHI NHẬN HÀNG (COD):**\n\n' +
            '• **100% ĐƯỢC MỞ HỘP KIỂM TRA:** Khi shipper giao tới, bạn hoàn toàn có quyền mở hộp kiểm tra ngoại quan máy, phụ kiện đi kèm, tem niêm phong và phiếu bảo hành trước khi thanh toán tiền mặt (COD).\n' +
            '• **An tâm tuyệt đối:** Nếu phát hiện trầy xước, cấn móp, sai mẫu hoặc seal bị rách, bạn có quyền từ chối nhận hàng ngay lập tức mà **không mất bất kỳ chi phí nào**.\n' +
            '• **Quyền lợi bảo vệ:** Sau khi nhận máy, bạn vẫn được áp dụng chính sách **Lỗi 1 đổi 1 trong 30 ngày đầu** nếu máy phát sinh bất kỳ lỗi phần cứng nào từ nhà sản xuất.';
    }

    // 3. Chính sách bảo hành & Đổi mới 1-1
    if (text.includes('bao hanh') || text.includes('doi tra') || text.includes('hoan tra') || text.includes('tra hang') || text.includes('loi 1 doi 1')) {
        return '🛡️ **CHÍNH SÁCH BẢO HÀNH & ĐỔI TRẢ CHÍNH HÃNG:**\n\n' +
            '• 🏆 **Cam kết 100% chính hãng:** Toàn bộ sản phẩm là hàng mới chính hãng, có hóa đơn VAT và bảo hành điện tử chính hãng từ 12 - 24 tháng.\n' +
            '• 🔄 **Lỗi 1 đổi 1 trong 30 ngày:** Đổi ngay máy mới cùng model nếu phát sinh lỗi phần cứng do nhà sản xuất (màn hình, nguồn, mainboard...).\n' +
            '• 🛠️ **Trung tâm bảo hành toàn quốc:** Tiếp nhận bảo hành tại tất cả các Trung tâm bảo hành ủy quyền (Apple Care, Samsung Service, ASUS, Dell, HP, Lenovo...) hoặc tiếp nhận trực tiếp tại Showroom của shop.\n' +
            '• 🚚 **Tiếp nhận bảo hành tận nơi:** Cửa hàng hỗ trợ gửi ship nhận bảo hành 2 chiều hoàn toàn miễn phí cho khách hàng ở xa.';
    }

    // 4. Chính sách giao hàng & Vận chuyển
    if (text.includes('van chuyen') || text.includes('giao hang') || text.includes('ship') || text.includes('phi van chuyen')) {
        return '🚚 **CHÍNH SÁCH GIAO HÀNG HỎA TỐC:**\n\n' +
            '• **Giao nhanh nội thành (Hà Nội & TP.HCM):** Nhận máy chỉ sau 2 - 4 giờ qua dịch vụ chuyển phát hỏa tốc.\n' +
            '• **Miễn phí vận chuyển toàn quốc:** Áp dụng cho mọi đơn hàng có giá trị từ 500.000 đ.\n' +
            '• **Đồng kiểm an toàn:** Được mở hộp kiểm tra máy nguyên vẹn trước khi thanh toán tiền cho nhân viên giao hàng.';
    }

    // 5. Hình thức thanh toán
    if (text.includes('thanh toan') || text.includes('vnpay') || text.includes('momo') || text.includes('cod') || text.includes('chuyen khoan')) {
        return '💳 **HÌNH THỨC THANH TOÁN TIỆN LỢI:**\n\n' +
            '• Thanh toán khi nhận hàng (COD) sau khi mở hộp kiểm tra máy.\n' +
            '• Chuyển khoản ngân hàng, quét mã VNPAY-QR, Ví MoMo (thường xuyên có mã giảm thêm).\n' +
            '• Trả góp 0% qua thẻ tín dụng hơn 25 ngân hàng hoặc trả góp qua CCCD gắn chip duyệt online 15 phút.';
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

    // 0. BẢO VỆ TUYỆT ĐỐI: Khách đang hỏi han, thắc mắc, phân vân, đánh giá, tìm hiểu ưu/nhược điểm
    // Tuyệt đối KHÔNG ĐƯỢC kích hoạt nhầm action mua hàng / thêm vào giỏ!
    const isConsultationOrQuestion = [
        'tai sao', 'vi sao', 'sao lai', 'ly do', 'co nen', 'co dang',
        'co gi tot', 'co gi hay', 'co gi noi bat', 'co uu diem gi', 'co diem gi',
        'uu diem', 'nhuoc diem', 'danh gia', 'review', 'suy nghi', 'phan van',
        'tot khong', 'on khong', 'muot khong', 'ben khong', 'dung co tot khong',
        'co nen mua', 'sao lai dat', 'sao lai re', 'tu van', 'cho hoi', 'cho minh hoi',
        'so sanh', 'khac gi', 'khac nhau gi', 'hoi ve', 'hoi san pham', 'dung the nao',
        'co dang mua', 'co tot khong', 'co hop khong', 'co on khong', 'co nen lay',
        'phu hop voi ai', 'nen mua con nao', 'nen mua may nao'
    ].some(k => norm.includes(k));

    if (isConsultationOrQuestion) {
        return null;
    }

    // 1. Phân loại lệnh thêm vào giỏ / đặt mua thực tế
    // Chỉ kích hoạt khi người dùng ra lệnh hành động dứt khoát
    const hasAddIntent = [
        'them vao gio', 'them vao cart', 'cho vao gio', 'bo vao gio',
        'mua ngay', 'dat mua', 'dat hang', 'thanh toan ngay', 'chot don',
        'lay con nay', 'lay may nay', 'mua luon', 'dat luon', 'lay san pham nay'
    ].some(k => norm.includes(k)) || /^(?:mua|lay|chon)\s+(?:san\s+pham|mau|con|may)\s+nay(?:\s+nhe|\s+nha|\s+di)?$/i.test(norm);

    const hasCouponIntent = [
        'ap ma giam gia', 'ap voucher', 'ap ma', 'dung ma giam gia',
        'ma tot nhat', 'ma giam gia tot nhat', 'uu dai tot nhat', 'voucher tot nhat', 'giam gia tot nhat'
    ].some(k => norm.includes(k));

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

    // B. Nếu chưa tìm thấy, kiểm tra sản phẩm đang xem trên trang hoặc context gần nhất
    if (!targetProduct && (context?.pageProductId || context?.productId)) {
        const activePid = context.pageProductId || context.productId;
        targetProduct = allActive.find(p => String(p._id) === String(activePid) || String(p.id) === String(activePid)) || null;
    }
    if (!targetProduct && Array.isArray(context?.lastProducts) && context.lastProducts.length > 0) {
        const candidateId = context.lastProducts[0]._id || context.lastProducts[0];
        targetProduct = allActive.find(p => String(p._id) === String(candidateId) || String(p.id) === String(candidateId)) || null;
    }

    // C. Tìm kiếm lỏng theo brand hoặc từ khóa công nghệ trong câu
    if (!targetProduct) {
        const matched = sortedCatalog.find(p => {
            const pNorm = normalizeText(p.name + ' ' + (p.brand || '') + ' ' + (p.category || ''));
            const words = norm.split(/\s+/).filter(w => w.length >= 3 && !['them', 'vao', 'gio', 'hang', 'giup', 'cho', 'va', 'ap', 'ma', 'giam', 'gia', 'tot', 'nhat', 'toi', 'minh', 'ngay', 'luon'].includes(w));
            return words.length > 0 && words.some(w => pNorm.includes(w));
        });
        if (matched) targetProduct = matched;
    }

    if (!targetProduct) {
        return {
            reply: 'Dạ em rất sẵn sàng hỗ trợ bạn thêm vào giỏ và áp mã ưu đãi ngay! Bạn có thể cho em biết rõ hơn tên model sản phẩm (ví dụ: *Logitech MX Keys S*, *iPhone 16 Pro Max*, *MacBook Air M3*...) được không ạ?',
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

async function answerBundleBargainQuestion(message, context = {}) {
    try {
        const allActive = await Product.find({ active: { $ne: false } }).lean();
        if (!allActive.length) return null;

        // 1. Tìm sản phẩm mục tiêu (từ context trước đó hoặc từ tên model nhắc tới)
        let targetProduct = null;
        if (Array.isArray(context.lastProducts) && context.lastProducts.length > 0) {
            const firstId = context.lastProducts[0]._id || context.lastProducts[0];
            targetProduct = allActive.find(p => String(p._id) === String(firstId)) || null;
        }

        if (!targetProduct) {
            const norm = normalizeText(message);
            targetProduct = allActive.find(p => {
                const pNorm = normalizeText(p.name);
                return norm.includes(pNorm) || (pNorm.length > 8 && norm.includes(pNorm.slice(0, 15)));
            });
        }

        if (!targetProduct) {
            targetProduct = allActive.find(p => p.featured || /iphone|macbook|galaxy|asus/i.test(p.name)) || allActive[0];
        }

        // 2. Tìm các phụ kiện tương thích có sẵn trong shop
        let accessories = allActive.filter(p =>
            p._id !== targetProduct._id && (
                p.category === 'Phụ kiện' ||
                p.category === 'Tai nghe' ||
                /chuột|tai nghe|sạc|cáp|balo|bàn phím|hub/i.test(p.name)
            )
        );

        if (accessories.length < 2) {
            accessories = allActive.filter(p => p._id !== targetProduct._id && p.price < targetProduct.price * 0.25);
        }

        const selectedAccessories = accessories.slice(0, 3).map((acc, idx) => {
            const discountPercent = idx === 0 ? 0.25 : (idx === 1 ? 0.30 : 0.20);
            const bundlePrice = Math.round(acc.price * (1 - discountPercent) / 10000) * 10000;
            return {
                id: `addon-${acc._id}`,
                productId: acc._id,
                name: acc.name,
                image: acc.image,
                originalPrice: acc.price,
                bundlePrice: Math.max(bundlePrice, 100000),
                discountPercent: Math.round(discountPercent * 100),
                selected: idx < 2
            };
        });

        const totalOriginalAddons = selectedAccessories.filter(a => a.selected).reduce((s, a) => s + a.originalPrice, 0);
        const totalBundleAddons = selectedAccessories.filter(a => a.selected).reduce((s, a) => s + a.bundlePrice, 0);
        const totalSavings = totalOriginalAddons - totalBundleAddons;

        const reply = `Dạ giá niêm yết **${money(targetProduct.price)}** của **${targetProduct.name}** hiện đã là giá kịch sàn cho hàng phân phối chính hãng kèm gói bảo hành 1 đổi 1 an tâm tuyệt đối ạ! 🛡️\n\n` +
            `Tuy nhiên để hỗ trợ bạn tiết kiệm tối đa hôm nay, TechEcommerce kích hoạt chính sách **Combo Trợ Giá Phụ Kiện Chính Hãng Giảm Đến 30%** khi mua kèm máy!\n` +
            `Bạn có thể tùy ý tích chọn các phụ kiện bên dưới để gộp đơn và tiết kiệm ngay **${money(totalSavings)}** nhé: 👇`;

        return {
            reply,
            bundle: {
                mainProduct: {
                    _id: targetProduct._id,
                    name: targetProduct.name,
                    price: targetProduct.price,
                    image: targetProduct.image,
                    category: targetProduct.category
                },
                addons: selectedAccessories,
                totalSavings
            },
            suggestions: [
                `Mua cả combo ${targetProduct.name}`,
                'Tư vấn trả góp 0%',
                'Xem bảng so sánh máy khác'
            ],
            context: {
                ...context,
                lastProducts: [targetProduct],
                stage: 'bundle_bargain'
            }
        };
    } catch (e) {
        console.warn('answerBundleBargainQuestion error:', e.message);
        return null;
    }
}

/**
 * 💡 Chế độ "Tư vấn theo ngân sách & nhu cầu chuyên sâu" (Group 4 Feature)
 * Xử lý trực tiếp các truy vấn gợi ý từ khách:
 * 1. "Tìm máy dưới 15 triệu chơi mượt Genshin Impact"
 * 2. "Tìm tai nghe chống ồn tốt nhất để đi máy bay"
 */
async function handleBudgetAndSpecialAdvisorQueries(message, context = {}) {
    const norm = normalizeText(message);

    // 1. Nhu cầu tai nghe chống ồn máy bay / du lịch
    const isAirplaneANC = (norm.includes('tai nghe') || norm.includes('headphone') || norm.includes('airpod')) &&
        (norm.includes('may bay') || norm.includes('chuyen bay') || norm.includes('di tour') || norm.includes('du lich') || norm.includes('chong on tot nhat') || norm.includes('chong on tot'));

    if (isAirplaneANC) {
        const ancHeadphones = await Product.find({
            category: 'Tai nghe',
            active: { $ne: false },
            stock: { $gt: 0 },
            name: { $regex: /(WH-1000XM5|AirPods Pro|JBL Tour|WH-ULT900N|Buds 3 Pro)/i }
        }).lean();

        ancHeadphones.sort((a, b) => {
            if (/WH-1000XM5/i.test(a.name)) return -1;
            if (/WH-1000XM5/i.test(b.name)) return 1;
            if (/AirPods Pro/i.test(a.name)) return -1;
            return 0;
        });

        const topPick = ancHeadphones[0];
        const secondPick = ancHeadphones[1];
        const selected = [topPick, secondPick].filter(Boolean);

        if (selected.length > 0) {
            selected[0].recommendation = { reason: 'Chống ồn ANC đỉnh cao, triệt tiêu tiếng gầm máy bay' };
            if (selected[1]) {
                selected[1].recommendation = { reason: 'Nhỏ gọn bỏ túi, xuyên âm đàm thoại trong trẻo' };
            }

            return {
                reply: `✈️ **LỰA CHỌN TỐI ƯU NHẤT KHI ĐI MÁY BAY / DU LỊCH:**\n\n` +
                    `Để triệt tiêu hoàn toàn tiếng ù và tiếng gầm động cơ phản lực trên các chuyến bay, **Tai nghe chống ồn chủ động (ANC)** là trang bị không thể thiếu. TechEcommerce đề xuất 2 mẫu tai nghe đỉnh nhất hiện nay:\n\n` +
                    `1. 🏆 **${topPick.name}** (${money(topPick.price)}):\n` +
                    `   • **Lý do tối ưu:** Sở hữu công nghệ chống ồn ANC hàng đầu thế giới với 2 chip xử lý và 8 micro triệt tiêu tạp âm tần số thấp cực sâu. Đệm tai siêu êm ái không gây đau tai suốt chuyến bay dài 8-12 tiếng. Pin 30 giờ và kèm sẵn cáp 3.5mm cắm trực tiếp vào hệ thống giải trí ghế máy bay.\n\n` +
                    (secondPick ? `2. 🌟 **${secondPick.name}** (${money(secondPick.price)}):\n   • **Lý do tối ưu:** Thiết kế True Wireless đút tai siêu gọn nhẹ bỏ túi áo. Chế độ xuyên âm thích ứng (Adaptive Audio) giúp nghe rõ thông báo từ cơ trưởng hoặc tiếp viên mà không cần tháo tai nghe.\n\n` : '') +
                    `👉 Em đã đính kèm danh thiếp sản phẩm bên dưới để bạn xem chi tiết hoặc bấm đặt hàng nhanh giao tận nơi nhé! 😊`,
                products: selected,
                suggestions: [
                    'Thêm vào giỏ hàng ngay',
                    'Tư vấn trả góp 0%',
                    'So sánh Sony WH-1000XM5 vs AirPods Pro 2',
                    'Mã giảm giá hôm nay'
                ],
                context: {
                    ...context,
                    lastProducts: selected,
                    stage: 'budget_special_advisor',
                    targetCategory: 'Tai nghe'
                }
            };
        }
    }

    // 2. Nhu cầu máy dưới 15 triệu chơi mượt Genshin Impact
    const isGenshinBudget = (norm.includes('genshin') || norm.includes('genshin impact')) &&
        (norm.includes('15 trieu') || norm.includes('duoi 15') || norm.includes('15tr') || norm.includes('tam gia'));

    if (isGenshinBudget) {
        const candidates = await Product.find({
            price: { $lte: 15000000 },
            active: { $ne: false },
            stock: { $gt: 0 },
            category: { $in: ['Điện thoại', 'Máy chơi game', 'Laptop'] }
        }).lean();

        candidates.sort((a, b) => {
            if (/POCO/i.test(a.name)) return -1;
            if (/POCO/i.test(b.name)) return 1;
            if (/Galaxy A55/i.test(a.name)) return -1;
            return 0;
        });

        const topPick = candidates[0];
        const secondPick = candidates[1];
        const selected = [topPick, secondPick].filter(Boolean);

        if (selected.length > 0) {
            selected[0].recommendation = { reason: 'Chip đồ họa mạnh, chiến Genshin mượt mà ổn định' };
            if (selected[1]) {
                selected[1].recommendation = { reason: 'Màn hình 120Hz rực rỡ, pin trâu cày game bền bỉ' };
            }

            return {
                reply: `🎮 **LỰA CHỌN TỐI ƯU DƯỚI 15 TRIỆU ĐỂ CHIẾN MƯỢT GENSHIN IMPACT:**\n\n` +
                    `Genshin Impact là tựa game thế giới mở đồ họa 3D rất nặng. Trong phân khúc dưới 15 triệu, **${topPick.name}** (${money(topPick.price)}) là **lựa chọn tối ưu nhất** tại TechEcommerce:\n\n` +
                    `• **Lý do tối ưu:**\n` +
                    `  1. **Hiệu năng & Đồ họa:** Trang bị vi xử lý đồ họa mạnh mẽ, tối ưu hóa khung hình giúp combat mượt mà ở mức thiết lập 50-60 FPS ổn định.\n` +
                    `  2. **Tản nhiệt LiquidCool:** Hệ thống làm mát chuyên dụng chống quá nhiệt, giúp máy không bị bóp xung hạ sáng khi cày La Hoàn Thâm Cảnh.\n` +
                    `  3. **Màn hình & Pin:** Tần số quét 120Hz siêu nhạy, viên pin lớn trên 5.000mAh hỗ trợ sạc nhanh giúp nạp đầy năng lượng chỉ trong 35-45 phút.\n` +
                    `  4. **Mức giá cực tốt:** Chỉ **${money(topPick.price)}**, tiết kiệm tới hơn 5 triệu so với ngân sách trần 15 triệu của bạn!\n\n` +
                    `👉 Bạn có thể xem ngay danh thiếp bên dưới để chọn phiên bản màu hoặc thêm vào giỏ nhận ưu đãi độc quyền nhé!`,
                products: selected,
                suggestions: [
                    'Thêm vào giỏ hàng ngay',
                    'Xem các màu có sẵn',
                    'Tư vấn trả góp 0%',
                    'Mã giảm giá hôm nay'
                ],
                context: {
                    ...context,
                    lastProducts: selected,
                    stage: 'budget_special_advisor',
                    targetCategory: topPick.category
                }
            };
        }
    }

    return null;
}

router.post('/', chatLimiter, optionalAuth, async (req, res) => {
    try {
        const message = String(req.body.message || '').trim();
        if (!message) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần tư vấn.' });

        // NLU Pre-Guardrails check: Chặn ngay prompt injection và khiếu nại (Giai đoạn A)
        if (process.env.NLU_PIPELINE !== 'off') {
            try {
                const nluResult = nlu.processInput(message, req.body.context);
                const preGuard = nlu.applyPreGuardrails({
                    nluResult,
                    rawMessage: message,
                    context: req.body.context
                });
                if (preGuard && preGuard.intercepted) {
                    recordConversation(req, message, preGuard.response).catch(e => console.warn('recordConversation error:', e.message));
                    return res.json(preGuard.response);
                }
            } catch (err) {
                console.warn('[chatRoutes NLU Pre-Guardrail Warning]:', err.message);
            }
        }

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
        const specialAdvisor = await handleBudgetAndSpecialAdvisorQueries(message, req.body.context);
        const policyAnswer = await answerPolicyQuestion(message);
        const gameCapability = await evaluateGameOrTaskCapability(message, req.body.context);
        const isBargainOrBundle = ['bot khong', 'giam them khong', 'mac ca', 'bot chut', 'giam gia them', 'qua tang', 'combo', 'mua kem', 'co qua gi khong', 'gia nay la gia cuoi chua', 'co bot duoc khong', 'co uu dai gi them khong', 'xin bot', 'co giam them', 'combo phu kien', 'co khuyen mai kem'].some(k => hasWordOrPhrase(text, k));

        const smallTalk = detectGreetingOrSmallTalk(text);
        if (smallTalk) {
            response = smallTalk;
        } else if (specialAdvisor) {
            response = specialAdvisor;
        } else if (await handleActionExecution(message, req.body.context)) {
            response = await handleActionExecution(message, req.body.context);
        } else if (isBargainOrBundle) {
            response = await answerBundleBargainQuestion(message, req.body.context);
            if (!response) {
                response = await answerVoucherQuestion();
            }
        } else if (gameCapability) {
            response = gameCapability;
        } else if (['voucher', 'ma giam gia', 'khuyen mai', 'uu dai', 'ma code', 'giam gia', 'sale', 'co khuyen mai gi'].some(k => hasWordOrPhrase(text, k))) {
            response = await answerVoucherQuestion();
        } else if (['tra gop', 'gop 0%', 'lai suat', 'moi thang bao nhieu', 'thu tuc tra gop'].some(k => hasWordOrPhrase(text, k)) && !['may thu hai', 'mau so', 'dat qua', 'so sanh'].some(k => hasWordOrPhrase(text, k))) {
            response = await answerInstallmentQuestion(message, req.body.context?.lastProducts);
        } else if (['don hang', 'ma don', 'trang thai don', 'van don', 'giao toi dau', 'don cua toi'].some(k => hasWordOrPhrase(text, k))) {
            response = await answerOrderQuestion(req, message);
        } else if (policyAnswer) {
            response = {
                reply: policyAnswer,
                suggestions: ['Kiểm tra đơn hàng', 'Tư vấn sản phẩm', 'Mã giảm giá hôm nay']
            };
        } else {
            response = await coordinateConsultation({ message, user: req.user, context: req.body.context });
            if (!response || !response.reply) {
                const openReply = await askGeminiOpenChat(message, req.body.context);
                if (openReply) {
                    response = {
                        reply: openReply,
                        suggestions: response?.suggestions?.length ? response.suggestions : ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Máy chơi game', 'Mã giảm giá hôm nay'],
                        context: { ...(req.body.context || {}), stage: 'conversational' }
                    };
                }
            }
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
 * 📷 Visual AI Search: Chuẩn hóa danh mục TechEcommerce
 */
function normalizeVisualCategory(cat) {
    if (!cat) return '';
    const c = String(cat).toLowerCase().trim();
    if (c.includes('thoại') || c.includes('phone') || c.includes('smartphone') || c.includes('mobile')) return 'Điện thoại';
    if (c.includes('laptop') || c.includes('macbook') || c.includes('notebook') || c.includes('máy tính xách tay')) return 'Laptop';
    if (c.includes('tablet') || c.includes('ipad') || c.includes('máy tính bảng')) return 'Tablet';
    if (c.includes('tai nghe') || c.includes('headphone') || c.includes('earphone') || c.includes('earbud') || c.includes('airpod') || c.includes('audio') || c.includes('loa') || c.includes('sound') || c.includes('headset')) return 'Tai nghe';
    if (c.includes('đồng hồ') || c.includes('watch') || c.includes('smartwatch')) return 'Đồng hồ thông minh';
    if (c.includes('máy chơi game') || c.includes('console') || c.includes('playstation') || c.includes('nintendo') || c.includes('ps5') || c.includes('ps4') || c.includes('xbox') || c.includes('gaming') || c.includes('rog ally') || c.includes('claw')) return 'Máy chơi game';
    if (c.includes('phụ kiện') || c.includes('accessory') || c.includes('chuột') || c.includes('mouse') || c.includes('bàn phím') || c.includes('keyboard') || c.includes('sạc') || c.includes('charger') || c.includes('cáp') || c.includes('cable') || c.includes('hub') || c.includes('gimbal') || c.includes('camera')) return 'Phụ kiện';
    return '';
}

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
                const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const prompt = `Bạn là hệ thống AI phân loại thiết bị công nghệ của TechEcommerce (chuyên: Điện thoại, Laptop, Tablet, Tai nghe, Đồng hồ thông minh, Phụ kiện, Máy chơi game).

Nhiệm vụ: Phân tích KỸ CÀNG bức ảnh. Liệt kê TẤT CẢ thiết bị công nghệ bạn nhìn thấy.

Quy tắc:
- Nếu ảnh chứa thiết bị công nghệ/phụ kiện điện tử: status "matched", liệt kê đầy đủ trong mảng "devices"
- Nếu ảnh chỉ chứa cây cối, thiên nhiên, thức ăn, quần áo, xe cộ, đồ gia dụng: status "non_tech"
- Nếu ảnh quá mờ, tối, bị che khuất: status "unclear"
- BẮT BUỘC "category" phải là 1 trong 7 danh mục: "Điện thoại", "Laptop", "Tablet", "Tai nghe", "Đồng hồ thông minh", "Phụ kiện", "Máy chơi game"

Trả về JSON thuần:
{
  "status": "matched" | "non_tech" | "unclear",
  "devices": [
    {
      "name": "tên thiết bị cụ thể",
      "category": "Điện thoại | Laptop | Tablet | Tai nghe | Đồng hồ thông minh | Phụ kiện | Máy chơi game",
      "brand": "Apple | Samsung | Logitech | Sony | ASUS | Dell | Nintendo | v.v.",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "reason": "lý do nếu non_tech hoặc unclear"
}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

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
                        maxOutputTokens: 2048,
                        thinkingConfig: { thinkingBudget: 0 }
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
                    let text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        try {
                            text = text.trim();
                            if (text.startsWith('```')) {
                                text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                            }
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

        // Heuristic fallback nếu Gemini không chạy hoặc trả về lỗi
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
                const hasAudio = raw.includes('headphone') || raw.includes('tai nghe') || raw.includes('airpods') || raw.includes('sony') || raw.includes('headset');
                const hasGaming = raw.includes('gaming') || raw.includes('game') || raw.includes('playstation') || raw.includes('ps5') || raw.includes('nintendo') || raw.includes('switch');
                const hasAccessories = raw.includes('logitech') || raw.includes('chuot') || raw.includes('mouse') || raw.includes('ban phim') || raw.includes('keyboard') || raw.includes('sac');

                if (hasGaming) {
                    candidates.push({
                        name: raw.includes('switch') ? 'Nintendo Switch OLED' : 'PlayStation 5 Slim',
                        category: 'Máy chơi game',
                        brand: raw.includes('switch') ? 'Nintendo' : 'Sony',
                        keywords: ['PlayStation 5', 'Nintendo Switch', 'máy chơi game']
                    });
                }
                if (hasPhone || hasApple) {
                    candidates.push({
                        name: raw.includes('samsung') ? 'Samsung Galaxy' : 'iPhone 17 Pro Max / iPhone 16',
                        category: 'Điện thoại',
                        brand: raw.includes('samsung') ? 'Samsung' : 'Apple',
                        keywords: raw.includes('samsung') ? ['Galaxy', 'Samsung'] : ['iPhone 17', 'iPhone 16']
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
                        name: raw.includes('macbook') ? 'MacBook Pro / Air M3' : 'Laptop',
                        category: 'Laptop',
                        brand: raw.includes('macbook') ? 'Apple' : '',
                        keywords: ['MacBook', 'laptop']
                    });
                }
                if (hasAudio) {
                    candidates.push({
                        name: raw.includes('airpods') ? 'Apple AirPods Pro 2' : 'Tai nghe chụp tai Sony / Marshall',
                        category: 'Tai nghe',
                        brand: raw.includes('airpods') ? 'Apple' : 'Sony',
                        keywords: ['AirPods', 'tai nghe', 'Sony WH']
                    });
                }
                if (hasAccessories) {
                    candidates.push({
                        name: raw.includes('logitech') ? 'Logitech MX Master' : 'Phụ kiện công nghệ',
                        category: 'Phụ kiện',
                        brand: raw.includes('logitech') ? 'Logitech' : '',
                        keywords: ['chuột', 'bàn phím', 'sạc']
                    });
                }

                if (candidates.length > 0) {
                    isTechDevice = true;
                    detectionStatus = 'matched';
                    detectedDevices = candidates;
                } else {
                    isTechDevice = true;
                    detectionStatus = 'matched';
                    detectedDevices = [
                        {
                            name: 'Điện thoại thông minh Smartphone',
                            category: 'Điện thoại',
                            brand: 'Apple',
                            keywords: ['iPhone 17', 'iPhone 16', 'Galaxy']
                        },
                        {
                            name: 'Laptop & Máy tính xách tay',
                            category: 'Laptop',
                            brand: 'Apple',
                            keywords: ['MacBook', 'Laptop']
                        },
                        {
                            name: 'Tai nghe & Âm thanh chất lượng cao',
                            category: 'Tai nghe',
                            brand: 'Sony',
                            keywords: ['AirPods', 'Sony WH']
                        }
                    ];
                }
            }
        }

        // Case: Non-tech or Unclear - politely notify and provide top popular products
        if (!isTechDevice) {
            const popularProducts = await Product.find({ active: { $ne: false } })
                .sort({ rating: -1, soldCount: -1 })
                .limit(4);

            return res.json({
                success: true,
                isTech: false,
                status: detectionStatus,
                detectedItem: null,
                detectedCategory: null,
                detectedBrand: null,
                description: detectionStatus === 'unclear'
                    ? 'Ảnh chụp chưa đủ rõ nét hoặc vật thể bị che khuất để nhận diện chính xác.'
                    : (classificationReason || 'Ảnh chưa cho thấy rõ thiết bị công nghệ trong hệ thống cửa hàng.'),
                reply: detectionStatus === 'unclear'
                    ? 'Ảnh chưa đủ rõ nét để nhận diện chính xác model. TechEcommerce gợi ý các sản phẩm công nghệ bán chạy hàng đầu dành cho bạn:'
                    : 'Ảnh này chưa cho thấy thiết bị công nghệ của TechEcommerce. Bạn có thể tham khảo các sản phẩm thịnh hành tại cửa hàng:',
                products: popularProducts,
                suggestions: ['Điện thoại', 'Laptop & MacBook', 'Tai nghe & Âm thanh', 'Phụ kiện máy tính']
            });
        }

        // Case: Tech device(s) detected -> Multi-pass search
        let allProducts = [];

        for (const device of detectedDevices) {
            const normCat = normalizeVisualCategory(device.category);
            const searchConditions = [];

            if (device.name) {
                const words = device.name.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'cho', 'voi', 'with', 'của'].includes(w.toLowerCase()));
                words.forEach(w => {
                    searchConditions.push({ name: new RegExp(escapeRegex(w), 'i') });
                    searchConditions.push({ tags: new RegExp(escapeRegex(w), 'i') });
                });
            }
            if (Array.isArray(device.keywords)) {
                device.keywords.forEach(kw => {
                    if (kw && kw.length > 2) {
                        searchConditions.push({ name: new RegExp(escapeRegex(kw), 'i') });
                        searchConditions.push({ tags: new RegExp(escapeRegex(kw), 'i') });
                    }
                });
            }
            if (device.brand) {
                searchConditions.push({ brand: new RegExp(escapeRegex(device.brand), 'i') });
            }

            let deviceProducts = [];

            // Pass 1: Match conditions AND normalized category
            if (searchConditions.length > 0 && normCat) {
                deviceProducts = await Product.find({
                    active: { $ne: false },
                    category: new RegExp(escapeRegex(normCat), 'i'),
                    $or: searchConditions
                }).sort({ rating: -1, soldCount: -1 }).limit(4);
            }

            // Pass 2: If no match in category, search across ALL categories
            if (!deviceProducts.length && searchConditions.length > 0) {
                deviceProducts = await Product.find({
                    active: { $ne: false },
                    $or: searchConditions
                }).sort({ rating: -1, soldCount: -1 }).limit(4);
            }

            // Pass 3: If still no match, fallback to top products in normalized category
            if (!deviceProducts.length && normCat) {
                deviceProducts = await Product.find({
                    category: new RegExp(escapeRegex(normCat), 'i'),
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

        // Pass 4: Global catalog fallback if all specific device searches yielded 0
        if (allProducts.length === 0) {
            allProducts = await Product.find({ active: { $ne: false } })
                .sort({ rating: -1, soldCount: -1 })
                .limit(6);
        }

        allProducts = allProducts.slice(0, 8);

        const primaryDevice = detectedDevices[0] || {};
        const isMultiDevice = detectedDevices.length > 1;

        const deviceListText = isMultiDevice
            ? `AI nhận diện **${detectedDevices.length} thiết bị** trong ảnh:\n${detectedDevices.map((d, i) => `  ${i + 1}. ${d.name}${d.brand ? ' (' + d.brand + ')' : ''}`).join('\n')}`
            : `AI nhận diện: **${primaryDevice.name}** (${primaryDevice.brand ? primaryDevice.brand + ' · ' : ''}${primaryDevice.category || 'Thiết bị công nghệ'})`;

        const replyMessage = `📷 **KẾT QUẢ TÌM KIẾM BẰNG HÌNH ẢNH (AI VISUAL SEARCH)**\n\n• ${deviceListText}\n• Đã tìm thấy **${allProducts.length} sản phẩm tương tự** tại cửa hàng:`;

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
            // Keep health-related details transient; do not persist them in
            // the durable conversation history.
            text: sanitizeStoredChatText(userMessage),
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

        session.intentSummary = sanitizeIntentSummary(extra.summary || '', extra.category, extra.budget);

        if (extra.category) {
            session.interestedCategory = extra.category;
        }

        if (extra.budget) {
            session.budgetRange = extra.budget;
        }

        session.updatedAt = new Date();
        if (!session.isMember) session.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await session.save();
    } catch (err) {
        console.warn('Could not record conversation to ChatSession:', err.message);
    }
}

const HEALTH_SENSITIVE_RE = /(nghe kem|kho nghe|nghenh ng[aã]ng|suy gi[aả]m th[iị]nh l[uự]c|điếc|diec|b[eệ]nh|ch[aẩ]n đo[aá]n|d[iị]u tr[iị]|thu[oố]c|b[aệ]nh l[yý])/i;
function sanitizeStoredChatText(value) {
    const text = String(value || '');
    return HEALTH_SENSITIVE_RE.test(text) ? '[Nội dung sức khỏe đã được ẩn để bảo vệ riêng tư]' : text.slice(0, 1000);
}
function sanitizeIntentSummary(summary, category, budget) {
    const categoryText = String(category || '').trim();
    const budgetText = String(budget || '').trim();
    if (HEALTH_SENSITIVE_RE.test(summary)) {
        return categoryText ? `Quan tâm ${categoryText}` : 'Quan tâm sản phẩm công nghệ';
    }
    const safe = String(summary || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160);
    if (safe) return safe;
    return [categoryText && `Quan tâm ${categoryText}`, budgetText && `ngân sách ${budgetText}`].filter(Boolean).join(', ') || 'Tư vấn sản phẩm công nghệ';
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
