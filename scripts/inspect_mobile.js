async function inspectProducts() {
    const res = await fetch('https://cellphones.com.vn/mobile.html', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    // Look for product-item or json data
    console.log('HTML length:', html.length);
    const scriptMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('LD+JSON scripts:', scriptMatches.length);
    for (const sm of scriptMatches) {
        try {
            const data = JSON.parse(sm[1]);
            if (data['@type'] === 'ItemList' || Array.isArray(data.itemListElement)) {
                console.log('Found ItemList with items:', data.itemListElement.length);
                console.log('Sample item:', JSON.stringify(data.itemListElement.slice(0, 2), null, 2));
            }
        } catch(e) {}
    }

    // Also look for window.__INITIAL_STATE__ or __NEXT_DATA__ or product-card
    const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (initialStateMatch) console.log('Found __INITIAL_STATE__');
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
        console.log('Found __NEXT_DATA__');
        const nextData = JSON.parse(nextDataMatch[1]);
        console.log('NextData keys:', Object.keys(nextData));
        if (nextData.props && nextData.props.pageProps) {
            console.log('pageProps keys:', Object.keys(nextData.props.pageProps));
        }
    }
}
inspectProducts();
