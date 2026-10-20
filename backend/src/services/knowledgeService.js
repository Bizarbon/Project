const KnowledgeArticle = require('../models/KnowledgeArticle');

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function termsFromMessage(message) {
    return normalize(message)
        .split(/[^a-z0-9]+/i)
        .filter(term => term.length >= 3)
        .slice(0, 12);
}

async function findKnowledgeArticle(message, options = {}) {
    const terms = termsFromMessage(message);
    if (!terms.length) return null;

    const query = {
        active: true,
        ...(options.type ? { type: options.type } : {}),
        $or: [
            { keywords: { $in: terms } },
            { title: { $regex: terms.join('|'), $options: 'i' } },
            { answer: { $regex: terms.join('|'), $options: 'i' } }
        ]
    };

    const articles = await KnowledgeArticle.find(query)
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean();

    if (!articles.length) return null;
    const scored = articles.map(article => {
        const haystack = normalize(`${article.title} ${(article.keywords || []).join(' ')} ${article.answer}`);
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { article, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].article : null;
}

module.exports = { findKnowledgeArticle, termsFromMessage };
