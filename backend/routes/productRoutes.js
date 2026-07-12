const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { protect, admin } = require('../middleware/auth');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productSort(sort) {
    const map = {
        price_asc: { price: 1 },
        price_desc: { price: -1 },
        stock_asc: { stock: 1 },
        stock_desc: { stock: -1 },
        newest: { createdAt: -1 },
        rating: { rating: -1, reviewCount: -1 },
        best_seller: { soldCount: -1 },
        name: { name: 1 }
    };
    return map[sort] || { featured: -1, _id: 1 };
}

function compactString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function splitList(value) {
    if (Array.isArray(value)) return value.map(compactString).filter(Boolean);
    if (!value) return [];
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeSpecs(value = {}) {
    const allowed = ['cpu', 'ram', 'storage', 'screen', 'camera', 'battery', 'os', 'gpu', 'connectivity', 'weight'];
    const specs = {};
    for (const key of allowed) {
        specs[key] = compactString(value[key] || '');
    }
    return specs;
}

function normalizeVariants(value = []) {
    if (!Array.isArray(value)) return [];
    return value
        .map(variant => ({
            sku: compactString(variant.sku || ''),
            color: compactString(variant.color || ''),
            ram: compactString(variant.ram || ''),
            storage: compactString(variant.storage || ''),
            price: Math.max(Number(variant.price) || 0, 0),
            stock: Math.max(Number(variant.stock) || 0, 0)
        }))
        .filter(variant => variant.color || variant.ram || variant.storage || variant.sku);
}

async function resolveSupplier(supplier) {
    if (!supplier) return null;
    if (typeof supplier === 'object' && supplier._id) return supplier._id;
    if (typeof supplier === 'string' && isNaN(supplier)) {
        let foundSupplier = await Supplier.findOne({
            name: { $regex: new RegExp(`^${escapeRegex(supplier)}$`, 'i') }
        });
        if (!foundSupplier) foundSupplier = await new Supplier({ name: supplier }).save();
        return foundSupplier._id;
    }
    return supplier;
}

async function normalizeProductPayload(body, existingProduct = null) {
    const payload = {
        name: compactString(body.name),
        sku: compactString(body.sku || ''),
        brand: compactString(body.brand || ''),
        price: Number(body.price),
        compareAtPrice: Math.max(Number(body.compareAtPrice) || 0, 0),
        description: compactString(body.description || ''),
        category: compactString(body.category),
        stock: Math.max(Number(body.stock) || 0, 0),
        image: compactString(body.image || ''),
        images: splitList(body.images),
        supplier: await resolveSupplier(body.supplier),
        minStock: Math.max(Number(body.minStock) || 5, 0),
        warranty: compactString(body.warranty || 'Không bảo hành'),
        specs: normalizeSpecs(body.specs || {}),
        variants: normalizeVariants(body.variants || []),
        tags: splitList(body.tags),
        rating: Math.min(Math.max(Number(body.rating) || 0, 0), 5),
        reviewCount: Math.max(Number(body.reviewCount) || 0, 0),
        soldCount: Math.max(Number(body.soldCount) || 0, 0),
        featured: Boolean(body.featured),
        active: body.active === undefined ? true : Boolean(body.active)
    };

    if (!payload.name) {
        const error = new Error('Tên sản phẩm là bắt buộc!');
        error.statusCode = 400;
        throw error;
    }
    if (!payload.category) {
        const error = new Error('Danh mục là bắt buộc!');
        error.statusCode = 400;
        throw error;
    }
    if (!Number.isFinite(payload.price) || payload.price < 0) {
        const error = new Error('Giá sản phẩm không hợp lệ!');
        error.statusCode = 400;
        throw error;
    }

    if (!payload.image && payload.images.length) payload.image = payload.images[0];
    if (payload.image && !payload.images.includes(payload.image)) payload.images.unshift(payload.image);
    if (!payload.sku) delete payload.sku;
    if (existingProduct && payload.active === undefined) payload.active = existingProduct.active;

    return payload;
}

// GET product metadata for filters/forms
router.get('/meta/options', async (req, res) => {
    try {
        const [categories, brands, tags] = await Promise.all([
            Product.distinct('category', { active: { $ne: false } }),
            Product.distinct('brand', { active: { $ne: false }, brand: { $ne: '' } }),
            Product.distinct('tags', { active: { $ne: false } })
        ]);

        res.json({
            categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')),
            brands: brands.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')),
            tags: tags.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET products with optional filters
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (!req.user?.isAdmin) filter.active = { $ne: false };
        if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
        if (req.query.brand && req.query.brand !== 'all') filter.brand = req.query.brand;
        if (req.query.featured === 'true') filter.featured = true;
        if (req.query.tag) filter.tags = req.query.tag;
        if (req.query.search) {
            const regex = new RegExp(escapeRegex(req.query.search), 'i');
            filter.$or = [
                { name: regex },
                { description: regex },
                { category: regex },
                { brand: regex },
                { sku: regex },
                { tags: regex }
            ];
        }
        if (req.query.inStock === 'true') filter.stock = { ...(filter.stock || {}), $gt: 0 };
        if (req.query.minPrice) filter.price = { ...(filter.price || {}), $gte: Number(req.query.minPrice) };
        if (req.query.maxPrice) filter.price = { ...(filter.price || {}), $lte: Number(req.query.maxPrice) };

        const products = await Product.find(filter)
            .populate('supplier', 'name')
            .sort(productSort(req.query.sort));
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('supplier', 'name');
        if (!product || product.active === false) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create product (Admin only)
router.post('/', protect, admin, async (req, res) => {
    try {
        const payload = await normalizeProductPayload(req.body);
        const existing = await Product.findOne({ name: payload.name });
        if (existing) return res.status(400).json({ message: 'Đã có sản phẩm này!' });
        if (payload.sku && await Product.findOne({ sku: payload.sku })) {
            return res.status(400).json({ message: 'SKU đã tồn tại!' });
        }

        const newProduct = await new Product(payload).save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// PUT update product (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const current = await Product.findById(req.params.id);
        if (!current) return res.status(404).json({ message: 'Product not found' });

        const payload = await normalizeProductPayload(req.body, current);
        const duplicateName = await Product.findOne({ name: payload.name, _id: { $ne: Number(req.params.id) } });
        if (duplicateName) return res.status(400).json({ message: 'Đã có sản phẩm này!' });
        if (payload.sku) {
            const duplicateSku = await Product.findOne({ sku: payload.sku, _id: { $ne: Number(req.params.id) } });
            if (duplicateSku) return res.status(400).json({ message: 'SKU đã tồn tại!' });
        }

        Object.keys(payload).forEach(key => {
            current[key] = payload[key];
        });
        const updatedProduct = await current.save();
        res.json(updatedProduct);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

// DELETE product (Admin only)
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted successfully', deletedId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
