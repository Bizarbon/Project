async function checkAnPhat() {
    const res = await fetch('https://www.anphatpc.com.vn/tim?q=nintendo+switch', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const imgs = [...html.matchAll(/(https:\/\/www\.anphatpc\.com\.vn\/media\/product\/[^"'\s<>]+\.(?:jpg|png|webp))/gi)].map(m => m[1]);
    console.log('An Phat Switch:', [...new Set(imgs)].slice(0, 5));
}
checkAnPhat();
