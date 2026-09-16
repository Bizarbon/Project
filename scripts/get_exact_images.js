const urls = [
    'https://cellphones.com.vn/hub-chuyen-doi-ugreen-usb-c-to-usb-a-2-0-usb-a-3-0-hdmi-pd-ho-tro-4k-15495.html',
    'https://cellphones.com.vn/may-quay-chong-rung-dji-osmo-pocket-3-advanced-4k.html',
    'https://cellphones.com.vn/rog-xbox-ally-x.html'
];

async function run() {
    for (const u of urls) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const imgs = [...html.matchAll(/https:\/\/cdn2\.cellphones\.com\.vn\/(?:200x|insecure\/rs:fill:\d+:\d+\/q:\d+\/plain\/https:\/\/cellphones\.com\.vn)\/media\/catalog\/product\/([a-z0-9\/_-]+\.(?:png|jpg|webp))/gi)].map(m => m[1]);
        console.log(u.split('/').pop(), '-> image path:', imgs[0]);
    }
}
run();
