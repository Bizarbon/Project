const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { optionalAuth } = require('../middleware/auth');
const { recommendProducts } = require('../utils/recommendations');

const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 60,
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

const KNOWN_UNSUPPORTED_ITEMS = [
    { keywords: ['may doc sach', 'kindle', 'kobo', 'boox', 'sach dien tu', 'doc sach'], name: 'máy đọc sách' },
    { keywords: ['tivi', 'ti vi', 'smart tv', 'television'], name: 'tivi / màn hình TV' },
    { keywords: ['tu lanh', 'refrigerator'], name: 'tủ lạnh' },
    { keywords: ['may giat', 'may say quan ao', 'may say'], name: 'máy giặt / máy sấy' },
    { keywords: ['dieu hoa', 'may lanh', 'may dieu hoa'], name: 'máy lạnh / máy điều hòa' },
    { keywords: ['may in', 'printer', 'muc in', 'may photo'], name: 'máy in / thiết bị in ấn' },
    { keywords: ['may chieu', 'projector'], name: 'máy chiếu' },
    { keywords: ['may scan', 'scanner'], name: 'máy scan' },
    { keywords: ['may loc khong khi', 'loc khong khi'], name: 'máy lọc không khí' },
    { keywords: ['may hut bui', 'robot hut bui'], name: 'máy hút bụi' },
    { keywords: ['noi chien', 'noi com', 'lo vi song', 'bep tu', 'bep hong ngoai', 'may xay'], name: 'thiết bị gia dụng nhà bếp' },
    { keywords: ['quat dien', 'quat khong canh', 'quat may', 'quat hoi nuoc'], name: 'quạt điện' },
    { keywords: ['ban gaming', 'ghe gaming', 'ghe cong thai hoc', 'ban nang ha'], name: 'bàn / ghế gaming' },
    { keywords: ['may anh canon', 'may anh sony', 'may anh nikon', 'may anh fujifilm', 'ong kinh', 'lens may anh', 'dslr', 'mirrorless'], name: 'máy ảnh chuyên nghiệp' },
    { keywords: ['flycam', 'drone'], name: 'flycam / drone' },
    { keywords: ['xe dien', 'xe dap', 'xe may'], name: 'xe / phương tiện di chuyển' },
    { keywords: ['quan ao', 'giay dep', 'quan jean', 'ao thun', 'dong ho co', 'vi da', 'tui xach'], name: 'thời trang / may mặc' },
    { keywords: ['bphone', 'vsmart', 'lumia', 'blackberry', 'htc'], name: 'dòng điện thoại này' },
    { keywords: ['iphone 4', 'iphone 5', 'iphone 6', 'iphone 7', 'iphone 8', 'iphone x', 'iphone xs', 'iphone xr', 'iphone 11', 'iphone 12', 'iphone 13'], name: 'dòng iPhone đời cũ này (cửa hàng hiện tập trung dòng iPhone 15 & 16 Series chính hãng)' }
];

function checkUnsupportedProduct(text) {
    const norm = normalizeText(text);
    for (const item of KNOWN_UNSUPPORTED_ITEMS) {
        if (item.keywords.some(k => hasWordOrPhrase(norm, k))) {
            return item.name;
        }
    }
    return null;
}

