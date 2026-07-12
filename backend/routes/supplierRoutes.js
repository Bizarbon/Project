const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { protect, admin } = require('../middleware/auth');

router.use(protect);
router.use(admin);

router.get('/', async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ createdAt: -1 });
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const existing = await Supplier.findOne({ name: req.body.name });
        if (existing) return res.status(400).json({ message: 'Đã có nhà cung cấp này!' });

        const newSupplier = await new Supplier({
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            address: req.body.address,
            deliveryTime: req.body.deliveryTime,
            returnPolicy: req.body.returnPolicy,
            notes: req.body.notes,
            active: req.body.active !== undefined ? req.body.active : true
        }).save();

        res.status(201).json(newSupplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (req.body.name) {
            const existing = await Supplier.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ message: 'Đã có nhà cung cấp này!' });
        }
        const updated = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'Supplier not found' });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
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
