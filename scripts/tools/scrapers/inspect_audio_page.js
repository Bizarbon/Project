const fs = require('fs');

async function testPage(url, cat) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const imgs = [...html.matchAll(/(https:\/\/cdn2\.cellphones\.com\.vn\/[^"'\s<>]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
    console.log(`URL: ${url} -> found ${imgs.length} images`);
    const cdnProduct = [...new Set(imgs.filter(i => i.includes('media/catalog/product') && !i.includes('logo') && !i.includes('banner')))];
    console.log(`Product images (${cdnProduct.length}):`, cdnProduct.slice(0, 5));
}

async function run() {
    await testPage('https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe.html', 'Tai nghe');
    await testPage('https://cellphones.com.vn/do-choi-cong-nghe/apple-watch.html', 'Đồng hồ');
    await testPage('https://cellphones.com.vn/gaming-zone.html', 'Gaming');
}
run();
