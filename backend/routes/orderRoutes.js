const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Coupon = require('../models/Coupon');
const { protect, optionalAuth, admin } = require('../middleware/auth');
const {
    reserveStock,
    rollbackStock,
    restoreOrderStock,
    reReserveOrderStock,
    shouldRestore,
    shouldReserve
} = require('../utils/orderStock');
const {
    ensurePaymentConfigured,
    createVnpayPayment,
    createMomoPayment
} = require('../utils/payments');
const { validateCoupon, normalizeCouponCode } = require('../utils/coupons');
const { buildPaymentPresentation } = require('../utils/paymentPresentation');
const { notifyOrderCreated, notifyPaymentConfirmed } = require('../utils/email');
const { paymentExpiryDate, needsPaymentExpiry, expireOrderIfNeeded } = require('../utils/paymentExpiry');
const { quoteShipping } = require('../utils/shipping');
const { selectedInstallmentPlan, installmentPolicy } = require('../utils/installments');
const { createShipmentForOrder } = require('../utils/shippingProvider');

const PAYMENT_MAP = {
    ShipCOD: 'cod',
    'Thanh toán trước': 'bank_transfer',
    'Trả góp': 'installment',
    cod: 'cod',
    bank_transfer: 'bank_transfer',
    vnpay: 'vnpay',
    momo: 'momo',
    installment: 'installment'
};

const STATUS_HISTORY_CONTENT = {
    pending: {
        title: 'Đã tiếp nhận đơn hàng',
        description: 'Đơn hàng đã được ghi nhận và đang chờ cửa hàng xác nhận.'
    },
    processing: {
        title: 'Đang kiểm hàng và đóng gói',
        description: 'Sản phẩm đang được kiểm tra ngoại quan, phụ kiện và niêm phong trước khi giao.'
    },
    shipping: {
        title: 'Đã bàn giao đơn vị vận chuyển',
        description: 'Đơn hàng đang trên đường đến địa chỉ nhận hàng.'
    },
    completed: {
        title: 'Giao hàng thành công',
        description: 'Người nhận đã nhận hàng. Bạn có thể kiểm tra sản phẩm và gửi đánh giá.'
    },
    cancelled: {
        title: 'Đơn hàng đã hủy',
        description: 'Đơn hàng không tiếp tục được xử lý.'
    },
    returned: {
        title: 'Đang hoàn hoặc đổi trả',
        description: 'Yêu cầu hoàn hoặc đổi trả đang được cửa hàng tiếp nhận.'
    },
    boom: {
        title: 'Giao hàng không thành công',
        description: 'Đơn hàng không thể giao đến người nhận.'
    }
};

function statusHistoryEntry(status, description = '') {
    const content = STATUS_HISTORY_CONTENT[status] || { title: status, description: '' };
    return {
        status,
        title: content.title,
        description: String(description || content.description).trim(),
        occurredAt: new Date()
    };
}

function normalizePaymentMethod(value) {
    return PAYMENT_MAP[value] || 'cod';
}

function initialPaymentStatus(method) {
    if (method === 'cod') return 'unpaid';
    return 'pending';
}

function serializeOrderQuery(query) {
    return query
        .populate('customer')
        .populate('products.product');
}

function guestTokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function guestTokenMatches(req, order) {
    const supplied = String(req.get('x-guest-order-token') || '').trim();
    const expected = String(order.guestAccessTokenHash || '');
    if (!supplied || !expected) return false;
    const actual = guestTokenHash(supplied);
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function canAccessOrder(req, order) {
    if (req.user?.isAdmin) return true;
    if (req.user && order.customer && String(order.customer?._id || order.customer) === String(req.user._id)) return true;
    return guestTokenMatches(req, order);
}

async function buildOrderProducts(items) {
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error('Giỏ hàng trống!');
        error.statusCode = 400;
        throw error;
    }

    const merged = new Map();
    for (const item of items) {
        const productId = Number(item.product);
        const quantity = Number(item.quantity);
        if (!productId || !Number.isInteger(quantity) || quantity < 1) {
            const error = new Error('Dữ liệu sản phẩm không hợp lệ!');
            error.statusCode = 400;
            throw error;
        }
        merged.set(productId, (merged.get(productId) || 0) + quantity);
    }

    const productsWithNames = [];
    let subtotal = 0;

    for (const [productId, quantity] of merged.entries()) {
        const product = await Product.findById(productId);
        if (!product) {
            const error = new Error(`Không tìm thấy sản phẩm #${productId}!`);
            error.statusCode = 404;
            throw error;
        }

        productsWithNames.push({
            product: product._id,
            productName: product.name,
            quantity,
            price: product.price
        });
        subtotal += product.price * quantity;
    }

    return { productsWithNames, subtotal };
}

