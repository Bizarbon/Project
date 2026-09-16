const candidates = [
    'dong-ho-thong-minh-apple-watch-se.png',
    'dong-ho-thong-minh-apple-watch-series-9.png',
    'dong-ho-thong-minh-apple-watch-series-8.png',
    'dong-ho-thong-minh-apple-watch-ultra-2.png',
    'dong-ho-thong-minh-garmin-forerunner-55.png',
    'dong-ho-thong-minh-garmin-forerunner-265.png',
    'dong-ho-thong-minh-garmin-forerunner-965.png',
    'dong-ho-thong-minh-garmin-venu-3.png',
    'dong-ho-thong-minh-huawei-watch-gt4.png',
    'dong-ho-thong-minh-huawei-watch-gt-4.png',
    'dong-ho-thong-minh-huawei-watch-fit-3.png',
    'dong-ho-thong-minh-xiaomi-redmi-watch-4.png',
    'dong-ho-thong-minh-samsung-galaxy-watch-ultra.png',
    'dong-ho-thong-minh-samsung-galaxy-fit-3.png',
    'apple-watch-se-2023.png',
    'apple-watch-s9.png',
    'apple-watch-ultra.png',
    'apple-watch-se.png'
];

async function check() {
    for (const name of candidates) {
        const first = name.slice(0, 1);
        const second = name.slice(1, 2);
        const url = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${first}/${second}/${name}`;
        const res = await fetch(url);
        if (res.status === 200) {
            console.log('[FOUND 200]', name, url);
        }
    }
}
check();
