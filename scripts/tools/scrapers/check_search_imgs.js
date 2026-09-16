async function checkSearch() {
    const res = await fetch('https://cellphones.com.vn/catalogsearch/result?q=tai+cam+choi+game', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/[^"'\s<>]+\.(?:png|jpg|webp)/gi)].map(m => m[0]);
    console.log('Search matches:', [...new Set(matches)].slice(0, 10));
}
checkSearch();
