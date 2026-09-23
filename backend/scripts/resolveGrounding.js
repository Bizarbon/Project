const https = require('https');

function resolveUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(res.headers.location);
            } else {
                resolve(url);
            }
        }).on('error', () => resolve(null));
    });
}

function checkOembed(videoId) {
    return new Promise((resolve) => {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        https.get(oembedUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve({ valid: true, title: json.title, author: json.author_name });
                    } catch (e) {
                        resolve({ valid: false });
                    }
                } else {
                    resolve({ valid: false });
                }
            });
        }).on('error', () => resolve({ valid: false }));
    });
}

(async () => {
    const urls = process.argv.slice(2);
    for (const u of urls) {
        const loc = await resolveUrl(u);
        const m = loc ? loc.match(/(?:v=|\/embed\/|\/watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/) : null;
        if (m) {
            const id = m[1];
            const check = await checkOembed(id);
            console.log(JSON.stringify({ id, valid: check.valid, title: check.title, author: check.author, url: loc }));
        } else {
            console.log(JSON.stringify({ raw: loc }));
        }
    }
})();
