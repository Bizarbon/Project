async function checkHaloLazy() {
    const res = await fetch('https://haloshop.vn/may-game/nintendo-switch', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/data-(?:lazy-)?src="([^">]+\.(?:jpg|png|webp))"[^>]*alt="([^"]*)"/gi)];
    for (const m of matches) {
        console.log(m[2], '->', m[1]);
    }
}
checkHaloLazy();
