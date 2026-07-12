const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Product = require('../models/Product');

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
        ['laptop', ['laptop', 'may tinh', 'hoc tap', 'van phong', 'gaming', 'do hoa', 'lap trinh']],
        ['điện thoại', ['dien thoai', 'smartphone', 'iphone', 'android', 'chup anh']],
        ['phụ kiện', ['phu kien', 'tai nghe', 'chuot', 'ban phim', 'sac', 'cap', 'op lung']],
        ['tablet', ['tablet', 'may tinh bang', 'ipad']],
        ['đồng hồ', ['dong ho', 'smartwatch']]
    ];

    const found = categories.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
    return found ? found[0] : '';
}

function buildProductFilter(text) {
    const filter = { active: { $ne: false } };
    const budget = extractBudget(text);
    const category = inferCategory(text);

    if (budget) filter.price = { $lte: budget };
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (text.includes('con hang') || text.includes('san co') || text.includes('mua duoc')) filter.stock = { $gt: 0 };

    const brands = ['apple', 'samsung', 'xiaomi', 'oppo', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'msi', 'sony', 'lg'];
    const brand = brands.find(item => text.includes(item));
    if (brand) filter.brand = { $regex: brand, $options: 'i' };

    return { filter, budget, category, brand };
}

async function currentUser(req) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) return null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return Customer.findById(decoded.id).select('-password');
    } catch (error) {
        return null;
    }
}

async function answerOrderQuestion(req, message) {
    const user = await currentUser(req);
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

async function answerProductQuestion(message) {
    const text = normalizeText(message);
    const { filter, budget, category, brand } = buildProductFilter(text);

    const products = await Product.find(filter)
        .sort({ stock: -1, rating: -1, soldCount: -1, price: 1 })
        .limit(5);

    if (!products.length) {
        return {
            reply: 'Mình chưa tìm thấy sản phẩm khớp hoàn toàn với nhu cầu đó. Bạn có thể nói rõ hơn về ngân sách, loại sản phẩm, thương hiệu hoặc nhu cầu như học tập, gaming, chụp ảnh, văn phòng.',
            suggestions: ['Laptop dưới 15 triệu', 'Điện thoại pin trâu', 'Phụ kiện còn hàng']
        };
    }

    const context = [
        budget ? `ngân sách khoảng ${money(budget)}` : '',
        category ? `nhóm ${category}` : '',
        brand ? `thương hiệu ${brand}` : ''
    ].filter(Boolean).join(', ');

    const intro = context
        ? `Theo nhu cầu ${context}, mình gợi ý các sản phẩm này:`
        : 'Mình gợi ý một số sản phẩm nổi bật trong cửa hàng:';

    return {
        reply: `${intro}\n${products.map(productLine).join('\n')}\nBạn có thể bấm vào sản phẩm trên trang để xem ảnh, cấu hình, đánh giá và thêm vào giỏ hàng.`,
        suggestions: ['So sánh sản phẩm', 'Tư vấn theo ngân sách khác', 'Chính sách bảo hành']
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

router.post('/', async (req, res) => {
    try {
        const message = String(req.body.message || '').trim();
        if (!message) return res.status(400).json({ message: 'Vui lòng nhập nội dung cần tư vấn.' });

        const text = normalizeText(message);
        const asksOrder = ['don hang', 'ma don', 'trang thai don', 'van don', 'giao toi dau'].some(keyword => text.includes(keyword));
        const policyAnswer = answerPolicyQuestion(message);

        if (asksOrder) return res.json(await answerOrderQuestion(req, message));
        if (policyAnswer) {
            return res.json({
                reply: policyAnswer,
                suggestions: ['Kiểm tra đơn hàng', 'Tư vấn sản phẩm', 'Sản phẩm còn hàng']
            });
        }

        return res.json(await answerProductQuestion(message));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Chatbot đang bận một chút. Bạn thử lại sau nhé.' });
    }
});

module.exports = router;
