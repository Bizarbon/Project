/**
 * TechEcommerce - Customer My Orders Management
 * Production-ready order tracking, tab filtering, live search, and action workflows
 */

const statusLabels = {
    pending: 'Chờ xác nhận',
    processing: 'Đang chuẩn bị',
    shipping: 'Đang giao hàng',
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
    cod: 'COD (Tiền mặt)',
    bank_transfer: 'Chuyển khoản',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp 0%',
    ShipCOD: 'COD (Tiền mặt)',
    'Thanh toán trước': 'Chuyển khoản',
    'Trả góp': 'Trả góp 0%'
};

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(value) {
    if (!value) return '--/--/----';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--/--/----';
    return d.toLocaleString('vi-VN', {
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
        setTimeout(() => toast.remove(), 3200);
    }, 100);
}

// Module State
let rawOrders = [];
let currentFilter = 'all';
let currentSearch = '';

async function loadMyOrders() {
    if (!auth.isLoggedIn()) {
        window.location.href = '../auth/login.html';
        return;
    }

    const ordersListEl = document.getElementById('ordersList');
    try {
        const res = await fetch(`${API_URL}/orders/my`, { headers: auth.getHeaders() });
        const data = await res.json();
        if (auth.handleApiError(res, data)) return;
        if (!res.ok) {
            ordersListEl.innerHTML = `
                <article class="orders-status-box">
                    <span class="orders-status-icon" aria-hidden="true">⚠️</span>
                    <p>${escapeHTML(data.message || 'Không thể tải danh sách đơn hàng lúc này.')}</p>
                    <button type="button" class="btn-primary" onclick="loadMyOrders()">Thử lại</button>
                </article>
            `;
            return;
        }

        rawOrders = Array.isArray(data) ? data : [];
        updateOverviewKpis(rawOrders);
        applyFiltersAndRender();
    } catch (err) {
        console.error('loadMyOrders error:', err);
        ordersListEl.innerHTML = `
            <article class="orders-status-box">
                <span class="orders-status-icon" aria-hidden="true">⚠️</span>
                <p>Lỗi kết nối máy chủ. Vui lòng kiểm tra đường truyền mạng.</p>
                <button type="button" class="btn-primary" onclick="loadMyOrders()">Thử lại</button>
            </article>
        `;
    }
}

function updateOverviewKpis(orders) {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const shipping = orders.filter(o => o.status === 'shipping').length;
    const completed = orders.filter(o => o.status === 'completed').length;

    const elTotal = document.getElementById('kpiTotalOrders');
    const elPending = document.getElementById('kpiPendingOrders');
    const elShipping = document.getElementById('kpiShippingOrders');
    const elCompleted = document.getElementById('kpiCompletedOrders');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elShipping) elShipping.textContent = shipping;
    if (elCompleted) elCompleted.textContent = completed;
}

function applyFiltersAndRender() {
    const ordersListEl = document.getElementById('ordersList');
    if (!ordersListEl) return;

    if (!rawOrders.length) {
        ordersListEl.innerHTML = `
            <article class="orders-status-box">
                <span class="orders-status-icon" aria-hidden="true">📦</span>
                <h3>Bạn chưa có đơn hàng nào</h3>
                <p>Khám phá ngay hàng trăm thiết bị công nghệ chính hãng giá tốt tại TechEcommerce.</p>
                <a href="../../index.html" class="btn-primary">Mua sắm ngay</a>
            </article>
        `;
        return;
    }

    let filtered = rawOrders;

    // Filter by tab status
    if (currentFilter !== 'all') {
        filtered = filtered.filter(o => o.status === currentFilter);
    }

    // Filter by search query (order ID or product name)
    if (currentSearch.trim()) {
        const q = currentSearch.trim().toLowerCase();
        filtered = filtered.filter(order => {
            const code = String(order._id || '').toLowerCase();
            const paddedCode = `#${String(order._id).padStart(4, '0')}`.toLowerCase();
            const hasProduct = (order.products || []).some(item => {
                const name = (item.product?.name || item.productName || '').toLowerCase();
                return name.includes(q);
            });
            return code.includes(q) || paddedCode.includes(q) || hasProduct;
        });
    }

    if (!filtered.length) {
        ordersListEl.innerHTML = `
            <article class="orders-status-box">
                <span class="orders-status-icon" aria-hidden="true">🔍</span>
                <h3>Không tìm thấy đơn hàng phù hợp</h3>
                <p>Không có đơn hàng nào khớp với điều kiện lọc hoặc từ khóa "${escapeHTML(currentSearch)}".</p>
                <button type="button" class="btn-primary" onclick="resetFilters()">Xem tất cả đơn hàng</button>
            </article>
        `;
        return;
    }

    ordersListEl.innerHTML = filtered.map(renderCustomerOrderCard).join('');
}

