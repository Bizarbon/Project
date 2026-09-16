const mongoose = require('mongoose');
const Counter = require('./Counter');

const supplierSchema = new mongoose.Schema({
    _id: { type: Number },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    deliveryTime: {
        type: Number,  // số ngày giao hàng trung bình
        default: 3,
        min: 0
    },
    returnPolicy: {
        type: String,
        enum: ['no_return', '7_days', '15_days', '30_days', 'negotiable'],
        default: 'no_return'
    },
    notes: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true
});

supplierSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'supplierId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Supplier', supplierSchema);
