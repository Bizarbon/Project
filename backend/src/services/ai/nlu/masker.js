/**
 * Tiện ích che mờ thông tin cá nhân (PII Masking) khi ghi log
 * TechEcommerce NLU System
 */

/**
 * Che số điện thoại (ví dụ: 0987654321 -> 098****321)
 * @param {string} text
 * @returns {string}
 */
function maskPhone(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/(0[3|5|7|8|9][0-9])([0-9]{4})([0-9]{3})/g, '$1****$3');
}

/**
 * Che email (ví dụ: nguyenvana@gmail.com -> ng***@gmail.com)
 * @param {string} text
 * @returns {string}
 */
function maskEmail(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/([a-zA-Z0-9._%+-]{1,2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***$2');
}

/**
 * Che toàn bộ thông tin cá nhân nhạy cảm trong chuỗi log
 * @param {string} text
 * @returns {string}
 */
function maskPII(text) {
    if (!text || typeof text !== 'string') return text;
    return maskEmail(maskPhone(text));
}

module.exports = {
    maskPII,
    maskPhone,
    maskEmail
};

