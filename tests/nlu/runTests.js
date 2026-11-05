/**
 * Test Runner cho Bộ Kiểm Thử NLU (Giai đoạn A)
 * Script: npm run test:nlu
 * TechEcommerce NLU System
 */

const fs = require('fs');
const path = require('path');
const nlu = require('../../backend/src/services/nlu');

function runAllTests() {
    const testCasesPath = path.join(__dirname, 'testCases.json');
    if (!fs.existsSync(testCasesPath)) {
        console.error('Không tìm thấy file test cases tại:', testCasesPath);
        process.exit(1);
    }

    const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
    console.log(`\n======================================================`);
    console.log(`🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ NLU (${testCases.length} CÂU HỎI TIẾNG VIỆT)`);
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
                // Dung sai cho phép ±10% nếu là phép xấp xỉ
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
    console.log(`📊 BẢNG TỶ LỆ ĐÚNG THEO TỪNG NHÓM:`);
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
    console.log(`\n🏆 TỔNG KẾT: ${totalPassed}/${testCases.length} CÂU ĐẠT (${overallRate}% CHÍNH XÁC)\n`);

    if (failures.length > 0) {
        console.log(`❌ DANH SÁCH ${failures.length} CÂU CHƯA ĐẠT:`);
        failures.forEach(f => {
            console.log(`  - [ID #${f.id} - ${f.group}] "${f.input}"`);
            console.log(`    + Kỳ vọng:`, JSON.stringify(f.expected));
            console.log(`    + Thực tế:`, JSON.stringify(f.actual));
        });
        console.log('');
    } else {
        console.log(`🎉 TẤT CẢ CÁC TEST CASES ĐÃ ĐẠT 100%!\n`);
    }

    if (totalPassed === testCases.length) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runAllTests();

