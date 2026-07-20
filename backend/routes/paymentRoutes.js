const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { restoreOrderStock } = require('../utils/orderStock');
const {
    getPaymentProvidersStatus,
    mockPaymentToken,
    verifyVnpayParams,
    verifyMomoParams,
    paymentResultRedirect
} = require('../utils/payments');

function orderIdFromGatewayRef(ref) {
    if (!ref) return null;

    const normalized = String(ref).trim();
    if (!normalized) return null;

    if (/^\d+$/.test(normalized)) return Number(normalized);

    const match = normalized.match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

function decodeMomoExtraData(extraData) {
    if (!extraData) return {};

    try {
        return JSON.parse(Buffer.from(String(extraData), 'base64').toString('utf8'));
    } catch (error) {
        return {};
    }
}

async function findOrderForPayment({ gatewayOrderId, gatewayRequestId, extraData }) {
    const filters = [];

    if (gatewayOrderId) filters.push({ paymentOrderId: String(gatewayOrderId) });
    if (gatewayRequestId) filters.push({ paymentRequestId: String(gatewayRequestId) });

    const decoded = decodeMomoExtraData(extraData);
    const fallbackOrderId = Number(decoded.orderId) || orderIdFromGatewayRef(gatewayOrderId) || orderIdFromGatewayRef(gatewayRequestId);
    if (fallbackOrderId) filters.push({ _id: fallbackOrderId });

    if (!filters.length) return null;
    return Order.findOne({ $or: filters });
}

function amountMatches(order, amount, multiplier = 1) {
    return Math.round(Number(order.totalAmount) * multiplier) === Math.round(Number(amount));
}

function checkoutOrigin(order) {
    const origin = order?.paymentMetadata?.checkoutOrigin;
    return /^https?:\/\//.test(String(origin || '')) ? String(origin) : undefined;
}

function redirectResult(res, order, provider, status, message, fallbackOrderId) {
    return res.redirect(
        paymentResultRedirect(
            provider,
            order?._id || fallbackOrderId,
            status,
            message,
            checkoutOrigin(order)
        )
    );
}

function isFinalPaymentStatus(order) {
    return ['paid', 'failed', 'refunded'].includes(order?.paymentStatus);
}

function isSettledPayment(order) {
    return ['paid', 'refunded'].includes(order?.paymentStatus);
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function formatVnd(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')} VND`;
}

function verifyMockPaymentRequest(provider, orderId, ref, token) {
    if (!['vnpay', 'momo'].includes(provider)) return false;
    if (!orderId || !ref || !token) return false;
    return mockPaymentToken(provider, orderId, ref) === String(token);
}

async function markPaid(order, provider, transactionId, metadata = {}) {
    if (!order) return null;

    order.paymentStatus = 'paid';
    order.paymentProvider = provider || order.paymentProvider || 'manual';
    order.paymentTransactionId = transactionId ? String(transactionId) : order.paymentTransactionId;
    order.paidAt = order.paidAt || new Date();
    order.paymentMetadata = {
        ...(order.paymentMetadata || {}),
        ...metadata
    };

    await order.save();
    return order;
}

async function markFailed(order, provider, metadata = {}) {
    if (!order || order.paymentStatus === 'paid') return order;

    order.paymentStatus = 'failed';
    order.paymentProvider = provider || order.paymentProvider || 'manual';
    order.paymentMetadata = {
        ...(order.paymentMetadata || {}),
        ...metadata
    };

    if (!order.stockRestored) {
        await restoreOrderStock(order);
    }
    if (order.status === 'pending') {
        order.status = 'cancelled';
    }

    await order.save();
    return order;
}

router.get('/providers', (req, res) => {
    res.json({ providers: getPaymentProvidersStatus() });
});

router.get('/mock/:provider', async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const orderId = Number(req.query.orderId);
    const ref = String(req.query.ref || '');
    const token = String(req.query.token || '');

    try {
        if (!verifyMockPaymentRequest(provider, orderId, ref, token)) {
            return res.status(400).send('Mock payment request is invalid.');
        }

        const order = await findOrderForPayment({
            gatewayOrderId: ref,
            gatewayRequestId: ref
        });
        if (!order) return res.status(404).send('Order not found.');

        const providerName = provider === 'vnpay' ? 'VNPay' : 'MoMo';
        const base = `/api/payments/mock/${provider}/complete?orderId=${encodeURIComponent(order._id)}&ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`;

        return res.send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${providerName} Sandbox - TechEcommerce</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f3f6fb;color:#172033}
    .box{width:min(92vw,460px);background:white;border-radius:14px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.16);text-align:center}
    .brand{font-weight:800;font-size:26px;margin-bottom:8px;color:${provider === 'momo' ? '#a50064' : '#005baa'}}
    .meta{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:18px 0;text-align:left;line-height:1.8}
    a{display:block;text-decoration:none;border-radius:10px;padding:12px 16px;margin-top:10px;font-weight:700}
    .pay{background:#16a34a;color:white}.fail{background:#fee2e2;color:#991b1b}.muted{color:#64748b;font-size:13px}
  </style>
</head>
<body>
  <main class="box">
    <div class="brand">${providerName} Sandbox</div>
    <div class="muted">Trang mô phỏng thanh toán phục vụ kiểm thử TechEcommerce</div>
    <div class="meta">
      <div><strong>Đơn hàng:</strong> #${escapeHTML(order._id)}</div>
      <div><strong>Khách hàng:</strong> ${escapeHTML(order.recipientName || order.customerName)}</div>
      <div><strong>Số tiền:</strong> ${escapeHTML(formatVnd(order.totalAmount))}</div>
      <div><strong>Mã giao dịch:</strong> ${escapeHTML(ref)}</div>
    </div>
    <a class="pay" href="${base}&result=success">Thanh toán thành công</a>
    <a class="fail" href="${base}&result=failed">Thanh toán thất bại</a>
  </main>
</body>
</html>`);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.get('/mock/:provider/complete', async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const orderId = Number(req.query.orderId);
    const ref = String(req.query.ref || '');
    const token = String(req.query.token || '');
    const result = String(req.query.result || '');

    try {
        if (!verifyMockPaymentRequest(provider, orderId, ref, token)) {
            return res.status(400).send('Mock payment request is invalid.');
        }

        const order = await findOrderForPayment({
            gatewayOrderId: ref,
            gatewayRequestId: ref
        });
        if (!order) {
            return redirectResult(res, null, provider, 'failed', 'Khong tim thay don hang.', orderId);
        }

        if (result === 'success') {
            if (order.paymentStatus !== 'paid') {
                await markPaid(order, provider, ref, { mockReturn: { result, ref } });
            }
            return redirectResult(res, order, provider, 'success', `Thanh toan ${provider.toUpperCase()} thanh cong.`);
        }

        if (!isFinalPaymentStatus(order)) {
            await markFailed(order, provider, { mockReturn: { result, ref } });
        }
        return redirectResult(res, order, provider, 'failed', `Thanh toan ${provider.toUpperCase()} khong thanh cong.`);
    } catch (error) {
        return redirectResult(res, null, provider, 'failed', error.message, orderId);
    }
});

router.get('/vnpay/return', async (req, res) => {
    const query = req.query;
    const fallbackOrderId = orderIdFromGatewayRef(query.vnp_TxnRef);

    try {
        const order = await findOrderForPayment({
            gatewayOrderId: query.vnp_TxnRef,
            gatewayRequestId: query.vnp_TxnRef
        });

        if (!order) {
            return redirectResult(res, null, 'vnpay', 'failed', 'Khong tim thay don hang.', fallbackOrderId);
        }

        const valid = verifyVnpayParams(query);
        const success = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
        const correctAmount = amountMatches(order, query.vnp_Amount, 100);

        if (!valid) {
            return redirectResult(res, order, 'vnpay', 'failed', 'Chu ky VNPay khong hop le.');
        }
        if (!correctAmount) {
            return redirectResult(res, order, 'vnpay', 'failed', 'So tien VNPay khong khop.');
        }

        if (success) {
            const confirmed = order.paymentStatus === 'paid';
            return redirectResult(
                res,
                order,
                'vnpay',
                'success',
                confirmed
                    ? 'Thanh toan VNPay thanh cong.'
                    : 'VNPay da tiep nhan giao dich. He thong dang cho IPN xac nhan.'
            );
        }

        return redirectResult(
            res,
            order,
            'vnpay',
            'failed',
            `Thanh toan VNPay khong thanh cong${query.vnp_ResponseCode ? ` (ma ${query.vnp_ResponseCode})` : '.'}`
        );
    } catch (error) {
        return redirectResult(res, null, 'vnpay', 'failed', error.message, fallbackOrderId);
    }
});

router.get('/vnpay/ipn', async (req, res) => {
    const query = req.query;

    try {
        const order = await findOrderForPayment({
            gatewayOrderId: query.vnp_TxnRef,
            gatewayRequestId: query.vnp_TxnRef
        });

        if (!order) return res.json({ RspCode: '01', Message: 'Order not found' });
        if (!verifyVnpayParams(query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
        if (!amountMatches(order, query.vnp_Amount, 100)) return res.json({ RspCode: '04', Message: 'Invalid amount' });
        if (isSettledPayment(order)) return res.json({ RspCode: '02', Message: 'Order already confirmed' });

        if (query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00') {
            await markPaid(order, 'vnpay', query.vnp_TransactionNo, { vnpayIpn: query });
        } else {
            await markFailed(order, 'vnpay', { vnpayIpn: query });
        }

        return res.json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error) {
        return res.json({ RspCode: '99', Message: error.message });
    }
});

router.get('/momo/return', async (req, res) => {
    const query = req.query;
    const fallbackOrderId = orderIdFromGatewayRef(query.orderId);

    try {
        const order = await findOrderForPayment({
            gatewayOrderId: query.orderId,
            gatewayRequestId: query.requestId,
            extraData: query.extraData
        });

        if (!order) {
            return redirectResult(res, null, 'momo', 'failed', 'Khong tim thay don hang.', fallbackOrderId);
        }

        const valid = verifyMomoParams(query);
        const success = Number(query.resultCode) === 0;
        const correctAmount = amountMatches(order, query.amount);

        if (!valid) {
            return redirectResult(res, order, 'momo', 'failed', 'Chu ky MoMo khong hop le.');
        }
        if (!correctAmount) {
            return redirectResult(res, order, 'momo', 'failed', 'So tien MoMo khong khop.');
        }

        if (success) {
            if (order.paymentStatus !== 'paid') {
                await markPaid(order, 'momo', query.transId, { momoReturn: query });
            }
            return redirectResult(res, order, 'momo', 'success', 'Thanh toan MoMo thanh cong.');
        }

        if (!isFinalPaymentStatus(order)) {
            await markFailed(order, 'momo', { momoReturn: query });
        }
        return redirectResult(
            res,
            order,
            'momo',
            'failed',
            query.message || 'Thanh toan MoMo khong thanh cong.'
        );
    } catch (error) {
        return redirectResult(res, null, 'momo', 'failed', error.message, fallbackOrderId);
    }
});

router.post('/momo/ipn', async (req, res) => {
    const payload = req.body || {};

    try {
        const order = await findOrderForPayment({
            gatewayOrderId: payload.orderId,
            gatewayRequestId: payload.requestId,
            extraData: payload.extraData
        });

        if (!order || !verifyMomoParams(payload) || !amountMatches(order, payload.amount) || isFinalPaymentStatus(order)) {
            return res.sendStatus(204);
        }

        if (Number(payload.resultCode) === 0) {
            await markPaid(order, 'momo', payload.transId, { momoIpn: payload });
        } else {
            await markFailed(order, 'momo', { momoIpn: payload });
        }
    } catch (error) {
        console.error('MoMo IPN error:', error.message);
    }

    return res.sendStatus(204);
});

module.exports = router;
