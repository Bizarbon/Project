const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Order = require('../models/Order');
const { optionalAuth } = require('../middleware/auth');
const { recommendProducts } = require('../utils/recommendations');

const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
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

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
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
    const patterns = [
        /(?:duoi|toi da|tam|khoang|ngan sach|budget)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m)/i,
        /(\d+(?:[.,]\d+)?)\s*(trieu|tr|m)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return Math.round(Number(match[1].replace(',', '.')) * 1000000);
    }

    const rawNumber = text.match(/(?:duoi|toi da|tam|khoang|ngan sach|budget)\s*(\d{7,})/i);
    if (rawNumber) return Number(rawNumber[1]);

    return null;
}

function inferCategory(text) {
    const categories = [
        ['Laptop', ['laptop', 'may tinh xach tay', 'macbook', 'notebook']],
        ['điện thoại', ['dien thoai', 'smartphone', 'iphone', 'android']],
        ['Tai nghe', ['tai nghe', 'airpods', 'headphone', 'earbuds']],
        ['Phụ kiện', ['phu kien', 'chuot', 'ban phim', 'sac', 'cap', 'op lung']],
        ['Tablet', ['tablet', 'may tinh bang', 'ipad']],
        ['Đồng hồ thông minh', ['dong ho thong minh', 'smartwatch', 'apple watch']]
    ];

    const found = categories.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
    return found ? found[0] : '';
}

function extractUseCase(text) {
    const cases = [
        ['lập trình', ['lap trinh', 'code', 'hoc it', 'cong nghe thong tin', 'developer']],
        ['học tập', ['hoc tap', 'di hoc', 'hoc sinh', 'sinh vien']],
        ['văn phòng', ['van phong', 'word', 'excel', 'hop online', 'lam viec']],
        ['chơi game', ['choi game', 'gaming', 'game nang', 'fps']],
        ['thiết kế và đồ họa', ['do hoa', 'thiet ke', 'photoshop', 'illustrator', '3d']],
        ['chụp ảnh và quay video', ['chup anh', 'quay video', 'camera', 'tiktok', 'vlog']],
        ['giải trí', ['xem phim', 'nghe nhac', 'giai tri', 'mang xa hoi']],
        ['thể thao và sức khỏe', ['the thao', 'suc khoe', 'chay bo', 'tap luyen']]
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
        ['độ bền và bảo hành', ['do ben', 'ben', 'lau dai', 'bao hanh', 'chong nuoc', 'chac chan']],
        ['pin lâu', ['pin trau', 'pin lau', 'dung lau', 'thoi luong pin']],
        ['hiệu năng', ['hieu nang', 'manh', 'toc do', 'muot', 'cau hinh']],
        ['camera', ['camera', 'chup anh', 'quay video']],
        ['nhẹ và dễ mang theo', ['mong nhe', 'nhe', 'de mang', 'di chuyen']],
        ['màn hình', ['man hinh', 'hien thi', 'mau sac', 'kich thuoc lon']],
        ['cân bằng', ['khong quan trong', 'can bang', 'deu duoc', 'tu van giup']]
    ];
    return priorities.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))?.[0] || '';
}

function safeConsultationContext(value) {
    const source = value && typeof value === 'object' ? value : {};
    const keep = key => String(source[key] || '').trim().slice(0, 100);
    return {
        intent: source.intent === 'product_consultation' ? source.intent : '',
        category: keep('category'),
        budget: Math.max(Number(source.budget) || 0, 0),
        budgetFlexible: Boolean(source.budgetFlexible),
        brand: keep('brand'),
        useCase: keep('useCase'),
        userProfile: keep('userProfile'),
        priority: keep('priority'),
        awaitingConfirmation: Boolean(source.awaitingConfirmation)
    };
}

function mergeConsultationNeeds(message, previousContext) {
    const text = normalizeText(message);
    const context = safeConsultationContext(previousContext);
    const filter = buildProductFilter(text);
    const flexibleBudget = ['khong gioi han', 'ngan sach linh hoat', 'gia nao cung duoc', 'chua co ngan sach'].some(item => text.includes(item));
    const reset = ['tu van lai', 'bat dau lai', 'xoa nhu cau', 'doi san pham khac'].some(item => text.includes(item));
    const merged = reset ? safeConsultationContext({}) : context;
    const result = {
        ...merged,
        intent: 'product_consultation',
        category: filter.category || merged.category,
        budget: filter.budget || (flexibleBudget ? 0 : merged.budget),
        budgetFlexible: flexibleBudget || (filter.budget ? false : merged.budgetFlexible),
        brand: filter.brand || merged.brand,
        useCase: extractUseCase(text) || merged.useCase,
        userProfile: extractUserProfile(text) || merged.userProfile,
        priority: extractPriority(text) || merged.priority
    };
    if (text.includes('doi ngan sach')) {
        result.budget = 0;
        result.budgetFlexible = false;
        result.awaitingConfirmation = false;
    }
    if (text.includes('doi nhu cau')) {
        result.useCase = '';
        result.userProfile = '';
        result.priority = '';
        result.awaitingConfirmation = false;
    }
    return result;
}

