/**
 * Module Phân tích và trích xuất ngân sách (Budget Parser)
 * TechEcommerce NLU System
 */

const { DEFAULT_RANGE_RATIO } = require('./config');

/**
 * Chuyển đổi chuỗi số và đơn vị thành số tiền VND nguyên vẹn
 * @param {string} numStr - Ví dụ: "15", "1.5", "1,5", "500"
 * @param {string} unitStr - Ví dụ: "tr", "triệu", "củ", "chai", "k", "nghìn", "loét"
 * @returns {number|null}
 */
function parseAmount(numStr, unitStr) {
    if (!numStr) return null;
    const cleanNum = parseFloat(numStr.replace(',', '.'));
    if (isNaN(cleanNum) || cleanNum <= 0) return null;

    const unit = String(unitStr || '').toLowerCase().trim();

    if (/^(tr|triệu|trieu|củ|cu|chai|m)$/.test(unit)) {
        return Math.round(cleanNum * 1000000);
    }
    if (/^(k|nghìn|nghin|ngàn|ngan|loét|loet)$/.test(unit)) {
        return Math.round(cleanNum * 1000);
    }
    if (/^(đ|vnd|dong|đồng)$/.test(unit)) {
        // Nếu số >= 100000 thì là số tiền trực tiếp (vd: 500000đ, 15000000đ)
        if (cleanNum >= 100000) return Math.round(cleanNum);
        // Nếu số nhỏ như 15đ -> có thể viết tắt triệu
        if (cleanNum <= 100) return Math.round(cleanNum * 1000000);
    }
    return null;
}

/**
 * Trích xuất ngân sách từ câu nói của khách
 * @param {string} text - Câu văn bản đã qua normalize
 * @returns {{ min: number|null, max: number|null, target: number|null, currency: string, confidence: number } | null}
 */
