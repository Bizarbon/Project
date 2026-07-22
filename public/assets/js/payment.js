const PAYMENT_STATUS_LABELS = {
    unpaid: 'Chưa thanh toán',
    pending: 'Đang chờ thanh toán',
    paid: 'Thanh toán thành công',
    failed: 'Thanh toán không thành công',
    refunded: 'Đã hoàn tiền'
};

let paymentPollTimer = null;
let paymentCountdownTimer = null;
let currentGuestOrderToken = '';

function paymentMoney(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function showPaymentError(message) {
    document.getElementById('paymentContent').hidden = true;
    document.getElementById('paymentError').hidden = false;
    document.getElementById('paymentErrorMessage').textContent = message;
    document.getElementById('paymentStatus').textContent = 'Không thể tiếp tục thanh toán.';
}

function renderBankDetails(bank, presentation) {
    const section = document.getElementById('bankDetails');
    if (!bank || !bank.accountNo) {
        section.hidden = true;
        return;
    }
    document.getElementById('bankName').textContent = bank.name || 'Ngân hàng nhận tiền';
    document.getElementById('bankAccountNo').textContent = bank.accountNo;
    document.getElementById('bankAccountName').textContent = bank.accountName || 'TechEcommerce';
    document.getElementById('paymentBankAmount').textContent = paymentMoney(presentation.amount);
    document.getElementById('paymentBankReference').textContent = presentation.reference;
    section.hidden = false;
}

async function copyPaymentValue(button, value) {
    if (!value || value === '—') return;
    button.dataset.state = 'loading';
    button.disabled = true;
    button.textContent = 'Đang sao chép';
    try {
        await navigator.clipboard.writeText(value);
        button.dataset.state = 'success';
        button.textContent = 'Đã sao chép';
    } catch (error) {
        button.dataset.state = 'error';
        button.textContent = 'Không thể sao chép';
    } finally {
        button.disabled = false;
        window.setTimeout(() => {
            button.dataset.state = 'default';
            button.textContent = 'Sao chép';
        }, 1800);
    }
}

function startCountdown(expiresAt) {
    clearInterval(paymentCountdownTimer);
    const output = document.getElementById('paymentCountdown');
    if (!expiresAt) {
        output.textContent = 'Không áp dụng';
        return;
    }
    const update = () => {
        const remaining = Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        output.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(paymentCountdownTimer);
            output.textContent = 'Đã hết hạn';
        }
    };
    update();
    paymentCountdownTimer = setInterval(update, 1000);
}

function renderPayment(presentation) {
    document.title = `Thanh toán đơn #${presentation.orderId} - TechEcommerce`;
    document.getElementById('paymentTitle').textContent = `Thanh toán đơn hàng #${presentation.orderId}`;
    document.getElementById('paymentOrderId').textContent = `#${presentation.orderId}`;
    document.getElementById('paymentProvider').textContent = presentation.providerLabel;
    document.getElementById('paymentAmount').textContent = paymentMoney(presentation.amount);
    document.getElementById('paymentReference').textContent = presentation.reference;
    document.getElementById('paymentInstructions').textContent = presentation.instructions;
    renderTracking(presentation);
    document.getElementById('viewOrder').href = auth.isLoggedIn()
        ? `../account/order-detail.html?id=${encodeURIComponent(presentation.orderId)}`
        : '../../index.html';

    const qr = document.getElementById('paymentQr');
    const qrSource = presentation.qrCodeDataUrl || presentation.qrImageUrl;
    const qrFigure = document.getElementById('qrFigure');
    const warning = document.getElementById('qrUnavailable');
    const title = document.getElementById('qrTitle');
    const installment = document.getElementById('paymentInstallment');
    title.textContent = presentation.provider === 'bank_transfer'
        ? 'Quét QR chuyển khoản'
        : presentation.provider === 'installment'
        ? 'Phương án trả góp đã chọn'
        : 'Quét QR để thanh toán';
    warning.classList.toggle('is-info', ['bank_transfer', 'installment'].includes(presentation.provider));
    if (qrSource) {
        qr.src = qrSource;
        qr.alt = `Mã QR thanh toán đơn hàng #${presentation.orderId} qua ${presentation.providerLabel}`;
        qrFigure.hidden = false;
        warning.hidden = true;
    } else {
        qr.removeAttribute('src');
        qrFigure.hidden = true;
        warning.textContent = ['installment', 'bank_transfer'].includes(presentation.provider)
            ? presentation.instructions
            : 'Thông tin QR chưa được cấu hình. Vui lòng liên hệ cửa hàng hoặc chọn phương thức khác.';
        warning.hidden = false;
    }

    if (presentation.provider === 'installment' && presentation.installmentPlan) {
        const plan = presentation.installmentPlan;
        document.getElementById('paymentInstallmentTerm').textContent = `${plan.term} tháng`;
        document.getElementById('paymentInstallmentDown').textContent = paymentMoney(plan.downPayment);
        document.getElementById('paymentInstallmentMonthly').textContent = paymentMoney(plan.monthlyPayment);
        document.getElementById('paymentInstallmentInterest').textContent = paymentMoney(plan.totalInterest);
        installment.hidden = false;
    } else {
        installment.hidden = true;
    }

    const openLink = document.getElementById('openPaymentUrl');
    if (presentation.paymentUrl) {
        openLink.href = presentation.paymentUrl;
        openLink.hidden = false;
    } else {
        openLink.hidden = true;
    }

    renderBankDetails(presentation.bank, presentation);
    startCountdown(presentation.expiresAt);
    document.getElementById('paymentContent').hidden = false;
    updatePaymentState(presentation.paymentStatus);
}

