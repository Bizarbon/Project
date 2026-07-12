const mongoose = require('mongoose');
const Counter = require('./Counter');

const expenseSchema = new mongoose.Schema({
    _id: { type: Number },
    type: {
        type: String,
        enum: ['ads', 'packaging', 'platform_fee', 'shipping_fee', 'import_cost', 'other'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true
});

expenseSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'expenseId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('Expense', expenseSchema);
