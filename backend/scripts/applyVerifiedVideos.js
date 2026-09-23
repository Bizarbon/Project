const mongoose = require('mongoose');
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../src/models/Product');

const verifiedVideoMap = {
    "TECH-00001": "6Mf6gZRTrwg", // Apple EarPods Lightning - GenZ Viet
    "TECH-00002": "89eiFLvM36k", // DJI Osmo Pocket 3 - Vinh Xo
    "TECH-00003": "nKFUOIPD-rM", // Logitech G502 Hero - Dao ModTech
    "TECH-00004": "txAO5aAFC3k", // Ugreen USB-C 5 IN 1 - GenZ Viet
    "TECH-00005": "gWK4-C_IUXM", // Anker A1695 165W - Vua2hand
    "TECH-00006": "RfakDAwVdRw", // iPhone 16 Pro Max - Vat Vo Studio
    "TECH-00007": "wVWVKMZomDw", // iPhone 16 Pro - Minh Tuan Mobile
    "TECH-00008": "UYXz1j0RUWQ", // iPhone 15 Pro Max - Vat Vo Studio
    "TECH-00009": "WXZRJO9w8nU", // Samsung Galaxy S25 Ultra - Vat Vo Studio
    "TECH-00010": "-iodtx2q9uA", // Samsung Galaxy S25 Plus - Vat Vo Studio
    "TECH-00011": "5E5SNAqEATw", // Xiaomi 14 Ultra - Vat Vo Studio
    "TECH-00012": "EnORZYNQqxs", // POCO X8 Pro / X6 Pro - Duong De
    "TECH-00013": "S0vldC2uLfw", // Samsung Galaxy S26 / S24 Ultra - Vat Vo Studio
    "TECH-00014": "EOYJGSTxtd4", // MacBook Air M3 - Duy Luan De Thuong
    "TECH-00015": "K-KUFRU7kAc", // MacBook Air M2 - Minh Tuan Mobile
    "TECH-00016": "VDMwDTa8EN8", // ASUS ROG Strix G16 - LaptopAZ
    "TECH-00017": "Mrt8cuMble4", // MSI Katana 15 - LaptopAZ
    "TECH-00018": "1rNns4ijKs0", // ASUS TUF Gaming A16 - LaptopAZ
    "TECH-00019": "0r9ORcoiMRs", // Acer Gaming Nitro V 15 - LaptopAZ
    "TECH-00020": "WhgK8afvAJ8", // Lenovo IdeaPad Slim 3 14 inch - Phong Vu
    "TECH-00021": "NVVJy6dWc2s", // Dell Inspiron 15 3520 - Vat Vo Studio
    "TECH-00022": "NpIrWTdGe-U", // iPad Pro M4 11 inch - F.A Channel
    "TECH-00023": "s06zgjuyCVI", // iPad Air M2 11 inch - Duy Luan De Thuong
    "TECH-00024": "jQNFeg2CW0c", // iPad Gen 10 - Vat Vo Studio
    "TECH-00026": "riBDJnfx6e0", // Xiaomi Pad 8 Pro / Pad 6 - Vat Vo Studio
    "TECH-00027": "g2SS1L5Kx0g", // Huawei MatePad 11.5 S - Vat Vo Studio
    "TECH-00028": "mkU3ZPu_Vas", // HONOR Pad 10 / X9 - The Gioi Di Dong
    "TECH-00029": "CsiA0nJl2l8", // Xiaomi Poco Pad - The Gioi Di Dong
    "TECH-00030": "6FNhma5-7xc", // Apple AirPods Pro 2 USB-C - Review
    "TECH-00031": "SFE7sRNd1tU", // Sony WH-1000XM5 - Vat Vo Studio
    "TECH-00032": "AT1Md2guHYk", // Sony WF-1000XM5 - Duy Luan De Thuong
    "TECH-00033": "I4TjhtDvCRc", // Marshall Minor IV - The Gioi Di Dong
    "TECH-00034": "Z5_BhehbAmg", // Marshall Major 5 (Major V) - Mai Trieu Nguyen
    "TECH-00035": "jqvWyxhGeBw", // Samsung Galaxy Buds 3 Pro - Vat Vo Studio
    "TECH-00036": "kqLd0bln0wo", // Sony WH-ULT900N ULT WEAR - Antien Audio
    "TECH-00037": "qSQWJhNcLA8", // Apple Watch Series 10 - Vat Vo Studio
    "TECH-00038": "31MRPYsWUr0", // Apple Watch SE 2023 - Review
    "TECH-00039": "uvOs-iGbTwI", // Samsung Galaxy Watch 7 - TUK
    "TECH-00040": "1yghZSyssM8", // Samsung Galaxy Watch 6 - Lam SmartWatch
    "TECH-00041": "5gyTImdfUe0", // Garmin Forerunner 165 - Anh Duc Digital
    "TECH-00042": "GJWvRa4qdoI", // Garmin Forerunner 55 - AnTien Studio
    "TECH-00043": "G7nybYxc3-k", // Huawei Watch Fit 3 - Vat Vo Studio
    "TECH-00045": "B508I2Lsbc8", // Baseus Bipow 20.000mAh - Phuong Vy Shop
    "TECH-00046": "H0OO_uRCH2I", // Logitech MX Master 3S - Dzung Vu
    "TECH-00047": "z3yyctCfzeQ", // Ugreen Nexode 130W PB721 - Phong Doan Review
    "TECH-00048": "3B_CnOkKRhA", // Nintendo Switch OLED - Ngo Duc Duy
    "TECH-00049": "47GxmYGLLdg", // Nintendo Switch Lite - Lam Nam
    "TECH-00050": "PR7Q8L2kb-s", // Sony PlayStation 5 Slim - Review
    "TECH-00051": "347DdlVr9qg", // Sony PlayStation 4 Pro - TOPO RETRO
    "TECH-00052": "M_aEGf6kDCk", // Valve Steam Deck OLED - Review
    "TECH-00053": "7cnDo8DKIgc", // Meta Quest 3 - Duc Biet Tech
    "TECH-00054": "1Rzr4miAQfs", // Sony DualSense PS5 White - Vu Cong Nghe
    "TECH-00055": "LxqNAxQh5WA"  // Xbox Wireless Controller Robot White - GEARVN
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
        console.log('--- 1. VALIDATING ALL VERIFIED VIDEOS VIA OEMBED ---');
        let allValid = true;
        for (const [sku, vid] of Object.entries(verifiedVideoMap)) {
            const res = await checkOembed(vid);
            if (!res.valid) {
                console.error(`[ERROR] SKU ${sku} video ${vid} is INVALID:`, res);
                allValid = false;
            } else {
                console.log(`[OK] ${sku} -> https://youtu.be/${vid} | "${res.title}" (${res.author})`);
            }
        }

        if (!allValid) {
            console.error('Some videos failed validation! Stopping.');
            process.exit(1);
        }

        console.log('\n--- 2. UPDATING MONGODB DATABASE ---');
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce_mini');
        const dbProducts = await Product.find({});
        console.log(`Found ${dbProducts.length} products in DB.`);

        let updatedDbCount = 0;
        for (const p of dbProducts) {
            const vid = verifiedVideoMap[p.sku];
            if (vid) {
                const targetUrl = `https://www.youtube.com/embed/${vid}`;
                p.videoUrl = targetUrl;
                await p.save();
                updatedDbCount++;
            } else {
                console.warn(`[WARN] DB product ${p.sku} ("${p.name}") has no mapped video!`);
            }
        }
        console.log(`Updated ${updatedDbCount}/${dbProducts.length} products in MongoDB.`);
        await mongoose.disconnect();

        console.log('\n--- 3. UPDATING backend/src/data/uniformCatalog.js ---');
        const catalogPath = path.join(__dirname, '../src/data/uniformCatalog.js');
        let catalog = require(catalogPath);
        let updatedCatalogCount = 0;

        catalog.forEach((item, index) => {
            // Find SKU either from item.sku or match with uniform index
            // If item has no SKU, let's see how SKUs are mapped
            let matchedSku = item.sku;
            if (!matchedSku) {
                // Check by name in DB or mapping
                for (const [s, vid] of Object.entries(verifiedVideoMap)) {
                    // Let's match by clean title
                    const pTitle = item.name.toLowerCase();
                    if (s === `TECH-${String(index + 1).padStart(5, '0')}`) {
                        matchedSku = s;
                        break;
                    }
                }
            }

            if (matchedSku && verifiedVideoMap[matchedSku]) {
                item.videoUrl = `https://www.youtube.com/embed/${verifiedVideoMap[matchedSku]}`;
                updatedCatalogCount++;
            }
        });

        // Write updated catalog back to uniformCatalog.js
        const catalogContent = 'module.exports = ' + JSON.stringify(catalog, null, 4) + ';\n';
        fs.writeFileSync(catalogPath, catalogContent, 'utf8');
        console.log(`Updated uniformCatalog.js with ${updatedCatalogCount} video URLs.`);

        console.log('\nALL PRODUCT VIDEOS SUCCESSFULLY UPDATED AND VERIFIED!');
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
})();
