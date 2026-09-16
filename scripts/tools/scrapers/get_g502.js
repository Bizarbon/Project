async function run() {
    const res = await fetch('https://cellphones.com.vn/chuot-choi-game-co-day-logitech-g502-hero.html', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const imgs = [...html.matchAll(/https:\/\/[^"'\s<>]+\.(?:png|jpg|webp)/gi)].map(m => m[0]);
    console.log('Total images found:', imgs.length);
    const cdnImgs = [...new Set(imgs.filter(i => i.includes('cdn2.cellphones.com.vn')))];
    console.log('CDN images:');
    cdnImgs.forEach(i => console.log(i));
}
run();
