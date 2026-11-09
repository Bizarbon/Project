const http = require('http');

async function testChat(msg) {
    return new Promise((resolve, reject) => {
        const req = http.request('http://127.0.0.1:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Parse error: ' + data));
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ message: msg }));
        req.end();
    });
}

(async () => {
    const questions = [
        'Bên em có xuất hóa đơn đỏ công ty không?',
        'Bên shop có thu cũ đổi mới không?',
        'Không có thẻ tín dụng trả góp được không?',
        'Có bảo hành rơi vỡ không?',
        'Hàng bên em có nguyên seal chính hãng không?',
        'Cho xin số điện thoại hotline của shop',
        'Sinh viên có được giảm giá không?',
        'Có được đặt giữ hàng trước không?',
        'Sạc qua đêm có bị chai pin không em?',
        'Nên dán cường lực hay dán PPF cho máy?',
        'Laptop chơi game bị nóng quạt kêu to có sao không?',
        'Cách chụp màn hình macbook thế nào?',
        'Vừa sạc vừa dùng điện thoại có nguy hiểm không?',
        'Em ăn cơm chưa?',
        'Hôm nay đi làm mệt quá em ơi',
        'Kể chuyện cười đi em',
        'Trời đang mưa to quá',
        'Em mấy tuổi rồi có người yêu chưa?',
        'Em có phải robot không?',
        'Hôm nay ăn gì em?',
        'Hết tiền rồi nghèo quá'
    ];

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const res = await testChat(q);
        console.log('\n========================================');
        console.log('[' + (i + 1) + '] Q: ' + q);
        console.log('REPLY:\n' + res.reply);
        console.log('SUGGESTIONS: ' + JSON.stringify(res.suggestions || []));
    }
})();
