const mongoose = require('mongoose');
const Counter = require('./Counter');

const reviewSchema = new mongoose.Schema({
    _id: { type: Number },
    product: {
        type: Number,
        ref: 'Product',
        required: true
    },
    customer: {
        type: Number,
        ref: 'Customer',
        required: true
    },
    customerName: {
        type: String,
        default: ''
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        trim: true,
        default: ''
    },
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['visible', 'hidden'],
        default: 'visible'
    }
}, { timestamps: true });

reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

reviewSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'reviewId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Review', reviewSchema);
