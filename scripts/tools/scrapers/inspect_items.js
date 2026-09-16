const fs = require('fs');

async function inspectProductItems() {
    const res = await fetch('https://cellphones.com.vn/mobile.html', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    // Find all product-item or product-info
    const items = [...html.matchAll(/<div class="product-item[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g)].map(m => m[0]);
    console.log('Items found:', items.length);
    if (items.length > 0) {
        console.log('Sample item html (first 500 chars):', items[0].slice(0, 500));
        // extract link, title, img, price
        items.slice(0, 5).forEach((item, idx) => {
            const titleMatch = item.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || item.match(/title="([^"]*)"/);
            const imgMatch = item.match(/src="([^"]*)"/) || item.match(/data-src="([^"]*)"/);
            const priceMatch = item.match(/class="[^"]*product__price--show[^"]*"[^>]*>([\s\S]*?)<\/p>/) || item.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            console.log(`Product ${idx + 1}:`, {
                title: titleMatch ? titleMatch[1].trim() : 'no title',
                img: imgMatch ? imgMatch[1] : 'no img',
                price: priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : 'no price'
            });
        });
    }
}
inspectProductItems();