// GET my orders
router.get('/my', protect, async (req, res) => {
    try {
        const orders = await serializeOrderQuery(
            Order.find({ customer: req.user._id }).sort({ orderDate: -1, createdAt: -1 })
        );
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET safe payment instructions/QR for the owner or an admin
router.get('/:id/payment-presentation', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).select('+guestAccessTokenHash');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ message: 'Bạn không có quyền xem thanh toán của đơn hàng này!' });
        }
        if (order.paymentMethod === 'cod') {
            return res.status(400).json({ message: 'Đơn COD không cần mã QR thanh toán.' });
        }
        await expireOrderIfNeeded(order);
        return res.json(await buildPaymentPresentation(order));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// GET all orders (Admin only)
router.get('/', protect, admin, async (req, res) => {
    try {
        const orders = await serializeOrderQuery(Order.find().sort({ orderDate: -1, createdAt: -1 }));
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET order by ID (Owner or Admin)
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const order = await serializeOrderQuery(Order.findById(req.params.id).select('+guestAccessTokenHash'));
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này!' });
        }
        await expireOrderIfNeeded(order);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create order
router.post('/', optionalAuth, async (req, res) => {
    let newOrder;
    try {
        const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
        const isGuest = !req.user;
        if (isGuest && !['bank_transfer', 'vnpay', 'momo'].includes(paymentMethod)) {
            return res.status(403).json({ message: 'Khách chưa đăng nhập chỉ có thể thanh toán bằng chuyển khoản ngân hàng, VNPay hoặc MoMo.' });
        }
        if (paymentMethod !== 'cod') {
            ensurePaymentConfigured(paymentMethod);
        }
        const installmentTerm = Number(req.body.installmentTerm || installmentPolicy().terms[0]);

        const customerId = req.user
            ? ((req.user.isAdmin && req.body.customer) ? Number(req.body.customer) : req.user._id)
            : null;
        const customer = customerId ? await Customer.findById(customerId) : null;
        if (customerId && !customer) return res.status(404).json({ message: 'Customer not found' });
        const guestEmail = String(req.body.guestEmail || '').trim().toLowerCase();
        if (isGuest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
            return res.status(400).json({ message: 'Vui lòng nhập email hợp lệ để nhận xác nhận đơn hàng!' });
        }

        const { productsWithNames, subtotal } = await buildOrderProducts(req.body.products);
        const shippingQuote = quoteShipping({
            provinceCode: req.body.shippingProvinceCode,
            address: req.body.shippingAddress || customer?.address
        });
        const shippingFee = shippingQuote.fee;
        const couponCode = normalizeCouponCode(req.body.couponCode);
        const couponResult = couponCode
            ? await validateCoupon(couponCode, subtotal)
            : { coupon: null, discountAmount: 0 };
        const discountAmount = couponResult.discountAmount || 0;
        const totalAmount = Math.max(subtotal - discountAmount, 0) + shippingFee;
        const installmentPlan = paymentMethod === 'installment'
            ? selectedInstallmentPlan(totalAmount, installmentTerm)
            : null;
        const recipientName = String(req.body.recipientName || customer?.name || '').trim();
        const recipientPhone = String(req.body.recipientPhone || customer?.phone || '').trim();
        const shippingAddress = String(req.body.shippingAddress || customer?.address || '').trim();
        const checkoutOrigin = String(req.get('origin') || '').trim();
        const guestAccessToken = isGuest ? crypto.randomBytes(32).toString('hex') : '';

        if (!recipientName || !recipientPhone || !shippingAddress) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin nhận hàng!' });
        }

        await reserveStock(productsWithNames);

        try {
            newOrder = await new Order({
                customer: customerId,
                guestEmail,
                guestAccessTokenHash: guestAccessToken ? guestTokenHash(guestAccessToken) : '',
                customerName: customer?.name || recipientName,
                customerPhone: customer?.phone || recipientPhone,
                recipientName,
                recipientPhone,
                shippingAddress,
                shippingProvinceCode: shippingQuote.provinceCode,
                shippingProvince: shippingQuote.provinceName,
                shippingWardCode: String(req.body.shippingWardCode || ''),
                shippingWard: String(req.body.shippingWard || ''),
                products: productsWithNames,
                subtotal,
                discountAmount,
                couponCode: couponResult.coupon?.code || '',
                couponName: couponResult.coupon?.name || '',
                totalAmount,
                paymentMethod,
                paymentProvider: paymentMethod,
                paymentStatus: initialPaymentStatus(paymentMethod),
                paymentExpiresAt: needsPaymentExpiry(paymentMethod) ? paymentExpiryDate() : null,
                shippingFee,
                shippingQuoteSource: shippingQuote.source,
                shippingMetadata: {
                    quote: shippingQuote,
                    ghnDistrictId: Number(req.body.ghnDistrictId || 0) || null,
                    ghnWardCode: String(req.body.ghnWardCode || '').trim()
                },
                note: req.body.note || '',
                paymentMetadata: {
                    ...(checkoutOrigin ? { checkoutOrigin } : {}),
                    ...(paymentMethod === 'installment' ? {
                        installmentMode: String(process.env.INSTALLMENT_MODE || 'internal_review'),
                        installmentTerm,
                        installmentPlan
                    } : {})
                },
                status: 'pending',
                statusHistory: [statusHistoryEntry('pending')]
            }).save();
        } catch (saveError) {
            await rollbackStock(productsWithNames);
            throw saveError;
        }

        let paymentUrl = null;
        if (paymentMethod === 'vnpay') {
            const payment = createVnpayPayment(newOrder, req);
            newOrder.paymentRequestId = payment.txnRef;
            newOrder.paymentOrderId = payment.txnRef;
            newOrder.paymentMetadata = {
                ...(newOrder.paymentMetadata || {}),
                paymentUrl: payment.paymentUrl
            };
            await newOrder.save();
            paymentUrl = payment.paymentUrl;
        }

        if (paymentMethod === 'momo') {
            try {
                const payment = await createMomoPayment(newOrder);
                newOrder.paymentRequestId = payment.requestId;
                newOrder.paymentOrderId = payment.momoOrderId;
                newOrder.paymentMetadata = {
                    ...(newOrder.paymentMetadata || {}),
                    paymentUrl: payment.paymentUrl,
                    createResponse: payment.response
                };
                await newOrder.save();
                paymentUrl = payment.paymentUrl;
            } catch (paymentError) {
                await restoreOrderStock(newOrder);
                await newOrder.save();
                await Order.findByIdAndDelete(newOrder._id);
                throw paymentError;
            }
        }

        if (couponResult.coupon) {
            await Coupon.findByIdAndUpdate(couponResult.coupon._id, { $inc: { usedCount: 1 } });
        }

        await notifyOrderCreated(newOrder, customer || { name: recipientName, email: guestEmail, phone: recipientPhone });

        const needsPaymentPage = ['bank_transfer', 'vnpay', 'momo', 'installment'].includes(paymentMethod);

        res.status(201).json({
            order: newOrder,
            paymentUrl,
            checkoutUrl: needsPaymentPage
                ? `/pages/checkout/payment.html?orderId=${encodeURIComponent(newOrder._id)}`
                : null,
            paymentProvider: paymentMethod,
            guestAccessToken: guestAccessToken || undefined
        });
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({ message: error.message });
    }
});

// POST customer/admin cancel order
router.post('/:id/cancel', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).select('+guestAccessTokenHash');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ message: 'Bạn không có quyền hủy đơn hàng này!' });
        }
        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Chỉ có thể hủy đơn hàng đang chờ xử lý!' });
        }

        await restoreOrderStock(order);
        order.status = 'cancelled';
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push(statusHistoryEntry('cancelled'));
        if (order.paymentStatus === 'pending') order.paymentStatus = 'failed';
        await order.save();
        res.json(order);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// PUT update order fields/status (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (req.body.status && req.body.status !== order.status) {
            if (shouldRestore(req.body.status)) {
                await restoreOrderStock(order);
            } else if (shouldReserve(req.body.status)) {
                await reReserveOrderStock(order);
            }
            order.status = req.body.status;
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push(statusHistoryEntry(req.body.status, req.body.statusNote));
            if (req.body.status === 'completed') order.deliveredAt = new Date();
        }

        if (
            ['processing', 'shipping'].includes(req.body.status)
            && !order.trackingNumber
            && !req.body.trackingNumber
        ) {
            const shipment = await createShipmentForOrder(order);
            order.shippingMetadata = { ...(order.shippingMetadata || {}), shipment };
            if (shipment.created) {
                order.trackingNumber = shipment.trackingNumber;
                order.shippingUnit = shipment.providerLabel;
                if (shipment.expectedDeliveryTime) order.estimatedDeliveryAt = shipment.expectedDeliveryTime;
            }
        }

        ['trackingNumber', 'shippingUnit', 'note', 'inspectionNote', 'recipientName', 'recipientPhone', 'shippingAddress'].forEach(field => {
            if (req.body[field] !== undefined) order[field] = req.body[field];
        });
        if (req.body.estimatedDeliveryAt !== undefined) {
            order.estimatedDeliveryAt = req.body.estimatedDeliveryAt || null;
        }
        if (req.body.shippingFee !== undefined) {
            order.shippingFee = Math.max(Number(req.body.shippingFee) || 0, 0);
            order.totalAmount = Math.max(Number(order.subtotal || 0) - Number(order.discountAmount || 0), 0) + order.shippingFee;
        }

        await order.save();
        res.json(order);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// PUT update manual payment status (Admin only)
