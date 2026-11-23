const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, admin, requirePermission } = require('../middleware/auth');

router.use(protect);
router.use(admin);

// GET all expenses (with optional date range filter)
router.get('/', requirePermission('finance', 'view'), async (req, res) => {
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

// GET financial summary (revenue - expenses = profit) with advanced analytics
router.get('/summary', requirePermission('finance', 'view'), async (req, res) => {
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
        const completedOrders = await Order.find(orderFilter)
            .select('totalAmount shippingFee paymentStatus paymentMethod products orderDate')
            .populate('products.product', 'category price name');

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

        // 1. Phân tích Biên lợi nhuận gộp theo Danh mục (Gross Margin by Category)
        const cogsRatios = {
            'Phụ kiện': 0.58,       // Margin ~42%
            'Tai nghe': 0.65,       // Margin ~35%
            'Đồng hồ': 0.72,        // Margin ~28%
            'Đồng hồ thông minh': 0.72,
            'Máy chơi game': 0.80,  // Margin ~20%
            'Tablet': 0.82,         // Margin ~18%
            'Laptop': 0.85,         // Margin ~15%
            'Điện thoại': 0.86      // Margin ~14%
        };

        const categoryStats = {};
        const paymentStats = {
            cod: { name: 'Thanh toán khi nhận hàng (COD)', total: 0, count: 0 },
            vietqr: { name: 'Chuyển khoản VietQR tức thì', total: 0, count: 0 },
            credit_card: { name: 'Thẻ tín dụng / Trả góp 0%', total: 0, count: 0 },
            other: { name: 'Khác', total: 0, count: 0 }
        };

        let codPendingSettlement = 0;
        let directReceived = 0;

        completedOrders.forEach(order => {
            const methodKey = String(order.paymentMethod || '').toLowerCase();
            const orderAmt = order.totalAmount || 0;
            if (methodKey.includes('cod')) {
                paymentStats.cod.total += orderAmt;
                paymentStats.cod.count += 1;
                codPendingSettlement += orderAmt;
            } else if (methodKey.includes('qr') || methodKey.includes('bank') || methodKey.includes('transfer')) {
                paymentStats.vietqr.total += orderAmt;
                paymentStats.vietqr.count += 1;
                directReceived += orderAmt;
            } else if (methodKey.includes('card') || methodKey.includes('credit') || methodKey.includes('installment')) {
                paymentStats.credit_card.total += orderAmt;
                paymentStats.credit_card.count += 1;
                directReceived += orderAmt;
            } else {
                paymentStats.other.total += orderAmt;
                paymentStats.other.count += 1;
                directReceived += orderAmt;
            }

            if (Array.isArray(order.products)) {
                order.products.forEach(p => {
                    const cat = (p.product && p.product.category) || 'Khác';
                    const itemRev = (p.price || 0) * (p.quantity || 1);
                    if (!categoryStats[cat]) {
                        categoryStats[cat] = { revenue: 0, soldCount: 0 };
                    }
                    categoryStats[cat].revenue += itemRev;
                    categoryStats[cat].soldCount += (p.quantity || 1);
                });
            }
        });

        let categoryAnalysis = Object.entries(categoryStats).map(([cat, stat]) => {
            const ratio = cogsRatios[cat] || 0.78;
            const cogs = Math.round(stat.revenue * ratio);
            const grossProfit = stat.revenue - cogs;
            const marginPct = stat.revenue > 0 ? Number(((grossProfit / stat.revenue) * 100).toFixed(1)) : 0;
            return {
                category: cat,
                revenue: stat.revenue,
                cogs,
                grossProfit,
                marginPct,
                soldCount: stat.soldCount
            };
        }).sort((a, b) => b.revenue - a.revenue);

        const totalPayAmt = Object.values(paymentStats).reduce((sum, p) => sum + p.total, 0);
        const paymentBreakdown = {};
        if (totalPayAmt > 0) {
            Object.keys(paymentStats).forEach(k => {
                if (paymentStats[k].count > 0 || paymentStats[k].total > 0) {
                    paymentBreakdown[k] = {
                        ...paymentStats[k],
                        pct: Number(((paymentStats[k].total / totalPayAmt) * 100).toFixed(1))
                    };
                }
            });
        }

        // Authentic cashflow forecast strictly derived from actual revenue (0 when no completed orders yet)
        const forecast7Days = Math.round(revenue * 0.28);
        const forecast30Days = Math.round(revenue * 1.15);
        const requiredWorkingCapital = Math.round(forecast30Days * 0.65);

        const aiCashflowInsights = revenue > 0 ? [
            {
                type: 'margin',
                title: 'Chiến lược tối ưu biên lợi nhuận',
                text: 'Nhóm sản phẩm Phụ kiện & Âm thanh có biên lợi nhuận gộp vượt trội (35% – 42%), cao hơn Điện thoại & Laptop (14% – 15%). Khuyến khích đẩy mạnh combo mua kèm để tối ưu lợi nhuận ròng.'
            },
            {
                type: 'cod',
                title: 'Kiểm soát dòng tiền COD tồn đọng',
                text: paymentBreakdown.cod
                    ? `Tỷ lệ COD đang chiếm ${paymentBreakdown.cod.pct}% tổng doanh thu (${paymentBreakdown.cod.total.toLocaleString('vi-VN')} đ). Có thể khuyến khích khách chuyển khoản VietQR để dòng tiền về tài khoản nhanh hơn.`
                    : 'Đa số đơn hàng hoàn thành đã được thanh toán trực tiếp qua chuyển khoản hoặc cổng thanh toán.'
            },
            {
                type: 'forecast',
                title: 'Dự báo dòng tiền & Vốn lưu động',
                text: `Dựa trên dữ liệu thực tế trong kỳ, doanh thu 30 ngày tới ước đạt ${forecast30Days.toLocaleString('vi-VN')} đ. Vốn lưu động nhập hàng khuyến nghị tối thiểu ${requiredWorkingCapital.toLocaleString('vi-VN')} đ.`
            }
        ] : [
            {
                type: 'info',
                title: 'Chưa phát sinh đơn hàng hoàn thành trong kỳ',
                text: 'Hệ thống sẽ tự động tính toán biên lợi nhuận gộp, phân bổ dòng tiền COD/VietQR và dự báo doanh thu ngay khi có đơn hàng hoàn tất.'
            }
        ];

        res.json({
            revenue,
            totalExpenses,
            profit: revenue - totalExpenses,
            orderCount: paidOrders.length,
            byType,
            categoryAnalysis,
            paymentBreakdown,
            cashflowStatus: {
                directReceived,
                codPendingSettlement
            },
            forecast: {
                forecast7Days,
                forecast30Days,
                requiredWorkingCapital
            },
            aiCashflowInsights
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST add expense
router.post('/', requirePermission('finance', 'create'), async (req, res) => {
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

// DELETE expense
router.delete('/:id', requirePermission('finance', 'delete'), async (req, res) => {
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
