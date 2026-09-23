const https = require('https');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../src/models/Product');
const fs = require('fs');

function getCleanSearchTerm(p) {
    let name = p.name;
    // Bỏ các từ khóa tiền tố danh mục
    name = name.replace(/^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ thông minh|Đồng hồ thể thao|Máy chơi game cầm tay|Máy chơi game|Tai nghe không dây|Tai nghe chụp tai|Tai nghe Bluetooth True Wireless|Tai nghe Bluetooth chụp tai|Tai nghe Bluetooth|Tai nghe|Pin sạc dự phòng|Chuột không dây|Chuột Gaming|Kính thực tế ảo|Tay Cầm Không Dây|Tay cầm không dây|Hub chuyển đổi)\s+/i, '');
    
    // Bỏ các hậu tố không cần thiết
    name = name.replace(/\b(Wi-Fi|Wifi|5G|LTE|Chính hãng|VN\/A|Model White|Turquoise|Robot White|Black|Standard|Creator Combo|Kèm Bàn Phím|Digital Display)\b/gi, '');
    name = name.replace(/\b\d+GB\b/gi, '');
    name = name.replace(/\b\d+TB\b/gi, '');
    name = name.replace(/\s+/g, ' ').trim();

    return `site:youtube.com ${name} review đánh giá`;
}

function searchDDG(query) {
    return new Promise((resolve) => {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const regex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g;
                const matches = [];
                let m;
                while ((m = regex.exec(data)) !== null) {
                    if (!matches.includes(m[1])) matches.push(m[1]);
                }
                resolve(matches);
            });
        });
        req.on('error', () => resolve([]));
        req.setTimeout(8000, () => { req.destroy(); resolve([]); });
    });
}

function checkYouTubeVideo(id) {
    return new Promise((resolve) => {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve({ ok: true, id, title: json.title, author: json.author_name });
                    } catch (e) {
                        resolve({ ok: false, id });
                    }
                } else {
                    resolve({ ok: false, id });
                }
            });
        });
        req.on('error', () => resolve({ ok: false, id }));
        req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false, id }); });
    });
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce_mini');
        const products = await Product.find({}, '_id sku name category brand videoUrl').sort({ _id: 1 });
        console.log(`Starting DDG video search for ${products.length} products...`);

        const videoMap = {};

        // Load existing matches if any
        const outPath = path.join(__dirname, 'matched_videos.json');
        if (fs.existsSync(outPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
                Object.assign(videoMap, existing);
            } catch (e) {}
        }

        for (let i = 0; i < products.length; i++) {
            const p = products[i];

            // Nếu sản phẩm đã có video match tốt và đúng tên thì có thể kiểm tra hoặc skip
            if (videoMap[p._id] && videoMap[p._id].youtubeTitle && !videoMap[p._id].youtubeTitle.toLowerCase().includes('asus tuf') && p.sku !== 'TECH-00018') {
                console.log(`[${i + 1}/${products.length}] ${p.sku} ALREADY MATCHED: ${videoMap[p._id].embedUrl} - "${videoMap[p._id].youtubeTitle}"`);
                continue;
            }

            const query = getCleanSearchTerm(p);
            console.log(`[${i + 1}/${products.length}] ${p.sku} | Query: "${query}"`);
            const ids = await searchDDG(query);
            let matched = null;

            for (const id of ids) {
                const info = await checkYouTubeVideo(id);
                if (info.ok) {
                    matched = info;
                    break;
                }
            }

            if (matched) {
                const embedUrl = `https://www.youtube.com/embed/${matched.id}`;
                videoMap[p._id] = {
                    id: p._id,
                    sku: p.sku,
                    name: p.name,
                    category: p.category,
                    embedUrl,
                    youtubeId: matched.id,
                    youtubeTitle: matched.title,
                    author: matched.author
                };
                console.log(`  -> OK: [${matched.id}] ${matched.title} (${matched.author})`);
                fs.writeFileSync(outPath, JSON.stringify(videoMap, null, 2), 'utf8');
            } else {
                console.warn(`  -> FAIL: "${query}"`);
            }

            await sleep(500);
        }

        fs.writeFileSync(outPath, JSON.stringify(videoMap, null, 2), 'utf8');
        console.log(`DONE! Saved ${Object.keys(videoMap).length}/${products.length} matched videos to ${outPath}`);

        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
})();
