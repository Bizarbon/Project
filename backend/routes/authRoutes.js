const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');

function signToken(customer) {
    return jwt.sign(
        { id: customer._id, isAdmin: customer.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
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
    body('name').notEmpty().withMessage('Tên bắt buộc'),
    body('username').notEmpty().withMessage('Tên đăng nhập bắt buộc').trim(),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu ít nhất 6 ký tự')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

        const { name, username, email, phone, address, password } = req.body;

        if (await Customer.findOne({ username })) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại!' });
        }
        if (email && await Customer.findOne({ email })) {
            return res.status(400).json({ message: 'Email đã tồn tại!' });
        }
        if (phone && await Customer.findOne({ phone })) {
            return res.status(400).json({ message: 'Số điện thoại đã tồn tại!' });
        }

        const customer = await new Customer({ name, username, email, phone, address, password }).save();
        res.status(201).json({
            message: 'Đăng ký thành công!',
            token: signToken(customer),
            user: publicUser(customer)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        const normalized = String(identifier || '').trim();
        const customer = await Customer.findOne({
            $or: [
                { username: normalized },
                { email: normalized.toLowerCase() },
                { phone: normalized }
            ]
        }).select('+password');

        const isMatch = customer ? await bcrypt.compare(password, customer.password) : false;
        if (!customer || !isMatch) {
            return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác!' });
        }

        res.json({
            message: 'Đăng nhập thành công!',
            token: signToken(customer),
            user: publicUser(customer)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
