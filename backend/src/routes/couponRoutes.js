const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { protect, admin } = require('../middleware/auth');
const { validateCoupon } = require('../utils/coupons');

function couponPayload(body) {
    const payload = {
        code: String(body.code || '').trim().toUpperCase(),
        name: String(body.name || '').trim(),
        type: ['percent', 'fixed'].includes(body.type) ? body.type : 'percent',
        value: Number(body.value),
        minOrderValue: Math.max(Number(body.minOrderValue) || 0, 0),
        maxDiscount: Math.max(Number(body.maxDiscount) || 0, 0),
        usageLimit: Math.max(Number(body.usageLimit) || 0, 0),
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        active: body.active === undefined ? true : Boolean(body.active)
    };

    if (!payload.code) {
        const error = new Error('Mã giảm giá là bắt buộc!');
        error.statusCode = 400;
        throw error;
    }
    if (!payload.name) {
        const error = new Error('Tên chương trình là bắt buộc!');
        error.statusCode = 400;
        throw error;
    }
    if (!Number.isFinite(payload.value) || payload.value <= 0) {
        const error = new Error('Giá trị giảm giá không hợp lệ!');
        error.statusCode = 400;
        throw error;
    }
    if (payload.type === 'percent' && payload.value > 100) {
        const error = new Error('Mã phần trăm không được vượt quá 100%!');
        error.statusCode = 400;
        throw error;
    }

    return payload;
}

router.post('/validate', async (req, res) => {
    try {
        const subtotal = Math.max(Number(req.body.subtotal) || 0, 0);
        const { coupon, discountAmount } = await validateCoupon(req.body.code, subtotal);
        res.json({
            code: coupon.code,
            name: coupon.name,
            type: coupon.type,
            value: coupon.value,
            discountAmount,
            finalSubtotal: Math.max(subtotal - discountAmount, 0)
        });
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.get('/', protect, admin, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', protect, admin, async (req, res) => {
    try {
        const payload = couponPayload(req.body);
        if (await Coupon.findOne({ code: payload.code })) {
            return res.status(400).json({ message: 'Mã giảm giá đã tồn tại!' });
        }
        const coupon = await new Coupon(payload).save();
        res.status(201).json(coupon);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.put('/:id', protect, admin, async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        const payload = couponPayload(req.body);
        const duplicate = await Coupon.findOne({ code: payload.code, _id: { $ne: Number(req.params.id) } });
        if (duplicate) return res.status(400).json({ message: 'Mã giảm giá đã tồn tại!' });
        Object.assign(coupon, payload);
        await coupon.save();
        res.json(coupon);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        res.json({ message: 'Coupon deleted successfully', deletedId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