function buildOutOfCatalogResponse(productName) {
    const itemLabel = productName ? `sản phẩm **${productName}**` : 'sản phẩm này';
    return {
        reply: `Dạ hiện tại TechEcommerce **chưa kinh doanh ${itemLabel}** này ạ! 🙏\n\n` +
            `Cửa hàng chúng mình hiện chuyên phân phối chính hãng 100% các nhóm sản phẩm công nghệ hàng đầu:\n` +
            `• 📱 **Điện thoại:** iPhone 16 / 15 Series, Samsung Galaxy S24, Galaxy Z Fold/Flip, Xiaomi, OPPO...\n` +
            `• 💻 **Laptop:** MacBook Air / Pro M3, ASUS ROG Strix, Dell Inspiron, Lenovo IdeaPad, Acer Nitro...\n` +
            `• 📲 **Tablet:** iPad Pro M4, iPad Air M2, Samsung Galaxy Tab, Huawei MatePad...\n` +
            `• ⌚ **Đồng hồ thông minh:** Apple Watch Series, Samsung Galaxy Watch, Garmin GPS...\n` +
            `• 🎮 **Máy chơi game:** PlayStation 5 Slim, Nintendo Switch OLED, Steam Deck...\n` +
            `• 🎧 **Tai nghe & Phụ kiện:** AirPods Pro 2, củ sạc nhanh, pin dự phòng, chuột Logitech, cáp sạc...\n\n` +
            `👉 Bạn có muốn tham khảo dòng sản phẩm công nghệ nào ở trên không, mình sẽ tư vấn chi tiết thông số và giá ưu đãi tốt nhất cho bạn nhé! 😊`,
        products: [],
        suggestions: ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Xem iPad & Tablet', 'Đồng hồ thông minh', 'Săn mã giảm giá'],
        context: { stage: 'out_of_catalog', notFound: true },
        notFound: true
    };
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

    // Loại trừ đồng hồ cơ / đồng hồ treo tường / báo thức
    if (hasWordOrPhrase(norm, 'dong ho co') || hasWordOrPhrase(norm, 'dong ho treo tuong') || hasWordOrPhrase(norm, 'dong ho bao thuc')) {
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
            'laptop', 'may tinh xach tay', 'macbook', 'notebook', 'ultrabook',
            'vivobook', 'thinkpad', 'rog strix', 'acer nitro', 'katana', 'ideapad', 'inspiron'
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
            'phu kien', 'chuot may tinh', 'chuot khong day', 'chuot gaming', 'ban phim co', 'ban phim',
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
        ['pin lâu', ['pin trau', 'pin lau', 'dung lau', 'thoi luong pin', 'pin tren 7 ngay', 'pin tren 30 gio', 'pin 30h']],
        ['hiệu năng', ['hieu nang', 'manh', 'toc do', 'muot', 'cau hinh']],
        ['camera', ['camera', 'chup anh', 'quay video']],
        ['nhẹ và dễ mang theo', ['mong nhe', 'nhe', 'de mang', 'di chuyen']],
        ['màn hình', ['man hinh', 'hien thi', 'mau sac', 'kich thuoc lon', 'oled']],
        ['cân bằng', ['khong quan trong', 'can bang', 'deu duoc', 'tu van giup']]
    ];
    return priorities.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))?.[0] || '';
}

async function buildProductFilter(text) {
    const budget = extractBudget(text);
    let category = inferCategory(text);
    if (!category) {
        category = await detectCategoryFromDatabase(text);
    }

    const brands = ['apple', 'samsung', 'xiaomi', 'oppo', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'msi', 'sony', 'lg', 'garmin', 'nintendo', 'valve', 'huawei'];
    const brand = brands.find(item => text.includes(item));

    return { budget, category, brand };
}

/**
 * Tích hợp Google Gemini API nếu có cấu hình GEMINI_API_KEY
 */
