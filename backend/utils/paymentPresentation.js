const QRCode = require('qrcode');

const PROVIDER_LABELS = {
    bank_transfer: 'Chuyển khoản thủ công',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp'
};

function envValue(name) {
    return String(process.env[name] || '').trim();
}

function paymentReference(order) {
    return `TECH${String(order._id).padStart(6, '0')}`;
}

function installmentPaymentUrl(order) {
    const template = envValue('INSTALLMENT_PAYMENT_URL');
    if (!template) return '';
    return template
        .replaceAll('{orderId}', encodeURIComponent(order._id))
        .replaceAll('{amount}', encodeURIComponent(Math.round(Number(order.totalAmount || 0))))
        .replaceAll('{reference}', encodeURIComponent(paymentReference(order)));
}

function bankQrPayload(order) {
    const template = envValue('BANK_QR_PAYLOAD');
    if (!template) return '';
    return template
        .replaceAll('{amount}', String(Math.round(Number(order.totalAmount || 0))))
        .replaceAll('{reference}', paymentReference(order))
        .replaceAll('{accountNo}', envValue('BANK_ACCOUNT_NO'));
}

async function qrDataUrl(value) {
    if (!value) return '';
    return QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 360,
        color: { dark: '#10233f', light: '#ffffff' }
    });
}

async function buildPaymentPresentation(order) {
    const provider = String(order.paymentMethod || order.paymentProvider || '');
    const gatewayUrl = String(order.paymentMetadata?.paymentUrl || '').trim();
    const isGateway = provider === 'vnpay' || provider === 'momo';
    const isBankTransfer = provider === 'bank_transfer';
    const isBankDemo = isBankTransfer && envValue('BANK_TRANSFER_DEMO').toLowerCase() === 'true';
    const installmentUrl = provider === 'installment' ? installmentPaymentUrl(order) : '';
    const paymentUrl = gatewayUrl || installmentUrl;
    const bankPayload = isBankTransfer ? bankQrPayload(order) : '';
    const bankQrImageUrl = isBankTransfer ? envValue('BANK_QR_IMAGE_URL') : '';
    const shipment = order.shippingMetadata?.shipment || {};
    const isInternalTracking = shipment.provider === 'tech_internal' || shipment.trackingType === 'internal';

    return {
        orderId: order._id,
        provider,
        providerLabel: PROVIDER_LABELS[provider] || provider,
        amount: Number(order.totalAmount || 0),
        reference: paymentReference(order),
        expiresAt: order.paymentExpiresAt
            ? new Date(order.paymentExpiresAt).toISOString()
            : null,
        expired: order.paymentStatus === 'failed' && order.paymentMetadata?.expirationReason === 'payment_timeout',
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        trackingNumber: order.trackingNumber || '',
        shippingUnit: order.shippingUnit || '',
        trackingStatus: order.trackingNumber
            ? 'created'
            : order.shippingMetadata?.shipment?.reason || 'awaiting_confirmation',
        trackingMessage: order.trackingNumber
            ? isInternalTracking
                ? 'Cửa hàng đã tạo mã giao vận TECH để theo dõi nội bộ; mã hãng vận chuyển sẽ được cập nhật khi bàn giao.'
                : 'Đơn vị vận chuyển đã tiếp nhận đơn hàng.'
            : shipment.message || 'Mã vận đơn sẽ xuất hiện sau khi cửa hàng xác nhận và đơn vị vận chuyển tiếp nhận.',
        paymentUrl,
        qrCodeDataUrl: paymentUrl
            ? await qrDataUrl(paymentUrl)
            : bankPayload
            ? await qrDataUrl(bankPayload)
            : '',
        qrImageUrl: bankQrImageUrl,
        bank: isBankTransfer ? {
            name: envValue('BANK_NAME'),
            accountNo: envValue('BANK_ACCOUNT_NO'),
            accountName: envValue('BANK_ACCOUNT_NAME'),
            demo: isBankDemo
        } : null,
        installmentPlan: provider === 'installment' ? (order.paymentMetadata?.installmentPlan || null) : null,
        autoConfirm: isGateway || (isBankTransfer && !isBankDemo && Boolean(envValue('BANK_WEBHOOK_SECRET'))),
        instructions: isGateway
            ? 'Quét QR hoặc mở cổng thanh toán. Hệ thống chỉ xác nhận sau khi nhận callback hợp lệ từ cổng.'
            : provider === 'bank_transfer'
            ? envValue('BANK_WEBHOOK_SECRET')
                ? isBankDemo
                    ? `QR và tài khoản bên dưới chỉ dùng để minh họa. Không chuyển tiền thật. Nội dung đơn: ${paymentReference(order)}.`
                    : `Chuyển đúng số tiền với nội dung ${paymentReference(order)}. Hệ thống sẽ tự xác nhận khi nhận webhook đối soát hợp lệ.`
                : isBankDemo
                ? `QR và tài khoản bên dưới chỉ dùng để minh họa. Không chuyển tiền thật. Nội dung đơn: ${paymentReference(order)}.`
                : `Chuyển đúng số tiền với nội dung ${paymentReference(order)}. Quản trị viên sẽ xác nhận đơn sau khi đối soát giao dịch.`
            : installmentUrl
            ? 'Hoàn tất yêu cầu trả góp theo hướng dẫn của đối tác. Đơn được xử lý sau khi hồ sơ được xác nhận.'
            : `Hồ sơ trả góp ${Number(order.paymentMetadata?.installmentPlan?.term || order.paymentMetadata?.installmentTerm || 0)} tháng đã được tiếp nhận. Cửa hàng sẽ liên hệ để thẩm định và xác nhận; chưa phát sinh khoản thanh toán.`
    };
}

module.exports = {
    buildPaymentPresentation,
    paymentReference
};
