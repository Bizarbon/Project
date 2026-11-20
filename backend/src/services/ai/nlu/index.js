/**
 * NLU & Guardrails Service (Giai đoạn A)
 * TechEcommerce - AI Shopping Assistant
 */

const config = require('./config');
const { normalizeText, removeVietnameseAccents } = require('./normalizer');
const { parseBudget } = require('./budgetParser');
const { classifyIntent, extractBrand, extractCategory } = require('./intentClassifier');
const { applyPreGuardrails, applyPostGuardrails } = require('./guardrails');
const { maskPII } = require('./masker');

/**
 * Xử lý toàn diện đầu vào của người dùng qua pipeline NLU
 * @param {string} rawMessage - Tin nhắn thô của người dùng
 * @param {object} context - Ngữ cảnh hội thoại hiện tại
 * @returns {{
 *   original: string,
 *   normalized: string,
 *   unaccented: string,
 *   intents: string[],
 *   confidence: number,
 *   entities: {
 *     budget: object|null,
 *     brand: string|null,
 *     category: string|null
 *   }
 * }}
 */
function processInput(rawMessage, context = {}) {
    const textNorm = normalizeText(rawMessage);
    const classification = classifyIntent(textNorm.normalized, textNorm.unaccented);

    return {
        original: textNorm.original,
        normalized: textNorm.normalized,
        unaccented: textNorm.unaccented,
        intents: classification.intents,
        confidence: classification.confidence,
        entities: classification.entities
    };
}

module.exports = {
    config,
    processInput,
    normalizeText,
    removeVietnameseAccents,
    parseBudget,
    classifyIntent,
    extractBrand,
    extractCategory,
    applyPreGuardrails,
    applyPostGuardrails,
    maskPII
};

