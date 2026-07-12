const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Không có quyền truy cập, không có token!' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await Customer.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({ message: 'Người dùng không tồn tại!' });
        }

        return next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Không có quyền truy cập, token lỗi!' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        return next();
    }
    return res.status(403).json({ message: 'Quyền hạn bị từ chối, yêu cầu quyền Admin!' });
};

module.exports = { protect, admin };
