const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET) {
    const envPaths = [
        path.join(__dirname, '../.env'),
        path.join(__dirname, '../../.env'),
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'backend', '.env')
    ];
    for (const p of envPaths) {
        if (fs.existsSync(p)) {
            require('dotenv').config({ path: p });
            break;
        }
    }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { expireOverduePayments } = require('./utils/paymentExpiry');
const { isAllowedOrigin } = require('./middleware/auth');
const Product = require('./models/Product');
const BlogPost = require('./models/BlogPost');

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
const staffRoutes = require('./routes/staffRoutes');
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const IS_VERCEL = Boolean(process.env.VERCEL);
let lastPaymentExpirySweep = 0;

function validateSecurityConfig() {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
        console.warn('Security warning: JWT_SECRET phải có ít nhất 32 ký tự.');
    }
}

validateSecurityConfig();

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(cors((req, callback) => {
    const origin = String(req.get('origin') || '').replace(/\/$/, '');
    const permitted = !origin || isAllowedOrigin(origin, req);
    callback(null, { origin: permitted, credentials: false });
}));
// Allow larger base64 payloads strictly for visual-search image uploads
app.use('/api/chat/visual-search', express.json({ limit: '15mb' }));
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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'TechEcommerce',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.round(process.uptime())
    });
});

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

// Dynamic SEO Sitemap including live active products and blog posts
async function serveDynamicSitemap(req, res) {
    try {
        await connectDB();
        const base = 'https://techshopvn.vercel.app';
        const today = new Date().toISOString().slice(0, 10);
        const staticUrls = [
            { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
            { loc: `${base}/?category=${encodeURIComponent('Điện thoại')}`, changefreq: 'daily', priority: '0.9' },
            { loc: `${base}/?category=Laptop`, changefreq: 'daily', priority: '0.9' },
            { loc: `${base}/?category=Tablet`, changefreq: 'daily', priority: '0.9' },
            { loc: `${base}/?category=${encodeURIComponent('Tai nghe')}`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/?category=${encodeURIComponent('Đồng hồ thông minh')}`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/?category=${encodeURIComponent('Phụ kiện')}`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/?category=${encodeURIComponent('Máy chơi game')}`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/pages/ai/assistant.html`, changefreq: 'weekly', priority: '0.85' },
            { loc: `${base}/pages/tools/setup-builder.html`, changefreq: 'weekly', priority: '0.85' },
            { loc: `${base}/pages/blog.html`, changefreq: 'daily', priority: '0.85' },
            { loc: `${base}/pages/legal/promotions.html`, changefreq: 'weekly', priority: '0.75' },
            { loc: `${base}/pages/legal/installment.html`, changefreq: 'monthly', priority: '0.7' },
            { loc: `${base}/pages/legal/warranty.html`, changefreq: 'monthly', priority: '0.6' },
            { loc: `${base}/pages/legal/shipping.html`, changefreq: 'monthly', priority: '0.6' },
            { loc: `${base}/pages/legal/return-policy.html`, changefreq: 'monthly', priority: '0.6' },
            { loc: `${base}/pages/legal/faq.html`, changefreq: 'monthly', priority: '0.6' },
            { loc: `${base}/pages/legal/terms.html`, changefreq: 'monthly', priority: '0.5' },
            { loc: `${base}/pages/legal/privacy.html`, changefreq: 'monthly', priority: '0.5' },
            { loc: `${base}/pages/legal/cookie.html`, changefreq: 'monthly', priority: '0.5' }
        ];

        const [products, posts] = await Promise.all([
            Product.find({ active: { $ne: false } }).select('_id updatedAt').sort({ _id: 1 }).limit(500).lean(),
            BlogPost.find({ status: 'published' }).select('_id updatedAt').sort({ _id: -1 }).limit(200).lean().catch(() => [])
        ]);

        const xmlEntries = [
            ...staticUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`),
            ...products.map(p => {
                const mod = p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : today;
                return `  <url>\n    <loc>${base}/pages/catalog/product.html?id=${encodeURIComponent(p._id)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
            }),
            ...posts.map(post => {
                const mod = post.updatedAt ? new Date(post.updatedAt).toISOString().slice(0, 10) : today;
                return `  <url>\n    <loc>${base}/pages/blog.html?post=${encodeURIComponent(post._id)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
            })
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries.join('\n')}\n</urlset>`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        return res.status(200).send(xml);
    } catch (error) {
        const fallback = path.join(IS_VERCEL ? PUBLIC_DIR : FRONTEND_DIR, 'sitemap.xml');
        if (fs.existsSync(fallback)) return res.sendFile(fallback);
        return res.status(500).send('Unable to build sitemap.');
    }
}
app.get(['/sitemap.xml', '/api/sitemap.xml'], serveDynamicSitemap);

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
app.use('/api/staff', staffRoutes);
app.use('/api/blog', blogRoutes);

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
            res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        }
    }));

    app.get('/', (req, res) => {
        return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    });
}

app.use((req, res) => {
    const notFoundPage = path.join(IS_VERCEL ? PUBLIC_DIR : FRONTEND_DIR, '404.html');
    if (req.accepts('html') && fs.existsSync(notFoundPage)) {
        return res.status(404).sendFile(notFoundPage);
    }
    return res.status(404).send('Không tìm thấy tài nguyên.');
});

app.use((error, req, res, next) => {
    console.error('Unhandled request error:', error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ.' });
});

module.exports = app;
