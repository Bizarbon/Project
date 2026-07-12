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
            <div class="order-head">
                <div>
                    <h3>#${String(order._id).padStart(4, '0')}</h3>
                    <p>${formatDate(order.orderDate || order.createdAt)}</p>
                </div>
                <div class="order-badges">
                    <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
                    <span class="pay-badge pay-${order.paymentStatus}">${paymentLabels[order.paymentStatus] || order.paymentStatus}</span>
                </div>
            </div>
            <div class="order-products-list">
                ${(order.products || []).map(item => `
                    <div>
                        <span>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm')}</span>
                        <strong>× ${item.quantity}</strong>
                    </div>
                `).join('')}
            </div>
            <div class="order-meta-grid">
                <div><strong>Người nhận</strong><span>${escapeHTML(order.recipientName || order.customerName || '')}</span></div>
                <div><strong>SĐT</strong><span>${escapeHTML(order.recipientPhone || order.customerPhone || '')}</span></div>
                <div><strong>Địa chỉ</strong><span>${escapeHTML(order.shippingAddress || '')}</span></div>
                <div><strong>Thanh toán</strong><span>${methodLabels[order.paymentMethod] || order.paymentMethod}</span></div>
                <div><strong>Vận chuyển</strong><span>${order.trackingNumber ? `${escapeHTML(order.shippingUnit || '')} - ${escapeHTML(order.trackingNumber)}` : 'Chưa có mã vận đơn'}</span></div>
                <div><strong>Tổng tiền</strong><span class="money">${fmt(order.totalAmount)}</span></div>
            </div>
            <div class="order-actions">
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
