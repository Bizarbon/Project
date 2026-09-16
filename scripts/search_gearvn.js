async function searchGearVn(query) {
    const res = await fetch(`https://gearvn.com/search?type=product&q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/src="(\/\/product\.hstatic\.net\/[^"]+)"[^>]*alt="([^"]*)"/gi)];
    console.log(`Query "${query}" found ${matches.length} matches:`);
    const unique = [];
    const seen = new Set();
    for (const m of matches) {
        const url = 'https:' + m[1].replace('_small', '').replace('_medium', '').replace('_thumb', '');
        if (!seen.has(url)) {
            seen.add(url);
            unique.push({ name: m[2].trim(), url });
            console.log(m[2].trim(), '->', url);
        }
    }
}
async function run() {
    await searchGearVn('nintendo switch');
    await searchGearVn('steam deck');
    await searchGearVn('playstation 5');
}
run();
