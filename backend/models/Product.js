const mongoose = require('mongoose');
const Counter = require('./Counter');

const productSchema = new mongoose.Schema({
    _id: { type: Number },
    sku: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: String,
        trim: true,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    compareAtPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    image: {
        type: String,
        default: 'https://via.placeholder.com/200'
    },
    images: [{
        type: String,
        trim: true
    }],
    supplier: {
        type: Number,
        ref: 'Supplier',
        default: null
    },
    minStock: {
        type: Number,
        default: 5,
        min: 0
    },
    warranty: {
        type: String,
        default: 'Không bảo hành'
    },
    specs: {
        cpu: { type: String, default: '' },
        ram: { type: String, default: '' },
        storage: { type: String, default: '' },
        screen: { type: String, default: '' },
        camera: { type: String, default: '' },
        battery: { type: String, default: '' },
        os: { type: String, default: '' },
        gpu: { type: String, default: '' },
        connectivity: { type: String, default: '' },
        weight: { type: String, default: '' }
    },
    variants: [{
        sku: { type: String, default: '' },
        color: { type: String, default: '' },
        ram: { type: String, default: '' },
        storage: { type: String, default: '' },
        price: { type: Number, default: 0, min: 0 },
        stock: { type: Number, default: 0, min: 0 }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0,
        min: 0
    },
    soldCount: {
        type: Number,
        default: 0,
        min: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

productSchema.pre('save', async function() {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            'productId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }

    if (!this.sku && this._id) {
        this.sku = `TECH-${String(this._id).padStart(5, '0')}`;
    }

    if ((!this.images || this.images.length === 0) && this.image) {
        this.images = [this.image];
    }
});

module.exports = mongoose.model('Product', productSchema);
