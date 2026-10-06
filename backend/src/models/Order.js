const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderSchema = new mongoose.Schema({
    _id: { type: Number },
    customer: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    guestEmail: {
        type: String,
        lowercase: true,
        trim: true,
        default: ''
    },
    guestAccessTokenHash: {
        type: String,
        default: '',
        select: false
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
    shippingProvinceCode: {
        type: String,
        default: ''
    },
    shippingProvince: {
        type: String,
        default: ''
    },
    shippingWardCode: {
        type: String,
        default: ''
    },
    shippingWard: {
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
        enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipping', 'completed', 'cancelled', 'delivery_failed', 'returned', 'boom', 'return_requested'],
        default: 'pending'
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipping', 'completed', 'cancelled', 'delivery_failed', 'returned', 'boom', 'return_requested'],
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
    paymentExpiresAt: {
        type: Date,
        default: null
    },
    paymentMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    adminOrderEmailSentAt: {
        type: Date,
        default: null
    },
    customerOrderEmailSentAt: {
        type: Date,
        default: null
    },
    paymentConfirmationEmailSentAt: {
        type: Date,
        default: null
    },
    trackingNumber: {
        type: String,
        default: ''
    },
    shippingUnit: {
        type: String,
        default: ''
    },
    shippingStatus: {
        type: String,
        enum: ['unassigned', 'assigned', 'waiting_pickup', 'picked_up', 'delivering', 'delivered', 'delivery_failed', 'returned'],
        default: 'unassigned'
    },
    shipper: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    shipperAssignedAt: {
        type: Date,
        default: null
    },
    shipperAssignedBy: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    shipperAssignedByName: {
        type: String,
        default: ''
    },
    // Phân biệt giao thành công với đã thu tiền / đối soát COD
    codCollected: {
        type: Boolean,
        default: false
    },
    codCollectedAt: {
        type: Date,
        default: null
    },
    codCollectedAmount: {
        type: Number,
        default: 0
    },
    codReconciled: {
        type: Boolean,
        default: false
    },
    codReconciledAt: {
        type: Date,
        default: null
    },
    codReconciledBy: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    codReconciledByName: {
        type: String,
        default: ''
    },
    returnStatus: {
        type: String,
        enum: ['none', 'requested', 'approved', 'rejected', 'received', 'completed'],
        default: 'none'
    },
    returnReason: {
        type: String,
        default: ''
    },
    returnRequestedAt: {
        type: Date,
        default: null
    },
    returnProcessedAt: {
        type: Date,
        default: null
    },
    refundStatus: {
        type: String,
        enum: ['none', 'not_refunded', 'refund_pending', 'partially_refunded', 'refunded', 'refund_failed'],
        default: 'none'
    },
    refundAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    refundReason: {
        type: String,
        default: ''
    },
    refundTransactionId: {
        type: String,
        default: ''
    },
    refundedAt: {
        type: Date,
        default: null
    },
    refundedBy: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    cancelReason: {
        type: String,
        default: ''
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancelledBy: {
        type: Number,
        ref: 'Customer',
        default: null
    },
    cancelledByName: {
        type: String,
        default: ''
    },
    adminNotes: [{
        content: { type: String, required: true },
        createdBy: { type: Number, ref: 'Customer', default: null },
        createdByName: { type: String, default: 'Admin' },
        createdAt: { type: Date, default: Date.now }
    }],
    history: [{
        action: { type: String, required: true },
        statusFrom: { type: String, default: '' },
        statusTo: { type: String, default: '' },
        changedBy: { type: Number, ref: 'Customer', default: null },
        changedByName: { type: String, default: '' },
        note: { type: String, default: '' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now }
    }],
    shippingFee: {
        type: Number,
        default: 0,
        min: 0
    },
    shippingQuoteSource: {
        type: String,
        enum: ['', 'store_estimate', 'carrier'],
        default: ''
    },
    shippingMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
    timestamps: true,
    toJSON: {
        transform: (_doc, value) => {
            delete value.guestAccessTokenHash;
            return value;
        }
    }
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

orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ shippingStatus: 1 });
orderSchema.index({ shipper: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ totalAmount: 1 });

module.exports = mongoose.model('Order', orderSchema);
