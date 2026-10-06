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
const { notifyOrderCreated, notifyPaymentConfirmed, notifyShipperAssigned } = require('../utils/email');
const { paymentExpiryDate, needsPaymentExpiry, expireOrderIfNeeded } = require('../utils/paymentExpiry');
const { quoteShipping } = require('../utils/shipping');
const { selectedInstallmentPlan, installmentPolicy } = require('../utils/installments');
const { createShipmentForOrder } = require('../utils/shippingProvider');
const {
    ORDER_ACTIONS,
    ORDER_STATUS_LABELS,
    SHIPPING_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
    CANCEL_REASONS,
    canTransitionOrderStatus,
    getStatusTitle,
    addOrderHistory
} = require('../utils/orderHistory');
const { ensureShippersSeeded } = require('../utils/seedShippers');

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

function normalizePaymentMethod(value) {
    return PAYMENT_MAP[value] || 'cod';
}

function initialPaymentStatus(method) {
    if (method === 'cod') return 'unpaid';
    return 'pending';
}

function serializeOrderQuery(query) {
    return query
        .populate('customer', '_id name phone email address avatar')
        .populate('shipper', '_id name phone email shipperStatus active')
        .populate('products.product', '_id name price images sku')
        .populate('adminNotes.createdBy', '_id name')
        .populate('history.changedBy', '_id name');
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

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount) || 0);
}

function normalizeLocation(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .toLowerCase();
}

function isHoChiMinhDelivery(order) {
    const provinceCode = String(order?.shippingProvinceCode || '').trim().toLowerCase();
    if (['79', 'hcm', 'hochiminh'].includes(provinceCode)) return true;

    const location = normalizeLocation([
        order?.shippingProvince,
        order?.shippingAddress
    ].filter(Boolean).join(' '));

    const hcmKeywords = [
        'ho chi minh', 'tp hcm', 'tphcm', 'sai gon', 'thu duc', 'go vap', 'binh thanh',
        'tan binh', 'tan phu', 'phu nhuan', 'binh tan', 'nha be', 'hoc mon', 'cu chi',
        'binh chanh', 'can gio', ...Array.from({ length: 12 }, (_, index) => `quan ${index + 1}`)
    ];
    return hcmKeywords.some(keyword => location.includes(keyword));
}

