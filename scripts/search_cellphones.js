async function searchCPS(keyword) {
    try {
        // CellphoneS internal search or API
        const url = `https://cellphones.com.vn/catalogsearch/result/?q=${encodeURIComponent(keyword)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        // find product item images
        const regex = /<div class="product-info-container[\s\S]*?<\/div>/g;
        const matches = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/insecure\/rs:fill:358:358\/[^\s"']+/g)].map(m => m[0]);
        console.log(`Keyword: ${keyword}, found images:`, matches.slice(0, 3));
    } catch (e) {
        console.error(e);
    }
}

async function main() {
    await searchCPS('logitech g502');
    await searchCPS('earpods lightning');
    await searchCPS('anker a1695');
}

main();
