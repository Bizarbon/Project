const testAppleWatchPages = [
    'https://cellphones.com.vn/apple-watch-se-2023-40mm.html',
    'https://cellphones.com.vn/apple-watch-series-9-41mm-nhom.html',
    'https://cellphones.com.vn/apple-watch-ultra-2.html',
    'https://cellphones.com.vn/apple-watch-series-10-42mm.html',
    'https://cellphones.com.vn/apple-watch-se-2.html',
    'https://cellphones.com.vn/apple-watch-series-8-41mm.html'
];

async function check() {
    for (const u of testAppleWatchPages) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(u.split('/').pop(), res.status);
        if (res.status === 200) {
            const html = await res.text();
            const imgs = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/(?:200x|insecure\/rs:fill:\d+:\d+\/q:\d+\/plain\/https:\/\/cellphones\.com\.vn)\/media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
            console.log('  -> Image:', imgs[0]);
        }
    }
}
check();
