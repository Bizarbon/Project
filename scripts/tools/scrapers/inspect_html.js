const fs = require('fs');

async function inspectHtml() {
    const res = await fetch('https://cellphones.com.vn/mobile.html', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    // Search for product cards
    const productCardMatches = [...html.matchAll(/class="[^"]*product-item[^"]*"[\s\S]*?<\/div>\s*<\/div>/g)];
    console.log('product-item matches:', productCardMatches.length);

    // Let's search for cdn2 images inside product containers
    const imgMatches = [...html.matchAll(/<img[^>]+src="(https:\/\/cdn2\.cellphones\.com\.vn\/[^">]+)"[^>]*alt="([^"]*)"/g)];
    console.log('cdn2 img with alt matches:', imgMatches.length);
    imgMatches.slice(0, 10).forEach(m => {
        console.log({ alt: m[2], src: m[1] });
    });
}
inspectHtml();
