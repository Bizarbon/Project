const KnowledgeArticle = require('../models/KnowledgeArticle');
const { ensureKnowledgeBaseSeeded, expandVietnameseQueryTerms } = require('./ragService');

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

const STOPWORDS = new Set([
    'cho', 'cua', 'khong', 'co', 'khach', 'hang', 'may', 'nay', 'kia', 'bao', 'gia',
    'voi', 'nhu', 'lam', 'sao', 'duoc', 'nhung', 'cac', 'mot', 'hai', 'minh', 'ban',
    'shop', 'em', 'anh', 'chi', 'toi', 'mua', 'can', 'tim', 'tu', 'van', 'giup',
    'xem', 'hoi', 'gi', 'nao', 'dau', 'the', 've', 'va', 'hay', 'hoac', 'tren',
    'duoi', 'tam', 'thu', 'nhieu', 'con', 'khac', 'loai', 'thich', 'nhat', 'nhi'
]);

function termsFromMessage(message) {
    return normalize(message)
        .split(/[^a-z0-9]+/i)
        .filter(term => term.length >= 2 && !STOPWORDS.has(term))
        .slice(0, 16);
}

async function findKnowledgeArticle(message, options = {}) {
    await ensureKnowledgeBaseSeeded();
    const rawTerms = termsFromMessage(message);
    if (!rawTerms.length) return null;

    const query = {
        active: true,
        ...(options.type ? { type: options.type } : {})
    };

    const articles = await KnowledgeArticle.find(query)
        .sort({ updatedAt: -1 })
        .limit(60)
        .lean();

    if (!articles.length) return null;
    const normMsg = normalize(message);
    const scored = articles.map(article => {
        const titleNorm = normalize(article.title);
        const kwNorm = normalize((article.keywords || []).join(' '));
        let titleOrKwScore = 0;

        rawTerms.forEach(term => {
            if (titleNorm.includes(term)) titleOrKwScore += 4;
            else if (kwNorm.includes(term)) titleOrKwScore += 3;
        });

        (article.keywords || []).forEach(kw => {
            const k = normalize(kw);
            if (k.length >= 5 && normMsg.includes(k)) titleOrKwScore += 8;
        });

        return { article, score: titleOrKwScore };
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.score >= 7 ? scored[0].article : null;
}

module.exports = { findKnowledgeArticle, termsFromMessage };
