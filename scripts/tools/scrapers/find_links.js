async function findLinks() {
    const res = await fetch('https://cellphones.com.vn', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/href="([^"#?]+)"/g)].map(m => m[1]);
    const unique = [...new Set(matches)];
    const relevant = unique.filter(u => 
        u.includes('dong-ho') || 
        u.includes('game') || 
        u.includes('playstation') || 
        u.includes('switch') || 
        u.includes('watch') || 
        u.includes('am-thanh') ||
        u.includes('phu-kien') ||
        u.includes('tablet') ||
        u.includes('laptop') ||
        u.includes('mobile')
    );
    console.log('Relevant links:');
    relevant.forEach(l => console.log(l));
}
findLinks();
