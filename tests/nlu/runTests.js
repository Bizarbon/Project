/**
 * Test Runner cho Bộ Kiểm Thử NLU (Giai đoạn A)
 * Script: npm run test:nlu
 * TechEcommerce NLU System
 */

const fs = require('fs');
const path = require('path');
const nlu = require('../../backend/src/services/nlu');

async function runAllTests() {
    const testCasesPath = path.join(__dirname, 'testCases.json');
    if (!fs.existsSync(testCasesPath)) {
        console.error('Không tìm thấy file test cases tại:', testCasesPath);
        process.exit(1);
    }

    const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
    console.log(`\n======================================================`);
    console.log(`🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ NLU GIAI ĐOẠN A (${testCases.length} CÂU HỎI TIẾNG VIỆT)`);
    console.log(`======================================================\n`);

    const groupStats = {};
    const failures = [];
    let totalPassed = 0;

    for (const tc of testCases) {
        if (!groupStats[tc.group]) {
            groupStats[tc.group] = { total: 0, passed: 0 };
        }
        groupStats[tc.group].total++;

        const result = nlu.processInput(tc.input);

        // 1. Kiểm tra Ý định (Intent check)
        const intentMatched = tc.expectedIntents.some(exp => result.intents.includes(exp));

        // 2. Kiểm tra Ngân sách (Budget check)
        let budgetMatched = true;
        if (tc.expectedBudget !== undefined) {
            if (tc.expectedBudget === null) {
                budgetMatched = result.entities.budget === null;
            } else {
                const target = result.entities.budget ? (result.entities.budget.target || result.entities.budget.max) : null;
                // Dung sai cho phép ±15% nếu là phép xấp xỉ
                budgetMatched = target !== null && Math.abs(target - tc.expectedBudget) <= (tc.expectedBudget * 0.15);
            }
        }

        // 3. Kiểm tra Thực thể Danh mục (Category check)
        let categoryMatched = true;
        if (tc.expectedCategory) {
            categoryMatched = result.entities.category === tc.expectedCategory;
        }

        // 4. Kiểm tra Thực thể Thương hiệu (Brand check)
        let brandMatched = true;
        if (tc.expectedBrand) {
            brandMatched = result.entities.brand === tc.expectedBrand;
        }

        const isPassed = intentMatched && budgetMatched && categoryMatched && brandMatched;

        if (isPassed) {
            groupStats[tc.group].passed++;
            totalPassed++;
        } else {
            failures.push({
                id: tc.id,
                group: tc.group,
                input: tc.input,
                expected: {
                    intents: tc.expectedIntents,
                    budget: tc.expectedBudget,
                    category: tc.expectedCategory,
                    brand: tc.expectedBrand
                },
                actual: {
                    intents: result.intents,
                    budget: result.entities.budget ? (result.entities.budget.target || result.entities.budget.max) : null,
                    category: result.entities.category,
                    brand: result.entities.brand,
                    normalized: result.normalized
                }
            });
        }
    }

    // In bảng thống kê theo từng nhóm
    console.log(`📊 BẢNG TỶ LỆ ĐÚNG THEO TỪNG NHÓM (ĐƠN LƯỢT):`);
    console.log(`---------------------------------------------------------------------------------`);
    console.log(`| STT | Nhóm Kiểm Thử (Group)        | Số Câu | Đúng | Tỷ Lệ Đạt  | Trạng Thái     |`);
    console.log(`---------------------------------------------------------------------------------`);

    const groupNames = {
        'abbreviations_unaccented': '1. Viết tắt / Không dấu   ',
        'budget':                   '2. Ngân sách / Khoảng giá',
        'bargain':                  '3. Mặc cả / Giảm giá    ',
        'policy':                   '4. Chính sách Việt Nam  ',
        'offtopic':                 '5. Tán gẫu / Lạc đề      ',
        'complaint':                '6. Khiếu nại / Bực bội   ',
        'jailbreak':                '7. Gài bẫy / Jailbreak   ',
        'out_of_catalog':           '8. Ngoài danh mục        '
    };

    let idx = 1;
    for (const [groupKey, stats] of Object.entries(groupStats)) {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        const name = groupNames[groupKey] || groupKey.padEnd(25);
        const status = stats.passed === stats.total ? '✅ HOÀN HẢO' : '⚠️ CẦN LƯU Ý';
        console.log(`| ${String(idx++).padStart(2)}  | ${name} |   ${String(stats.total).padStart(2)}   |  ${String(stats.passed).padStart(2)}  |   ${rate.padStart(5)}%   | ${status.padEnd(14)} |`);
    }
    console.log(`---------------------------------------------------------------------------------`);

    const overallRate = ((totalPassed / testCases.length) * 100).toFixed(1);
    console.log(`\n🏆 TỔNG KẾT PHẦN 1: ${totalPassed}/${testCases.length} CÂU ĐẠT (${overallRate}% CHÍNH XÁC)\n`);

    if (failures.length > 0) {
        console.log(`❌ DANH SÁCH ${failures.length} CÂU CHƯA ĐẠT:`);
        failures.forEach(f => {
            console.log(`  - [ID #${f.id} - ${f.group}] "${f.input}"`);
            console.log(`    + Kỳ vọng:`, JSON.stringify(f.expected));
            console.log(`    + Thực tế:`, JSON.stringify(f.actual));
        });
        console.log('');
    }

    // =========================================================================
    // PHẦN 2: KIỂM THỬ HỒI QUY HỘI THOẠI NHIỀU LƯỢT (MULTI-TURN REGRESSION SUITE)
    // =========================================================================
    const multiTurnPath = path.join(__dirname, 'multiTurnTestCases.json');
    let multiPassed = 0;
    let multiTotal = 0;
    const multiFailures = [];

    if (fs.existsSync(multiTurnPath)) {
        const multiCases = JSON.parse(fs.readFileSync(multiTurnPath, 'utf-8'));
        multiTotal = multiCases.length;
        console.log(`================================================================`);
        console.log(`🔄 BẮT ĐẦU CHẠY KIỂM THỬ HỒI QUY HỘI THOẠI NHIỀU LƯỢT (${multiTotal} CA KIỂM CHỨNG)`);
        console.log(`================================================================\n`);

        for (const tc of multiCases) {
            try {
                const res = await fetch('http://localhost:5000/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: tc.input,
                        context: tc.context || {}
                    })
                });

                if (!res.ok) {
                    throw new Error(`API HTTP Error: ${res.status}`);
                }

                const data = await res.json();
                const reply = data.reply || '';
                const suggestions = data.suggestions || [];
                const products = data.products || [];
                const context = data.context || {};

                let passed = true;
                const reasons = [];

                // 1. Kiểm tra các cụm từ BẮT BUỘC có trong reply
                if (tc.expected.replyMustInclude) {
                    for (const phrase of tc.expected.replyMustInclude) {
                        if (!reply.toLowerCase().includes(phrase.toLowerCase())) {
                            passed = false;
                            reasons.push(`Thiếu cụm từ bắt buộc: "${phrase}"`);
                        }
                    }
                }

                // 2. Kiểm tra các cụm từ CẤM có trong reply (chống xưng hô sai, chống hứa suông)
                if (tc.expected.replyMustNotInclude) {
                    for (const phrase of tc.expected.replyMustNotInclude) {
                        if (reply.toLowerCase().includes(phrase.toLowerCase())) {
                            passed = false;
                            reasons.push(`Chứa cụm từ bị cấm: "${phrase}"`);
                        }
                    }
                }

                // 3. Kiểm tra suggestions không chứa cụm từ vô lý (vd giá 10tr cho chuột)
                if (tc.expected.suggestionsMustNotInclude) {
                    for (const phrase of tc.expected.suggestionsMustNotInclude) {
                        const hasForbidden = suggestions.some(s => s.toLowerCase().includes(phrase.toLowerCase()));
                        if (hasForbidden) {
                            passed = false;
                            reasons.push(`Suggestions chứa mốc bị cấm: "${phrase}"`);
                        }
                    }
                }

                // 4. Kiểm tra chống lặp lại slot questionKey cũ
                if (tc.expected.notRepeatQuestionKey) {
                    if (context.lastQuestionKey === tc.expected.notRepeatQuestionKey) {
                        passed = false;
                        reasons.push(`Lặp lại questionKey cũ: "${tc.expected.notRepeatQuestionKey}"`);
                    }
                }

                // 5. Kiểm tra số lượng sản phẩm trả về
                if (tc.expected.productsMinCount !== undefined) {
                    if (products.length < tc.expected.productsMinCount) {
                        passed = false;
                        reasons.push(`Số sản phẩm trả về (${products.length}) ít hơn yêu cầu (${tc.expected.productsMinCount})`);
                    }
                }

                if (tc.expected.productsMaxCount !== undefined) {
                    if (products.length > tc.expected.productsMaxCount) {
                        passed = false;
                        reasons.push(`Số sản phẩm trả về (${products.length}) vượt quá mức cho phép (${tc.expected.productsMaxCount})`);
                    }
                }

                if (passed) {
                    multiPassed++;
                    console.log(`  ✅ [ID #${tc.id} - ${tc.group}] ${tc.title}`);
                } else {
                    multiFailures.push({
                        id: tc.id,
                        group: tc.group,
                        title: tc.title,
                        reasons,
                        replyPreview: reply.slice(0, 100) + '...'
                    });
                    console.log(`  ❌ [ID #${tc.id} - ${tc.group}] ${tc.title}`);
                    reasons.forEach(r => console.log(`     -> ${r}`));
                }
            } catch (err) {
                multiFailures.push({
                    id: tc.id,
                    group: tc.group,
                    title: tc.title,
                    reasons: [`Lỗi kết nối / thực thi: ${err.message}`]
                });
                console.log(`  ❌ [ID #${tc.id} - ${tc.group}] ${tc.title} -> ${err.message}`);
            }
        }

        const multiRate = ((multiPassed / multiTotal) * 100).toFixed(1);
        console.log(`\n🏆 TỔNG KẾT PHẦN 2 (KIỂM THỬ HỒI QUY): ${multiPassed}/${multiTotal} CA ĐẠT (${multiRate}% THÀNH CÔNG)\n`);
    }

    const allPassed = failures.length === 0 && multiFailures.length === 0;
    if (allPassed) {
        console.log(`🎉 CHÚC MỪNG: TOÀN BỘ ${testCases.length + multiTotal} TEST CASES ĐÃ ĐẠT 100% HOÀN HẢO!\n`);
        process.exit(0);
    } else {
        console.log(`⚠️ CÒN ${failures.length + multiFailures.length} TEST CASES CẦN ĐIỀU CHỈNH.\n`);
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error('Lỗi thực thi kiểm thử:', err);
    process.exit(1);
});
