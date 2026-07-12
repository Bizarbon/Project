require('dotenv').config();
const connectDB = require('../config/db');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

async function refreshProductRating(productId) {
    const reviews = await Review.find({ product: productId, status: 'visible' });
    const reviewCount = reviews.length;
    const rating = reviewCount
        ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
        : 0;
    await Product.findByIdAndUpdate(productId, { rating, reviewCount }, { runValidators: true });
}

async function upsertCoupon(data) {
    await Coupon.deleteMany({ code: data.code });
    await new Coupon(data).save();
}

async function seed() {
    await connectDB();

    await upsertCoupon({
        code: 'TECH10',
        name: 'Giảm 10% cho đơn công nghệ',
        type: 'percent',
        value: 10,
        minOrderValue: 5000000,
        maxDiscount: 1500000,
        usageLimit: 200,
        active: true
    });
    await upsertCoupon({
        code: 'FREESHIP',
        name: 'Hỗ trợ phí vận chuyển',
        type: 'fixed',
        value: 30000,
        minOrderValue: 1000000,
        maxDiscount: 30000,
        usageLimit: 500,
        active: true
    });
    await upsertCoupon({
        code: 'LAPTOP500',
        name: 'Giảm 500K cho laptop',
        type: 'fixed',
        value: 500000,
        minOrderValue: 20000000,
        usageLimit: 100,
        active: true
    });

    const [product, customer] = await Promise.all([
        Product.findOne().sort({ _id: 1 }),
        Customer.findOne().sort({ _id: 1 })
    ]);

    if (product && customer) {
        await Review.deleteMany({ product: product._id, customer: customer._id });
        const review = new Review({ product: product._id, customer: customer._id });
        review.customerName = customer.name;
        review.rating = 5;
        review.title = 'Sản phẩm tốt, giao diện đặt hàng rõ ràng';
        review.comment = 'Máy đúng mô tả, giá hiển thị minh bạch và checkout có mã giảm giá rất tiện.';
        review.verifiedPurchase = true;
        review.status = 'visible';
        await review.save();
        await refreshProductRating(product._id);
    }

    console.log('Seeded coupons and sample reviews.');
    process.exit(0);
}

seed().catch(error => {
    console.error(error);
    process.exit(1);
});
