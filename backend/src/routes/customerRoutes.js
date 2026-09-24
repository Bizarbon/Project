const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const bcrypt = require('bcryptjs');
const { protect, admin } = require('../middleware/auth');

function canAccessCustomer(req, id) {
    return req.user.isAdmin || String(req.user._id) === String(id);
}

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

async function assertUniqueCustomerFields(payload, excludeId) {
    const checks = [];
    if (payload.username) checks.push({ username: payload.username });
    if (payload.email) checks.push({ email: payload.email });
    if (payload.phone) checks.push({ phone: payload.phone });

    for (const filter of checks) {
        const existing = await Customer.findOne({ ...filter, _id: { $ne: excludeId } });
        if (existing) {
            const field = Object.keys(filter)[0];
            const labels = { username: 'Tên đăng nhập', email: 'Email', phone: 'Số điện thoại' };
            const error = new Error(`${labels[field]} đã tồn tại!`);
            error.statusCode = 400;
            throw error;
        }
    }
}

function pickCustomerPayload(body, isAdmin) {
    const allowed = isAdmin
        ? ['name', 'username', 'email', 'phone', 'address', 'avatar', 'password', 'isAdmin']
        : ['name', 'email', 'phone', 'address', 'avatar', 'password'];

    const payload = {};
    for (const field of allowed) {
        if (body[field] !== undefined) payload[field] = cleanString(body[field]);
    }

    if (payload.email === '') payload.email = undefined;
    if (payload.phone === '') payload.phone = undefined;
    if (payload.address === '') payload.address = '';
    if (payload.avatar === '') payload.avatar = '';
    if (payload.password === '') delete payload.password;
    if (!isAdmin) delete payload.isAdmin;
    delete payload._id;
    delete payload.__v;

    return payload;
}

