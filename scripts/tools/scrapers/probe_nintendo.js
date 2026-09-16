const nintendoNames = [
    'nintendo-switch.png',
    'nintendo-switch-oled.png',
    'nintendo-switch-lite.png',
    'may-choi-game-nintendo-switch-oled.png',
    'may-choi-game-nintendo-switch.png',
    'nintendo-switch-oled-white.png',
    'nintendo-switch-oled-trang.png',
    'nintendo-switch-oled-neon.png',
    'nintendo-switch-v2.png',
    'switch-oled.png',
    'switch-lite.png',
    'nintendo-switch-lite-coral.png',
    'nintendo-switch-lite-turquoise.png',
    'nintendo-switch-lite-yellow.png',
    'nintendo_switch_oled.png',
    'nintendo_switch.png',
    'may-choi-game-nintendo-switch-oled-trang.png'
];

async function checkNintendo() {
    const prefixes = ['m/a/', 'n/i/', 's/w/', 'c/o/', 't/o/', ''];
    for (const name of nintendoNames) {
        for (const pref of prefixes) {
            const url = `https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/${pref}${name}`;
            try {
                const res = await fetch(url);
                if (res.status === 200) {
                    console.log('[FOUND 200]', name, url);
                }
            } catch (e) {}
        }
    }
}
checkNintendo();
