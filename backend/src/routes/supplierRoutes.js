const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { protect, admin, requirePermission } = require('../middleware/auth');

router.use(protect);
router.use(admin);

function pickSupplierPayload(body = {}) {
    const allowed = ['name', 'phone', 'email', 'address', 'deliveryTime', 'returnPolicy', 'notes', 'active'];
    const out = {};
    for (const key of allowed) {
        if (body[key] === undefined) continue;
        if (key === 'active') out.active = Boolean(body.active);
        else out[key] = typeof body[key] === 'string' ? body[key].trim() : String(body[key] ?? '').trim();
    }
    return out;
}

router.get('/', requirePermission('suppliers', 'view'), async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ createdAt: -1 });
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', requirePermission('suppliers', 'view'), async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', requirePermission('suppliers', 'create'), async (req, res) => {
    try {
        const payload = pickSupplierPayload(req.body);
        if (!payload.name) return res.status(400).json({ message: 'Tên nhà cung cấp là bắt buộc!' });
        const existing = await Supplier.findOne({ name: payload.name });
        if (existing) return res.status(400).json({ message: 'Đã có nhà cung cấp này!' });

        const newSupplier = await new Supplier({
            ...payload,
            active: payload.active !== undefined ? payload.active : true
        }).save();

        res.status(201).json(newSupplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', requirePermission('suppliers', 'edit'), async (req, res) => {
    try {
        const payload = pickSupplierPayload(req.body);
        if (payload.name) {
            const existing = await Supplier.findOne({ name: payload.name, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ message: 'Đã có nhà cung cấp này!' });
        }
        const updated = await Supplier.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'Supplier not found' });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', requirePermission('suppliers', 'delete'), async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        await Supplier.findByIdAndDelete(req.params.id);
        res.json({ message: 'Supplier deleted successfully', deletedId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
