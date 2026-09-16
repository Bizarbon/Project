const { restoreOrderStock } = require('./orderStock');
const Order = require('../models/Order');

const EXPIRING_METHODS = new Set(['vnpay', 'momo']);

function paymentExpiryDate(from = new Date()) {
    const minutes = Math.min(Math.max(Number(process.env.PAYMENT_QR_EXPIRES_MINUTES) || 15, 5), 60);
    return new Date(new Date(from).getTime() + minutes * 60 * 1000);
}

function needsPaymentExpiry(method) {
    return EXPIRING_METHODS.has(String(method || ''));
}

async function expireOrderIfNeeded(order) {
    if (!order || order.paymentStatus !== 'pending' || !order.paymentExpiresAt) return false;
    if (new Date(order.paymentExpiresAt).getTime() > Date.now()) return false;

    await restoreOrderStock(order);
    order.paymentStatus = 'failed';
    order.status = 'cancelled';
    order.paymentMetadata = {
        ...(order.paymentMetadata || {}),
        expiredAt: new Date().toISOString(),
        expirationReason: 'payment_timeout'
    };
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
        status: 'cancelled',
        title: 'Đơn hàng đã hủy',
        description: 'Mã thanh toán đã hết hạn 15 phút và đơn hàng chưa được thanh toán.',
        occurredAt: new Date()
    });
    await order.save();
    return true;
}

async function expireOverduePayments(limit = 100) {
    const orders = await Order.find({
        paymentStatus: 'pending',
        paymentExpiresAt: { $ne: null, $lte: new Date() }
    }).limit(limit);
    let expired = 0;
    for (const order of orders) {
        if (await expireOrderIfNeeded(order)) expired += 1;
    }
    return expired;
}

module.exports = { paymentExpiryDate, needsPaymentExpiry, expireOrderIfNeeded, expireOverduePayments };