async function askGeminiIfConfigured(systemPrompt, userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\nNgười dùng: "${userPrompt}"\nHãy trả lời bằng tiếng Việt thân thiện, súc tích, định dạng markdown rõ ràng:` }]
                }
            ],
            generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 600
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.warn('[Gemini API] Failed status:', res.status);
            return null;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
    } catch (err) {
        console.warn('[Gemini API] Request error:', err.message);
        return null;
    }
}

/**
 * Xử lý tra cứu mã giảm giá / Voucher
 */
async function answerVoucherQuestion() {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            active: { $ne: false },
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
        }).sort({ minOrderValue: 1 }).limit(4);

        if (!coupons.length) {
            return {
                reply: 'Hiện tại cửa hàng đang cập nhật các chương trình ưu đãi mới. Bạn hãy theo dõi thêm tại trang Khuyến mãi hoặc đăng ký nhận tin nhé!',
                suggestions: ['Tư vấn laptop giá tốt', 'Điện thoại giảm giá', 'Chính sách bảo hành']
            };
        }

        const list = coupons.map(c => {
            const val = c.type === 'percent' ? `${c.value}% (tối đa ${money(c.maxDiscount || 0)})` : money(c.value);
            const condition = c.minOrderValue > 0 ? ` cho đơn từ ${money(c.minOrderValue)}` : ' cho mọi đơn hàng';
            return `• **Mã ${c.code}**: Giảm ${val}${condition}.`;
        }).join('\n');

        return {
            reply: `🎁 **Danh sách mã giảm giá đang hoạt động:**\n\n${list}\n\n👉 Bạn chỉ cần copy mã trên và nhập vào ô "Mã giảm giá" tại bước giỏ hàng hoặc thanh toán để được trừ tiền ngay!`,
            suggestions: ['Tư vấn sản phẩm áp dụng', 'Xem giỏ hàng của tôi', 'Chính sách trả góp 0%'],
            vouchers: coupons.map(c => ({
                code: c.code,
                name: c.name,
                value: c.value,
                type: c.type,
                minOrderValue: c.minOrderValue
            }))
        };
    } catch (err) {
        console.error('Voucher query error:', err);
        return {
            reply: 'Đang có nhiều chương trình khuyến mãi và quà tặng khi thanh toán online hoặc mua trả góp 0%. Bạn đang quan tâm mua dòng máy nào để mình tư vấn ưu đãi cụ thể nhé?',
            suggestions: ['Tư vấn laptop', 'Tư vấn điện thoại', 'Xem chính sách trả góp']
        };
    }
}

/**
 * Xử lý so sánh 2 sản phẩm
 */
async function answerComparison(message) {
    const text = normalizeText(message);
    const cleanMsg = text.replace(/so sanh|so voi|khac nhau|nen mua|hay/g, ' ').trim();
    const parts = cleanMsg.split(/\s+(?:va|vs|hay|voi)\s+/i).filter(Boolean);

    let p1 = null;
    let p2 = null;

    if (parts.length >= 2) {
        const q1 = parts[0].trim();
        const q2 = parts[1].trim();
        p1 = await Product.findOne({ active: { $ne: false }, name: { $regex: escapeRegex(q1), $options: 'i' } });
        p2 = await Product.findOne({ active: { $ne: false }, name: { $regex: escapeRegex(q2), $options: 'i' } });
    }

    // Nếu không tách được 2 phần, tìm top 2 sản phẩm theo từ khóa
    if (!p1 || !p2) {
        const found = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } })
            .sort({ soldCount: -1, rating: -1 })
            .limit(2);
        if (found.length >= 2) {
            p1 = p1 || found[0];
            p2 = p2 || (found[1]._id !== p1._id ? found[1] : found[0]);
        }
    }

    if (!p1 || !p2 || String(p1._id) === String(p2._id)) {
        return {
            reply: 'Bạn muốn so sánh 2 sản phẩm cụ thể nào? Ví dụ: "So sánh MacBook Air và Asus Vivobook" hoặc "So sánh iPhone 15 và Galaxy S24" để mình lập bảng so sánh chi tiết cho bạn nhé.',
            suggestions: ['So sánh MacBook và Asus', 'So sánh iPhone và Samsung', 'Tư vấn laptop học tập']
        };
    }

    const reply = `⚖️ **So sánh nhanh giữa 2 sản phẩm:**\n\n` +
        `1. **${p1.name}** - **${money(p1.price)}** ${p1.stock > 0 ? `(Còn ${p1.stock} máy)` : '(Tạm hết)'}\n` +
        `2. **${p2.name}** - **${money(p2.price)}** ${p2.stock > 0 ? `(Còn ${p2.stock} máy)` : '(Tạm hết)'}\n\n` +
        `💡 **Khuyên dùng:** Nếu bạn ưu tiên mức giá ${p1.price < p2.price ? p1.name : p2.name} sẽ kinh tế hơn. Cả hai máy đều hỗ trợ trả góp 0% tại cửa hàng. Bạn có thể bấm nút "Thêm vào giỏ" bên dưới để đặt ngay!`;

    return {
        reply,
        products: [p1, p2],
        suggestions: [`Thêm ${p1.name.slice(0, 18)} vào giỏ`, `Thêm ${p2.name.slice(0, 18)} vào giỏ`, 'Tính trả góp 0%', 'Kiểm tra mã giảm giá']
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

    const reply = `💳 **Bảng dự tính trả góp 0% cho ${product.name}:**\n\n` +
        `• Giá sản phẩm: **${money(price)}**\n` +
        `• Trả trước (30%): **${money(downPayment)}**\n` +
        `• Số tiền còn lại: ${money(remaining)}\n\n` +
        `📅 **Lựa chọn kỳ hạn trả góp:**\n` +
        `• Kỳ hạn **6 tháng**: khoảng **${money(monthly6)}/tháng**\n` +
        `• Kỳ hạn **12 tháng**: khoảng **${money(monthly12)}/tháng**\n\n` +
        `✨ *Thủ tục đơn giản chỉ cần CCCD gắn chip (từ 18 tuổi trở lên) hoặc thẻ tín dụng. Bạn có thể thêm vào giỏ và chọn "Trả góp" khi thanh toán!*`;

    return {
        reply,
        products: [product],
        suggestions: ['Thêm sản phẩm này vào giỏ', 'Săn mã giảm giá', 'So sánh sản phẩm khác']
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
 * Thực hiện RAG: Truy vấn MongoDB và sinh câu trả lời tư vấn chuyên nghiệp kèm gợi ý cross-sell
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
    // 1. RAG Retrieval: Tìm sản phẩm chính phù hợp từ MongoDB
    let products = [];
    const searchKeywords = [category, brand, useCase, priority, profile].filter(Boolean).join(' ');

    if (category) {
        products = await recommendProducts({
            user,
            limit: 3,
            category,
            maxPrice: budget ? Math.round(budget * 1.25) : 0,
            search: searchKeywords,
            requirements: {
                category,
                budget,
                brand,
                useCase,
                priority,
                userProfile: profile
            }
        });
    }

    // Nếu bộ lọc nới lỏng cần bổ sung
    if (!products.length && category) {
        const query = { category, active: { $ne: false }, stock: { $gt: 0 } };
        if (budget) {
            // Lấy các sản phẩm có giá lân cận ngân sách (từ 65% đến 125% budget)
            query.price = { $gte: Math.round(budget * 0.65), $lte: Math.round(budget * 1.25) };
        }
        products = await Product.find(query).sort({ rating: -1, soldCount: -1 }).limit(3);
        if (!products.length) {
            products = await Product.find({ category, active: { $ne: false }, stock: { $gt: 0 } })
                .sort({ price: 1 }).limit(3);
        }
    }

    if (!products.length) {
        if (category) {
            return {
                reply: `Dạ hiện tại cửa hàng **chưa có sẵn mẫu sản phẩm phù hợp** với yêu cầu này trong danh mục **${category}** ạ! 🙏\n\nBạn có muốn tham khảo các mẫu ${category} khác đang có sẵn hoặc sản phẩm thuộc danh mục khác không ạ?`,
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
                reason: priority ? `${p.brand || 'Chính hãng'} · ${priority}` : `${p.brand || 'Chính hãng'} · Phù hợp ngân sách`
            };
        }
    });

    // 2. RAG Retrieval Phụ kiện bán kèm (Cross-sell / Up-sell tăng lợi nhuận theo sơ đồ tư duy)
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

    // 3. Chuẩn bị context để gọi Gemini (nếu có GEMINI_API_KEY)
    const catalogContext = products.map(p =>
        `- ${p.name} (ID: ${p._id}, Giá: ${money(p.price)}, Còn: ${p.stock}, Hãng: ${p.brand}, CPU: ${p.specs?.cpu || ''}, RAM: ${p.specs?.ram || ''}, Bộ nhớ: ${p.specs?.storage || ''}, Màn hình: ${p.specs?.screen || ''}, BH: ${p.warranty || 'Chính hãng 12-24T'})`
    ).join('\n');

    const systemPrompt = `Bạn là Trợ lý Tư vấn Mua sắm AI chuyên nghiệp của TechEcommerce.
Khách hàng cần tư vấn ${category} với ngân sách: ${budget ? money(budget) : 'linh hoạt'}, mục đích sử dụng: "${useCase}", ưu tiên: "${priority}".
Danh sách sản phẩm thực tế trong kho:
${catalogContext}

YÊU CẦU QUAN TRỌNG:
1. Trình bày thân thiện, ngắn gọn và súc tích.
2. CHỈ NÊU TÊN SẢN PHẨM VÀ GIÁ BÁN (kèm số lượng còn nếu có). TUYỆT ĐỐI KHÔNG đọc hay liệt kê thông số kỹ thuật (CPU, RAM, màn hình...) rườm rà dài dòng.
3. Hướng dẫn khách có thể bấm "+ Thêm giỏ" ngay trên thẻ sản phẩm hoặc hỏi về trả góp 0%.
4. Cuối câu, hỏi ngắn gọn khách có muốn xem thêm phụ kiện mua kèm (giảm 15%) không.`;

    const geminiReply = await askGeminiIfConfigured(systemPrompt, message || `Tư vấn ${category} ${budget ? money(budget) : ''} cho ${useCase}, ưu tiên ${priority}`);

    const newContext = {
        ...previousContext,
        stage: 'asking_accessory',
        category,
        budget,
        useCase,
        priority,
        lastProducts: products,
        crossSellProducts: accessories
    };

    if (geminiReply) {
        return {
            reply: geminiReply,
            products,
            suggestions: ['Có, xem phụ kiện kèm', 'Không, cảm ơn', 'Tính trả góp 0%', 'Kiểm tra mã giảm giá'],
            context: newContext
        };
    }

    // 4. Sinh lời tư vấn RAG thông minh (Bộ máy tri thức nội bộ)
    const demandDesc = [
        useCase ? `mục đích **${useCase}**` : '',
        priority ? `ưu tiên **${priority}**` : '',
        budget ? `ngân sách khoảng **${money(budget)}**` : ''
    ].filter(Boolean).join(', ');

    const intro = demandDesc
        ? `Dựa trên ${demandDesc}, mình gợi ý các lựa chọn phù hợp nhất cho bạn:`
        : `Dưới đây là các lựa chọn phù hợp nhất cho bạn:`;

    const productDetails = products.map((p, idx) => {
        return `${idx + 1}. **${p.name}** - **${money(p.price)}** ${p.stock > 0 ? `(Còn ${p.stock} máy)` : '(Tạm hết)'}`;
    }).join('\n');

    const policy = `✨ **Chính sách:** Hỗ trợ trả góp 0% lãi suất, 1 đổi 1 trong 30 ngày và giao hàng miễn phí toàn quốc.`;

    const crossSellPrompt = `🎁 Bạn có muốn xem thêm **phụ kiện mua kèm** (được giảm thêm 15%) không ạ?`;

    const reply = `${intro}\n\n${productDetails}\n\n${policy}\n\n${crossSellPrompt}`;

    return {
        reply,
        products,
        suggestions: ['Có, xem phụ kiện kèm', 'Không, cảm ơn', 'Tính trả góp 0%', 'Kiểm tra mã giảm giá'],
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
    const useCase = extractUseCase(text);
    const priority = extractPriority(text);
    const profile = extractUserProfile(text);

    // NGUYÊN TẮC TƯ VẤN SƠ ĐỒ TƯ DUY:
    // Khi khách hàng đưa ra nhu cầu chung chung (ví dụ "Tư vấn laptop 15 triệu", "tôi có khoảng 10 triệu Tôi muốn mua đồng hồ di động")
    // mà CHƯA nói rõ mục đích sử dụng và yếu tố ưu tiên:
    // AI KHÔNG NÊN lập tức đề xuất sản phẩm, mà cần tiếp tục hỏi về mục đích sử dụng!
    const isGeneralInquiry = category && (!useCase && !priority);

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
                ? `Chào bạn! Với mức ngân sách khoảng **${money(budget)}**, bạn đang quan tâm loại phụ kiện nào (như chuột, bàn phím, sạc nhanh, pin dự phòng hay hub chuyển đổi) ạ?`
                : `Chào bạn! Với danh mục Phụ kiện, bạn đang quan tâm loại sản phẩm nào (như chuột, bàn phím, sạc nhanh, pin dự phòng hay hub chuyển đổi) để mình tư vấn mẫu tốt nhất nhé?`;
            const suggestions = [
                'Chuột không dây & gaming',
                'Pin sạc dự phòng',
                'Củ cáp sạc nhanh',
                'Hub chuyển đổi Type-C'
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
        const isGeneralGreeting = [
            '', 'tu van', 'tu van giup', 'tu van mua hang', 'goi y san pham', 'san pham', 'cua hang', 'shop', 'mua hang',
            'chao', 'hello', 'hi', 'alo', 'co gi hot', 'co khuyen mai gi', 'muon mua do', 'tu van ho'
        ].includes(cleanQuery);

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

router.post('/', chatLimiter, optionalAuth, async (req, res) => {
    try {
        const message = String(req.body.message || '').trim();
        if (!message) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần tư vấn.' });

        const text = normalizeText(message);

        // 1. Ý định kiểm tra mã giảm giá / khuyến mãi
        const isVoucherQuery = ['voucher', 'ma giam gia', 'khuyen mai', 'uu dai', 'ma code', 'giam gia', 'sale', 'co khuyen mai gi'].some(k => text.includes(k));
        if (isVoucherQuery) {
            const voucherRes = await answerVoucherQuestion();
            return res.json(voucherRes);
        }

        // 2. Ý định so sánh sản phẩm
        const isComparison = ['so sanh', 'so voi', 'khac nhau gi', 'hay nen mua'].some(k => text.includes(k));
        if (isComparison) {
            const compRes = await answerComparison(message);
            return res.json(compRes);
        }

        // 3. Ý định tính trả góp
        const isInstallment = ['tra gop', 'gop 0%', 'lai suat', 'moi thang bao nhieu', 'thu tuc tra gop'].some(k => text.includes(k));
        if (isInstallment) {
            const installRes = await answerInstallmentQuestion(message, req.body.context?.lastProducts);
            return res.json(installRes);
        }

        // 4. Ý định tra cứu đơn hàng
        const asksOrder = ['don hang', 'ma don', 'trang thai don', 'van don', 'giao toi dau', 'don cua toi'].some(k => text.includes(k));
        if (asksOrder) {
            return res.json(await answerOrderQuestion(req, message));
        }

        // 5. Ý định hỏi chính sách (bảo hành, đổi trả, ship...)
        const policyAnswer = answerPolicyQuestion(message);
        if (policyAnswer) {
            return res.json({
                reply: policyAnswer,
                suggestions: ['Kiểm tra đơn hàng', 'Tư vấn sản phẩm', 'Mã giảm giá hôm nay']
            });
        }

        // 6. Tư vấn sản phẩm (Gemini RAG + Intelligent Fallback)
        return res.json(await answerProductQuestion(message, req.user, req.body.context));
    } catch (error) {
        console.error('Chatbot route error:', error);
        return res.status(500).json({ message: 'Chatbot đang bận một chút. Bạn thử lại sau nhé.' });
    }
});

module.exports = router;
