async function getGearVnProducts() {
    const urls = [
        'https://gearvn.com/collections/may-choi-game',
        'https://gearvn.com/collections/tay-cam-choi-game'
    ];
    for (const u of urls) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const matches = [...html.matchAll(/<img[^>]+src="([^">]+)"[^>]*alt="([^"]*)"/gi)];
        console.log(`=== ${u} (${matches.length} images) ===`);
        for (const m of matches) {
            if (m[1].includes('product.hstatic.net')) {
                console.log(m[2].trim(), '->', m[1]);
            }
        }
    }
}
getGearVnProducts();
