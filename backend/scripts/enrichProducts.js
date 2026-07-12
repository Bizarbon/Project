require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');

const BRAND_RULES = [
    { test: /iphone|ipad|macbook|airpods|apple pencil|magic keyboard|apple watch/i, brand: 'Apple' },
    { test: /samsung|galaxy/i, brand: 'Samsung' },
    { test: /sony/i, brand: 'Sony' },
    { test: /google|pixel/i, brand: 'Google' },
    { test: /oppo/i, brand: 'OPPO' },
    { test: /xiaomi|redmi/i, brand: 'Xiaomi' },
    { test: /dell|xps/i, brand: 'Dell' },
    { test: /asus|rog/i, brand: 'ASUS' },
    { test: /thinkpad|lenovo/i, brand: 'Lenovo' },
    { test: /logitech/i, brand: 'Logitech' },
    { test: /keychron/i, brand: 'Keychron' },
    { test: /anker/i, brand: 'Anker' }
];

function detectBrand(product) {
    const text = `${product.name || ''} ${product.description || ''}`;
    return BRAND_RULES.find(rule => rule.test.test(text))?.brand || product.brand || 'TechStore Select';
}

function makeSku(product, brand) {
    const prefix = brand
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 4)
        .toUpperCase()
        .padEnd(4, 'X');
    return `${prefix}-${String(product._id).padStart(5, '0')}`;
}

function specsFor(product, brand) {
    const name = product.name || '';
    const desc = product.description || '';
    const category = String(product.category || '').toLowerCase();

    if (category.includes('điện thoại')) {
        return {
            cpu: desc.match(/A\d+ Pro|Snapdragon [^,]+|Tensor [^,]+|Dimensity [^,]+/i)?.[0] || 'Chip hiệu năng cao',
            ram: brand === 'Apple' ? '8GB' : '12GB',
            storage: name.includes('Pro Max') ? '256GB' : '128GB',
            screen: desc.match(/AMOLED|OLED|2K/i)?.[0] || 'OLED/AMOLED 120Hz',
            camera: desc.match(/camera [^,]+|48MP|200MP/i)?.[0] || 'Camera đa ống kính',
            battery: 'Pin dùng cả ngày',
            os: brand === 'Apple' ? 'iOS' : 'Android',
            connectivity: '5G, Wi-Fi, Bluetooth'
        };
    }

    if (category.includes('laptop')) {
        return {
            cpu: desc.match(/M\d+[^,]*|Intel [^,]+|Core [^,]+|Ryzen [^,]+/i)?.[0] || 'CPU hiệu năng cao',
            ram: desc.match(/RAM [^,]+/i)?.[0]?.replace(/^RAM\s*/i, '') || '16GB',
            storage: desc.match(/SSD [^,]+/i)?.[0]?.replace(/^SSD\s*/i, '') || '512GB SSD',
            screen: desc.match(/OLED [^,]+|Retina [^,]+|240Hz [^,]*/i)?.[0] || 'Màn hình Full HD/2K',
            gpu: desc.match(/RTX [^,]+/i)?.[0] || '',
            os: brand === 'Apple' ? 'macOS' : 'Windows 11',
            weight: desc.match(/\d+(\.\d+)?kg/i)?.[0] || ''
        };
    }

    if (category.includes('tablet')) {
        return {
            cpu: desc.match(/M\d+|A\d+|Snapdragon [^,]+/i)?.[0] || 'Chip tiết kiệm pin',
            storage: '128GB',
            screen: desc.match(/OLED [^,]+|Retina [^,]+|AMOLED [^,]+/i)?.[0] || 'Màn hình cảm ứng sắc nét',
            battery: 'Pin dùng cả ngày',
            os: brand === 'Apple' ? 'iPadOS' : 'Android'
        };
    }

    if (category.includes('tai nghe')) {
        return {
            connectivity: 'Bluetooth',
            battery: desc.match(/\d+ giờ pin/i)?.[0] || 'Pin dùng nhiều giờ',
            camera: '',
            os: 'Tương thích iOS/Android/Windows',
            weight: 'Thiết kế di động'
        };
    }

    return {
        connectivity: desc.match(/USB-C|Bluetooth|Wi-Fi/i)?.[0] || 'Tùy sản phẩm',
        battery: desc.match(/\d+mAh|PD \d+W/i)?.[0] || '',
        screen: desc.match(/4K|HDR10|OLED/i)?.[0] || '',
        os: ''
    };
}

function tagsFor(product, brand) {
    const tags = new Set([brand, product.category].filter(Boolean));
    const text = `${product.name} ${product.description}`.toLowerCase();
    if (/gaming|rog|rtx|240hz/.test(text)) tags.add('gaming');
    if (/pro|max|ultra|xps/.test(text)) tags.add('cao cấp');
    if (/air|mini|carbon|nhẹ|mỏng/.test(text)) tags.add('mỏng nhẹ');
    if (/camera|48mp|200mp|leica|hasselblad/.test(text)) tags.add('camera tốt');
    if (/sinh viên|office|keyboard|mouse|phụ kiện/i.test(text)) tags.add('phụ kiện');
    return [...tags];
}

function mergeSpecs(generated, current = {}) {
    const merged = { ...generated };
    for (const [key, value] of Object.entries(current || {})) {
        if (typeof value === 'string' && value.trim()) {
            merged[key] = value.trim();
        }
    }
    return merged;
}

async function enrichProducts() {
    await connectDB();
    const products = await Product.find();

    for (const product of products) {
        const brand = product.brand || detectBrand(product);
        product.brand = brand;
        product.sku = product.sku || makeSku(product, brand);
        product.images = product.images?.length ? product.images : [product.image].filter(Boolean);
        product.compareAtPrice = product.compareAtPrice || Math.round(product.price * 1.08 / 10000) * 10000;
        product.specs = mergeSpecs(specsFor(product, brand), product.specs);
        product.tags = product.tags?.length ? product.tags : tagsFor(product, brand);
        product.rating = product.rating || Number((4.4 + (product._id % 6) / 10).toFixed(1));
        product.reviewCount = product.reviewCount || 24 + product._id * 3;
        product.soldCount = product.soldCount || 30 + product._id * 7;
        product.featured = product.featured || product._id % 5 === 0 || /pro|max|ultra|rog/i.test(product.name);
        product.active = product.active !== false;
        await product.save();
    }

    console.log(`Enriched ${products.length} products for TechStore.`);
    process.exit(0);
}

enrichProducts().catch(error => {
    console.error(error);
    process.exit(1);
});
