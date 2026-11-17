const Coupon = require('../models/Coupon');

const DEFAULT_PROMO_COUPONS = [
    {
        code: 'TECH10',
        name: 'Giảm 10% cho đơn công nghệ',
        type: 'percent',
        value: 10,
        minOrderValue: 5000000,
        maxDiscount: 1500000,
        active: true
    },
    {
        code: 'FREESHIP',
        name: 'Hỗ trợ phí vận chuyển',
        type: 'fixed',
        value: 30000,
        minOrderValue: 1000000,
        maxDiscount: 30000,
        active: true
    },
    {
        code: 'LAPTOP500',
        name: 'Giảm 500K cho laptop',
        type: 'fixed',
        value: 500000,
        minOrderValue: 20000000,
        maxDiscount: 0,
        active: true
    },
    {
        code: 'TECHVIP',
        name: 'Voucher Trợ Giá Độc Quyền AI',
        type: 'fixed',
        value: 200000,
        minOrderValue: 3000000,
        maxDiscount: 200000,
        active: true
    },
    {
        code: 'DEALHOT500',
        name: 'Voucher Trợ Giá Flagship 500K',
        type: 'fixed',
        value: 500000,
        minOrderValue: 20000000,
        maxDiscount: 500000,
        active: true
    },
    {
        code: 'GIUGIA200',
        name: 'Mã Giữ Giá 24H Exit-Intent',
        type: 'fixed',
        value: 200000,
        minOrderValue: 2000000,
        maxDiscount: 200000,
        active: true
    },
    {
        code: 'TECHWELCOME',
        name: 'Voucher Chào Mừng Thành Viên',
        type: 'fixed',
        value: 100000,
        minOrderValue: 500000,
        maxDiscount: 100000,
        active: true
    }
];

const DEFAULT_PROMO_COUPON_MAP = Object.fromEntries(
    DEFAULT_PROMO_COUPONS.map((item) => [item.code, item])
);

function normalizeCouponCode(code) {
    return String(code || '').trim().toUpperCase();
}

function calculateDiscount(coupon, subtotal) {
    if (!coupon) return 0;
    const amount = Number(subtotal) || 0;
    let discount = coupon.type === 'fixed'
        ? Number(coupon.value) || 0
        : Math.round(amount * (Number(coupon.value) || 0) / 100);

    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    return Math.max(0, Math.min(discount, amount));
}

async function ensureDefaultCoupon(normalizedCode) {
    const preset = DEFAULT_PROMO_COUPON_MAP[normalizedCode];
    if (!preset) return null;
    try {
        return await new Coupon(preset).save();
    } catch (error) {
        if (error && error.code === 11000) {
            return Coupon.findOne({ code: normalizedCode });
        }
        throw error;
    }
}

async function validateCoupon(code, subtotal) {
    const normalized = normalizeCouponCode(code);
    if (!normalized) return { coupon: null, discountAmount: 0 };

    let coupon = await Coupon.findOne({ code: normalized });
    if (!coupon && DEFAULT_PROMO_COUPON_MAP[normalized]) {
        coupon = await ensureDefaultCoupon(normalized);
    }
    if (!coupon || !coupon.active) {
        const error = new Error('Mã giảm giá không tồn tại hoặc đã tắt!');
        error.statusCode = 400;
        throw error;
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
        const error = new Error('Mã giảm giá chưa đến thời gian sử dụng!');
        error.statusCode = 400;
        throw error;
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
        const error = new Error('Mã giảm giá đã hết hạn!');
        error.statusCode = 400;
        throw error;
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        const error = new Error('Mã giảm giá đã hết lượt sử dụng!');
        error.statusCode = 400;
        throw error;
    }
    if ((Number(subtotal) || 0) < coupon.minOrderValue) {
        const error = new Error(`Đơn hàng cần tối thiểu ${coupon.minOrderValue.toLocaleString('vi-VN')} đ để dùng mã này!`);
        error.statusCode = 400;
        throw error;
    }

    return {
        coupon,
        discountAmount: calculateDiscount(coupon, subtotal)
    };
}

module.exports = {
    normalizeCouponCode,
    calculateDiscount,
    validateCoupon
};
