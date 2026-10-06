const mongoose = require('mongoose');

const messageSubSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    products: {
        type: Array,
        default: []
    },
    isImage: {
        type: Boolean,
        default: false
    },
    imageUrl: {
        type: String,
        default: ''
    },
    intent: {
        type: String,
        default: ''
    }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
    sessionKey: {
        type: String,
        required: true,
        index: true
    },
    customerId: {
        type: Number,
        ref: 'Customer',
        required: false
    },
    customerName: {
        type: String,
        required: true,
        default: 'Khách hàng'
    },
    customerPhone: {
        type: String,
        default: ''
    },
    customerEmail: {
        type: String,
        default: ''
    },
    isMember: {
        type: Boolean,
        default: false
    },
    intentSummary: {
        type: String,
        default: 'Tư vấn sản phẩm công nghệ'
    },
    interestedCategory: {
        type: String,
        default: 'all'
    },
    budgetRange: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'needs_agent'],
        default: 'active'
    },
    messages: [messageSubSchema]
}, {
    timestamps: true
});

chatSessionSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
