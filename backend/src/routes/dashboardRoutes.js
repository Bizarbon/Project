const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const { protect, admin } = require('../middleware/auth');

const EXCLUDED_STATUSES = new Set(['cancelled', 'returned', 'boom']);

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
}

function dashboardRange(query = {}) {
    const now = new Date();
    const preset = ['today', '7d', 'month', 'custom'].includes(query.range) ? query.range : 'month';
    let from;
    let to = endOfDay(now);

    if (preset === 'today') from = startOfDay(now);
    else if (preset === '7d') from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    else if (preset === 'custom' && query.from && query.to) {
        from = startOfDay(query.from);
        to = endOfDay(query.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
            const error = new Error('Khoảng ngày thống kê không hợp lệ.');
            error.statusCode = 400;
            throw error;
        }
    } else from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

    const duration = Math.max(to.getTime() - from.getTime(), 86400000);
    return { preset, from, to, previousFrom: new Date(from.getTime() - duration - 1), previousTo: new Date(from.getTime() - 1) };
}

function orderDate(order) {
    return new Date(order.orderDate || order.createdAt);
}

function isCollected(order) {
    return order.paymentStatus === 'paid'
        || (['cod', 'ShipCOD'].includes(order.paymentMethod) && order.status === 'completed' && order.codCollected !== false);
}

function compactOrder(order) {
    return {
        _id: order._id,
        customerName: order.customer?.name || order.customerName || order.recipientName || 'Khách vãng lai',
        totalAmount: Number(order.totalAmount || 0),
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate || order.createdAt
    };
}

function buildTimeSeries(orders, from, to) {
    const days = Math.ceil((to - from) / 86400000) + 1;
    const monthly = days > 45;
    const buckets = new Map();
    const cursor = new Date(from);

    while (cursor <= to) {
        const key = monthly
            ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
            : cursor.toISOString().slice(0, 10);
        if (!buckets.has(key)) {
            buckets.set(key, {
                key,
                label: monthly ? `T${cursor.getMonth() + 1}/${String(cursor.getFullYear()).slice(-2)}` : cursor.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                revenue: 0,
                orderValue: 0,
                orders: 0
            });
        }
        if (monthly) cursor.setMonth(cursor.getMonth() + 1, 1);
        else cursor.setDate(cursor.getDate() + 1);
    }

    orders.forEach(order => {
        const date = orderDate(order);
        const key = monthly
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : date.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (!bucket) return;
        bucket.orders += 1;
        if (!EXCLUDED_STATUSES.has(order.status)) bucket.orderValue += Number(order.totalAmount || 0);
        if (isCollected(order) && !EXCLUDED_STATUSES.has(order.status)) bucket.revenue += Number(order.totalAmount || 0);
    });
    return [...buckets.values()];
}

router.get('/dashboard', protect, admin, async (req, res) => {
    try {
        const range = dashboardRange(req.query);
        const currentFilter = { orderDate: { $gte: range.from, $lte: range.to } };
        const previousFilter = { orderDate: { $gte: range.previousFrom, $lte: range.previousTo } };
        const [orders, previousOrders, products, expenses, customerCount, newCustomers] = await Promise.all([
            Order.find(currentFilter).populate('customer', 'name').populate('products.product', 'name image category'),
            Order.find(previousFilter).select('totalAmount status paymentStatus paymentMethod codCollected orderDate createdAt'),
            Product.find().select('name image category stock minStock active'),
            Expense.find({ date: { $gte: range.from, $lte: range.to } }),
            Customer.countDocuments(),
            Customer.countDocuments({ createdAt: { $gte: range.from, $lte: range.to } })
        ]);

        const validOrders = orders.filter(order => !EXCLUDED_STATUSES.has(order.status));
        const paidOrders = validOrders.filter(isCollected);
        const orderValue = validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const paidRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const previousRevenue = previousOrders.filter(order => !EXCLUDED_STATUSES.has(order.status) && isCollected(order)).reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const revenueChangePercent = previousRevenue > 0 ? Number((((paidRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)) : null;

        const statusOrder = ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipping', 'completed', 'delivery_failed', 'return_requested', 'cancelled', 'returned', 'boom'];
        const orderStatuses = statusOrder.map(status => ({ status, count: orders.filter(order => order.status === status).length })).filter(item => item.count > 0);
        const categoryMap = new Map();
        const productMap = new Map();

        validOrders.forEach(order => {
            (order.products || []).forEach(item => {
                const quantity = Number(item.quantity || 0);
                const revenue = Number(item.price || 0) * quantity;
                const product = item.product || {};
                const category = product.category || 'Khác';
                const categoryItem = categoryMap.get(category) || { category, quantity: 0, revenue: 0 };
                categoryItem.quantity += quantity;
                categoryItem.revenue += revenue;
                categoryMap.set(category, categoryItem);

                const key = String(product._id || item.product || item.productName);
                const productItem = productMap.get(key) || { _id: product._id || item.product, name: product.name || item.productName || 'Sản phẩm', image: product.image || '', quantity: 0, revenue: 0 };
                productItem.quantity += quantity;
                productItem.revenue += revenue;
                productMap.set(key, productItem);
            });
        });

        const completedOrders = orders.filter(order => order.status === 'completed').length;
        res.json({
            range: { preset: range.preset, from: range.from.toISOString(), to: range.to.toISOString(), previousFrom: range.previousFrom.toISOString(), previousTo: range.previousTo.toISOString() },
            paidRevenue,
            previousRevenue,
            revenueChangePercent,
            orderValue,
            expenses: totalExpenses,
            profit: paidRevenue - totalExpenses,
            orderCount: orders.length,
            validOrderCount: validOrders.length,
            completedOrders,
            processingOrders: orders.filter(order => ['pending', 'confirmed', 'processing', 'ready_to_ship'].includes(order.status)).length,
            shippingOrders: orders.filter(order => order.status === 'shipping').length,
            cancelledOrders: orders.filter(order => EXCLUDED_STATUSES.has(order.status)).length,
            productCount: products.length,
            customerCount,
            newCustomers,
            timeSeries: buildTimeSeries(orders, range.from, range.to),
            orderStatuses,
            categorySales: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
            bestSellers: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
            lowStockProducts: products.filter(product => product.active !== false && product.stock <= (product.minStock ?? 5)).map(product => ({ _id: product._id, name: product.name, stock: product.stock, minStock: product.minStock ?? 5 })),
            recentOrders: [...orders].sort((a, b) => orderDate(b) - orderDate(a)).slice(0, 8).map(compactOrder)
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
});

module.exports = router;
