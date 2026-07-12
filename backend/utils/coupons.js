const Coupon = require('../models/Coupon');

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

async function validateCoupon(code, subtotal) {
    const normalized = normalizeCouponCode(code);
    if (!normalized) return { coupon: null, discountAmount: 0 };

    const coupon = await Coupon.findOne({ code: normalized });
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
