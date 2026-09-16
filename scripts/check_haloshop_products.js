async function checkHaloProducts() {
    const res = await fetch('https://haloshop.vn/may-game/nintendo-switch', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/<img[^>]+src="([^">]+)"[^>]*alt="([^"]*)"/gi)];
    for (const m of matches) {
        if (m[2].toLowerCase().includes('switch') || m[2].toLowerCase().includes('nintendo') || m[2].toLowerCase().includes('oled')) {
            console.log(m[2], '->', m[1]);
        }
    }
}
checkHaloProducts();
