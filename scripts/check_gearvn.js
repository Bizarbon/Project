async function checkGearVN() {
    try {
        const res = await fetch('https://gearvn.com/collections/may-choi-game-console', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('GearVN status:', res.status);
        if (res.status === 200) {
            const html = await res.text();
            const matches = [...html.matchAll(/<img[^>]+src="([^">]+)"[^>]*alt="([^"]*)"/gi)];
            console.log('Matches on GearVN:', matches.length);
            for (const m of matches) {
                if (m[2].toLowerCase().includes('nintendo') || m[2].toLowerCase().includes('switch') || m[2].toLowerCase().includes('ps5') || m[2].toLowerCase().includes('xbox')) {
                    console.log(m[2], '->', m[1]);
                }
            }
        }
    } catch (e) {
        console.log('GearVN err:', e.message);
    }
}
checkGearVN();
