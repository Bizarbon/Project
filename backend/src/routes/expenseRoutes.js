const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

router.use(protect);
router.use(admin);


// GET all expenses (with optional date range filter)
router.get('/', async (req, res) => {
    try {
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                filter.date.$lte = toDate;
            }
        }
        const expenses = await Expense.find(filter).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET financial summary (revenue - expenses = profit)
router.get('/summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFilter = {};
        if (from || to) {
            dateFilter.$gte = from ? new Date(from) : new Date('2000-01-01');
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                dateFilter.$lte = toDate;
            }
        }

        const orderFilter = { status: 'completed' };
        const expenseFilter = {};
        if (Object.keys(dateFilter).length > 0) {
            orderFilter.orderDate = dateFilter;
            expenseFilter.date = dateFilter;
        }

        // Doanh thu từ đơn hoàn thành
        const completedOrders = await Order.find(orderFilter).select('totalAmount shippingFee paymentStatus paymentMethod');
        const paidOrders = completedOrders.filter(o => (
            o.paymentStatus === 'paid' ||
            o.paymentMethod === 'cod' ||
            o.paymentMethod === 'ShipCOD'
        ));
        const revenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        // Chi phí vận hành
        const expenses = await Expense.find(expenseFilter);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Chi phí phân loại
        const byType = {};
        expenses.forEach(e => {
            byType[e.type] = (byType[e.type] || 0) + e.amount;
        });

        res.json({
            revenue,
            totalExpenses,
            profit: revenue - totalExpenses,
            orderCount: paidOrders.length,
            byType
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST add expense
router.post('/', async (req, res) => {
    const expense = new Expense({
        type: req.body.type,
        amount: req.body.amount,
        description: req.body.description,
        date: req.body.date || Date.now()
    });
    try {
        const newExpense = await expense.save();
        res.status(201).json(newExpense);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE expense + renumber
router.delete('/:id', async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        await Expense.findByIdAndDelete(req.params.id);

        res.json({ 
            message: 'Expense deleted successfully',
            deletedId: req.params.id 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
