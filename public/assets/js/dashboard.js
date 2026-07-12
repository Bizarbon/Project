function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('vi-VN');
}

const orderStatusLabels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    returned: 'Hoàn/Đổi trả',
    boom: 'Khách boom',
    cancelled: 'Đã hủy'
};

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/admin/dashboard`, { headers: auth.getHeaders() });
        const data = await res.json();
        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message || 'Không tải được dashboard');

        document.getElementById('dbRevenue').textContent = fmt(data.revenue);
        document.getElementById('dbToday').textContent = fmt(data.todayRevenue);
        document.getElementById('dbProfit').textContent = fmt(data.profit);
        document.getElementById('dbOrders').textContent = data.orderCount;
        document.getElementById('dbPending').textContent = data.pendingOrders;
        document.getElementById('dbShipping').textContent = data.shippingOrders;
        document.getElementById('dbProducts').textContent = data.productCount;
        document.getElementById('dbCustomers').textContent = data.customerCount;
        document.getElementById('dbNewCustomers').textContent = data.newCustomers;

        document.getElementById('lowStockList').innerHTML = data.lowStockProducts.length
            ? data.lowStockProducts.map(product => `
                <div class="mini-row">
                    <span>${escapeHTML(product.name)}</span>
                    <strong>${product.stock}/${product.minStock}</strong>
                </div>
            `).join('')
            : '<div class="empty-state">Không có sản phẩm sắp hết hàng.</div>';

        document.getElementById('recentOrders').innerHTML = data.recentOrders.length
            ? data.recentOrders.map(order => `
                <tr>
                    <td>#${String(order._id).padStart(4, '0')}</td>
                    <td>${escapeHTML(order.customer?.name || order.customerName || '')}</td>
                    <td>${fmt(order.totalAmount)}</td>
                    <td><span class="status-badge status-${order.status}">${orderStatusLabels[order.status] || order.status}</span></td>
                    <td>${formatDate(order.orderDate || order.createdAt)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem;">Chưa có đơn hàng</td></tr>';
    } catch (error) {
        document.getElementById('dashboardError').textContent = error.message;
    }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
