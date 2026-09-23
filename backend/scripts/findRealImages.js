async function searchProduct(query) {
    try {
        const url = 'https://cellphones.com.vn/catalogsearch/result/?q=' + encodeURIComponent(query);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const text = await res.text();
        const regex = /https:\/\/cdn2\.cellphones\.com\.vn\/insecure\/rs:fill:[^\s"'>]+\.(?:png|jpg|webp)/g;
        const matches = [...text.matchAll(regex)].map(m => m[0]);
        const unique = [...new Set(matches)];
        
        const valid = [];
        for (const u of unique.slice(0, 10)) {
            try {
                const check = await fetch(u);
                if (check.status === 200 && check.headers.get('content-type')?.startsWith('image')) {
                    const bytes = (await check.arrayBuffer()).byteLength;
                    if (bytes > 3000) {
                        valid.push({ url: u, bytes });
                    }
                }
            } catch (e) {}
        }
        console.log(`[${query}] found ${valid.length} valid images:`);
        valid.slice(0, 3).forEach(v => console.log('  ', v.url, `(${v.bytes} bytes)`));
        return valid[0]?.url;
    } catch (err) {
        console.error(`Error searching ${query}:`, err.message);
    }
}

async function main() {
    const queries = [
        'pin sac du phong baseus',
        'pin sac du phong ugreen 20000',
        'ipad pro m4 11',
        'ipad air m2 11',
        'huawei matepad 11 5',
        'macbook air m3 13',
        'asus rog strix g16',
        'lenovo ideapad slim 3',
        'dell inspiron 15',
        'acer nitro v'
    ];

    const results = {};
    for (const q of queries) {
        results[q] = await searchProduct(q);
    }
    console.log('\nFinal Results:');
    console.log(JSON.stringify(results, null, 2));
}

main();
