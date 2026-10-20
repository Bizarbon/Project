const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    type: {
        type: String,
        enum: ['faq', 'policy', 'guide', 'compatibility'],
        default: 'faq',
        index: true
    },
    category: { type: String, default: 'all', index: true },
    keywords: [{ type: String, trim: true, lowercase: true }],
    answer: { type: String, required: true, trim: true },
    source: { type: String, default: 'admin', trim: true },
    active: { type: Boolean, default: true, index: true },
    updatedBy: { type: Number, ref: 'Customer', default: null }
}, { timestamps: true });

knowledgeArticleSchema.index({ keywords: 1, active: 1 });
knowledgeArticleSchema.index({ title: 'text', answer: 'text', keywords: 'text' });

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
