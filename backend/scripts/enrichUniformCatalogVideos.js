const fs = require('fs');
const path = require('path');
const uniformCatalog = require('../src/data/uniformCatalog');

const videoRules = [
    { test: /apple watch.*series 10/i, url: 'https://www.youtube.com/embed/qSQWJhNcLA8' },
    { test: /apple watch.*se/i, url: 'https://www.youtube.com/embed/31MRPYsWUr0' },
    { test: /apple watch.*ultra/i, url: 'https://www.youtube.com/embed/qSQWJhNcLA8' },
    { test: /apple watch/i, url: 'https://www.youtube.com/embed/qSQWJhNcLA8' },
    { test: /galaxy watch.*7/i, url: 'https://www.youtube.com/embed/iWwZgc_Jbbg' },
    { test: /galaxy watch.*6/i, url: 'https://www.youtube.com/embed/iWwZgc_Jbbg' },
    { test: /galaxy watch/i, url: 'https://www.youtube.com/embed/iWwZgc_Jbbg' },
    { test: /garmin/i, url: 'https://www.youtube.com/embed/bSbDqRtnYKE' },
    { test: /huawei watch|xiaomi watch|redmi watch/i, url: 'https://www.youtube.com/embed/iWwZgc_Jbbg' },
    { test: /iphone 16 pro/i, url: 'https://www.youtube.com/embed/7WVLHcva5wY' },
    { test: /iphone 16/i, url: 'https://www.youtube.com/embed/7WVLHcva5wY' },
    { test: /iphone 15/i, url: 'https://www.youtube.com/embed/7WVLHcva5wY' },
    { test: /iphone 14|iphone 13/i, url: 'https://www.youtube.com/embed/7WVLHcva5wY' },
    { test: /iphone/i, url: 'https://www.youtube.com/embed/7WVLHcva5wY' },
    { test: /galaxy s24|galaxy s25/i, url: 'https://www.youtube.com/embed/GntJXsOLU10' },
    { test: /galaxy z fold|galaxy z flip/i, url: 'https://www.youtube.com/embed/GntJXsOLU10' },
    { test: /galaxy a/i, url: 'https://www.youtube.com/embed/GntJXsOLU10' },
    { test: /xiaomi|oppo/i, url: 'https://www.youtube.com/embed/GntJXsOLU10' },
    { test: /macbook air.*m3|macbook air.*m2/i, url: 'https://www.youtube.com/embed/ae_xkIoN1TA' },
    { test: /macbook pro/i, url: 'https://www.youtube.com/embed/ae_xkIoN1TA' },
    { test: /macbook/i, url: 'https://www.youtube.com/embed/ae_xkIoN1TA' },
    { test: /rog strix|tuf gaming|asus/i, url: 'https://www.youtube.com/embed/x_LPQLoE8Xw' },
    { test: /dell|lenovo|acer|laptop/i, url: 'https://www.youtube.com/embed/x_LPQLoE8Xw' },
    { test: /ipad pro|ipad air|ipad/i, url: 'https://www.youtube.com/embed/BMxU16eGrs8' },
    { test: /galaxy tab/i, url: 'https://www.youtube.com/embed/BMxU16eGrs8' },
    { test: /playstation 5|ps5/i, url: 'https://www.youtube.com/embed/SyfuWvnr5XM' },
    { test: /nintendo switch/i, url: 'https://www.youtube.com/embed/Rgh162FO-R0' },
    { test: /steam deck/i, url: 'https://www.youtube.com/embed/Rgh162FO-R0' },
    { test: /airpods/i, url: 'https://www.youtube.com/embed/6FNhma5-7xc' },
    { test: /earpods/i, url: 'https://www.youtube.com/embed/6FNhma5-7xc' },
    { test: /wh-1000xm|wf-1000xm|sony/i, url: 'https://www.youtube.com/embed/5SOdwaVvbWM' },
    { test: /marshall/i, url: 'https://www.youtube.com/embed/5SOdwaVvbWM' },
    { test: /pocket 3|osmo pocket/i, url: 'https://www.youtube.com/embed/8oCPUXHYij8' },
    { test: /g502|chuột logitech/i, url: 'https://www.youtube.com/embed/WjB3fiZol18' },
    { test: /anker|ugreen/i, url: 'https://www.youtube.com/embed/WjB3fiZol18' }
];

const categoryDefaultVideos = {
    'Đồng hồ thông minh': 'https://www.youtube.com/embed/qSQWJhNcLA8',
    'Điện thoại': 'https://www.youtube.com/embed/7WVLHcva5wY',
    'Laptop': 'https://www.youtube.com/embed/ae_xkIoN1TA',
    'Máy tính bảng': 'https://www.youtube.com/embed/BMxU16eGrs8',
    'Máy chơi game': 'https://www.youtube.com/embed/Rgh162FO-R0',
    'Tai nghe': 'https://www.youtube.com/embed/6FNhma5-7xc',
    'Phụ kiện': 'https://www.youtube.com/embed/8oCPUXHYij8'
};

function getVideoForProduct(product) {
    const text = `${product.name} ${product.brand || ''} ${product.category || ''}`;
    for (const rule of videoRules) {
        if (rule.test.test(text)) {
            return rule.url;
        }
    }
    return categoryDefaultVideos[product.category] || 'https://www.youtube.com/embed/qSQWJhNcLA8';
}

const enriched = uniformCatalog.map(p => ({
    ...p,
    videoUrl: getVideoForProduct(p)
}));

const catalogPath = path.join(__dirname, '../src/data/uniformCatalog.js');
const fileContent = `const uniformCatalog = ${JSON.stringify(enriched, null, 4)};\n\nmodule.exports = uniformCatalog;\n`;
fs.writeFileSync(catalogPath, fileContent, 'utf8');
console.log(`Updated uniformCatalog.js with ${enriched.length} verified products.`);