function consultationSummary(context) {
    return [
        `sản phẩm ${context.category}`,
        context.budget ? `ngân sách tối đa ${money(context.budget)}` : 'ngân sách linh hoạt',
        context.userProfile ? `người dùng: ${context.userProfile}` : '',
        context.useCase ? `mục đích: ${context.useCase}` : '',
        context.priority ? `ưu tiên: ${context.priority}` : '',
        context.brand ? `thương hiệu: ${context.brand}` : ''
    ].filter(Boolean).join(' · ');
}

function buildProductFilter(text) {
    const budget = extractBudget(text);
    const category = inferCategory(text);

    const brands = ['apple', 'samsung', 'xiaomi', 'oppo', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'msi', 'sony', 'lg'];
    const brand = brands.find(item => text.includes(item));

    return { budget, category, brand };
}

async function answerOrderQuestion(req, message) {
    const user = req.user;
    const orderId = (message.match(/#?\b(\d{1,8})\b/) || [])[1];

    if (!user) {
        return {
            reply: 'Để mình kiểm tra đơn hàng chính xác, bạn hãy đăng nhập tài khoản đã đặt hàng rồi hỏi lại theo mẫu: "Kiểm tra đơn #123". Nếu chưa đăng nhập, mình chỉ có thể hướng dẫn chung về trạng thái đơn.',
            suggestions: ['Đăng nhập để xem đơn hàng', 'Chính sách vận chuyển', 'Chính sách đổi trả']
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
        const payment = order.paymentStatus === 'paid' ? 'đã thanh toán' : 'chưa hoàn tất thanh toán';
        return `- Đơn #${order._id}: ${status}, ${payment}, tổng ${money(order.totalAmount)}${order.trackingNumber ? `, mã vận đơn ${order.trackingNumber}` : ''}.`;
    });

    return {
        reply: `Mình tìm thấy thông tin đơn hàng của bạn:\n${lines.join('\n')}\nBạn có thể vào mục Đơn hàng của tôi để xem chi tiết sản phẩm, địa chỉ giao và trạng thái thanh toán.`,
        suggestions: ['Xem đơn hàng của tôi', 'Chính sách vận chuyển', 'Tư vấn mua thêm phụ kiện']
    };
}

async function answerProductQuestion(message, user, previousContext) {
    const text = normalizeText(message);
    const consultation = mergeConsultationNeeds(message, previousContext);
    const confirms = ['dung', 'dung roi', 'xac nhan', 'ok', 'dong y', 'hay goi y', 'tu van di']
        .some(item => text === item || text.includes(item));

    if (!consultation.category) {
        return {
            reply: 'Bạn đang cần sản phẩm nào hoặc quan tâm nhóm nào của cửa hàng? Mình có thể tư vấn laptop, điện thoại, tablet, tai nghe, đồng hồ thông minh hoặc phụ kiện.',
            suggestions: ['Laptop', 'Điện thoại', 'Tablet', 'Tai nghe'],
            context: consultation
        };
    }
    if (!consultation.budget && !consultation.budgetFlexible) {
        return {
            reply: `Bạn dự kiến chi tối đa bao nhiêu cho ${consultation.category}? Bạn có thể nói “khoảng 15 triệu”, “10–20 triệu” hoặc “ngân sách linh hoạt”.`,
            suggestions: ['Khoảng 10 triệu', 'Khoảng 15 triệu', 'Khoảng 25 triệu', 'Ngân sách linh hoạt'],
            context: consultation
        };
    }
    if (!consultation.userProfile || !consultation.useCase) {
        return {
            reply: `Ai sẽ dùng ${consultation.category} này và công việc chính là gì? Ví dụ: sinh viên học IT, nhân viên văn phòng, người chơi game hoặc người làm thiết kế.`,
            suggestions: ['Sinh viên học IT', 'Nhân viên văn phòng', 'Chơi game', 'Thiết kế đồ họa'],
            context: consultation
        };
    }
    if (!consultation.priority) {
        return {
            reply: 'Bạn ưu tiên điều gì nhất: độ bền và bảo hành, pin lâu, hiệu năng, camera, màn hình hay thiết bị nhẹ dễ mang theo?',
            suggestions: ['Độ bền và bảo hành', 'Pin lâu', 'Hiệu năng', 'Cân bằng các yếu tố'],
            context: consultation
        };
    }
    if (!consultation.awaitingConfirmation || !confirms) {
        consultation.awaitingConfirmation = true;
        return {
            reply: `Mình xác nhận nhu cầu của bạn: ${consultationSummary(consultation)}. Thông tin này đã đúng chưa?`,
            suggestions: ['Đúng, hãy gợi ý', 'Đổi ngân sách', 'Đổi nhu cầu sử dụng', 'Tư vấn lại từ đầu'],
            context: consultation
        };
    }

    consultation.awaitingConfirmation = false;
    const { budget, category, brand } = consultation;
    const searchDescription = [message, consultation.useCase, consultation.userProfile, consultation.priority, brand]
        .filter(Boolean).join(' ');

    let products = await recommendProducts({
        user,
        limit: 5,
        category,
        maxPrice: budget,
        search: searchDescription,
        requirements: consultation
    });

    let relaxed = false;
    if (!products.length && budget) {
        products = await recommendProducts({ user, limit: 5, category, search: searchDescription, requirements: consultation });
        relaxed = products.length > 0;
    }
    if (!products.length && category) {
        products = await recommendProducts({ user, limit: 5, search: searchDescription, requirements: consultation });
        relaxed = products.length > 0;
    }

    if (!products.length) {
        return {
            reply: 'Kho hiện chưa có sản phẩm khớp đủ các điều kiện vừa xác nhận. Bạn có thể đổi ngân sách hoặc ưu tiên để mình tìm lại.',
            suggestions: ['Đổi ngân sách', 'Đổi loại sản phẩm', 'Tư vấn lại từ đầu'],
            context: consultation
        };
    }

    const context = [
        budget ? `ngân sách khoảng ${money(budget)}` : '',
        category ? `nhóm ${category}` : '',
        brand ? `thương hiệu ${brand}` : ''
    ].filter(Boolean).join(', ');

    const intro = relaxed
        ? `Hiện chưa có sản phẩm khớp hoàn toàn với ${context}. Đây là các lựa chọn gần nhất để bạn tham khảo:`
        : context
        ? `Theo nhu cầu ${context}, mình gợi ý các sản phẩm này:`
        : 'Mình gợi ý một số sản phẩm nổi bật trong cửa hàng:';

    return {
        reply: `${intro}\n${products.map(productLine).join('\n')}\nMình chỉ dùng giá, tồn kho và thông số đang có trong cửa hàng. Bạn muốn so sánh hai lựa chọn nào?`,
        suggestions: ['So sánh sản phẩm', 'Tư vấn theo ngân sách khác', 'Chính sách bảo hành'],
        products,
        context: consultation
    };
}

function answerPolicyQuestion(message) {
    const text = normalizeText(message);

    if (text.includes('bao hanh')) {
        return 'Sản phẩm công nghệ thường có thông tin bảo hành ngay trong chi tiết sản phẩm. Khi mua, bạn nên giữ hóa đơn/đơn hàng để được hỗ trợ bảo hành. Với lỗi kỹ thuật, cửa hàng sẽ hướng dẫn kiểm tra và tiếp nhận theo chính sách từng hãng.';
    }

    if (text.includes('van chuyen') || text.includes('giao hang') || text.includes('ship')) {
        return 'Đơn hàng sau khi xác nhận sẽ chuyển sang xử lý và giao hàng. Bạn có thể theo dõi trạng thái trong mục Đơn hàng của tôi. Nếu đơn có mã vận đơn, hệ thống sẽ hiển thị kèm trong chi tiết đơn.';
    }

    if (text.includes('doi tra') || text.includes('hoan tra') || text.includes('tra hang')) {
        return 'Đổi trả thường áp dụng khi sản phẩm lỗi, giao sai hoặc còn đủ điều kiện theo chính sách cửa hàng. Bạn nên giữ nguyên phụ kiện, hộp, hóa đơn và liên hệ sớm để được kiểm tra.';
    }

    if (text.includes('thanh toan') || text.includes('vnpay') || text.includes('momo') || text.includes('cod')) {
        return 'Website hỗ trợ COD, chuyển khoản, VNPay, MoMo và trả góp tùy cấu hình. Nếu thanh toán online chưa hoàn tất, bạn có thể kiểm tra lại ở trang kết quả thanh toán hoặc trong đơn hàng.';
    }

    return '';
}

router.post('/', chatLimiter, optionalAuth, async (req, res) => {
    try {
        const message = String(req.body.message || '').trim();
        if (!message) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần tư vấn.' });

        const text = normalizeText(message);
        const asksOrder = ['don hang', 'ma don', 'trang thai don', 'van don', 'giao toi dau'].some(keyword => text.includes(keyword));
        const policyAnswer = answerPolicyQuestion(message);
        const activeConsultation = req.body.context?.intent === 'product_consultation';
        const explicitlyAsksPolicy = ['chinh sach', 'quy dinh', 'dieu kien bao hanh', 'doi tra'].some(keyword => text.includes(keyword));

        if (asksOrder) return res.json(await answerOrderQuestion(req, message));
        if (policyAnswer && (!activeConsultation || explicitlyAsksPolicy)) {
            return res.json({
                reply: policyAnswer,
                suggestions: ['Kiểm tra đơn hàng', 'Tư vấn sản phẩm', 'Sản phẩm còn hàng']
            });
        }

        return res.json(await answerProductQuestion(message, req.user, req.body.context));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Chatbot đang bận một chút. Bạn thử lại sau nhé.' });
    }
});

module.exports = router;
