const Order = require('../models/Order');
const Product = require('../models/Product');

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function increment(map, key, amount = 1) {
    const normalized = normalizeText(key);
    if (normalized) map.set(normalized, (map.get(normalized) || 0) + amount);
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productWords(product) {
    return normalizeText([
        product.name,
        product.brand,
        product.category,
        product.description,
        ...(product.tags || []),
        ...Object.values(product.specs || {})
    ].join(' '));
}

async function buildPreferenceProfile(user) {
    const categoryWeights = new Map();
    const brandWeights = new Map();
    const purchasedIds = new Set();

    if (!user?._id) return { categoryWeights, brandWeights, purchasedIds };

    const [orders, wishlistProducts] = await Promise.all([
        Order.find({
            customer: user._id,
            status: { $nin: ['cancelled', 'returned', 'boom'] }
        }).sort({ createdAt: -1 }).limit(20).select('products'),
        Product.find({ _id: { $in: user.wishlist || [] }, active: { $ne: false } })
            .select('category brand')
    ]);

    const orderedIds = [];
    orders.forEach(order => {
        (order.products || []).forEach(item => {
            const id = Number(item.product);
            if (id) {
                purchasedIds.add(id);
                orderedIds.push(id);
            }
        });
    });

    const orderedProducts = await Product.find({ _id: { $in: [...new Set(orderedIds)] } })
        .select('category brand');
    orderedProducts.forEach(product => {
        increment(categoryWeights, product.category, 4);
        increment(brandWeights, product.brand, 3);
    });
    wishlistProducts.forEach(product => {
        increment(categoryWeights, product.category, 2);
        increment(brandWeights, product.brand, 1.5);
    });

    return { categoryWeights, brandWeights, purchasedIds };
}

function recommendationReason(product, signals) {
    if (signals.requirementMatch) return signals.requirementReason;
    if (signals.priorityRequested && signals.overBudget) return `Vượt ngân sách; cần xác minh ${signals.priorityLabel}`;
    if (signals.priorityRequested) return `Lựa chọn gần nhất; cần xác minh ${signals.priorityLabel}`;
    if (signals.overBudget) return 'Lựa chọn gần nhất nhưng vượt ngân sách';
    if (signals.referenceCategory) return `Tương tự ${signals.referenceCategory}`;
    if (signals.preferredCategory) return `Phù hợp sở thích ${product.category}`;
    if (signals.preferredBrand) return `Thương hiệu bạn quan tâm`;
    if (signals.searchMatch) return `Khớp nhu cầu bạn mô tả`;
    if (signals.budgetMatch) return `Phù hợp ngân sách`;
    if (product.featured) return `Sản phẩm nổi bật`;
    if (Number(product.soldCount) > 0) return `Được nhiều khách hàng lựa chọn`;
    return `Đánh giá tốt và đang còn hàng`;
}

async function recommendProducts({
    user = null,
    limit = 6,
    category = '',
    maxPrice = 0,
    referenceProductId = null,
    search = '',
    requirements = null
} = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 12);
    const priceLimit = Math.max(Number(maxPrice) || 0, 0);
    const filter = { active: { $ne: false }, stock: { $gt: 0 } };
    if (category) filter.category = { $regex: `^${escapeRegex(category)}$`, $options: 'i' };
    if (priceLimit) filter.price = { $lte: priceLimit };

    const [products, preferences, referenceProduct] = await Promise.all([
        Product.find(filter).limit(250),
        buildPreferenceProfile(user),
        referenceProductId ? Product.findById(referenceProductId) : null
    ]);
    const searchTerms = normalizeText(search).split(/\s+/).filter(term => term.length > 1);

    return products
        .filter(product => !referenceProduct || Number(product._id) !== Number(referenceProduct._id))
        .map(product => {
            const categoryKey = normalizeText(product.category);
            const brandKey = normalizeText(product.brand);
            const words = productWords(product);
            const priority = normalizeText(requirements?.priority || '');
            const warrantyAvailable = Boolean(product.warranty && normalizeText(product.warranty) !== 'khong bao hanh');
            const requirementChecks = [
                { match: priority.includes('do ben') && warrantyAvailable, reason: `Có thông tin bảo hành ${product.warranty}` },
                { match: priority.includes('pin') && Boolean(product.specs?.battery), reason: `Có thông tin pin: ${product.specs?.battery}` },
                { match: priority.includes('hieu nang') && Boolean(product.specs?.cpu || product.specs?.ram || product.specs?.gpu), reason: 'Có cấu hình hiệu năng để đối chiếu' },
                { match: priority.includes('camera') && Boolean(product.specs?.camera), reason: `Có thông tin camera: ${product.specs?.camera}` },
                { match: priority.includes('man hinh') && Boolean(product.specs?.screen), reason: `Có thông tin màn hình: ${product.specs?.screen}` },
                { match: priority.includes('nhe') && Boolean(product.specs?.weight), reason: `Có thông tin khối lượng: ${product.specs?.weight}` }
            ];
            const requirement = requirementChecks.find(item => item.match);
            const signals = {
                preferredCategory: preferences.categoryWeights.has(categoryKey),
                preferredBrand: preferences.brandWeights.has(brandKey),
                referenceCategory: referenceProduct && normalizeText(referenceProduct.category) === categoryKey,
                budgetMatch: Boolean(priceLimit && product.price <= priceLimit),
                searchMatch: searchTerms.length > 0 && searchTerms.some(term => words.includes(term)),
                requirementMatch: Boolean(requirement),
                requirementReason: requirement?.reason || '',
                priorityRequested: Boolean(priority && !requirement),
                priorityLabel: String(requirements?.priority || 'ưu tiên đã chọn'),
                overBudget: Boolean(Number(requirements?.budget || priceLimit) && product.price > Number(requirements?.budget || priceLimit))
            };

            let score = Number(product.rating || 0) * 1.6;
            score += Math.log10(Number(product.soldCount || 0) + 1) * 2;
            score += product.featured ? 2.5 : 0;
            score += Math.min(Number(product.stock || 0) / 20, 2);
            score += Math.min(preferences.categoryWeights.get(categoryKey) || 0, 12);
            score += Math.min(preferences.brandWeights.get(brandKey) || 0, 8);
            score += signals.referenceCategory ? 8 : 0;
            score += referenceProduct && normalizeText(referenceProduct.brand) === brandKey ? 4 : 0;
            score += signals.searchMatch ? 7 : 0;
            score += signals.budgetMatch ? 2 : 0;
            score += signals.requirementMatch ? 4 : 0;
            score -= preferences.purchasedIds.has(Number(product._id)) ? 1.5 : 0;

            const result = product.toObject();
            result.recommendation = {
                score: Math.round(score * 10) / 10,
                reason: recommendationReason(product, signals)
            };
            return result;
        })
        .sort((a, b) => b.recommendation.score - a.recommendation.score || b.rating - a.rating)
        .slice(0, safeLimit);
}

module.exports = { recommendProducts };
