const crypto = require('crypto');
const axios = require('axios');

const VNPAY_DEFAULT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const MOMO_DEFAULT_URL = 'https://test-payment.momo.vn/v2/gateway/api/create';
const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5500';
const GMT7_OFFSET_MINUTES = 7 * 60;
const MOCK_TOKEN_SECRET = 'shopmini-payment-mock';

const PROVIDER_CONFIG = {
    vnpay: {
        label: 'VNPay',
        envKeys: ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET']
    },
    momo: {
        label: 'MoMo',
        envKeys: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']
    }
};

function envValue(name) {
    return String(process.env[name] || '').trim();
}

function gatewayMode() {
    return envValue('PAYMENT_GATEWAY_MODE') || 'real';
}

function isMockMode() {
    return gatewayMode().toLowerCase() === 'mock';
}

function sanitizeBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        if (!/^https?:$/.test(parsed.protocol)) return '';
        return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
        return '';
    }
}

function vercelBaseUrl() {
    const host = envValue('VERCEL_PROJECT_PRODUCTION_URL') || envValue('VERCEL_URL');
    if (!host) return '';
    return sanitizeBaseUrl(/^https?:\/\//i.test(host) ? host : `https://${host}`);
}

function appBaseUrl() {
    return sanitizeBaseUrl(process.env.APP_BASE_URL)
        || vercelBaseUrl()
        || sanitizeBaseUrl(process.env.RENDER_EXTERNAL_URL)
        || `http://localhost:${process.env.PORT || 5000}`;
}

function frontendBaseUrl(override) {
    return sanitizeBaseUrl(override)
        || sanitizeBaseUrl(process.env.FRONTEND_BASE_URL)
        || vercelBaseUrl()
        || sanitizeBaseUrl(process.env.RENDER_EXTERNAL_URL)
        || DEFAULT_FRONTEND_BASE_URL;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const fallback = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
    let ip = forwarded ? forwarded.split(',')[0].trim() : fallback;

    if (ip === '::1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip || '127.0.0.1';
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatDate(date) {
    const shifted = new Date(date.getTime() + (date.getTimezoneOffset() + GMT7_OFFSET_MINUTES) * 60 * 1000);

    return [
        shifted.getUTCFullYear(),
        pad(shifted.getUTCMonth() + 1),
        pad(shifted.getUTCDate())
    ].join('') + [
        pad(shifted.getUTCHours()),
        pad(shifted.getUTCMinutes()),
        pad(shifted.getUTCSeconds())
    ].join('');
}

function sortParams(params) {
    return Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
        .sort()
        .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {});
}

function encodeValue(value) {
    return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

function toQueryString(params) {
    return Object.entries(sortParams(params))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeValue(value)}`)
        .join('&');
}

function signHmac(algorithm, secret, raw) {
    return crypto.createHmac(algorithm, secret).update(raw, 'utf8').digest('hex');
}

function missingProviderKeys(provider) {
    const config = PROVIDER_CONFIG[provider];
    if (!config) return [];
    return config.envKeys.filter(key => !envValue(key));
}

function paymentProviderStatus(provider) {
    const config = PROVIDER_CONFIG[provider];
    if (!config) return null;

    const missingKeys = missingProviderKeys(provider);
    if (isMockMode()) {
        return {
            provider,
            label: config.label,
            configured: true,
            mode: 'mock',
            missingKeys,
            message: `${config.label} đang chạy chế độ mô phỏng an toàn.`
        };
    }

    return {
        provider,
        label: config.label,
        configured: missingKeys.length === 0,
        mode: 'real',
        missingKeys,
        message: missingKeys.length
            ? `${config.label} chua duoc cau hinh trong backend. Thieu: ${missingKeys.join(', ')}`
            : `${config.label} da san sang.`
    };
}

function getPaymentProvidersStatus() {
    return {
        cod: {
            provider: 'cod',
            label: 'COD',
            configured: true,
            missingKeys: [],
            message: 'COD luon kha dung.'
        },
        bank_transfer: {
            provider: 'bank_transfer',
            label: 'Chuyen khoan',
            configured: true,
            missingKeys: [],
            message: 'Chuyen khoan thu cong luon kha dung.'
        },
        installment: {
            provider: 'installment',
            label: 'Tra gop',
            configured: true,
            missingKeys: [],
            message: 'Tra gop luon kha dung.'
        },
        vnpay: paymentProviderStatus('vnpay'),
        momo: paymentProviderStatus('momo')
    };
}

function ensurePaymentConfigured(provider) {
    const status = paymentProviderStatus(provider);
    if (status && !status.configured) {
        const error = new Error(status.message);
        error.statusCode = 503;
        error.missingKeys = status.missingKeys;
        throw error;
    }
}

function mockPaymentToken(provider, orderId, mockRef) {
    return signHmac('sha256', envValue('JWT_SECRET') || MOCK_TOKEN_SECRET, `${provider}|${orderId}|${mockRef}`);
}

function createMockPayment(order, provider) {
    const mockRef = `MOCK-${provider.toUpperCase()}-${order._id}-${Date.now()}`;
    const params = new URLSearchParams({
        orderId: String(order._id),
        ref: mockRef,
        token: mockPaymentToken(provider, order._id, mockRef)
    });

    return {
        paymentUrl: `${appBaseUrl()}/api/payments/mock/${provider}?${params.toString()}`,
        mockRef
    };
}

function shouldUseMockProvider(provider) {
    return isMockMode();
}

function sanitizeVnpayOrderInfo(value) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^0-9A-Za-z .,:/_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return (normalized || 'Thanh toan don hang').slice(0, 255);
}

function createVnpayPayment(order, req) {
    ensurePaymentConfigured('vnpay');
    if (shouldUseMockProvider('vnpay')) {
        const payment = createMockPayment(order, 'vnpay');
        return { paymentUrl: payment.paymentUrl, txnRef: payment.mockRef };
    }

    const amount = Math.round(Number(order.totalAmount || 0));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        const error = new Error('Số tiền thanh toán VNPay không hợp lệ.');
        error.statusCode = 400;
        throw error;
    }

    const now = new Date();
    const expire = new Date(now.getTime() + 15 * 60 * 1000);
    const txnRef = `${order._id}-${Date.now()}`;
    const params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: envValue('VNPAY_TMN_CODE'),
        vnp_Amount: amount * 100,
        vnp_CreateDate: formatDate(now),
        vnp_CurrCode: 'VND',
        vnp_IpAddr: getClientIp(req),
        vnp_Locale: 'vn',
        vnp_OrderInfo: sanitizeVnpayOrderInfo(`Thanh toan don hang ${order._id}`),
        vnp_OrderType: 'other',
        vnp_ReturnUrl: `${appBaseUrl()}/api/payments/vnpay/return`,
        vnp_ExpireDate: formatDate(expire),
        vnp_TxnRef: txnRef
    };

    const signedQuery = toQueryString(params);
    const secureHash = signHmac('sha512', envValue('VNPAY_HASH_SECRET'), signedQuery);
    const paymentUrl = `${process.env.VNPAY_PAYMENT_URL || VNPAY_DEFAULT_URL}?${signedQuery}&vnp_SecureHash=${secureHash}`;

    return { paymentUrl, txnRef };
}

function verifyVnpayParams(query) {
    const secureHash = query.vnp_SecureHash;
    const params = { ...query };
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const signedQuery = toQueryString(params);
    const expected = signHmac('sha512', envValue('VNPAY_HASH_SECRET'), signedQuery);

    const received = String(secureHash || '').toLowerCase();
    const merchantMatches = String(query.vnp_TmnCode || '') === envValue('VNPAY_TMN_CODE');
    if (!merchantMatches || received.length !== expected.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
}

function momoRawSignature(fields) {
    return [
        `accessKey=${envValue('MOMO_ACCESS_KEY')}`,
        `amount=${fields.amount}`,
        `extraData=${fields.extraData || ''}`,
        `ipnUrl=${fields.ipnUrl}`,
        `orderId=${fields.orderId}`,
        `orderInfo=${fields.orderInfo}`,
        `partnerCode=${fields.partnerCode}`,
        `redirectUrl=${fields.redirectUrl}`,
        `requestId=${fields.requestId}`,
        `requestType=${fields.requestType}`
    ].join('&');
}

function momoResultRawSignature(fields) {
    const pairs = [
        ['accessKey', envValue('MOMO_ACCESS_KEY')],
        ['amount', fields.amount],
        ['extraData', fields.extraData || ''],
        ['message', fields.message],
        ['orderId', fields.orderId],
        ['orderInfo', fields.orderInfo],
        ['orderType', fields.orderType],
        ['partnerCode', fields.partnerCode],
        ['payType', fields.payType],
        ['requestId', fields.requestId],
        ['responseTime', fields.responseTime],
        ['resultCode', fields.resultCode],
        ['transId', fields.transId]
    ];

    return pairs
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

function verifyMomoParams(fields) {
    const signature = fields.signature;
    if (!signature) return false;

    const expected = signHmac('sha256', envValue('MOMO_SECRET_KEY'), momoResultRawSignature(fields));
    return expected.toLowerCase() === String(signature).toLowerCase();
}

async function createMomoPayment(order) {
    ensurePaymentConfigured('momo');
    if (shouldUseMockProvider('momo')) {
        const payment = createMockPayment(order, 'momo');
        return {
            paymentUrl: payment.paymentUrl,
            momoOrderId: payment.mockRef,
            requestId: payment.mockRef,
            response: { mock: true, payUrl: payment.paymentUrl }
        };
    }

    const orderId = `SM${order._id}-${Date.now()}`;
    const requestId = orderId;
    const extraData = Buffer.from(JSON.stringify({ orderId: order._id })).toString('base64');
    const body = {
        partnerCode: envValue('MOMO_PARTNER_CODE'),
        storeName: envValue('MOMO_STORE_NAME') || envValue('MOMO_STORE_ID') || 'ShopMini',
        storeId: envValue('MOMO_STORE_ID') || 'ShopMini',
        requestType: 'captureWallet',
        ipnUrl: `${appBaseUrl()}/api/payments/momo/ipn`,
        redirectUrl: `${appBaseUrl()}/api/payments/momo/return`,
        orderId,
        amount: String(Math.round(Number(order.totalAmount || 0))),
        lang: 'vi',
        orderInfo: `Thanh toan don hang ${order._id}`,
        requestId,
        extraData,
        autoCapture: true
    };

    body.signature = signHmac('sha256', envValue('MOMO_SECRET_KEY'), momoRawSignature(body));

    const response = await axios.post(process.env.MOMO_CREATE_URL || MOMO_DEFAULT_URL, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
    });

    if (!response.data?.payUrl) {
        const error = new Error(response.data?.message || 'Khong tao duoc lien ket thanh toan MoMo.');
        error.statusCode = 400;
        error.payload = response.data;
        throw error;
    }

    return {
        paymentUrl: response.data.payUrl,
        momoOrderId: orderId,
        requestId,
        response: response.data
    };
}

function paymentResultRedirect(provider, orderId, status, message, baseUrlOverride) {
    const params = new URLSearchParams({
        provider,
        orderId: String(orderId || ''),
        status,
        message: message || ''
    });

    return `${frontendBaseUrl(baseUrlOverride)}/pages/checkout/payment-result.html?${params.toString()}`;
}

module.exports = {
    getPaymentProvidersStatus,
    createMockPayment,
    mockPaymentToken,
    ensurePaymentConfigured,
    createVnpayPayment,
    verifyVnpayParams,
    createMomoPayment,
    verifyMomoParams,
    paymentResultRedirect
};
