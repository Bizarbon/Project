require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const couponRoutes = require('./routes/couponRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatRoutes = require('./routes/chatRoutes');
const locationRoutes = require('./routes/locationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const IS_VERCEL = Boolean(process.env.VERCEL);

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    }
    next();
});

app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        res.status(503).json({ message: 'Không thể kết nối cơ sở dữ liệu.' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'TechEcommerce',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.round(process.uptime())
    });
});

app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/locations', locationRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API endpoint không tồn tại.' });
});

if (!IS_VERCEL) {
    app.use(express.static(FRONTEND_DIR, {
        extensions: ['html'],
        maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
        setHeaders: res => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        }
    }));

    app.get('*', (req, res, next) => {
        if (path.extname(req.path)) return next();
        return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    });
}

app.use((req, res) => {
    res.status(404).send('Không tìm thấy tài nguyên.');
});

app.use((error, req, res, next) => {
    console.error('Unhandled request error:', error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ.' });
});

async function startServer() {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`TechEcommerce running at http://0.0.0.0:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch(error => {
        console.error('Server startup error:', error.message);
        process.exit(1);
    });
}

module.exports = app;
