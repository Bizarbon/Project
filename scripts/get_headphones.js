const fs = require('fs');

const headphonePages = [
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/apple.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/sony.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/marshall.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/samsung.html'
];

async function run() {
    const list = [];
    for (const url of headphonePages) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const matches = [...html.matchAll(/(?:src|data-src)="(https:\/\/cdn2\.cellphones\.com\.vn\/[^"]*media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp)))"[^>]*alt="([^"]*)"/gi)];
        console.log(url.split('/').pop(), 'matches:', matches.length);
        for (const m of matches) {
            const raw = m[2];
            const name = m[3].trim();
            if (name && !name.toLowerCase().includes('banner') && !name.toLowerCase().includes('chibi') && !name.toLowerCase().includes('logo')) {
                const img = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${raw}`;
                list.push({ name, image: img });
            }
        }
    }
    
    // verify 200
    const verified = [];
    for (const item of list) {
        const r = await fetch(item.image);
        if (r.status === 200) {
            verified.push(item);
            console.log('[200]', item.name, item.image);
        }
    }
    console.log('Total verified headphones:', verified.length);
    fs.writeFileSync('scripts/verified_headphones.json', JSON.stringify(verified, null, 2));
}
run();
