const fs = require('fs');

async function inspectAudioAndAccessories() {
    for (const url of ['https://cellphones.com.vn/thiet-bi-am-thanh.html', 'https://cellphones.com.vn/phu-kien.html']) {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const cdnImgs = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/[^"'\s<>]+\.(?:png|jpg|webp)/gi)].map(m => m[0]);
        console.log(`URL: ${url} -> total CDN images: ${cdnImgs.length}`);
        const productImgs = cdnImgs.filter(i => i.includes('media/catalog/product'));
        console.log(`Product images in ${url}:`, productImgs.length);
        console.log('Sample:', productImgs.slice(0, 5));
    }
}
inspectAudioAndAccessories();
