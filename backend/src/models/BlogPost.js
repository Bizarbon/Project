const mongoose = require('mongoose');
const Counter = require('./Counter');

const blogPostSchema = new mongoose.Schema({
    _id: { type: Number },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    slug: { type: String, trim: true, lowercase: true, index: true },
    category: { type: String, required: true, trim: true, default: 'Tin tức' },
    author: { type: String, trim: true, default: 'TechEcommerce Editorial' },
    excerpt: { type: String, trim: true, default: '', maxlength: 600 },
    content: { type: String, required: true, trim: true },
    image: { type: String, trim: true, default: '' },
    tags: [{ type: String, trim: true }],
    status: {
        type: String,
        enum: ['published', 'draft'],
        default: 'published',
        index: true
    },
    views: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

blogPostSchema.pre('save', async function() {
    if (this.isNew && !this._id) {
        const counter = await Counter.findByIdAndUpdate(
            'blogPostId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this._id = counter.seq;
    }
    if (!this.slug && this.title) {
        this.slug = String(this.title)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 90) + `-${this._id || Date.now()}`;
    }
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
