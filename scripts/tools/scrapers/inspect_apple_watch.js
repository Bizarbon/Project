async function inspectAppleWatch() {
    const res = await fetch('https://cellphones.com.vn/do-choi-cong-nghe/apple-watch.html', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const imgs = [...html.matchAll(/(https:\/\/cdn2\.cellphones\.com\.vn\/[^"'\s<>]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
    console.log('Total cdn2 images in apple-watch.html:', imgs.length);
    console.log('Sample images:', [...new Set(imgs)].slice(0, 15));
}
inspectAppleWatch();
