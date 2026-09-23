const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../src/models/Product');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce_mini');
        const products = await Product.find({}, '_id sku name category brand videoUrl').sort({ _id: 1 });
        console.log('TOTAL_PRODUCTS:' + products.length);
        products.forEach(p => {
            console.log(`[${p._id}] [${p.sku}] [${p.category}] "${p.name}" => ${p.videoUrl || 'NONE'}`);
        });
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
})();
