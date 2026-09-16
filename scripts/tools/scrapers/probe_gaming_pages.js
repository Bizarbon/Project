const gamingPages = [
    'https://cellphones.com.vn/may-choi-game-nintendo-switch-oled-trang.html',
    'https://cellphones.com.vn/may-choi-game-nintendo-switch-oled-neon.html',
    'https://cellphones.com.vn/may-choi-game-nintendo-switch-v2.html',
    'https://cellphones.com.vn/may-choi-game-nintendo-switch-lite-coral.html',
    'https://cellphones.com.vn/nintendo-switch-oled.html',
    'https://cellphones.com.vn/nintendo-switch-lite.html',
    'https://cellphones.com.vn/tay-cam-xbox.html',
    'https://cellphones.com.vn/tay-cam-xbox-series-x-robot-white.html',
    'https://cellphones.com.vn/tay-cam-choi-game-khong-day-xbox-wireless-controller-robot-white.html',
    'https://cellphones.com.vn/tay-cam-choi-game-khong-day-xbox-series-x.html',
    'https://cellphones.com.vn/may-choi-game-sony-playstation-4-pro.html',
    'https://cellphones.com.vn/may-choi-game-sony-ps4-slim.html',
    'https://cellphones.com.vn/kinh-thuc-te-ao-meta-quest-3-128gb.html',
    'https://cellphones.com.vn/kinh-thuc-te-ao-meta-quest-3s.html',
    'https://cellphones.com.vn/may-choi-game-asus-rog-ally-x.html'
];

async function check() {
    for (const u of gamingPages) {
        try {
            const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log(u.split('/').pop(), res.status);
            if (res.status === 200) {
                const html = await res.text();
                const imgs = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/(?:200x|insecure\/rs:fill:\d+:\d+\/q:\d+\/plain\/https:\/\/cellphones\.com\.vn)\/media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
                console.log('  -> Found image:', imgs[0]);
            }
        } catch (e) {}
    }
}
check();
