require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { expireOverduePayments } = require('./utils/paymentExpiry');
const Product = require('./models/Product');

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
const shippingRoutes = require('./routes/shippingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const IS_VERCEL = Boolean(process.env.VERCEL);
let lastPaymentExpirySweep = 0;

function validateSecurityConfig() {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
        const message = 'JWT_SECRET phải có ít nhất 32 ký tự.';
        if (process.env.NODE_ENV === 'production') throw new Error(message);
        console.warn(`Security warning: ${message}`);
    }
}

validateSecurityConfig();

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const allowedOrigins = new Set([
    process.env.APP_BASE_URL,
    process.env.FRONTEND_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5500'
].filter(Boolean).map(value => String(value).replace(/\/$/, '')));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use(cors((req, callback) => {
    const origin = String(req.get('origin') || '').replace(/\/$/, '');
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol;
    const requestOrigin = `${protocol}://${req.get('host')}`.replace(/\/$/, '');
    const permitted = !origin || origin === requestOrigin || allowedOrigins.has(origin);
    callback(null, { origin: permitted, credentials: false });
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    }
    next();
});

app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: req => req.path === '/health'
        || req.path.includes('/payments/vnpay/ipn')
        || req.path.includes('/payments/momo/ipn')
        || req.path.includes('/payments/bank/webhook'),
    message: { message: 'Hệ thống nhận quá nhiều yêu cầu. Vui lòng thử lại sau.' }
}));

app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        if (Date.now() - lastPaymentExpirySweep > 60000) {
            lastPaymentExpirySweep = Date.now();
            expireOverduePayments().catch(error => console.error('Payment expiry sweep error:', error.message));
        }
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

app.get('/api/sitemap', async (req, res, next) => {
    try {
        const configuredBaseUrl = process.env.APP_BASE_URL
            || process.env.FRONTEND_BASE_URL
            || 'https://techecommerce-shop.vercel.app';
        const baseUrl = String(configuredBaseUrl).replace(/\/$/, '');
        const staticPages = [
            '/',
            '/pages/legal/faq.html',
            '/pages/legal/privacy.html',
            '/pages/legal/return-policy.html',
            '/pages/legal/shipping.html',
            '/pages/legal/terms.html',
            '/pages/legal/warranty.html',
            '/pages/legal/cookie.html'
        ];
        const products = await Product.find({ active: { $ne: false } })
            .select('_id updatedAt')
            .sort({ _id: 1 })
            .lean();
        const today = new Date().toISOString().slice(0, 10);
        const urls = [
            ...staticPages.map(page => ({ loc: `${baseUrl}${page}`, lastmod: today })),
            ...products.map(product => ({
                loc: `${baseUrl}/pages/catalog/product.html?id=${encodeURIComponent(product._id)}`,
                lastmod: new Date(product.updatedAt || Date.now()).toISOString().slice(0, 10)
            }))
        ];
        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls.map(url => `  <url><loc>${url.loc.replace(/&/g, '&amp;')}</loc><lastmod>${url.lastmod}</lastmod></url>`),
            '</urlset>'
        ].join('\n');
        res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.type('application/xml').send(xml);
    } catch (error) {
        next(error);
    }
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
app.use('/api/shipping', shippingRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API endpoint không tồn tại.' });
});

if (IS_VERCEL) {
    app.get(['/', '/index.html'], (req, res) => {
        res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
}

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
    const expiryTimer = setInterval(() => {
        expireOverduePayments().catch(error => console.error('Payment expiry sweep error:', error.message));
    }, 60000);
    expiryTimer.unref();
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
