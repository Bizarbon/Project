const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Coupon = require('../models/Coupon');
const { protect, admin } = require('../middleware/auth');
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

function canAccessOrder(req, order) {
    return req.user.isAdmin || String(order.customer?._id || order.customer) === String(req.user._id);
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
router.get('/:id', protect, async (req, res) => {
    try {
        const order = await serializeOrderQuery(Order.findById(req.params.id));
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này!' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create order
router.post('/', protect, async (req, res) => {
    let newOrder;
    try {
        const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
        if (paymentMethod === 'vnpay' || paymentMethod === 'momo') {
            ensurePaymentConfigured(paymentMethod);
        }

        const customerId = (req.user.isAdmin && req.body.customer) ? Number(req.body.customer) : req.user._id;
        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const { productsWithNames, subtotal } = await buildOrderProducts(req.body.products);
        const shippingFee = Math.max(Number(req.body.shippingFee) || 0, 0);
        const couponCode = normalizeCouponCode(req.body.couponCode);
        const couponResult = couponCode
            ? await validateCoupon(couponCode, subtotal)
            : { coupon: null, discountAmount: 0 };
        const discountAmount = couponResult.discountAmount || 0;
        const totalAmount = Math.max(subtotal - discountAmount, 0) + shippingFee;
        const recipientName = String(req.body.recipientName || customer.name || '').trim();
        const recipientPhone = String(req.body.recipientPhone || customer.phone || '').trim();
        const shippingAddress = String(req.body.shippingAddress || customer.address || '').trim();
        const checkoutOrigin = String(req.get('origin') || '').trim();

        if (!recipientName || !recipientPhone || !shippingAddress) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin nhận hàng!' });
        }

        await reserveStock(productsWithNames);

        try {
            newOrder = await new Order({
                customer: customerId,
                customerName: customer.name,
                customerPhone: customer.phone,
                recipientName,
                recipientPhone,
                shippingAddress,
                products: productsWithNames,
                subtotal,
                discountAmount,
                couponCode: couponResult.coupon?.code || '',
                couponName: couponResult.coupon?.name || '',
                totalAmount,
                paymentMethod,
                paymentProvider: paymentMethod,
                paymentStatus: initialPaymentStatus(paymentMethod),
                shippingFee,
                note: req.body.note || '',
                paymentMetadata: checkoutOrigin ? { checkoutOrigin } : {},
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

        res.status(201).json({
            order: newOrder,
            paymentUrl,
            paymentProvider: paymentMethod
        });
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({ message: error.message });
    }
});

// POST customer/admin cancel order
router.post('/:id/cancel', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
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

        ['trackingNumber', 'shippingUnit', 'note', 'inspectionNote', 'recipientName', 'recipientPhone', 'shippingAddress'].forEach(field => {
            if (req.body[field] !== undefined) order[field] = req.body[field];
        });
        if (req.body.estimatedDeliveryAt !== undefined) {
            order.estimatedDeliveryAt = req.body.estimatedDeliveryAt || null;
        }
        if (req.body.shippingFee !== undefined) order.shippingFee = Math.max(Number(req.body.shippingFee) || 0, 0);

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
        await order.save();

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
