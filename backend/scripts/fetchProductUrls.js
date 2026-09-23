const productSlugs = [
    { key: 'baseus', url: 'https://cellphones.com.vn/pin-sac-du-phong-baseus-bipow-2-digital-display-20000mah-20w.html' },
    { key: 'ugreen', url: 'https://cellphones.com.vn/pin-sac-du-phong-ugreen-100w-20000mah-pb205.html' },
    { key: 'ipad_pro_m4', url: 'https://cellphones.com.vn/ipad-pro-11-inch-2024-m4.html' },
    { key: 'ipad_air_m2', url: 'https://cellphones.com.vn/ipad-air-6-11-inch-2024.html' },
    { key: 'huawei', url: 'https://cellphones.com.vn/huawei-matepad-11-5-s.html' },
    { key: 'macbook_m3', url: 'https://cellphones.com.vn/macbook-air-m3-13-inch-2024.html' },
    { key: 'asus_rog', url: 'https://cellphones.com.vn/laptop-asus-rog-strix-g16-g614jv-n4040w.html' },
    { key: 'lenovo', url: 'https://cellphones.com.vn/laptop-lenovo-ideapad-slim-3-14iah8-83eq0005vn.html' },
    { key: 'dell', url: 'https://cellphones.com.vn/laptop-dell-inspiron-15-3520-71003262.html' },
    { key: 'acer', url: 'https://cellphones.com.vn/laptop-acer-gaming-nitro-v-anv15-51-57b2.html' }
];

async function check() {
    for (const item of productSlugs) {
        try {
            const res = await fetch(item.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (res.status !== 200) {
                console.log(item.key, 'HTTP', res.status);
                continue;
            }
            const html = await res.text();
            // Look for og:image
            const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
            let img = ogMatch ? ogMatch[1] : null;
            if (!img) {
                const cdnMatch = html.match(/https:\/\/cdn2\.cellphones\.com\.vn\/insecure\/rs:fill:[^\s"'>]+\.(?:png|jpg|webp)/);
                img = cdnMatch ? cdnMatch[0] : null;
            }
            if (img) {
                const imgRes = await fetch(img);
                const bytes = (await imgRes.arrayBuffer()).byteLength;
                console.log(item.key, '->', imgRes.status, bytes > 1000 ? 'OK' : 'SMALL', img);
            } else {
                console.log(item.key, 'NO IMAGE FOUND');
            }
        } catch (e) {
            console.log(item.key, 'ERROR:', e.message);
        }
    }
}

check();
