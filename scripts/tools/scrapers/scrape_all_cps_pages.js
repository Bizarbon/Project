const fs = require('fs');

const pages = [
    { cat: 'Điện thoại', url: 'https://cellphones.com.vn/mobile.html' },
    { cat: 'Laptop', url: 'https://cellphones.com.vn/laptop.html' },
    { cat: 'Tablet', url: 'https://cellphones.com.vn/tablet.html' },
    { cat: 'Tai nghe', url: 'https://cellphones.com.vn/thiet-bi-am-thanh.html' },
    { cat: 'Phụ kiện', url: 'https://cellphones.com.vn/phu-kien.html' }
];

async function scrapeAll() {
    const allProducts = [];
    for (const p of pages) {
        console.log(`Scraping ${p.cat} from ${p.url}...`);
        try {
            const res = await fetch(p.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await res.text();
            
            // Look for cdn2 images with alt or title
            const matches = [...html.matchAll(/<img[^>]+(?:src|data-src)="(https:\/\/cdn2\.cellphones\.com\.vn\/(?:insecure\/rs:fill:\d+:\d+\/q:\d+\/plain\/https:\/\/cellphones\.com\.vn\/|200x\/)media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp)))"[^>]*alt="([^"]*)"/gi)];
            console.log(`Found ${matches.length} matches in ${p.cat}`);
            
            for (const m of matches) {
                const rawPath = m[2];
                const alt = m[3].trim();
                if (alt && !alt.toLowerCase().includes('logo') && !alt.toLowerCase().includes('banner')) {
                    // Standard 358x358 framed URL
                    const framedUrl = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${rawPath}`;
                    allProducts.push({
                        category: p.cat,
                        name: alt,
                        image: framedUrl,
                        rawPath
                    });
                }
            }
        } catch (e) {
            console.error(e.message);
        }
    }
    
    // De-duplicate by image
    const unique = [];
    const seen = new Set();
    for (const item of allProducts) {
        if (!seen.has(item.image)) {
            seen.add(item.image);
            unique.push(item);
        }
    }
    console.log(`\nTotal unique catalog products found: ${unique.length}`);
    fs.writeFileSync('scripts/scraped_products.json', JSON.stringify(unique, null, 2));
    
    // Group by category and print sample
    for (const p of pages) {
        const catItems = unique.filter(i => i.category === p.cat);
        console.log(`\n=== Category: ${p.cat} (${catItems.length} items) ===`);
        catItems.slice(0, 5).forEach(i => console.log(`- ${i.name} (${i.image})`));
    }
}

scrapeAll();
