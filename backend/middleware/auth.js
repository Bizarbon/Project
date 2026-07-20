const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const JWT_OPTIONS = {
    issuer: 'techecommerce-api',
    audience: 'techecommerce-web'
};

async function userFromToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
    const user = await Customer.findById(decoded.id).select('-password');
    if (!user || Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) return null;
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
            return res.status(401).json({ message: 'Người dùng không tồn tại!' });
        }

        return next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Không có quyền truy cập, token lỗi!' });
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
    if (req.user && req.user.isAdmin) {
        return next();
    }
    return res.status(403).json({ message: 'Quyền hạn bị từ chối, yêu cầu quyền Admin!' });
};

module.exports = { protect, optionalAuth, admin };
