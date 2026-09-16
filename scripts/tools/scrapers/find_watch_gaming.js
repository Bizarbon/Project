async function findWatchesAndGaming() {
    const res = await fetch('https://cellphones.com.vn', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"#?]+)"/g)].map(m => m[1]);
    const unique = [...new Set(links)];
    const watchAndGame = unique.filter(l => 
        l.includes('watch') || 
        l.includes('dong-ho') || 
        l.includes('garmin') || 
        l.includes('game') || 
        l.includes('playstation') || 
        l.includes('nintendo') ||
        l.includes('tay-cam')
    );
    console.log('Watch & Gaming links on homepage:', watchAndGame);
}
findWatchesAndGaming();
