const mongoose = require('mongoose');
const Counter = require('./Counter');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
    _id: { type: Number },
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        set: value => {
            const normalized = String(value || '').trim().toLowerCase();
            return normalized || undefined;
        }
    },
    phone: {
        type: String,
        required: false,
        trim: true
    },
    address: {
        type: String,
        required: false
    },
    avatar: {
        type: String,
        required: false,
        default: '',
        maxlength: 500000
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    googleId: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        index: true,
        trim: true
    },
    provider: {
        type: String,
        default: 'local',
        enum: ['local', 'google']
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'staff', 'shipper'],
        default: 'customer',
        index: true
    },
    active: {
        type: Boolean,
        default: true,
        index: true
    },
    shipperStatus: {
        type: String,
        enum: ['available', 'delivering', 'offline'],
        default: 'available'
    },
    loginAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    lockUntil: {
        type: Date,
        default: null,
        select: false
    },
    lastLoginAt: {
        type: Date,
        default: null
    },
    passwordChangedAt: {
        type: Date,
        default: null
    },
    resetPasswordToken: {
        type: String,
        default: null,
        select: false
    },
    resetPasswordExpiresAt: {
        type: Date,
        default: null,
        select: false
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    wishlist: [{
        type: Number,
        ref: 'Product'
    }]
}, { 
    timestamps: true
});

customerSchema.pre('save', async function() {
    if (this.isAdmin && (!this.role || this.role === 'customer')) {
        this.role = 'admin';
    } else if (this.role === 'admin') {
        this.isAdmin = true;
    }
    
    if (this.isNew || this.isModified('password')) {
        if (this.password) {
            const salt = await bcrypt.genSalt(12);
            this.password = await bcrypt.hash(this.password, salt);
            if (!this.isNew) {
                this.passwordChangedAt = new Date();
                this.tokenVersion = Number(this.tokenVersion || 0) + 1;
            }
        }
    }
    
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'customerId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Customer', customerSchema);
