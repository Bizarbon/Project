const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const JWT_OPTIONS = {
    issuer: 'techecommerce-api',
    audience: 'techecommerce-web'
};

const DEV_FALLBACK_JWT_SECRET = 'techecommerce_dev_only_fallback_secret_2026';

function getJwtSecret() {
    const secret = String(process.env.JWT_SECRET || '').trim();
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET bắt buộc phải được cấu hình trong môi trường production.');
    }
    return DEV_FALLBACK_JWT_SECRET;
}

function getAllowedOrigins() {
    const list = [
        process.env.APP_BASE_URL,
        process.env.FRONTEND_BASE_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
        process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
        'https://techshopvn.vercel.app'
    ];
    if (process.env.NODE_ENV !== 'production') {
        list.push(
            'http://localhost:5000',
            'http://localhost:5500',
            'http://localhost:5501',
            'http://127.0.0.1:5000',
            'http://127.0.0.1:5500',
            'http://127.0.0.1:5501'
        );
    }
    return new Set(list.filter(Boolean).map(v => String(v).trim().replace(/\/$/, '')));
}

function isAllowedOrigin(origin, req = null) {
    const clean = String(origin || '').trim().replace(/\/$/, '');
    if (!clean || !/^https?:\/\//i.test(clean)) return false;
    if (getAllowedOrigins().has(clean)) return true;
    if (req) {
        const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
        const protocol = forwardedProto || req.protocol;
        const host = req.get('host');
        if (host && clean === `${protocol}://${host}`.replace(/\/$/, '')) return true;
    }
    return false;
}

async function userFromToken(token) {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, JWT_OPTIONS);
    const user = await Customer.findById(decoded.id).select('-password');
    if (!user) return null;
    if (user.active === false) return null;
    if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) return null;
    return user;
}

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Không có quyền truy cập, không có token!' });
    }

    try {
        req.user = await userFromToken(token);

        if (!req.user) {
            return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa!' });
        }

        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!' });
        }
        return res.status(401).json({ message: 'Không có quyền truy cập, token không hợp lệ!' });
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    try {
        req.user = await userFromToken(token);
    } catch (error) {
        req.user = null;
    }
    return next();
};

const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin && req.user.active !== false) {
        return next();
    }
    return res.status(403).json({ message: 'Quyền hạn bị từ chối, yêu cầu quyền Admin!' });
};

const requirePermission = (moduleKey, action = 'view') => (req, res, next) => {
    if (!req.user || !req.user.isAdmin || req.user.active === false) {
        return res.status(403).json({ message: 'Quyền hạn bị từ chối!' });
    }
    const perms = req.user.permissions;
    // Super admin (no restricted permission matrix) has full permissions
    if (!perms || typeof perms !== 'object') return next();
    if (perms[moduleKey] && perms[moduleKey][action]) return next();
    return res.status(403).json({
        message: `Tài khoản của bạn không có quyền thực hiện thao tác (${action}) trên mục ${moduleKey}.`
    });
};

module.exports = {
    getJwtSecret,
    getAllowedOrigins,
    isAllowedOrigin,
    protect,
    optionalAuth,
    admin,
    requirePermission
};
