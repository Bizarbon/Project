const fs = require('fs');

async function searchGaming() {
    const urls = [
        'https://cellphones.com.vn/thiet-bi-choi-game.html',
        'https://cellphones.com.vn/may-choi-game.html',
        'https://cellphones.com.vn/phu-kien/phu-kien-choi-game.html'
    ];
    
    // Also test search query for nintendo, ps5, xbox
    for (const q of ['nintendo', 'dualsense', 'ps5', 'xbox', 'switch', 'game']) {
        const url = `https://cellphones.com.vn/catalogsearch/result?q=${q}`;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            const imgs = [...html.matchAll(/(https:\/\/cdn2\.cellphones\.com\.vn\/[^"'\s<>]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
            const filtered = imgs.filter(i => i.includes('media/catalog/product') && !i.includes('banner') && !i.includes('logo'));
            console.log(`Query ${q}: found ${filtered.length} images`);
            for (const img of filtered.slice(0, 5)) {
                console.log('  ->', img);
            }
        } catch (e) {}
    }
}
searchGaming();
