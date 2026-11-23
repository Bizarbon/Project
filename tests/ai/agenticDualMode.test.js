/**
 * tests/ai/agenticDualMode.test.js
 * Kiểm thử tự động động cơ LLM-First Agentic Dual-Mode:
 * - Chế độ 1 (open_ai): lập trình, tra cứu web thời gian thực, thêm nhiều sản phẩm vào giỏ
 * - Chế độ 2 (tech_advisor): giải đáp kỹ thuật chuyên sâu, lọc chuẩn danh mục, mã giảm giá
 * Chạy: npm run test:ai
 */

const path = require('path');
const fs = require('fs');
const rootEnv = path.resolve(__dirname, '../../.env');
const backendEnv = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
if (fs.existsSync(backendEnv)) require('dotenv').config({ path: backendEnv });
const mongoose = require('mongoose');
const connectDB = require('../../backend/src/config/db');
const agenticChatService = require('../../backend/src/services/ai/agenticChatService');

(async () => {
    const failures = [];
    try {
        await connectDB();

        console.log('=== 1. MODE 1 (open_ai): Code Python tự do (không gọi tool thừa) ===');
        const rCode = await agenticChatService.runAgenticChat({
            message: 'Viết hàm tính giai thừa ngắn gọn bằng Python.',
            mode: 'open_ai',
            context: {}
        });
        console.log('model:', rCode?.meta?.model, '| tools:', rCode?.meta?.toolsUsed);
        if (!rCode?.reply || !/def\s+/i.test(rCode.reply)) failures.push('open_ai Python code failed');

        console.log('\n=== 2. MODE 1 (open_ai): Thêm nhiều sản phẩm vào giỏ (Switch Lite + iPhone 17 Pro) ===');
        const rCart = await agenticChatService.runAgenticChat({
            message: 'thêm vô giỏ hàng giúp tôi máy switch lite và iphone 17 pro',
            mode: 'open_ai',
            context: {}
        });
        const cartIds = (rCart?.cartItems || []).map(i => Number(i.productId));
        console.log('action:', rCart?.action, '| cartIds:', cartIds, '| total:', rCart?.totalCartAddedAmount);
        if (rCart?.action !== 'add_to_cart_batch' || !cartIds.includes(49) || !cartIds.includes(106)) {
            failures.push('add_to_cart_batch missing Switch Lite (49) or iPhone 17 Pro (106): ' + JSON.stringify(cartIds));
        }

        console.log('\n=== 3. MODE 2 (tech_advisor): Lọc chuẩn danh mục Switch Lite (không lọt Điện thoại) ===');
        const rSwitch = await agenticChatService.runAgenticChat({
            message: 'switch lite',
            mode: 'tech_advisor',
            context: { category: 'Máy chơi game' }
        });
        const switchCats = (rSwitch?.products || []).map(p => `${p.name} [${p.category}]`);
        console.log('products:', switchCats);
        if ((rSwitch?.products || []).some(p => p.category === 'Điện thoại')) {
            failures.push('Switch Lite leaked phone product: ' + JSON.stringify(switchCats));
        }

        console.log('\n=== 4. MODE 2 (tech_advisor): Tra cứu web thời gian thực (GTA 6) ===');
        const rWeb = await agenticChatService.runAgenticChat({
            message: 'GTA 6 ra mắt ngày nào và chơi trên máy nào?',
            mode: 'tech_advisor',
            context: {}
        });
        console.log('tools:', rWeb?.meta?.toolsUsed, '| snippet:', (rWeb?.reply || '').replace(/\s+/g, ' ').slice(0, 160));
        if (!(rWeb?.meta?.toolsUsed || []).includes('web_search') || !/2026/i.test(rWeb?.reply || '')) {
            failures.push('web_search did not fetch 2026 GTA 6 release info');
        }

        if (failures.length > 0) {
            console.error('\nFAILURES:', failures);
            process.exitCode = 1;
        } else {
            console.log('\nALL AGENTIC AI TESTS PASSED ✅');
            process.exitCode = 0;
        }
    } finally {
        await mongoose.disconnect().catch(() => {});
        process.exit(process.exitCode || 0);
    }
})();
