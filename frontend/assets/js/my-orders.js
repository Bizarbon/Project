const statusLabels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    returned: 'Hoàn/đổi trả',
    boom: 'Khách boom'
};

const paymentLabels = {
    unpaid: 'Chưa thanh toán',
    pending: 'Chờ xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
};

const methodLabels = {
    cod: 'COD',
    bank_transfer: 'Chuyển khoản',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp',
    ShipCOD: 'COD',
    'Thanh toán trước': 'Chuyển khoản',
    'Trả góp': 'Trả góp'
};

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(value) {
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

async function loadMyOrders() {
    if (!auth.isLoggedIn()) {
        window.location.href = '../auth/login.html';
        return;
    }

    const res = await fetch(`${API_URL}/orders/my`, { headers: auth.getHeaders() });
    const data = await res.json();
    if (auth.handleApiError(res, data)) return;
    if (!res.ok) {
        document.getElementById('ordersList').innerHTML = `<div class="empty-state">${escapeHTML(data.message || 'Không tải được đơn hàng')}</div>`;
        return;
    }

    document.getElementById('orderCount').textContent = data.length;
    document.getElementById('ordersList').innerHTML = data.length ? data.map(orderCard).join('') :
        '<div class="empty-state">Bạn chưa có đơn hàng nào.</div>';
}

function orderCard(order) {
    return `
        <article class="order-card glass-card">
            <header class="order-head">
                <div>
                    <h3>#${String(order._id).padStart(4, '0')}</h3>
                    <p>${formatDate(order.orderDate || order.createdAt)}</p>
                </div>
                <div class="order-badges">
                    <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
                    <span class="pay-badge pay-${order.paymentStatus}">${paymentLabels[order.paymentStatus] || order.paymentStatus}</span>
                </div>
            </header>
            <ul class="order-products-list">
                ${(order.products || []).map(item => `
                    <li>
                        <span>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm')}</span>
                        <strong>× ${item.quantity}</strong>
                    </li>
                `).join('')}
            </ul>
            <dl class="order-meta-grid">
                <div><dt>Người nhận</dt><dd>${escapeHTML(order.recipientName || order.customerName || '')}</dd></div>
                <div><dt>SĐT</dt><dd>${escapeHTML(order.recipientPhone || order.customerPhone || '')}</dd></div>
                <div><dt>Địa chỉ</dt><dd>${escapeHTML(order.shippingAddress || '')}</dd></div>
                <div><dt>Thanh toán</dt><dd>${methodLabels[order.paymentMethod] || order.paymentMethod}</dd></div>
                <div><dt>Vận chuyển</dt><dd>${order.trackingNumber ? `${escapeHTML(order.shippingUnit || '')} - ${escapeHTML(order.trackingNumber)}` : 'Chưa có mã vận đơn'}</dd></div>
                <div><dt>Tổng tiền</dt><dd class="money">${fmt(order.totalAmount)}</dd></div>
            </dl>
            <div class="order-actions">
                <a class="btn-primary order-tracking-link" href="order-detail.html?id=${encodeURIComponent(order._id)}">Xem quá trình giao hàng</a>
                ${order.status === 'pending' ? `<button class="btn-delete" onclick="cancelOrder('${order._id}')">Hủy đơn</button>` : ''}
            </div>
        </article>
    `;
}

async function cancelOrder(id) {
    if (!confirm('Bạn muốn hủy đơn hàng này?')) return;
    const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
        method: 'POST',
        headers: auth.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.message || 'Không hủy được đơn hàng', 'error');
    showToast('Đã hủy đơn hàng');
    loadMyOrders();
}

document.addEventListener('DOMContentLoaded', loadMyOrders);
