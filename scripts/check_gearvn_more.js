async function checkGearVN() {
    const urls = [
        'https://gearvn.com/collections/may-choi-game',
        'https://gearvn.com/collections/tay-cam-choi-game',
        'https://gearvn.com/collections/thiet-bi-choi-game'
    ];
    for (const u of urls) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(u, res.status);
        if (res.status === 200) {
            const html = await res.text();
            const imgs = [...html.matchAll(/(https:\/\/product\.hstatic\.net\/[^"'\s<>]+\.(?:jpg|png|webp))/gi)].map(m => m[1]);
            console.log('  Images found:', [...new Set(imgs)].slice(0, 5));
        }
    }
}
checkGearVN();