// Wishlist for current user
router.get('/me/wishlist', protect, async (req, res) => {
    try {
        const customer = await Customer.findById(req.user._id).populate('wishlist');
        res.json(customer?.wishlist || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/me/wishlist', protect, async (req, res) => {
    try {
        const customer = await Customer.findById(req.user._id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        if (Array.isArray(req.body.wishlist)) {
            customer.wishlist = [...new Set(req.body.wishlist.map(Number).filter(Boolean))];
        } else {
            const productId = Number(req.body.productId);
            if (!productId) return res.status(400).json({ message: 'Thiếu mã sản phẩm!' });
            const product = await Product.findById(productId);
            if (!product) return res.status(404).json({ message: 'Product not found' });

            const current = new Set((customer.wishlist || []).map(Number));
            const action = req.body.action || 'toggle';
            if (action === 'remove' || (action === 'toggle' && current.has(productId))) current.delete(productId);
            else current.add(productId);
            customer.wishlist = [...current];
        }

        await customer.save();
        const populated = await Customer.findById(req.user._id).populate('wishlist');
        res.json(populated.wishlist || []);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// GET all customers (Admin only)
router.get('/', protect, admin, async (req, res) => {
    try {
        const customers = await Customer.find();
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET customer RFM segmentation analysis (Admin only)
router.get('/rfm-segmentation', protect, admin, async (req, res) => {
    try {
        const customers = await Customer.find().select('-password').lean();
        const orders = await Order.find().select('_id customer customerPhone customerName guestEmail totalAmount orderDate status createdAt').lean();

        const ordersByCustomer = new Map();
        const ordersByPhone = new Map();

        orders.forEach(o => {
            if (o.status === 'cancelled') return;
            if (o.customer) {
                const cid = String(o.customer);
                if (!ordersByCustomer.has(cid)) ordersByCustomer.set(cid, []);
                ordersByCustomer.get(cid).push(o);
            }
            const phone = String(o.customerPhone || '').trim();
            if (phone) {
                if (!ordersByPhone.has(phone)) ordersByPhone.set(phone, []);
                ordersByPhone.get(phone).push(o);
            }
        });

        const segmentedCustomers = customers.map(cust => {
            const custId = String(cust._id);
            const phone = String(cust.phone || '').trim();

            const matched = [];
            const seenOrderIds = new Set();

            const fromId = ordersByCustomer.get(custId) || [];
            fromId.forEach(o => {
                if (!seenOrderIds.has(String(o._id))) {
                    seenOrderIds.add(String(o._id));
                    matched.push(o);
                }
            });

            if (phone) {
                const fromPhone = ordersByPhone.get(phone) || [];
                fromPhone.forEach(o => {
                    if (!seenOrderIds.has(String(o._id))) {
                        seenOrderIds.add(String(o._id));
                        matched.push(o);
                    }
                });
            }

            const orderCount = matched.length;
            const totalSpent = matched.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const lastOrderTs = orderCount
                ? Math.max(...matched.map(o => new Date(o.orderDate || o.createdAt).getTime()))
                : null;
            const daysSinceLastOrder = lastOrderTs !== null
                ? Math.max(0, Math.round((Date.now() - lastOrderTs) / (1000 * 60 * 60 * 24)))
                : null;

            let segment = 'lead';
            let segmentLabel = 'Chưa phát sinh đơn';
            let rfmBadge = 'badge-lead';
            let suggestedAction = 'Tặng Voucher Chào mừng 50K';

            if (daysSinceLastOrder !== null) {
                if (totalSpent >= 15000000 || (orderCount >= 2 && daysSinceLastOrder <= 45)) {
                    segment = 'champion';
                    segmentLabel = '👑 VIP Champion';
                    rfmBadge = 'badge-vip';
                    suggestedAction = 'Tặng Voucher Tri ân VIP 10%';
                } else if (daysSinceLastOrder > 60) {
                    segment = 'at_risk';
                    segmentLabel = '⚠️ Nguy cơ rời bỏ';
                    rfmBadge = 'badge-at-risk';
                    suggestedAction = 'Tặng Voucher Giữ chân 15%';
                } else if (orderCount === 1 && daysSinceLastOrder <= 30) {
                    segment = 'new';
                    segmentLabel = '🆕 Khách hàng mới';
                    rfmBadge = 'badge-new';
                    suggestedAction = 'Tặng Voucher Mua lần 2 8%';
                } else {
                    segment = 'potential';
                    segmentLabel = '🌟 Tiềm năng';
                    rfmBadge = 'badge-potential';
                    suggestedAction = 'Tặng Voucher Upsell 50K';
                }
            }

            return {
                ...cust,
                orderCount,
                totalSpent,
                lastOrderDate: lastOrderTs ? new Date(lastOrderTs).toISOString() : null,
                daysSinceLastOrder,
                segment,
                segmentLabel,
                rfmBadge,
                suggestedAction
            };
        });

        // Summary counts
        const summary = {
            total: segmentedCustomers.length,
            champion: segmentedCustomers.filter(c => c.segment === 'champion').length,
            potential: segmentedCustomers.filter(c => c.segment === 'potential').length,
            at_risk: segmentedCustomers.filter(c => c.segment === 'at_risk').length,
            new: segmentedCustomers.filter(c => c.segment === 'new').length,
            lead: segmentedCustomers.filter(c => c.segment === 'lead').length
        };

        res.json({
            summary,
            customers: segmentedCustomers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST issue retargeting voucher for customer segment (Admin only)
router.post('/send-segment-voucher', protect, admin, async (req, res) => {
    try {
        const { segment, code, value = 10, type = 'percent', minOrderValue = 300000, maxDiscount = 200000, name } = req.body;
        if (!code) return res.status(400).json({ message: 'Thiếu mã voucher!' });

        const voucherCode = String(code).trim().toUpperCase();
        let coupon = await Coupon.findOne({ code: voucherCode });
        if (!coupon) {
            coupon = new Coupon({
                code: voucherCode,
                name: name || `Voucher kích cầu phân khúc ${segment || 'khách hàng'}`,
                type: type === 'fixed' ? 'fixed' : 'percent',
                value: Number(value) || 10,
                minOrderValue: Number(minOrderValue) || 0,
                maxDiscount: Number(maxDiscount) || 0,
                usageLimit: 500,
                active: true,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            await coupon.save();
        }

        res.json({
            success: true,
            message: `Đã phát hành và gửi mã ${voucherCode} thành công cho phân khúc khách hàng!`,
            coupon
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET customer by ID (Owner or Admin)
router.get('/:id', protect, async (req, res) => {
    try {
        if (!canAccessCustomer(req, req.params.id)) {
            return res.status(403).json({ message: 'Bạn không có quyền xem khách hàng này!' });
        }

        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create customer (Admin only)
router.post('/', protect, admin, async (req, res) => {
    try {
        const customerData = pickCustomerPayload(req.body, true);
        if (!customerData.name) return res.status(400).json({ message: 'Tên khách hàng là bắt buộc!' });
        if (!customerData.username) customerData.username = customerData.phone || `cust_${Date.now().toString().slice(-6)}`;
        if (!customerData.password) {
            return res.status(400).json({ message: 'Mật khẩu ban đầu là bắt buộc.' });
        }
        if (String(customerData.password).length < 8 || !/[a-z]/.test(customerData.password) || !/[A-Z]/.test(customerData.password) || !/\d/.test(customerData.password)) {
            return res.status(400).json({ message: 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.' });
        }

        await assertUniqueCustomerFields(customerData);
        const newCustomer = await new Customer(customerData).save();
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// PUT update customer (Owner or Admin)
router.put('/:id', protect, async (req, res) => {
    try {
        if (!canAccessCustomer(req, req.params.id)) {
            return res.status(403).json({ message: 'Bạn không có quyền cập nhật khách hàng này!' });
        }

        const customer = await Customer.findById(req.params.id).select('+password');
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const payload = pickCustomerPayload(req.body, req.user.isAdmin);
        const changesOwnPassword = Boolean(payload.password) && String(req.user._id) === String(customer._id);
        if (payload.password) {
            if (String(payload.password).length < 8 || !/[a-z]/.test(payload.password) || !/[A-Z]/.test(payload.password) || !/\d/.test(payload.password)) {
                return res.status(400).json({ message: 'Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.' });
            }
            if (changesOwnPassword) {
                const currentPassword = String(req.body.currentPassword || '');
                const passwordMatches = currentPassword && await bcrypt.compare(currentPassword, customer.password);
                if (!passwordMatches) return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
            }
        }
        await assertUniqueCustomerFields(payload, req.params.id);

        Object.keys(payload).forEach(key => {
            customer[key] = payload[key];
        });

        const updated = await customer.save();
        const safeCustomer = updated.toObject();
        delete safeCustomer.password;
        safeCustomer.sessionInvalidated = changesOwnPassword;
        res.json(safeCustomer);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// DELETE customer (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        await Customer.findByIdAndDelete(req.params.id);
        res.json({ message: 'Customer deleted successfully', deletedId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