function renderTracking(order) {
    const trackingRow = document.getElementById('trackingRow');
    if (!order.trackingNumber) {
        document.getElementById('trackingNumber').textContent = 'Chờ đơn vị vận chuyển';
        const message = order.trackingMessage
            || order.shippingMetadata?.shipment?.message
            || 'Mã vận đơn sẽ xuất hiện sau khi cửa hàng xác nhận.';
        document.getElementById('shippingUnit').textContent = ` · ${message}`;
        trackingRow.hidden = false;
        return;
    }
    document.getElementById('trackingNumber').textContent = order.trackingNumber;
    document.getElementById('shippingUnit').textContent = order.shippingUnit ? ` · ${order.shippingUnit}` : '';
    trackingRow.hidden = false;
}

function paymentRequestHeaders() {
    const headers = auth.getHeaders();
    if (!auth.isLoggedIn() && currentGuestOrderToken) {
        headers['x-guest-order-token'] = currentGuestOrderToken;
    }
    return headers;
}

function updatePaymentState(status) {
    const output = document.getElementById('paymentStatus');
    output.className = 'payment-status';
    output.textContent = PAYMENT_STATUS_LABELS[status] || status;

    if (status === 'paid') {
        output.classList.add('is-paid');
        document.getElementById('paymentTitle').textContent = 'Thanh toán đã được xác nhận';
        document.getElementById('qrFigure').hidden = true;
        document.getElementById('openPaymentUrl').hidden = true;
        clearInterval(paymentPollTimer);
        clearInterval(paymentCountdownTimer);
    } else if (status === 'failed' || status === 'refunded') {
        output.classList.add('is-failed');
        clearInterval(paymentPollTimer);
    }
}

async function pollPaymentStatus(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, { headers: paymentRequestHeaders() });
        const order = await response.json();
        if (auth.handleApiError(response, order)) return;
        if (!response.ok) throw new Error(order.message || 'Không kiểm tra được trạng thái thanh toán.');
        updatePaymentState(order.paymentStatus);
        renderTracking(order);
    } catch (error) {
        console.error('Payment polling error:', error);
    }
}

async function loadPaymentPage() {
    const orderId = new URLSearchParams(window.location.search).get('orderId');
    if (!/^\d+$/.test(String(orderId || ''))) {
        showPaymentError('Mã đơn hàng không hợp lệ.');
        return;
    }
    currentGuestOrderToken = localStorage.getItem(`guestOrderToken:${orderId}`) || '';
    if (!auth.isLoggedIn() && !currentGuestOrderToken) {
        showPaymentError('Phiên thanh toán khách đã hết. Vui lòng dùng đúng tab đã tạo đơn hoặc kiểm tra email xác nhận.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/payment-presentation`, {
            headers: paymentRequestHeaders()
        });
        const presentation = await response.json();
        if (auth.handleApiError(response, presentation)) return;
        if (!response.ok) throw new Error(presentation.message || 'Không tải được thông tin thanh toán.');
        renderPayment(presentation);
        paymentPollTimer = setInterval(() => pollPaymentStatus(orderId), 4000);
    } catch (error) {
        showPaymentError(error.message);
    }
}

document.getElementById('copyReference').addEventListener('click', event => {
    copyPaymentValue(event.currentTarget, document.getElementById('paymentReference').textContent);
});
document.getElementById('copyBankAccount').addEventListener('click', event => {
    copyPaymentValue(event.currentTarget, document.getElementById('bankAccountNo').textContent);
});
document.getElementById('copyBankReference').addEventListener('click', event => {
    copyPaymentValue(event.currentTarget, document.getElementById('paymentBankReference').textContent);
});

document.addEventListener('DOMContentLoaded', loadPaymentPage);
window.addEventListener('pagehide', () => {
    clearInterval(paymentPollTimer);
    clearInterval(paymentCountdownTimer);
});
