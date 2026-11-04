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
    hearingAidProfile: {
        designType: { type: String, default: '' },
        audioFeatures: [{ type: String, trim: true }],
        bluetoothCompatibility: { type: String, default: '' },
        batteryCharging: { type: String, default: '' },
        technicalSpecs: {
            db: { type: String, default: '' },
            khz: { type: String, default: '' },
            channels: { type: String, default: '' }
        },
        manufacturer: { type: String, default: '' },
        responsibleEntity: { type: String, default: '' },
        medicalDeviceClassification: { type: String, default: '' },
        circulationNumber: { type: String, default: '' },
        declarationNumber: { type: String, default: '' },
        requiredDocuments: [{
            name: { type: String, trim: true },
            reference: { type: String, trim: true },
            verified: { type: Boolean, default: false }
        }],
        instructionManualUrl: { type: String, default: '' },
        technicalDocumentUrl: { type: String, default: '' },
        verificationStatus: {
            type: String,
            enum: ['not_applicable', 'pending', 'verified', 'rejected'],
            default: 'not_applicable'
        },
        verifiedAt: { type: Date, default: null },
        verifiedBy: { type: String, default: '' }
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    image: {
        type: String,
        default: '/assets/images/product-placeholder.svg'
    },
    images: [{
        type: String,
        trim: true
    }],
    videoUrl: {
        type: String,
        trim: true,
        default: ''
    },
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
        default: 'Chưa có thông tin'
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
        colorHex: { type: String, default: '' },
        image: { type: String, default: '' },
        compareAtPrice: { type: Number, default: 0 },
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
    },
    sourceUrl: {
        type: String,
        trim: true,
        default: ''
    },
    originalImageUrl: {
        type: String,
        trim: true,
        default: ''
    },
    sourceFetchedAt: {
        type: Date,
        default: null
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
