const fs = require('fs');

const testUrls = [
    'https://cellphones.com.vn/tai-nghe-apple-earpods-cong-lightning.html',
    'https://cellphones.com.vn/dji-osmo-pocket-3-creator-combo.html',
    'https://cellphones.com.vn/chuot-choi-game-co-day-logitech-g502-hero.html',
    'https://cellphones.com.vn/hub-chuyen-doi-ugreen-usb-c-5-in-1-cm478-15495.html',
    'https://cellphones.com.vn/pin-sac-du-phong-anker-a1695-25000mah-165w.html'
];

async function checkUrls() {
    for (const url of testUrls) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            console.log(`URL: ${url} -> Status: ${res.status}`);
            if (res.status === 200) {
                const html = await res.text();
                // Find cdn2 images
                const matches = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/(?:200x|insecure\/rs:fill:\d+:\d+\/q:\d+\/plain\/https:\/\/cellphones\.com\.vn)\/media\/catalog\/product\/[^\s"']+/g)].map(m => m[0]);
                console.log('Matches:', [...new Set(matches)].slice(0, 3));
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}
checkUrls();
