const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

async function refreshProductRating(productId) {
    const reviews = await Review.find({ product: productId, status: 'visible' });
    const reviewCount = reviews.length;
    const rating = reviewCount
        ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
        : 0;
    await Product.findByIdAndUpdate(productId, { rating, reviewCount }, { runValidators: true });
}

async function hasPurchased(customerId, productId) {
    const order = await Order.findOne({
        customer: customerId,
        status: 'completed',
        'products.product': Number(productId)
    });
    return Boolean(order);
}

router.get('/product/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({
            product: Number(req.params.productId),
            status: 'visible'
        }).populate('customer', 'name').sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/product/:productId', protect, async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5!' });
        }

        const verifiedPurchase = await hasPurchased(req.user._id, productId);
        let review = await Review.findOne({ product: productId, customer: req.user._id });
        if (!review) {
            review = new Review({
                product: productId,
                customer: req.user._id
            });
        }

        review.customerName = req.user.name;
        review.rating = rating;
        review.title = String(req.body.title || '').trim();
        review.comment = String(req.body.comment || '').trim();
        review.verifiedPurchase = verifiedPurchase;
        review.status = 'visible';
        await review.save();

        await refreshProductRating(productId);
        res.status(201).json(review);
    } catch (error) {
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.get('/', protect, admin, async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('product', 'name')
            .populate('customer', 'name')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id/status', protect, admin, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });
        review.status = req.body.status === 'hidden' ? 'hidden' : 'visible';
        await review.save();
        await refreshProductRating(review.product);
        res.json(review);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
