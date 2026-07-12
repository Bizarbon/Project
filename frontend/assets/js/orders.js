const EP = API_URL + '/orders';

const statusLabels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    returned: 'Hoàn/Đổi trả',
    boom: 'Khách boom',
    cancelled: 'Đã hủy'
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

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadOrders() {
    try {
        const res = await fetch(EP, { headers: auth.getHeaders() });
        const data = await res.json();
        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message || 'Lỗi từ server');

        document.getElementById('statTotal').textContent = data.length;
        document.getElementById('statPending').textContent = data.filter(order => order.status === 'pending').length;
        document.getElementById('statProcessing').textContent = data.filter(order => order.status === 'processing').length;
        document.getElementById('statCompleted').textContent = data.filter(order => order.status === 'completed').length;
        document.getElementById('statShipping').textContent = data.filter(order => order.status === 'shipping').length;

        const tableBody = document.querySelector('#orderTable tbody');
        if (!data.length) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted);">Chưa có đơn hàng nào</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(order => `
            <tr class="fade-in">
                <td style="font-family:monospace;color:var(--text-muted);">#${String(order._id).padStart(4, '0')}</td>
                <td>
                    <strong>${escapeHTML(order.recipientName || order.customer?.name || order.customerName || 'N/A')}</strong>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHTML(order.recipientPhone || order.customer?.phone || order.customerPhone || '')}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(order.shippingAddress || '')}</div>
                </td>
                <td>
                    <div class="order-products">
                        ${(order.products || []).map(item => `
                            <div class="order-product-item">
                                <strong>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm không tồn tại')}</strong> x ${item.quantity}
                            </div>
                        `).join('')}
                    </div>
                </td>
                <td class="td-price">${fmt(order.totalAmount)}</td>
                <td>${paymentCell(order)}</td>
                <td>
                    <select class="status-select" onchange="updateStatus('${order._id}', this.value)">
                        ${Object.keys(statusLabels).map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}
                    </select>
                </td>
                <td style="font-size:0.8rem;">
                    <div style="font-weight:600;color:var(--primary);cursor:pointer;" onclick="updateTracking('${order._id}', '${escapeHTML(order.trackingNumber || '')}', '${escapeHTML(order.shippingUnit || '')}')">
                        ${order.trackingNumber ? escapeHTML(order.trackingNumber) : 'Nhập mã vận đơn'}
                    </div>
                    <div style="color:var(--text-muted);margin-top:0.2rem;">${order.shippingUnit ? escapeHTML(order.shippingUnit) : ''}</div>
                </td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">${formatDate(order.orderDate || order.createdAt)}</td>
                <td><button class="btn-delete" onclick="deleteOrder('${order._id}')">Xóa</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Lỗi tải danh sách đơn hàng!', 'error');
    }
}

function paymentCell(order) {
    const canMarkPaid = order.paymentStatus !== 'paid' && ['cod', 'bank_transfer', 'installment', 'ShipCOD', 'Thanh toán trước', 'Trả góp'].includes(order.paymentMethod);
    return `
        <div style="font-size:0.82rem;line-height:1.5;">
            <strong>${methodLabels[order.paymentMethod] || escapeHTML(order.paymentMethod)}</strong>
            <div class="pay-status pay-${order.paymentStatus}">${paymentLabels[order.paymentStatus] || order.paymentStatus}</div>
            ${order.paymentTransactionId ? `<div style="color:var(--text-muted);">Mã GD: ${escapeHTML(order.paymentTransactionId)}</div>` : ''}
            ${canMarkPaid ? `<button class="btn-edit btn-sm" onclick="markPaymentPaid('${order._id}')">Xác nhận đã thanh toán</button>` : ''}
        </div>
    `;
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi cập nhật');
        showToast(`Đã cập nhật trạng thái: ${statusLabels[status] || status}`);
        loadOrders();
    } catch (error) {
        showToast(error.message || 'Lỗi cập nhật!', 'error');
        loadOrders();
    }
}

async function markPaymentPaid(id) {
    const transactionId = prompt('Nhập mã giao dịch/ghi chú xác nhận:', `MANUAL-${Date.now()}`);
    if (transactionId === null) return;
    try {
        const res = await fetch(`${EP}/${id}/payment`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ paymentStatus: 'paid', paymentProvider: 'manual', paymentTransactionId: transactionId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi xác nhận thanh toán');
        showToast('Đã xác nhận thanh toán!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateTracking(id, currentTracking, currentUnit) {
    const trackingNumber = prompt('Nhập mã vận đơn:', currentTracking);
    if (trackingNumber === null) return;
    const shippingUnit = prompt('Nhập đơn vị giao hàng (VD: GHTK, SPX):', currentUnit || 'GHTK');
    if (shippingUnit === null) return;

    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ trackingNumber, shippingUnit, status: 'shipping' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi cập nhật mã vận đơn');
        showToast('Đã lưu mã vận đơn và chuyển trạng thái đang giao!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteOrder(id) {
    if (!confirm('Xóa đơn hàng này? Tồn kho sẽ được hoàn nếu đơn chưa hoàn kho.')) return;

    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi xóa đơn hàng');
        showToast('Đã xóa đơn hàng!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadOrders);
