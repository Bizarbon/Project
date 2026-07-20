const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderSchema = new mongoose.Schema({
    _id: { type: Number },
    customer: {
        type: Number,
        ref: 'Customer',
        required: true
    },
    customerName: {
        type: String,
        default: ''
    },
    customerPhone: {
        type: String,
        default: ''
    },
    recipientName: {
        type: String,
        default: ''
    },
    recipientPhone: {
        type: String,
        default: ''
    },
    shippingAddress: {
        type: String,
        default: ''
    },
    products: [{
        product: {
            type: Number,
            ref: 'Product'
        },
        productName: {
            type: String,
            default: ''
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    subtotal: {
        type: Number,
        default: 0,
        min: 0
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    couponCode: {
        type: String,
        default: ''
    },
    couponName: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipping', 'completed', 'cancelled', 'returned', 'boom'],
        default: 'pending'
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipping', 'completed', 'cancelled', 'returned', 'boom'],
            required: true
        },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        occurredAt: { type: Date, default: Date.now }
    }],
    inspectionNote: {
        type: String,
        default: ''
    },
    estimatedDeliveryAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'bank_transfer', 'vnpay', 'momo', 'installment', 'ShipCOD', 'Thanh toán trước', 'Trả góp'],
        default: 'cod'
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded'],
        default: 'unpaid'
    },
    paymentProvider: {
        type: String,
        enum: ['', 'cod', 'bank_transfer', 'vnpay', 'momo', 'installment', 'manual'],
        default: ''
    },
    paymentTransactionId: {
        type: String,
        default: ''
    },
    paymentRequestId: {
        type: String,
        default: ''
    },
    paymentOrderId: {
        type: String,
        default: ''
    },
    paidAt: {
        type: Date,
        default: null
    },
    paymentMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    trackingNumber: {
        type: String,
        default: ''
    },
    shippingUnit: {
        type: String,
        default: ''
    },
    shippingFee: {
        type: Number,
        default: 0,
        min: 0
    },
    note: {
        type: String,
        default: ''
    },
    stockRestored: {
        type: Boolean,
        default: false
    },
    orderDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

orderSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'orderId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Order', orderSchema);