function parseBudget(text) {
    if (!text || typeof text !== 'string') return null;

    // Chuẩn hóa nhẹ chuỗi để tìm kiếm pattern
    const s = text.toLowerCase().replace(/\s+/g, ' ');

    // Đơn vị tiền tệ hỗ trợ
    const unitPattern = '(?:tr(?:iệu)?|củ|cu|chai|k|nghìn|nghin|ngàn|ngan|loét|loet|m|đ|vnd)';
    const numPattern = '(\\d+(?:[.,]\\d+)?)';

    // 1. Dạng KHOẢNG / TỪ ... ĐẾN (Range): "từ 10 đến 15tr", "từ 10tr đến 15tr", "10 - 15tr", "10-15 triệu"
    const rangeRegex1 = new RegExp(`(?:từ|tu)?\\s*${numPattern}\\s*${unitPattern}?\\s*(?:đến|den|tới|toi|-)\\s*${numPattern}\\s*(${unitPattern})`, 'i');
    const rangeMatch1 = s.match(rangeRegex1);
    if (rangeMatch1) {
        const val1 = parseFloat(rangeMatch1[1].replace(',', '.'));
        const val2 = parseFloat(rangeMatch1[2].replace(',', '.'));
        const unit = rangeMatch1[3];
        
        let minAmount = parseAmount(String(val1), unit);
        let maxAmount = parseAmount(String(val2), unit);

        // Kiểm tra xem val1 có đơn vị riêng không
        const separateUnitMatch = s.match(new RegExp(`${numPattern}\\s*(${unitPattern})\\s*(?:đến|den|tới|toi|-)\\s*${numPattern}\\s*${unitPattern}`, 'i'));
        if (separateUnitMatch) {
            minAmount = parseAmount(separateUnitMatch[1], separateUnitMatch[2]);
        }

        if (minAmount && maxAmount) {
            if (minAmount > maxAmount) {
                const temp = minAmount;
                minAmount = maxAmount;
                maxAmount = temp;
            }
            return {
                min: minAmount,
                max: maxAmount,
                target: Math.round((minAmount + maxAmount) / 2),
                currency: 'VND',
                confidence: 0.95
            };
        }
    }

    // 2. Dạng GIỚI HẠN TRÊN (Max): "dưới 20tr", "tối đa 20tr", "quay đầu 20tr", "<= 20tr", "20tr đổ lại", "dưới 500k"
    const maxRegex = new RegExp(`(?:dưới|duoi|tối đa|toi da|quay đầu|quay dau|đổ lại|do lai|trở xuống|tro xuong|<=|<)\\s*${numPattern}\\s*(${unitPattern})`, 'i');
    const maxMatch = s.match(maxRegex);
    if (maxMatch) {
        const amount = parseAmount(maxMatch[1], maxMatch[2]);
        if (amount) {
            return {
                min: null,
                max: amount,
                target: amount,
                currency: 'VND',
                confidence: 0.9
            };
        }
    }
    // Dạng số đứng trước cụm "đổ lại / quay đầu": "20tr đổ lại"
    const maxSuffixRegex = new RegExp(`${numPattern}\\s*(${unitPattern})\\s*(?:đổ lại|do lai|quay đầu|quay dau|trở xuống|tro xuong)`, 'i');
    const maxSuffixMatch = s.match(maxSuffixRegex);
    if (maxSuffixMatch) {
        const amount = parseAmount(maxSuffixMatch[1], maxSuffixMatch[2]);
        if (amount) {
            return {
                min: null,
                max: amount,
                target: amount,
                currency: 'VND',
                confidence: 0.9
            };
        }
    }

    // 3. Dạng GIỚI HẠN DƯỚI (Min): "trên 10 triệu", "tối thiểu 10tr", "từ 10tr trở lên", ">= 10tr", "hơn 10tr"
    const minRegex = new RegExp(`(?:trên|tren|tối thiểu|toi thieu|từ|tu|hơn|hon|>=|>)\\s*${numPattern}\\s*(${unitPattern})(?:\\s*(?:trở lên|tro len))?`, 'i');
    const minMatch = s.match(minRegex);
    if (minMatch && !/đến|den|tới|toi|-/.test(s)) {
        const amount = parseAmount(minMatch[1], minMatch[2]);
        if (amount) {
            return {
                min: amount,
                max: null,
                target: amount,
                currency: 'VND',
                confidence: 0.9
            };
        }
    }

    // 4. Dạng KHOẢNG / TẦM / CỠ (Approximate): "khoảng 15tr", "tầm 15tr", "cỡ 15 củ", "ngân sách 15 triệu"
    const approxRegex = new RegExp(`(?:khoảng|khoang|tầm|tam|cỡ|co|ngân sách|ngan sach|tài chính|tai chinh|tầm giá|tam gia)\\s*${numPattern}\\s*(${unitPattern})`, 'i');
    const approxMatch = s.match(approxRegex);
    if (approxMatch) {
        const amount = parseAmount(approxMatch[1], approxMatch[2]);
        if (amount) {
            const range = Math.round(amount * DEFAULT_RANGE_RATIO);
            return {
                min: Math.max(0, amount - range),
                max: amount + range,
                target: amount,
                currency: 'VND',
                confidence: 0.85
            };
        }
    }

    // 5. Dạng SỐ ĐƠN CÓ ĐƠN VỊ TIỀN RÕ RÀNG (Single exact): "15tr", "15 triệu", "15 củ", "500k", "15 chai"
    // Phải kiểm tra cẩn thận để không bắt nhầm thông số kỹ thuật (vd: iPhone 15, 16GB RAM, 14 inch, 120Hz, 100W)
    const singleRegex = new RegExp(`(?:^|\\s)${numPattern}\\s*(${unitPattern})(?:$|\\s|[,.!?;])`, 'i');
    const singleMatch = s.match(singleRegex);
    if (singleMatch) {
        // Loại trừ các trường hợp tên model / cấu hình:
        // ví dụ: "iphone 15", "ipad gen 10", "16gb", "14 inch"
        const beforeMatch = s.substring(0, singleMatch.index || 0);
        if (/iphone|galaxy|ipad|mi|nova|gen|core|ryzen|rtx|gtx|inch|hz|w|gb|tb|mah/i.test(beforeMatch.slice(-15))) {
            return null;
        }

        const amount = parseAmount(singleMatch[1], singleMatch[2]);
        if (amount) {
            const range = Math.round(amount * DEFAULT_RANGE_RATIO);
            return {
                min: Math.max(0, amount - range),
                max: amount + range,
                target: amount,
                currency: 'VND',
                confidence: 0.8
            };
        }
    }

    // Không tìm thấy hoặc không chắc chắn -> trả null theo đúng quy tắc
    return null;
}

module.exports = {
    parseBudget,
    parseAmount
};

