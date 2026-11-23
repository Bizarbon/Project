const mongoose = require('mongoose');
const Counter = require('./Counter');

const staffMemberSchema = new mongoose.Schema({
    _id: { type: Number },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        default: 'Bán hàng',
        trim: true
    },
    position: {
        type: String,
        default: 'Nhân viên tư vấn',
        trim: true
    },
    shift: {
        type: String,
        default: 'Toàn thời gian',
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'leave', 'locked'],
        default: 'active'
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    rolePreset: {
        type: String,
        default: 'custom',
        trim: true
    },
    permissions: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

staffMemberSchema.pre('save', async function () {
    if (this.isNew && (this._id === undefined || this._id === null)) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: 'staffMemberId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
});

module.exports = mongoose.model('StaffMember', staffMemberSchema);