function canAccessOrder(req, order) {
    if (req.user?.isAdmin) return true;
    if (req.user?.role === 'shipper' && order.shipper && String(order.shipper?._id || order.shipper) === String(req.user._id)) return true;
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

function buildOrderFilter(query) {
    const filter = {};

    // Search query across ID, customer name, phone, email, products, tracking
    const search = String(query.search || '').trim();
    if (search) {
        const conditions = [];
        const isNumeric = /^\d+$/.test(search.replace(/^#/, ''));
        if (isNumeric) {
            conditions.push({ _id: Number(search.replace(/^#/, '')) });
        }

        const safeRegex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        conditions.push(
            { recipientName: safeRegex },
            { customerName: safeRegex },
            { recipientPhone: safeRegex },
            { customerPhone: safeRegex },
            { guestEmail: safeRegex },
            { trackingNumber: safeRegex },
            { 'products.productName': safeRegex }
        );

        filter.$or = conditions;
    }

    // Order status filter
    if (query.status && query.status !== 'all') {
        filter.status = query.status;
    }

    // Payment status filter
    if (query.paymentStatus && query.paymentStatus !== 'all') {
        filter.paymentStatus = query.paymentStatus;
    }

    // Payment method filter
    if (query.paymentMethod && query.paymentMethod !== 'all') {
        filter.paymentMethod = query.paymentMethod;
    }

    // Shipping status filter
    if (query.shippingStatus && query.shippingStatus !== 'all') {
        if (query.shippingStatus === 'unassigned') {
            filter.shippingStatus = { $in: ['unassigned', null, ''] };
        } else {
            filter.shippingStatus = query.shippingStatus;
        }
    }

    // Shipper filter
    if (query.shipper && query.shipper !== 'all') {
        if (query.shipper === 'unassigned') {
            filter.shipper = null;
        } else {
            const sId = Number(query.shipper);
            if (sId) filter.shipper = sId;
        }
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
        const dateFilter = {};
        if (query.dateFrom) {
            const from = new Date(query.dateFrom);
            if (!isNaN(from.getTime())) {
                from.setHours(0, 0, 0, 0);
                dateFilter.$gte = from;
            }
        }
        if (query.dateTo) {
            const to = new Date(query.dateTo);
            if (!isNaN(to.getTime())) {
                to.setHours(23, 59, 59, 999);
                dateFilter.$lte = to;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            filter.createdAt = dateFilter;
        }
    }

    return filter;
}

// ==========================================
// 1. GET ACTIVE SHIPPERS (Admin only)
// ==========================================
router.get('/shippers', protect, admin, async (req, res) => {
    try {
        await ensureShippersSeeded();

        const shippers = await Customer.find({
            role: 'shipper',
            active: true
        }).select('_id name phone email shipperStatus active createdAt');

        // Dynamically compute active delivering orders count for each shipper
        const shippersWithCount = await Promise.all(shippers.map(async s => {
            const activeOrdersCount = await Order.countDocuments({
                shipper: s._id,
                status: { $in: ['processing', 'ready_to_ship', 'shipping'] },
                shippingStatus: { $nin: ['delivered', 'returned'] }
            });
            return {
                _id: s._id,
                name: s.name,
                phone: s.phone || '',
                email: s.email || '',
                role: s.role,
                active: s.active,
                shipperStatus: s.shipperStatus || (activeOrdersCount > 0 ? 'delivering' : 'available'),
                activeOrdersCount
            };
        }));

        res.json({
            success: true,
            data: shippersWithCount
        });
    } catch (error) {
        console.error('Error fetching shippers:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách người giao hàng!' });
    }
});

// ==========================================
// 2. EXPORT ORDERS TO CSV (Admin only)
// ==========================================
router.get('/export', protect, admin, async (req, res) => {
    try {
        const filter = buildOrderFilter(req.query);
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const orders = await Order.find(filter)
            .sort({ [sortBy]: sortOrder })
            .limit(2000)
            .populate('customer', 'name phone email')
            .populate('shipper', 'name phone')
            .lean();

        // CSV Header with UTF-8 BOM so Excel opens with proper Vietnamese accents
        const headers = [
            'Mã đơn',
            'Ngày đặt',
            'Khách hàng',
            'Số điện thoại',
            'Email',
            'Địa chỉ giao hàng',
            'Sản phẩm',
            'Số lượng',
            'Tổng tiền (VNĐ)',
            'Phương thức TT',
            'Trạng thái TT',
            'Trạng thái đơn hàng',
            'Trạng thái vận chuyển',
            'Đơn vị vận chuyển',
            'Shipper phụ trách',
            'SĐT Shipper',
            'Mã vận đơn',
            'Ghi chú khách hàng'
        ];

        const escapeCsv = (val) => {
            const str = String(val ?? '').replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = orders.map(o => {
            const customerName = o.recipientName || o.customer?.name || o.customerName || 'N/A';
            const customerPhone = o.recipientPhone || o.customer?.phone || o.customerPhone || '';
            const customerEmail = o.guestEmail || o.customer?.email || '';
            const productsList = (o.products || []).map(p => `${p.productName || 'Sản phẩm'} (x${p.quantity})`).join('; ');
            const totalQty = (o.products || []).reduce((sum, p) => sum + (p.quantity || 1), 0);
            const shipperName = o.shipper?.name || o.shipperAssignedByName || (o.shipper ? `Shipper #${o.shipper}` : 'Chưa phân công');
            const shipperPhone = o.shipper?.phone || '';

            const dateStr = new Date(o.orderDate || o.createdAt).toLocaleString('vi-VN');

            return [
                escapeCsv(`#${String(o._id).padStart(4, '0')}`),
                escapeCsv(dateStr),
                escapeCsv(customerName),
                escapeCsv(customerPhone),
                escapeCsv(customerEmail),
                escapeCsv(o.shippingAddress || ''),
                escapeCsv(productsList),
                escapeCsv(totalQty),
                escapeCsv(o.totalAmount || 0),
                escapeCsv(o.paymentMethod || 'cod'),
                escapeCsv(PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus),
                escapeCsv(ORDER_STATUS_LABELS[o.status] || o.status),
                escapeCsv(SHIPPING_STATUS_LABELS[o.shippingStatus] || o.shippingStatus || 'Chưa phân công'),
                escapeCsv(o.shippingUnit || ''),
                escapeCsv(shipperName),
                escapeCsv(shipperPhone),
                escapeCsv(o.trackingNumber || ''),
                escapeCsv(o.note || '')
            ].join(',');
        });

        const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
        const filename = `TechEcommerce_Orders_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xuất danh sách đơn hàng!' });
    }
});

// ==========================================
// 3. GET ORDERS (Admin List with Search & Pagination)
// ==========================================
router.get('/', protect, admin, async (req, res) => {
    try {
        const filter = buildOrderFilter(req.query);

        // Sorting
        const allowedSort = ['orderDate', 'createdAt', 'totalAmount', '_id', 'status'];
        const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        // Query filtered data and global database statistics in parallel
        const [orders, totalFiltered, globalStats] = await Promise.all([
            serializeOrderQuery(
                Order.find(filter)
                    .sort({ [sortBy]: sortOrder })
                    .skip(skip)
                    .limit(limit)
            ),
            Order.countDocuments(filter),
            Promise.all([
                Order.countDocuments(),
                Order.countDocuments({ status: 'pending' }),
                Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'ready_to_ship'] } }),
                Order.countDocuments({ status: 'shipping' }),
                Order.countDocuments({ status: 'completed' }),
                Order.countDocuments({ status: 'cancelled' }),
                Order.countDocuments({ status: { $in: ['returned', 'return_requested'] } })
            ])
        ]);

        const [
            statTotal,
            statPending,
            statProcessing,
            statShipping,
            statCompleted,
            statCancelled,
            statReturned
        ] = globalStats;

        const totalPages = Math.ceil(totalFiltered / limit) || 1;

        res.json({
            success: true,
            data: orders,
            pagination: {
                page,
                limit,
                total: totalFiltered,
                totalPages
            },
            stats: {
                total: statTotal,
                pending: statPending,
                processing: statProcessing,
                shipping: statShipping,
                completed: statCompleted,
                cancelled: statCancelled,
                returned: statReturned
            }
        });
    } catch (error) {
        console.error('Error fetching admin orders:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 4. GET MY ORDERS (Customer)
// ==========================================
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

// ==========================================
// 5. GET PAYMENT PRESENTATION
// ==========================================
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

// ==========================================
// 6. GET ORDER BY ID (Admin or Owner)
// ==========================================
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const order = await serializeOrderQuery(Order.findById(req.params.id).select('+guestAccessTokenHash'));
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này!' });
        }
        await expireOrderIfNeeded(order);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==========================================
// 7. POST CREATE ORDER
// ==========================================
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
            newOrder = new Order({
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
                shippingStatus: 'unassigned',
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
                status: 'pending'
            });

            addOrderHistory(newOrder, {
                action: ORDER_ACTIONS.ORDER_CREATED,
                statusTo: 'pending',
                user: req.user,
                note: 'Đơn hàng được tạo thành công bởi khách hàng.'
            });

            await newOrder.save();
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

// ==========================================
// 8. PATCH ASSIGN SHIPPER (Admin only)
// ==========================================
router.patch('/:id/assign-shipper', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        if (['cancelled', 'completed', 'returned'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Không thể phân công shipper cho đơn hàng đã ${ORDER_STATUS_LABELS[order.status] || order.status}!`
            });
        }

        if (!isHoChiMinhDelivery(order)) {
            return res.status(400).json({
                success: false,
                message: 'Đơn liên tỉnh phải giao qua đối tác vận chuyển. Shipper nội bộ chỉ nhận đơn trong TP.HCM.'
            });
        }

        const shipperId = Number(req.body.shipperId);
        if (!shipperId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn người giao hàng hợp lệ!' });
        }

        const shipper = await Customer.findOne({ _id: shipperId, role: 'shipper', active: true });
        if (!shipper) {
            return res.status(404).json({ success: false, message: 'Người giao hàng không tồn tại hoặc tài khoản đang bị khóa!' });
        }

        const oldShipperId = order.shipper;
        let oldShipperName = order.shipperAssignedByName;

        if (oldShipperId && String(oldShipperId) === String(shipperId)) {
            return res.json({ success: true, message: 'Đơn hàng đã được phân công cho shipper này rồi.', data: order });
        }

        if (oldShipperId && !oldShipperName) {
            const oldS = await Customer.findById(oldShipperId);
            oldShipperName = oldS?.name || `Shipper #${oldShipperId}`;
        }

        // Apply shipper update
        const oldStatus = order.status;
        order.shipper = shipper._id;
        order.shipperAssignedAt = new Date();
        order.shipperAssignedBy = req.user._id;
        order.shipperAssignedByName = req.user.name || 'Admin';

        if (order.shippingStatus === 'unassigned' || !order.shippingStatus) {
            order.shippingStatus = 'assigned';
        }

        // Advance pending orders to processing when shipper is assigned
        if (order.status === 'pending') {
            order.status = 'processing';
        }

        // Record audit history
        const shipperDetailsStr = `"${shipper.name}"${shipper.phone ? ` (SĐT: ${shipper.phone})` : ''}`;
        if (oldShipperId) {
            addOrderHistory(order, {
                action: ORDER_ACTIONS.SHIPPER_REASSIGNED,
                statusFrom: oldStatus,
                statusTo: order.status,
                user: req.user,
                note: `Admin ${req.user.name} đã chuyển giao từ "${oldShipperName}" sang ${shipperDetailsStr}.`
            });
        } else {
            addOrderHistory(order, {
                action: ORDER_ACTIONS.SHIPPER_ASSIGNED,
                statusFrom: oldStatus,
                statusTo: order.status,
                user: req.user,
                note: `Admin ${req.user.name} đã phân công người giao hàng ${shipperDetailsStr}.`
            });
        }

        await order.save();

        // Notify customer via email
        notifyShipperAssigned(order, shipper).catch(err => {
            console.error('Error sending shipper assigned notification:', err.message);
        });

        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: `Đã phân công đơn hàng cho ${shipper.name}`,
            data: populated
        });
    } catch (error) {
        console.error('Error assigning shipper:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi phân công shipper!' });
    }
});

// ==========================================
// 8b. GET SHIPPER ASSIGNED ORDERS (Shipper or Admin)
// ==========================================
router.get('/shipper/my-orders', protect, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'shipper' && !req.user.isAdmin)) {
            return res.status(403).json({ success: false, message: 'Chức năng chỉ dành cho tài khoản người giao hàng (shipper)!' });
        }

        const filter = { shipper: req.user._id };
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        if (req.query.shippingStatus && req.query.shippingStatus !== 'all') {
            filter.shippingStatus = req.query.shippingStatus;
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            serializeOrderQuery(Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
            Order.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 8c. PATCH SHIPPER UPDATE DELIVERY STATUS (Assigned Shipper only)
// ==========================================
router.patch('/:id/shipper-delivery', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        // Quyền hạn: Chỉ shipper được phân công hoặc Admin mới có quyền thao tác
        if (!req.user.isAdmin && (req.user.role !== 'shipper' || String(order.shipper) !== String(req.user._id))) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật đơn hàng này!' });
        }

        const { action, note, reason } = req.body;
        const validActions = ['start_delivery', 'confirm_delivered', 'delivery_failed'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, message: 'Hành động của shipper không hợp lệ!' });
        }

        const oldStatus = order.status;

        if (action === 'start_delivery') {
            if (!['processing', 'ready_to_ship'].includes(order.status)) {
                return res.status(400).json({ success: false, message: `Không thể bắt đầu giao từ trạng thái "${ORDER_STATUS_LABELS[order.status] || order.status}"!` });
            }
            order.status = 'shipping';
            order.shippingStatus = 'delivering';
            addOrderHistory(order, {
                action: ORDER_ACTIONS.SHIPPING_STATUS_CHANGED,
                statusFrom: oldStatus,
                statusTo: 'shipping',
                user: req.user,
                note: note || `Shipper ${req.user.name} đã nhận kiện hàng và bắt đầu giao.`
            });
        } else if (action === 'confirm_delivered') {
            if (order.status !== 'shipping') {
                return res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận giao thành công khi đơn đang trong trạng thái Đang giao (shipping)!' });
            }
            order.status = 'completed';
            order.shippingStatus = 'delivered';
            order.deliveredAt = new Date();

            // Phân biệt rõ: Giao thành công vs Thu tiền mặt COD vs Đối soát
            if (order.paymentMethod === 'cod') {
                order.codCollected = true;
                order.codCollectedAt = new Date();
                order.codCollectedAmount = order.totalAmount;
                order.codReconciled = false; // Chờ kế toán/Admin đối soát
                addOrderHistory(order, {
                    action: ORDER_ACTIONS.COD_COLLECTED,
                    statusFrom: oldStatus,
                    statusTo: 'completed',
                    user: req.user,
                    note: `Shipper ${req.user.name} đã giao hàng thành công và thu ${formatMoney(order.totalAmount)} tiền mặt COD (chờ đối soát nộp quỹ).`
                });
            } else {
                addOrderHistory(order, {
                    action: ORDER_ACTIONS.ORDER_STATUS_CHANGED,
                    statusFrom: oldStatus,
                    statusTo: 'completed',
                    user: req.user,
                    note: note || `Shipper ${req.user.name} đã giao hàng thành công cho khách hàng.`
                });
            }
        } else if (action === 'delivery_failed') {
            if (order.status !== 'shipping') {
                return res.status(400).json({ success: false, message: 'Chỉ có thể báo giao thất bại cho đơn đang giao!' });
            }
            order.status = 'delivery_failed';
            order.shippingStatus = 'delivery_failed';
            addOrderHistory(order, {
                action: ORDER_ACTIONS.SHIPPING_STATUS_CHANGED,
                statusFrom: oldStatus,
                statusTo: 'delivery_failed',
                user: req.user,
                note: reason || note || `Shipper ${req.user.name} báo giao hàng không thành công (khách hẹn lại hoặc không liên lạc được).`
            });
        }

        await order.save();
        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: 'Đã cập nhật tiến độ giao hàng thành công!',
            data: populated
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 8d. PATCH ADMIN RECONCILE COD (Admin only)
// ==========================================
router.patch('/:id/reconcile-cod', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        if (order.paymentMethod !== 'cod') {
            return res.status(400).json({ success: false, message: 'Chỉ áp dụng đối soát COD cho đơn hàng thanh toán tiền mặt khi nhận hàng!' });
        }
        if (!order.codCollected) {
            return res.status(400).json({ success: false, message: 'Chưa thể đối soát vì shipper chưa xác nhận đã thu tiền COD!' });
        }
        if (order.codReconciled) {
            return res.json({ success: true, message: 'Đơn hàng này đã được đối soát nộp quỹ trước đó.', data: order });
        }

        order.codReconciled = true;
        order.codReconciledAt = new Date();
        order.codReconciledBy = req.user._id;
        order.codReconciledByName = req.user.name || 'Admin';
        order.paymentStatus = 'paid';
        order.paidAt = order.paidAt || new Date();

        addOrderHistory(order, {
            action: ORDER_ACTIONS.COD_RECONCILED,
            statusFrom: order.status,
            statusTo: order.status,
            user: req.user,
            note: req.body.note || `Admin ${req.user.name} đã hoàn tất đối soát tiền COD (${formatMoney(order.totalAmount)}) vào tài khoản công ty.`
        });

        await order.save();
        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: 'Đã hoàn tất đối soát tiền mặt COD thành công!',
            data: populated
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// ==========================================
// 9. PATCH / PUT UPDATE ORDER STATUS (Admin only)
// ==========================================
const handleStatusUpdate = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        const targetStatus = req.body.status;
        if (!targetStatus) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trạng thái cần cập nhật!' });
        }

        if (targetStatus === order.status) {
            return res.json({ success: true, message: 'Trạng thái không thay đổi.', data: order });
        }

        // State machine validation
        if (!canTransitionOrderStatus(order.status, targetStatus)) {
            const currentLabel = ORDER_STATUS_LABELS[order.status] || order.status;
            const targetLabel = ORDER_STATUS_LABELS[targetStatus] || targetStatus;
            return res.status(400).json({
                success: false,
                message: `Quy trình không hợp lệ: Không thể chuyển từ "${currentLabel}" sang "${targetLabel}"!`
            });
        }

        const oldStatus = order.status;

        // Stock management
        if (shouldRestore(targetStatus) && !order.stockRestored) {
            await restoreOrderStock(order);
        } else if (shouldReserve(targetStatus) && order.stockRestored) {
            await reReserveOrderStock(order);
        }

        order.status = targetStatus;

        // Synchronize shipping status & delivered timestamp
        if (targetStatus === 'shipping') {
            order.shippingStatus = 'delivering';
        } else if (targetStatus === 'completed') {
            order.shippingStatus = 'delivered';
            order.deliveredAt = new Date();
        } else if (targetStatus === 'delivery_failed' || targetStatus === 'boom') {
            order.shippingStatus = 'delivery_failed';
        } else if (targetStatus === 'returned') {
            order.shippingStatus = 'returned';
        }

        // Optional shipping metadata / tracking creation
        if (
            ['processing', 'shipping'].includes(targetStatus)
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

        if (req.body.trackingNumber !== undefined) order.trackingNumber = req.body.trackingNumber;
        if (req.body.shippingUnit !== undefined) order.shippingUnit = req.body.shippingUnit;
        if (req.body.shippingStatus !== undefined) order.shippingStatus = req.body.shippingStatus;

        // Record history
        addOrderHistory(order, {
            action: ORDER_ACTIONS.ORDER_STATUS_CHANGED,
            statusFrom: oldStatus,
            statusTo: targetStatus,
            user: req.user,
            note: req.body.note || req.body.statusNote || `Chuyển trạng thái sang ${ORDER_STATUS_LABELS[targetStatus] || targetStatus}`
        });

        await order.save();

        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: `Đã cập nhật trạng thái đơn hàng thành ${ORDER_STATUS_LABELS[targetStatus] || targetStatus}`,
            data: populated
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};

router.patch('/:id/status', protect, admin, handleStatusUpdate);
router.put('/:id', protect, admin, handleStatusUpdate);

// ==========================================
// 10. PATCH / PUT PAYMENT STATUS (Admin only)
// ==========================================
const handlePaymentUpdate = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        const allowed = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
        const paymentStatus = req.body.paymentStatus;
        if (!allowed.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Trạng thái thanh toán không hợp lệ!' });
        }

        const oldPaymentStatus = order.paymentStatus;
        order.paymentStatus = paymentStatus;
        order.paymentProvider = req.body.paymentProvider || order.paymentProvider || 'manual';
        order.paymentTransactionId = req.body.paymentTransactionId || order.paymentTransactionId || `TXN-${Date.now()}`;
        order.paidAt = paymentStatus === 'paid' ? (order.paidAt || new Date()) : null;

        // Auto transition from pending to processing if paid
        if (paymentStatus === 'paid' && order.status === 'pending') {
            order.status = 'processing';
            const shipment = await createShipmentForOrder(order);
            order.shippingMetadata = { ...(order.shippingMetadata || {}), shipment };
            if (shipment.created) {
                order.trackingNumber = shipment.trackingNumber;
                order.shippingUnit = shipment.providerLabel;
                if (shipment.expectedDeliveryTime) order.estimatedDeliveryAt = shipment.expectedDeliveryTime;
            }
        }

        // Record history
        addOrderHistory(order, {
            action: paymentStatus === 'paid' ? ORDER_ACTIONS.PAYMENT_CONFIRMED : ORDER_ACTIONS.PAYMENT_STATUS_CHANGED,
            statusFrom: oldPaymentStatus,
            statusTo: paymentStatus,
            user: req.user,
            note: req.body.note || `Admin ${req.user.name} xác nhận thanh toán (${PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}).`
        });

        await order.save();

        if (paymentStatus === 'paid') {
            await notifyPaymentConfirmed(order);
        }

        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái thanh toán thành công!',
            data: populated
        });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

