const mongoose = require('mongoose');
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../src/models/Product');

const fixMap = {
    "TECH-00012": {
        id: 12,
        name: "POCO X8 Pro Max 5G 256GB",
        videoId: "PdDL-h3l5RY", // Đánh Giá POCO X8 Pro Max - Vật Vờ Studio
    },
    "TECH-00013": {
        id: 13,
        name: "Samsung Galaxy S26 Ultra 5G 256GB",
        videoId: "xsHhWU3Uvjw", // Trên Tay Samsung Galaxy S26 Ultra - Vật Vờ Studio
    },
    "TECH-00015": {
        id: 15,
        name: "MacBook Air M2 13 inch 256GB",
        videoId: "KyCvDikX85A", // Đánh giá Macbook Air M2 - Vật Vờ Studio
    },
    "TECH-00026": {
        id: 26,
        name: "Xiaomi Pad 8 Pro 8GB 128GB",
        videoId: "B1WdmK8SQE8", // Đánh giá chi tiết Xiaomi Pad 8 Pro - AnhEm TV
    },
    "TECH-00028": {
        id: 28,
        name: "HONOR Pad 10 Wifi 8GB 256GB",
        videoId: "Iwvxssp7Qxk", // Honor Pad 10 Review - Ash Does Tech
    }
};

function checkOembed(videoId) {
    return new Promise((resolve) => {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        https.get(oembedUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve({ valid: true, title: json.title, author: json.author_name });
                    } catch (e) {
                        resolve({ valid: false });
                    }
                } else {
                    resolve({ valid: false, status: res.statusCode });
                }
            });
        }).on('error', (err) => resolve({ valid: false, error: err.message }));
    });
}

(async () => {
    try {
        console.log('--- 1. VERIFYING 5 TARGET VIDEOS ---');
        for (const [sku, info] of Object.entries(fixMap)) {
            const check = await checkOembed(info.videoId);
            if (!check.valid) {
                console.error(`[FAIL] ${sku} (${info.name}) video ${info.videoId} failed:`, check);
                process.exit(1);
            }
            console.log(`[PASS] ${sku} -> https://youtu.be/${info.videoId} | "${check.title}" (${check.author})`);
        }

        console.log('\n--- 2. UPDATING MONGODB ---');
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce_mini');
        for (const [sku, info] of Object.entries(fixMap)) {
            const p = await Product.findById(info.id);
            if (p) {
                p.videoUrl = `https://www.youtube.com/embed/${info.videoId}`;
                await p.save();
                console.log(`Updated DB: [${p._id}] ${p.sku} "${p.name}" => ${p.videoUrl}`);
            } else {
                console.warn(`Product not found in DB: ${info.id}`);
            }
        }
        await mongoose.disconnect();

        console.log('\n--- 3. UPDATING backend/src/data/uniformCatalog.js ---');
        const catalogPath = path.join(__dirname, '../src/data/uniformCatalog.js');
        const catalog = require(catalogPath);

        catalog.forEach((item, idx) => {
            for (const [sku, info] of Object.entries(fixMap)) {
                if (item.name.toLowerCase().includes(info.name.split(' ')[0].toLowerCase()) &&
                    (item.name.includes('S26') || item.name.includes('X8') || item.name.includes('Air M2') || item.name.includes('Pad 8') || item.name.includes('Pad 10'))) {
                    item.videoUrl = `https://www.youtube.com/embed/${info.videoId}`;
                    console.log(`Updated Catalog item: "${item.name}" => ${item.videoUrl}`);
                }
            }
        });

        fs.writeFileSync(catalogPath, 'module.exports = ' + JSON.stringify(catalog, null, 4) + ';\n', 'utf8');
        console.log('Successfully updated uniformCatalog.js!');

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
