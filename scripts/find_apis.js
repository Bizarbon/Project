const fs = require('fs');

async function findApis() {
    const res = await fetch('https://cellphones.com.vn/mobile.html', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const apis = [...html.matchAll(/https?:\/\/[^"'\s<>]*(?:api|graphql)[^"'\s<>]*/gi)].map(m => m[0]);
    console.log('Unique APIs found:', [...new Set(apis)]);
}
findApis();
