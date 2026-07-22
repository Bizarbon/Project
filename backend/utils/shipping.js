const PROVINCE_NAMES = {
    '91': 'An Giang', '24': 'Bắc Ninh', '96': 'Cà Mau', '04': 'Cao Bằng',
    '66': 'Đắk Lắk', '11': 'Điện Biên', '75': 'Đồng Nai', '82': 'Đồng Tháp',
    '52': 'Gia Lai', '42': 'Hà Tĩnh', '33': 'Hưng Yên', '56': 'Khánh Hòa',
    '12': 'Lai Châu', '20': 'Lạng Sơn', '15': 'Lào Cai', '68': 'Lâm Đồng',
    '40': 'Nghệ An', '37': 'Ninh Bình', '25': 'Phú Thọ', '51': 'Quảng Ngãi',
    '22': 'Quảng Ninh', '44': 'Quảng Trị', '14': 'Sơn La', '80': 'Tây Ninh',
    '19': 'Thái Nguyên', '38': 'Thanh Hóa', '92': 'Thành phố Cần Thơ',
    '48': 'Thành phố Đà Nẵng', '01': 'Thành phố Hà Nội', '31': 'Thành phố Hải Phòng',
    '79': 'Thành phố Hồ Chí Minh', '46': 'Thành phố Huế', '08': 'Tuyên Quang', '86': 'Vĩnh Long'
};

const ZONE_CODES = {
    local: new Set(['79']),
    nearby: new Set(['75', '80']),
    south: new Set(['91', '96', '82', '92', '86']),
    central: new Set(['66', '68', '52', '56', '51', '48', '46', '44', '42', '40', '38', '37'])
};

const ZONE_LABELS = {
    local: 'Nội thành TP. Hồ Chí Minh',
    nearby: 'Khu vực lân cận TP. Hồ Chí Minh',
    south: 'Miền Nam',
    central: 'Miền Trung và Tây Nguyên',
    north: 'Miền Bắc'
};

function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();
}

function provinceCodeFromAddress(address) {
    const normalized = normalize(address);
    return Object.entries(PROVINCE_NAMES).find(([, name]) => {
        const simple = normalize(name).replace(/^(thanh pho|tinh)\s+/, '');
        return normalized.includes(normalize(name)) || normalized.includes(simple);
    })?.[0] || '';
}

function shippingZone(provinceCode) {
    const code = String(provinceCode || '').padStart(2, '0');
    if (!PROVINCE_NAMES[code]) return '';
    return Object.entries(ZONE_CODES).find(([, codes]) => codes.has(code))?.[0] || 'north';
}

function feeForZone(zone) {
    const envMap = {
        local: 'SHIPPING_FEE_LOCAL', nearby: 'SHIPPING_FEE_NEARBY', south: 'SHIPPING_FEE_SOUTH',
        central: 'SHIPPING_FEE_CENTRAL', north: 'SHIPPING_FEE_NORTH'
    };
    const defaults = { local: 30000, nearby: 35000, south: 40000, central: 45000, north: 50000 };
    const configured = Number(process.env[envMap[zone]]);
    return Math.max(Number.isFinite(configured) ? configured : defaults[zone], 0);
}

function quoteShipping({ provinceCode, address }) {
    const resolvedCode = String(provinceCode || '').padStart(2, '0');
    const code = PROVINCE_NAMES[resolvedCode] ? resolvedCode : provinceCodeFromAddress(address);
    const zone = shippingZone(code);
    if (!zone) {
        const error = new Error('Chưa xác định được Tỉnh/Thành để đề xuất phí vận chuyển. Vui lòng chọn địa chỉ giao hàng.');
        error.statusCode = 400;
        throw error;
    }
    return {
        provinceCode: code,
        provinceName: PROVINCE_NAMES[code],
        zone,
        zoneLabel: ZONE_LABELS[zone],
        fee: feeForZone(zone),
        currency: 'VND',
        serviceCode: 'standard',
        serviceLabel: 'Giao hàng tiêu chuẩn',
        calculationBasis: 'province_zone',
        source: 'store_estimate',
        isCarrierQuote: false,
        requiresCarrierConfirmation: true,
        message: 'Phí tạm tính theo Tỉnh/Thành. Cửa hàng sẽ cập nhật nếu hãng vận chuyển báo giá khác.'
    };
}

module.exports = { quoteShipping, provinceCodeFromAddress };
