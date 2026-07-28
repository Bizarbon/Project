const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const {
    emailEnabled,
    sendPasswordChangedEmail
} = require('../utils/email');
const {
    normalizeVietnamPhone,
    phoneVariants
} = require('../utils/phone');
const {
    smsEnabled,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    safeSmsError
} = require('../utils/sms');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau 15 phút.' }
});
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau một giờ.' }
});
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã nhập mã quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});

router.use(authLimiter);

function signToken(customer) {
    return jwt.sign(
        {
            id: customer._id,
            isAdmin: customer.isAdmin,
            tokenVersion: Number(customer.tokenVersion || 0)
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '2h',
            issuer: 'techecommerce-api',
            audience: 'techecommerce-web'
        }
    );
}

function publicUser(customer) {
    return {
        id: customer._id,
        name: customer.name,
        username: customer.username,
        avatar: customer.avatar || '',
        isAdmin: customer.isAdmin
    };
}

// POST register
router.post('/register', [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Họ tên phải từ 2 đến 80 ký tự'),
    body('username').trim().matches(/^[a-zA-Z0-9_]{3,30}$/).withMessage('Tên đăng nhập gồm 3-30 chữ, số hoặc dấu gạch dưới'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .custom(value => Boolean(normalizeVietnamPhone(value)))
        .withMessage('Số điện thoại Việt Nam không hợp lệ'),
    body('address').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Địa chỉ quá dài'),
    body('password')
        .isLength({ min: 8, max: 72 }).withMessage('Mật khẩu phải từ 8 đến 72 ký tự')
        .matches(/[a-z]/).withMessage('Mật khẩu cần có chữ thường')
        .matches(/[A-Z]/).withMessage('Mật khẩu cần có chữ hoa')
        .matches(/\d/).withMessage('Mật khẩu cần có chữ số')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { name, address, password } = req.body;
        const username = String(req.body.username || '').toLowerCase();
        const email = String(req.body.email || '').trim().toLowerCase();
        const normalizedPhone = normalizeVietnamPhone(req.body.phone);
        const phone = normalizedPhone?.local || '';

        if (await Customer.findOne({ username })) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại!' });
        }
        if (email && await Customer.findOne({ email })) {
            return res.status(400).json({ message: 'Email đã tồn tại!' });
        }
        if (phone && await Customer.findOne({ phone: { $in: phoneVariants(phone) } })) {
            return res.status(400).json({ message: 'Số điện thoại đã tồn tại!' });
        }

        const customerData = { name, username, password };
        if (email) customerData.email = email;
        if (phone) customerData.phone = phone;
        if (address) customerData.address = String(address).trim();

        const customer = await new Customer(customerData).save();
        res.status(201).json({
            message: 'Đăng ký thành công!',
            token: signToken(customer),
            user: publicUser(customer)
        });
    } catch (error) {
        if (error?.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const duplicateMessages = {
                username: 'Tên đăng nhập đã tồn tại!',
                email: 'Email đã được sử dụng!',
                phone: 'Số điện thoại đã được sử dụng!'
            };
            return res.status(409).json({
                message: duplicateMessages[duplicateField] || 'Thông tin đăng ký đã tồn tại.'
            });
        }

        console.error('Registration error:', error);
        res.status(500).json({ message: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.' });
    }
});

// POST login
router.post('/login', [
    body('identifier').notEmpty().withMessage('Tên đăng nhập, Email hoặc SĐT là bắt buộc'),
    body('password').notEmpty().withMessage('Mật khẩu là bắt buộc')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { identifier, password } = req.body;
        const normalized = String(identifier || '').trim().toLowerCase();
        const normalizedPhone = normalizeVietnamPhone(normalized);
        const identifiers = [
            { username: normalized },
            { email: normalized.toLowerCase() }
        ];
        if (normalizedPhone) {
            identifiers.push({ phone: { $in: phoneVariants(normalizedPhone.local) } });
        } else {
            identifiers.push({ phone: normalized });
        }
        const customer = await Customer.findOne({
            $or: identifiers
        }).select('+password +loginAttempts +lockUntil');

        if (customer?.lockUntil && customer.lockUntil > new Date()) {
            const waitMinutes = Math.max(Math.ceil((customer.lockUntil.getTime() - Date.now()) / 60000), 1);
            return res.status(423).json({ message: `Tài khoản tạm khóa. Vui lòng thử lại sau ${waitMinutes} phút.` });
        }

        const isMatch = customer ? await bcrypt.compare(password, customer.password) : false;
        if (!customer || !isMatch) {
            if (customer) {
                if (customer.lockUntil && customer.lockUntil <= new Date()) customer.loginAttempts = 0;
                customer.loginAttempts = Number(customer.loginAttempts || 0) + 1;
                if (customer.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                    customer.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
                    customer.loginAttempts = 0;
                }
                await customer.save({ validateBeforeSave: false });
            } else {
                await bcrypt.compare(password, '$2a$12$C6UzMDM.H6dfI/f/IKcEe.5jKGGdP.VC8a8QY3MdB2Jz9Qe3vG7eG');
            }
            return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác!' });
        }

        customer.loginAttempts = 0;
        customer.lockUntil = null;
        customer.lastLoginAt = new Date();
        await customer.save({ validateBeforeSave: false });

        res.json({
            message: 'Đăng nhập thành công!',
            token: signToken(customer),
            user: publicUser(customer)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/forgot-password', passwordResetLimiter, [
    body('phone')
        .trim()
        .custom(value => Boolean(normalizeVietnamPhone(value)))
        .withMessage('Số điện thoại Việt Nam không hợp lệ')
], async (req, res) => {
    const genericMessage = 'Nếu số điện thoại này thuộc một tài khoản, mã xác nhận đã được gửi qua SMS.';
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
        if (!smsEnabled()) {
            return res.status(503).json({
                message: 'Dịch vụ gửi mã xác nhận qua SMS chưa được cấu hình. Vui lòng liên hệ cửa hàng.'
            });
        }

        const normalizedPhone = normalizeVietnamPhone(req.body.phone);
        const matchingCustomers = await Customer.find({
            phone: { $in: phoneVariants(normalizedPhone.local) }
        }).limit(2);
        const customer = matchingCustomers.length === 1 ? matchingCustomers[0] : null;

        if (customer) {
            try {
                await sendPasswordResetOtp(normalizedPhone.e164);
            } catch (error) {
                console.error('Password reset SMS error:', error?.response?.data?.code || error.message);
                return res.status(error?.code === 'SMS_NOT_CONFIGURED' ? 503 : 502).json({
                    message: safeSmsError(error)
                });
            }
            customer.resetPasswordToken = null;
            customer.resetPasswordExpiresAt = null;
            await customer.save({ validateBeforeSave: false });
        } else if (matchingCustomers.length > 1) {
            console.warn(`Password reset skipped: duplicate phone belongs to multiple accounts (${normalizedPhone.local}).`);
        }

        return res.json({
            message: genericMessage,
            expiresInSeconds: 600,
            retryAfterSeconds: 30
        });
    } catch (error) {
        console.error('Forgot password error:', error.message);
        return res.status(500).json({ message: 'Chưa thể xử lý yêu cầu đặt lại mật khẩu.' });
    }
});

router.post('/verify-reset-otp', otpVerifyLimiter, [
    body('phone')
        .trim()
        .custom(value => Boolean(normalizeVietnamPhone(value)))
        .withMessage('Số điện thoại Việt Nam không hợp lệ'),
    body('code')
        .trim()
        .matches(/^\d{4,10}$/)
        .withMessage('Mã xác nhận phải gồm từ 4 đến 10 chữ số')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
        if (!smsEnabled()) {
            return res.status(503).json({
                message: 'Dịch vụ gửi mã xác nhận qua SMS chưa được cấu hình. Vui lòng liên hệ cửa hàng.'
            });
        }

        const normalizedPhone = normalizeVietnamPhone(req.body.phone);
        const matchingCustomers = await Customer.find({
            phone: { $in: phoneVariants(normalizedPhone.local) }
        }).limit(2);
        const customer = matchingCustomers.length === 1 ? matchingCustomers[0] : null;

        if (!customer) {
            return res.status(400).json({
                message: 'Mã xác nhận không đúng hoặc đã hết hạn.'
            });
        }

        let approved = false;
        try {
            approved = await verifyPasswordResetOtp(
                normalizedPhone.e164,
                String(req.body.code).trim()
            );
        } catch (error) {
            console.error('Password reset OTP verification error:', error?.response?.data?.code || error.message);
            return res.status(error?.code === 'SMS_NOT_CONFIGURED' ? 503 : 400).json({
                message: safeSmsError(error)
            });
        }

        if (!approved) {
            return res.status(400).json({
                message: 'Mã xác nhận không đúng hoặc đã hết hạn.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        customer.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        customer.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await customer.save({ validateBeforeSave: false });

        return res.json({
            message: 'Số điện thoại đã được xác nhận. Hãy tạo mật khẩu mới.',
            resetToken,
            expiresInSeconds: 600
        });
    } catch (error) {
        console.error('Verify reset OTP error:', error.message);
        return res.status(500).json({ message: 'Chưa thể xác nhận mã lúc này.' });
    }
});

router.post('/reset-password', passwordResetLimiter, [
    body('token').isLength({ min: 64, max: 64 }).withMessage('Phiên đặt lại mật khẩu không hợp lệ'),
    body('password')
        .isLength({ min: 8, max: 72 }).withMessage('Mật khẩu phải từ 8 đến 72 ký tự')
        .matches(/[a-z]/).withMessage('Mật khẩu cần có chữ thường')
        .matches(/[A-Z]/).withMessage('Mật khẩu cần có chữ hoa')
        .matches(/\d/).withMessage('Mật khẩu cần có chữ số')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const tokenHash = crypto.createHash('sha256').update(String(req.body.token)).digest('hex');
        const customer = await Customer.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpiresAt: { $gt: new Date() }
        }).select('+resetPasswordToken +resetPasswordExpiresAt');

        if (!customer) {
            return res.status(400).json({
                message: 'Phiên đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu mã mới.'
            });
        }

        customer.password = req.body.password;
        customer.resetPasswordToken = null;
        customer.resetPasswordExpiresAt = null;
        customer.loginAttempts = 0;
        customer.lockUntil = null;
        await customer.save();

        if (emailEnabled() && customer.email) {
            sendPasswordChangedEmail(customer).catch(error => {
                console.error('Password changed email error:', error.message);
            });
        }

        return res.json({ message: 'Mật khẩu đã được thay đổi. Bạn có thể đăng nhập ngay.' });
    } catch (error) {
        console.error('Reset password error:', error.message);
        return res.status(500).json({ message: 'Chưa thể thay đổi mật khẩu lúc này.' });
    }
});

module.exports = router;
