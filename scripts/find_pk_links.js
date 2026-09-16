async function findLinks() {
    const res = await fetch('https://cellphones.com.vn/phu-kien.html', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const links = [...html.matchAll(/href="(https:\/\/cellphones\.com\.vn\/[^"#?]+)"/g)].map(m => m[1]);
    const unique = [...new Set(links)];
    console.log('Links in phu-kien.html:', unique.slice(0, 30));
}
findLinks();
