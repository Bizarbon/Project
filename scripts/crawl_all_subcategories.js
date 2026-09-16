const fs = require('fs');

const sources = [
    { cat: 'Điện thoại', url: 'https://cellphones.com.vn/mobile.html' },
    { cat: 'Laptop', url: 'https://cellphones.com.vn/laptop.html' },
    { cat: 'Tablet', url: 'https://cellphones.com.vn/tablet.html' },
    { cat: 'Tai nghe', url: 'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe.html' },
    { cat: 'Đồng hồ thông minh', url: 'https://cellphones.com.vn/do-choi-cong-nghe/apple-watch.html' },
    { cat: 'Phụ kiện', url: 'https://cellphones.com.vn/phu-kien/pin-du-phong.html' },
    { cat: 'Phụ kiện', url: 'https://cellphones.com.vn/phu-kien.html' }
];

async function run() {
    const collected = [];
    
    for (const s of sources) {
        console.log(`Fetching ${s.cat} from ${s.url}...`);
        try {
            const res = await fetch(s.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await res.text();
            
            // Extract product-item cards
            // Match pattern: link with title and image
            const regex = /<div class="product-item[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
            const cardMatches = [...html.matchAll(/<div class="product-item[\s\S]*?(?:class="product-item"|<\/section>|<\/div>\s*<\/div>\s*<\/div>)/gi)].map(m => m[0]);
            
            // Also regex for img src with media/catalog/product
            const imgMatches = [...html.matchAll(/(?:src|data-src)="(https:\/\/cdn2\.cellphones\.com\.vn\/[^"]*media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp)))"[^>]*alt="([^"]*)"/gi)];
            console.log(`Found ${imgMatches.length} product images in ${s.cat}`);
            
            for (const m of imgMatches) {
                const rawPath = m[2];
                const alt = m[3].trim();
                if (alt && !alt.toLowerCase().includes('logo') && !alt.toLowerCase().includes('banner') && !alt.toLowerCase().includes('chibi') && !alt.toLowerCase().includes('voucher')) {
                    const url = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${rawPath}`;
                    collected.push({
                        category: s.cat,
                        name: alt,
                        image: url
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    // De-duplicate
    const unique = [];
    const seen = new Set();
    for (const item of collected) {
        if (!seen.has(item.image)) {
            seen.add(item.image);
            unique.push(item);
        }
    }
    
    console.log(`\nTesting ${unique.length} unique candidates...`);
    const valid = [];
    for (const item of unique) {
        try {
            const r = await fetch(item.image);
            if (r.status === 200) {
                valid.push(item);
                console.log(`[200] [${item.category}] ${item.name}`);
            }
        } catch (e) {}
    }
    
    console.log(`\nTotal verified valid products: ${valid.length}`);
    fs.writeFileSync('scripts/verified_products.json', JSON.stringify(valid, null, 2));
}

run();
