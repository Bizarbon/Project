/**
 * Module Chuẩn hóa văn bản Tiếng Việt (Normalizer)
 * TechEcommerce NLU System
 */

const fs = require('fs');
const path = require('path');

// Đọc từ điển biệt danh và viết tắt
let dictionary = { exactWords: {} };
try {
    const dictPath = path.join(__dirname, 'dictionary.json');
    if (fs.existsSync(dictPath)) {
        dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
    }
} catch (err) {
    console.warn('[Normalizer Warning] Không thể đọc dictionary.json:', err.message);
}

/**
 * Loại bỏ dấu tiếng Việt chuẩn xác (dùng native String.prototype.normalize, không thêm thư viện)
 * @param {string} text
 * @returns {string}
 */
function removeVietnameseAccents(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim();
}

/**
 * Chuẩn hóa chuỗi đầu vào theo tiêu chuẩn NLU tiếng Việt
 * @param {string} raw - Chuỗi nguyên bản của người dùng
 * @returns {{ original: string, normalized: string, unaccented: string }}
 */
function normalizeText(raw) {
    const original = String(raw || '');
    if (!original.trim()) {
        return { original, normalized: '', unaccented: '' };
    }

    // 1. Chuyển Unicode sang NFC chuẩn hóa, chuyển chữ thường và gộp khoảng trắng
    let text = original.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

    // 2. Bảo vệ các mã SKU và model đặc thù (vd: TECH-00169, Type-C, Core-i5)
    const preservedTokens = [];
    text = text.replace(/\b(tech-\d+|[a-z0-9]+-[a-z0-9]+)\b/gi, (match) => {
        const placeholder = `__PRESERVED_${preservedTokens.length}__`;
        preservedTokens.push(match);
        return placeholder;
    });

    // 3. Xử lý ngữ cảnh đặc biệt: "k" sau số (vd "500k", "15k", "50k") là nghìn, KHÔNG phải "không"
    // Tạm thời bảo vệ định dạng số + k (vd: 500k -> __K_NUMBER_0__)
    const kNumbers = [];
    text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*k\b/gi, (match, num) => {
        const placeholder = `__K_NUM_${kNumbers.length}__`;
        kNumbers.push(`${num}k`);
        return placeholder;
    });

    // 4. Thay thế từ điển viết tắt / tiếng lóng theo ranh giới từ nguyên vẹn (word boundary)
    const exactWords = dictionary.exactWords || {};
    for (const [abbr, expansion] of Object.entries(exactWords)) {
        // Tạo regex với word boundary an toàn cho cả ký tự tiếng Việt
        // Với từ đơn như "k", "đc", "dc", "ip", "ss"
        const escapedAbbr = abbr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])${escapedAbbr}(?=[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|$)`, 'gi');
        
        text = text.replace(regex, (match, prefix) => {
            return `${prefix}${expansion}`;
        });
    }

    // 5. Khôi phục các số có đuôi k (500k)
    kNumbers.forEach((val, idx) => {
        text = text.replace(`__K_NUM_${idx}__`, val);
    });

    // 6. Khôi phục các mã sản phẩm/SKU đã bảo vệ
    preservedTokens.forEach((val, idx) => {
        text = text.replace(`__PRESERVED_${idx}__`, val);
    });

    // 7. Gộp lại khoảng trắng sau khi mở rộng từ viết tắt
    const normalized = text.replace(/\s+/g, ' ').trim();

    // 8. Tạo bản unaccented (bỏ dấu) từ bản normalized
    const unaccented = removeVietnameseAccents(normalized);

    return {
        original,
        normalized,
        unaccented
    };
}

module.exports = {
    normalizeText,
    removeVietnameseAccents
};

