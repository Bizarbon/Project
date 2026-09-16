const testWatchNames = [
    'apple-watch-series-9-41mm-nhom.png',
    'apple-watch-series-9-45mm.png',
    'apple-watch-se-2023-40mm-gps.png',
    'apple-watch-ultra-2-49mm.png',
    'apple-watch-series-8.png',
    'dong-ho-thong-minh-apple-watch-se-2024-40mm.png',
    'samsung-galaxy-watch-6-40mm.png',
    'samsung-galaxy-watch-7.png',
    'samsung-galaxy-watch-ultra.png',
    'garmin-forerunner-55.png',
    'garmin-forerunner-265.png',
    'garmin-forerunner-165.png',
    'huawei-watch-gt-4-46mm.png',
    'dong-ho-thong-minh-huawei-watch-gt-4.png',
    'xiaomi-watch-2.png',
    'xiaomi-redmi-watch-4.png'
];

async function checkWatches() {
    console.log('Testing watch image filenames...');
    const found = [];
    for (const name of testWatchNames) {
        // Try both raw and nested prefix a/p, s/a, g/a, h/u, x/i
        const firstLetter = name[0];
        const secondLetter = name[1];
        const prefixes = [
            `${firstLetter}/${secondLetter}/`,
            'a/p/', 's/a/', 'g/a/', 'h/u/', 'x/i/', 'd/o/', ''
        ];
        
        for (const pref of prefixes) {
            const url = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${pref}${name}`;
            try {
                const res = await fetch(url);
                if (res.status === 200) {
                    found.push({ name, url });
                    console.log(`[FOUND 200] ${name} -> ${url}`);
                    break;
                }
            } catch (e) {}
        }
    }
    console.log(`Found ${found.length} watch images!`);
}
checkWatches();