router.patch('/:id/payment', protect, admin, handlePaymentUpdate);
router.put('/:id/payment', protect, admin, handlePaymentUpdate);

// ==========================================
// 11. POST CANCEL ORDER (Admin or Customer)
// ==========================================
router.post('/:id/cancel', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).select('+guestAccessTokenHash');
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });
        if (!canAccessOrder(req, order)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn hàng này!' });
        }

        if (['cancelled', 'completed', 'returned'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Đơn hàng đã ở trạng thái ${ORDER_STATUS_LABELS[order.status] || order.status}, không thể hủy!`
            });
        }

        // Regular customers can only cancel when pending
        if (!req.user?.isAdmin && order.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn hàng khi đang ở trạng thái Chờ xử lý!' });
        }

        await restoreOrderStock(order);

        const oldStatus = order.status;
        order.status = 'cancelled';
        order.shippingStatus = 'returned';

        const reasonKey = req.body.reason || 'customer_request';
        const customReason = req.body.customReason || req.body.note || '';
        order.cancelReason = customReason || CANCEL_REASONS[reasonKey] || reasonKey;
        order.cancelledAt = new Date();
        order.cancelledBy = req.user ? req.user._id : null;
        order.cancelledByName = req.user ? (req.user.name || req.user.username) : (order.recipientName || 'Khách hàng');

        if (order.paymentStatus === 'pending') {
            order.paymentStatus = 'failed';
        }

        addOrderHistory(order, {
            action: ORDER_ACTIONS.ORDER_CANCELLED,
            statusFrom: oldStatus,
            statusTo: 'cancelled',
            user: req.user,
            note: `Lý do hủy: ${order.cancelReason}`
        });

        await order.save();

        const populated = await serializeOrderQuery(Order.findById(order._id));
        res.json({
            success: true,
            message: 'Đơn hàng đã được hủy thành công!',
            data: populated
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
});

// ==========================================
// 12. POST ADD ADMIN INTERNAL NOTE (Admin only)
// ==========================================
router.post('/:id/notes', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        const content = String(req.body.content || '').trim();
        if (!content) {
            return res.status(400).json({ success: false, message: 'Nội dung ghi chú không được để trống!' });
        }

        if (!Array.isArray(order.adminNotes)) order.adminNotes = [];
        order.adminNotes.push({
            content,
            createdBy: req.user._id,
            createdByName: req.user.name || 'Admin',
            createdAt: new Date()
        });

        addOrderHistory(order, {
            action: ORDER_ACTIONS.ADMIN_NOTE_ADDED,
            user: req.user,
            note: `Thêm ghi chú: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`
        });

        await order.save();

        res.json({
            success: true,
            message: 'Đã thêm ghi chú nội bộ thành công!',
            data: order.adminNotes
        });
    } catch (error) {
        console.error('Error adding admin note:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 13. POST BULK OPERATIONS (Admin only)
// ==========================================
router.post('/bulk', protect, admin, async (req, res) => {
    try {
        const { action, orderIds, shipperId, status, note } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một đơn hàng!' });
        }

        let updated = 0;
        let failed = 0;
        const errors = [];

        if (action === 'assign_shipper') {
            const sId = Number(shipperId);
            if (!sId) return res.status(400).json({ success: false, message: 'Vui lòng chọn shipper!' });

            const shipper = await Customer.findOne({ _id: sId, role: 'shipper', active: true });
            if (!shipper) return res.status(404).json({ success: false, message: 'Shipper không hợp lệ!' });

            for (const id of orderIds) {
                try {
                    const order = await Order.findById(id);
                    if (!order) {
                        failed++;
                        errors.push({ orderId: id, message: 'Không tìm thấy đơn hàng' });
                        continue;
                    }
                    if (['cancelled', 'completed', 'returned'].includes(order.status)) {
                        failed++;
                        errors.push({ orderId: id, message: `Đơn đã ${ORDER_STATUS_LABELS[order.status] || order.status}` });
                        continue;
                    }

                    if (!isHoChiMinhDelivery(order)) {
                        failed++;
                        errors.push({ orderId: id, message: 'Đơn liên tỉnh phải giao qua đối tác vận chuyển' });
                        continue;
                    }

                    const oldShipperId = order.shipper;
                    order.shipper = shipper._id;
                    order.shipperAssignedAt = new Date();
                    order.shipperAssignedBy = req.user._id;
                    order.shipperAssignedByName = req.user.name;
                    if (order.shippingStatus === 'unassigned' || !order.shippingStatus) {
                        order.shippingStatus = 'assigned';
                    }

                    addOrderHistory(order, {
                        action: oldShipperId ? ORDER_ACTIONS.SHIPPER_REASSIGNED : ORDER_ACTIONS.SHIPPER_ASSIGNED,
                        user: req.user,
                        note: `Hành động hàng loạt: Phân công shipper "${shipper.name}".`
                    });

                    await order.save();
                    updated++;
                } catch (err) {
                    failed++;
                    errors.push({ orderId: id, message: err.message });
                }
            }
        } else if (action === 'update_status') {
            if (!status) return res.status(400).json({ success: false, message: 'Vui lòng chọn trạng thái mới!' });

            for (const id of orderIds) {
                try {
                    const order = await Order.findById(id);
                    if (!order) {
                        failed++;
                        errors.push({ orderId: id, message: 'Không tìm thấy đơn hàng' });
                        continue;
                    }
                    if (!canTransitionOrderStatus(order.status, status)) {
                        failed++;
                        errors.push({ orderId: id, message: `Không thể chuyển từ ${ORDER_STATUS_LABELS[order.status]} sang ${ORDER_STATUS_LABELS[status]}` });
                        continue;
                    }

                    const oldStatus = order.status;
                    if (shouldRestore(status) && !order.stockRestored) {
                        await restoreOrderStock(order);
                    } else if (shouldReserve(status) && order.stockRestored) {
                        await reReserveOrderStock(order);
                    }

                    order.status = status;
                    if (status === 'shipping') order.shippingStatus = 'delivering';
                    else if (status === 'completed') { order.shippingStatus = 'delivered'; order.deliveredAt = new Date(); }
                    else if (status === 'cancelled' || status === 'returned') order.shippingStatus = 'returned';

                    addOrderHistory(order, {
                        action: ORDER_ACTIONS.ORDER_STATUS_CHANGED,
                        statusFrom: oldStatus,
                        statusTo: status,
                        user: req.user,
                        note: note || `Hành động hàng loạt: Cập nhật sang ${ORDER_STATUS_LABELS[status] || status}`
                    });

                    await order.save();
                    updated++;
                } catch (err) {
                    failed++;
                    errors.push({ orderId: id, message: err.message });
                }
            }
        } else {
            return res.status(400).json({ success: false, message: 'Hành động hàng loạt không hợp lệ!' });
        }

        res.json({
            success: true,
            updated,
            failed,
            errors,
            message: `Xử lý thành công ${updated} đơn hàng.${failed > 0 ? ` Có ${failed} đơn thất bại.` : ''}`
        });
    } catch (error) {
        console.error('Error running bulk orders operation:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 14. DELETE ORDER (Admin only with safe guard)
// ==========================================
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

        // Safety rule: Only cancelled or test orders can be deleted
        if (order.status !== 'cancelled' && req.query.force !== 'true') {
            return res.status(400).json({
                success: false,
                message: 'Không được xóa trực tiếp đơn hàng đang hoạt động! Hãy hủy đơn hàng trước.'
            });
        }

        if (!order.stockRestored) await restoreOrderStock(order);
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Đã xóa dữ liệu đơn hàng thành công', deletedId: req.params.id });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
});

module.exports = router;
