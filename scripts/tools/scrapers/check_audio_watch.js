const testUrls = [
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/apple.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/sony.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/marshall.html',
    'https://cellphones.com.vn/thiet-bi-am-thanh/tai-nghe/samsung.html',
    'https://cellphones.com.vn/do-choi-cong-nghe/apple-watch/apple-watch-series-10.html',
    'https://cellphones.com.vn/do-choi-cong-nghe/apple-watch/apple-watch-ultra-2.html',
    'https://cellphones.com.vn/dong-ho-thong-minh/samsung.html',
    'https://cellphones.com.vn/dong-ho-thong-minh/garmin.html'
];

async function check() {
    for (const url of testUrls) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(url.split('/').slice(-2).join('/'), 'Status:', res.status);
    }
}
check();
