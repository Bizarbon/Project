require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const API = 'https://www.googleapis.com/youtube/v3/search';
const key = (process.env.YOUTUBE_API_KEY || '').trim();
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = value => normalize(value).split(/\s+/).filter(t => t.length > 1);

function score(product, item) {
    const title = normalize(item.snippet?.title);
    const name = tokens(product.name);
    const brand = normalize(product.brand);
    const model = name.filter(t => !['dien','thoai','laptop','tai','nghe','dong','ho','thong','minh','may','tinh','bang','phu','kien'].includes(t));
    const matched = model.filter(t => title.includes(t)).length;
    const brandHit = brand && title.includes(brand) ? 2 : 0;
    return matched * 3 + brandHit;
}

async function search(product) {
    const query = `${product.brand || ''} ${product.name} review`;
    const url = `${API}?part=snippet&type=video&maxResults=5&order=relevance&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube ${response.status}`);
    const data = await response.json();
    const ranked = (data.items || []).map(item => ({ item, score: score(product, item) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 6) return null;
    return `https://www.youtube.com/embed/${best.item.id.videoId}`;
}

async function main() {
    if (!key) throw new Error('YOUTUBE_API_KEY is missing');
    await mongoose.connect(process.env.MONGO_URI);
    const products = await Product.find({ active: { $ne: false } }).sort({ _id: 1 });
    let linked = 0, skipped = 0;
    for (const product of products) {
        try {
            const videoUrl = await search(product);
            if (!videoUrl) { skipped++; console.log(`[skip] ${product.name}`); continue; }
            await Product.updateOne({ _id: product._id }, { $set: { videoUrl } });
            linked++; console.log(`[ok] ${product.name} -> ${videoUrl}`);
        } catch (error) {
            skipped++; console.error(`[error] ${product.name}: ${error.message}`);
        }
    }
    console.log(`Done: linked=${linked}, skipped=${skipped}, total=${products.length}`);
    await mongoose.disconnect();
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
