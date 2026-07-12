const mongoose = require('mongoose');
const Counter = require('./Counter');

const couponSchema = new mongoose.Schema({
    _id: { type: Number },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['percent', 'fixed'],
        default: 'percent'
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    minOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscount: {
        type: Number,
        default: 0,
        min: 0
    },
    usageLimit: {
        type: Number,
        default: 0,
        min: 0
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    startsAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: null
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

couponSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'couponId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Coupon', couponSchema);
