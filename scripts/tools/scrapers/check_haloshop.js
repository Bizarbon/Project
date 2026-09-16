async function checkHaloShop() {
    const res = await fetch('https://haloshop.vn/may-game/nintendo-switch', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const imgs = [...html.matchAll(/src="([^"]+\.(?:jpg|png|webp))"/gi)].map(m => m[1]);
    const clean = imgs.filter(i => i.includes('product') || i.includes('cache') || i.includes('image'));
    console.log('Clean images:', clean.slice(0, 10));
}
checkHaloShop();