function renderCustomerOrderCard(order) {
    const orderCode = `#${String(order._id).padStart(4, '0')}`;
    const orderTime = formatDate(order.orderDate || order.createdAt);
    const paymentText = paymentLabels[order.paymentStatus] || order.paymentStatus;
    const paymentMethodText = methodLabels[order.paymentMethod] || order.paymentMethod || 'COD';

    // Shipper & Shipping note
    const shipperObj = order.shipper;
    const shipperName = (typeof shipperObj === 'object' && shipperObj?.name) ? shipperObj.name : (order.shipperAssignedByName || '');
    const shipperPhone = (typeof shipperObj === 'object' && shipperObj?.phone) ? shipperObj.phone : '';

    const shippingStatusMap = {
        unassigned: 'Chưa phân công',
        assigned: 'Đã nhận phân công · Chuẩn bị giao',
        waiting_pickup: 'Chờ lấy hàng từ kho',
        picked_up: 'Shipper đã lấy hàng',
        delivering: 'Shipper đang trên đường giao hàng',
        delivered: 'Giao hàng thành công',
        delivery_failed: 'Giao hàng thất bại',
        returned: 'Đã hoàn hàng'
    };

    let shippingNote = '';
    if (shipperName) {
        const stText = shippingStatusMap[order.shippingStatus] || 'Đã phân công người giao hàng';
        shippingNote = `🛵 Shipper: <strong>${escapeHTML(shipperName)}</strong>${shipperPhone ? ` (☎ <a href="tel:${escapeHTML(shipperPhone)}" style="color:var(--primary,#2563eb);font-weight:700;text-decoration:underline;">${escapeHTML(shipperPhone)}</a>)` : ''} · <span style="color:#059669;font-weight:700;">${escapeHTML(stText)}</span>`;
    } else if (order.trackingNumber) {
        shippingNote = `${escapeHTML(order.shippingUnit || 'Đơn vị vận chuyển')} · Vận đơn: <strong>${escapeHTML(order.trackingNumber)}</strong>`;
    } else if (order.shippingUnit) {
        shippingNote = `${escapeHTML(order.shippingUnit)} · Đang chuẩn bị`;
    } else {
        shippingNote = '⏳ Đang xử lý & phân công shipper';
    }

    let statusText = statusLabels[order.status] || order.status;
    if (order.status === 'pending' && shipperName) {
        statusText = 'Đang chuẩn bị (Đã có shipper)';
    }

    // Products rows
    const productsHtml = (order.products || []).map(item => {
        const prod = item.product || {};
        const name = prod.name || item.productName || 'Sản phẩm công nghệ';
        const img = prod.image || prod.images?.[0] || 'https://placehold.co/120x120?text=TechEcommerce';
        const qty = item.quantity || 1;
        const price = item.price || 0;

        return `
            <li class="order-product-row">
                <figure class="order-product-thumb">
                    <img src="${escapeHTML(img)}" alt="${escapeHTML(name)}" loading="lazy">
                </figure>
                <div class="order-product-info">
                    <h4 class="order-product-name" title="${escapeHTML(name)}">${escapeHTML(name)}</h4>
                    <div class="order-product-meta">
                        <span>Số lượng: × ${qty}</span>
                        <span class="order-product-price">${fmt(price)}</span>
                    </div>
                </div>
            </li>
        `;
    }).join('');

    const canCancel = order.status === 'pending' && !shipperName;

    return `
        <article class="order-item-card">
            <header class="order-card-header">
                <div class="order-code-block">
                    <strong class="order-code-badge">${orderCode}</strong>
                    <time class="order-time-text" datetime="${new Date(order.orderDate || order.createdAt).toISOString()}">${orderTime}</time>
                </div>
                <div class="order-badges-group">
                    <span class="cust-badge status-${order.status}">${escapeHTML(statusText)}</span>
                    ${shipperName ? `<span class="cust-badge" style="background:rgba(16,185,129,0.12);color:#047857;border:1px solid rgba(16,185,129,0.3);">🛵 Shipper: ${escapeHTML(shipperName)}</span>` : ''}
                    <span class="cust-badge pay-${order.paymentStatus}">${escapeHTML(paymentMethodText)} · ${escapeHTML(paymentText)}</span>
                </div>
            </header>

            <ul class="order-products-preview">
                ${productsHtml}
            </ul>

            <footer class="order-card-footer">
                <div class="order-shipping-summary">
                    <span>${shippingNote}</span>
                </div>

                <div class="order-total-action-group">
                    <div class="order-total-amount">
                        <span>Tổng thanh toán:</span>
                        <strong>${fmt(order.totalAmount)}</strong>
                    </div>

                    <div class="order-action-buttons">
                        <a class="btn-view-detail" href="order-detail.html?id=${encodeURIComponent(order._id)}">
                            <span>Xem chi tiết</span>
                            <span aria-hidden="true">&rarr;</span>
                        </a>
                        ${canCancel ? `<button type="button" class="btn-cancel-cust" onclick="cancelCustomerOrder('${order._id}')">Hủy đơn</button>` : ''}
                    </div>
                </div>
            </footer>
        </article>
    `;
}

async function cancelCustomerOrder(id) {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return;
    try {
        const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
            method: 'POST',
            headers: auth.getHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || 'Không thể hủy đơn hàng lúc này.', 'error');
            return;
        }
        showToast('Đã hủy đơn hàng thành công.');
        loadMyOrders();
    } catch (err) {
        showToast('Lỗi kết nối khi gửi yêu cầu hủy đơn.', 'error');
    }
}

function resetFilters() {
    currentFilter = 'all';
    currentSearch = '';
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('#statusFilterTabs .status-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === 'all');
    });
    applyFiltersAndRender();
}

document.addEventListener('DOMContentLoaded', () => {
    loadMyOrders();

    // Tab buttons event listener
    const tabsContainer = document.getElementById('statusFilterTabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.status-tab-btn');
            if (!btn) return;
            tabsContainer.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.status || 'all';
            applyFiltersAndRender();
        });
    }

    // Search input debounced
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearch = e.target.value;
                applyFiltersAndRender();
            }, 250);
        });
    }
});
