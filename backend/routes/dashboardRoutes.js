const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const { protect, admin } = require('../middleware/auth');

router.get('/dashboard', protect, admin, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [orders, products, customerCount, newCustomers, expenses, recentOrders] = await Promise.all([
            Order.find(),
            Product.find(),
            Customer.countDocuments(),
            Customer.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Expense.find({ date: { $gte: startOfMonth } }),
            Order.find().sort({ createdAt: -1 }).limit(8).populate('customer').populate('products.product')
        ]);

        const completed = orders.filter(order => order.status === 'completed');
        const paidOrCodCompleted = completed.filter(order => order.paymentStatus === 'paid' || order.paymentMethod === 'cod');
        const revenue = paidOrCodCompleted.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const todayRevenue = paidOrCodCompleted
            .filter(order => new Date(order.orderDate || order.createdAt) >= startOfToday)
            .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

        res.json({
            revenue,
            todayRevenue,
            expenses: totalExpenses,
            profit: revenue - totalExpenses,
            orderCount: orders.length,
            pendingOrders: orders.filter(order => order.status === 'pending').length,
            shippingOrders: orders.filter(order => order.status === 'shipping').length,
            completedOrders: completed.length,
            productCount: products.length,
            lowStockProducts: products
                .filter(product => product.stock <= (product.minStock ?? 5))
                .map(product => ({
                    _id: product._id,
                    name: product.name,
                    stock: product.stock,
                    minStock: product.minStock ?? 5
                })),
            customerCount,
            newCustomers,
            recentOrders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
