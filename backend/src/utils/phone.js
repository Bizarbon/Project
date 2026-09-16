function normalizeVietnamPhone(value) {
    const compact = String(value || '')
        .trim()
        .replace(/[\s().-]/g, '');

    let subscriber = '';

    if (/^0\d{9}$/.test(compact)) {
        subscriber = compact.slice(1);
    } else if (/^\+84\d{9}$/.test(compact)) {
        subscriber = compact.slice(3);
    } else if (/^84\d{9}$/.test(compact)) {
        subscriber = compact.slice(2);
    } else {
        return null;
    }

    return {
        local: `0${subscriber}`,
        e164: `+84${subscriber}`
    };
}

function phoneVariants(value) {
    const normalized = normalizeVietnamPhone(value);
    if (!normalized) return [];

    return [
        normalized.local,
        normalized.e164,
        normalized.e164.slice(1)
    ];
}

module.exports = {
    normalizeVietnamPhone,
    phoneVariants
};
