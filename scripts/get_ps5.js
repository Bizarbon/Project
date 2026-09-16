async function getPs5Breadcrumbs() {
    const res = await fetch('https://cellphones.com.vn/may-choi-game-sony-playstation-5-slim.html', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"#?]+)"/g)].map(m => m[1]);
    const unique = [...new Set(links)];
    const breadcrumbLinks = unique.filter(l => l.includes('game') || l.includes('playstation') || l.includes('sony'));
    console.log('Relevant breadcrumb / internal links:');
    breadcrumbLinks.forEach(l => console.log(l));
}
getPs5Breadcrumbs();
