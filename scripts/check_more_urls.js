const urls = [
    'https://cellphones.com.vn/phu-kien/chuot.html',
    'https://cellphones.com.vn/phu-kien/ban-phim.html',
    'https://cellphones.com.vn/phu-kien/hub-chuyen-doi.html',
    'https://cellphones.com.vn/phu-kien/cu-cap-sac.html',
    'https://cellphones.com.vn/dong-ho-thong-minh.html',
    'https://cellphones.com.vn/dong-ho.html',
    'https://cellphones.com.vn/gaming-gear.html',
    'https://cellphones.com.vn/thiet-bi-choi-game.html',
    'https://cellphones.com.vn/may-game.html'
];

async function check() {
    for (const u of urls) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(u, res.status);
    }
}
check();