router.put('/:id/payment', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const allowed = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
        if (!allowed.includes(req.body.paymentStatus)) {
            return res.status(400).json({ message: 'Trạng thái thanh toán không hợp lệ!' });
        }

        order.paymentStatus = req.body.paymentStatus;
        order.paymentProvider = req.body.paymentProvider || order.paymentProvider || 'manual';
        order.paymentTransactionId = req.body.paymentTransactionId || order.paymentTransactionId;
        order.paidAt = req.body.paymentStatus === 'paid' ? (order.paidAt || new Date()) : null;
        if (req.body.paymentStatus === 'paid' && order.status === 'pending') {
            order.status = 'processing';
            const shipment = await createShipmentForOrder(order);
            order.shippingMetadata = { ...(order.shippingMetadata || {}), shipment };
            if (shipment.created) {
                order.trackingNumber = shipment.trackingNumber;
                order.shippingUnit = shipment.providerLabel;
                if (shipment.expectedDeliveryTime) order.estimatedDeliveryAt = shipment.expectedDeliveryTime;
            }
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push(statusHistoryEntry(
                'processing',
                'Thanh toán đã được quản trị viên xác nhận. Đơn hàng chuyển sang kiểm hàng và đóng gói.'
            ));
        }
        await order.save();
        if (req.body.paymentStatus === 'paid') await notifyPaymentConfirmed(order);

        res.json(order);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE order (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!order.stockRestored) await restoreOrderStock(order);
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: 'Order deleted successfully', deletedId: req.params.id });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
});

module.exports = router;
