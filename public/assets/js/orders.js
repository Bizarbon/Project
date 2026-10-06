/**
 * TechEcommerce Admin - Orders Management Module
 * Production-ready Order Management, Shipper Assignment, Timeline Audit, Server Pagination & Filters
 */

const EP = API_URL + '/orders';

// State
let currentPage = 1;
let pageSize = 20;
let searchQuery = '';
let activeStatusFilter = 'all';
let activePaymentStatus = 'all';
let activePaymentMethod = 'all';
let activeShippingStatus = 'all';
let activeShipper = 'all';
let filterDateFrom = '';
let filterDateTo = '';
let currentSortBy = 'createdAt';
let currentSortOrder = 'desc';

let loadedOrders = [];
let cachedShippers = [];
let selectedOrderIds = new Set();
let currentAssignOrderId = null;
let currentCancelOrderId = null;
let currentDetailOrder = null;
let searchDebounceTimer = null;

// Label mappings
const statusLabels = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    processing: 'Đang chuẩn bị',
    ready_to_ship: 'Chờ lấy hàng',
    shipping: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    delivery_failed: 'Giao thất bại',
    returned: 'Trả hàng',
    boom: 'Khách boom',
    return_requested: 'Yêu cầu trả hàng'
};

const paymentStatusLabels = {
    unpaid: 'Chưa thanh toán',
    pending: 'Chờ xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
};

const shippingStatusLabels = {
    unassigned: 'Chưa phân công',
    assigned: 'Đã phân công',
    waiting_pickup: 'Chờ lấy hàng',
    picked_up: 'Đã lấy hàng',
    delivering: 'Đang giao',
    delivered: 'Giao thành công',
    delivery_failed: 'Giao thất bại',
    returned: 'Đã hoàn hàng'
};

const methodLabels = {
    cod: 'COD (Tiền mặt)',
    bank_transfer: 'Chuyển khoản',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp',
    ShipCOD: 'COD (Tiền mặt)',
    'Thanh toán trước': 'Chuyển khoản',
    'Trả góp': 'Trả góp'
};

const actionLabels = {
    ORDER_CREATED: 'Tạo đơn hàng',
    ORDER_CONFIRMED: 'Xác nhận đơn hàng',
    ORDER_STATUS_CHANGED: 'Đổi trạng thái đơn',
    PAYMENT_CONFIRMED: 'Xác nhận thanh toán',
    PAYMENT_STATUS_CHANGED: 'Cập nhật thanh toán',
    SHIPPER_ASSIGNED: 'Phân công shipper',
    SHIPPER_REASSIGNED: 'Chuyển đổi shipper',
    SHIPPING_STATUS_CHANGED: 'Cập nhật vận chuyển',
    ORDER_CANCELLED: 'Hủy đơn hàng',
    RETURN_REQUESTED: 'Yêu cầu trả hàng',
    RETURN_COMPLETED: 'Hoàn tất trả hàng',
    REFUND_CREATED: 'Xử lý hoàn tiền',
    ADMIN_NOTE_ADDED: 'Ghi chú nội bộ'
};

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(dateStr) {
    if (!dateStr) return '--/--/----';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
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
    }, 80);
}

// ==========================================
// 1. DATA LOADING & API CALLS
// ==========================================

async function loadShippers() {
    try {
        const res = await fetch(`${EP}/shippers`, { headers: auth.getHeaders() });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            cachedShippers = json.data;
            populateShipperFilterDropdown(cachedShippers);
        }
    } catch (e) {
        console.warn('Could not fetch shippers:', e);
    }
}

function populateShipperFilterDropdown(shippers) {
    const select = document.getElementById('filterShipper');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="all">Tất cả shipper</option><option value="unassigned">Chưa phân công</option>';
    shippers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s._id;
        opt.textContent = `${s.name} (${s.phone || 'Không có SĐT'})`;
        select.appendChild(opt);
    });
    select.value = currentVal || 'all';
}

async function loadOrders() {
    const tbody = document.getElementById('orderTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 2.5rem; color: #94a3b8;">Đang tải dữ liệu đơn hàng từ máy chủ...</td></tr>';

    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize,
            sortBy: currentSortBy,
            sortOrder: currentSortOrder
        });

        if (searchQuery) params.append('search', searchQuery);
        if (activeStatusFilter && activeStatusFilter !== 'all') params.append('status', activeStatusFilter);
        if (activePaymentStatus && activePaymentStatus !== 'all') params.append('paymentStatus', activePaymentStatus);
        if (activePaymentMethod && activePaymentMethod !== 'all') params.append('paymentMethod', activePaymentMethod);
        if (activeShippingStatus && activeShippingStatus !== 'all') params.append('shippingStatus', activeShippingStatus);
        if (activeShipper && activeShipper !== 'all') params.append('shipper', activeShipper);
        if (filterDateFrom) params.append('dateFrom', filterDateFrom);
        if (filterDateTo) params.append('dateTo', filterDateTo);

        const res = await fetch(`${EP}?${params.toString()}`, { headers: auth.getHeaders() });
        const json = await res.json();

        if (auth.handleApiError(res, json)) return;
        if (!res.ok) throw new Error(json.message || 'Lỗi tải đơn hàng');

        const orders = json.data || [];
        const pagination = json.pagination || { total: orders.length, page: 1, limit: pageSize, totalPages: 1 };
        const stats = json.stats || {};

        loadedOrders = orders;

        // Update Global Statistics Cards (Real numbers from backend database)
        updateStatisticsCards(stats);

        // Render Table Body
        renderOrdersTable(orders);

        // Render Pagination Controls
        renderPagination(pagination);

        // Update Selection Toolbar
        updateBulkSelectionToolbar();

    } catch (error) {
        console.error('Error loading orders:', error);
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 2.5rem; color: #ef4444;">Không thể tải danh sách đơn hàng: ${escapeHTML(error.message)}</td></tr>`;
        showToast(error.message || 'Lỗi kết nối máy chủ!', 'error');
    }
}

function updateStatisticsCards(stats) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(val || 0).toLocaleString('vi-VN');
    };

    setVal('statTotal', stats.total);
    setVal('statPending', stats.pending);
    setVal('statProcessing', stats.processing);
    setVal('statShipping', stats.shipping);
    setVal('statCompleted', stats.completed);
    setVal('statCancelled', stats.cancelled);
    setVal('statReturned', stats.returned);

    // Update active highlight on cards
    const cardMap = {
        all: 'cardTotal',
        pending: 'cardPending',
        processing: 'cardProcessing',
        shipping: 'cardShipping',
        completed: 'cardCompleted',
        cancelled: 'cardCancelled',
        returned: 'cardReturned'
    };

    Object.keys(cardMap).forEach(key => {
        const card = document.getElementById(cardMap[key]);
        if (card) {
            if (activeStatusFilter === key) card.classList.add('active-filter');
            else card.classList.remove('active-filter');
        }
    });
}

// ==========================================
// 2. TABLE RENDERING
// ==========================================

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orderTableBody');
    if (!tbody) return;

    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 3rem; color: #94a3b8; font-size: 0.95rem;">Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const isSelected = selectedOrderIds.has(String(order._id));
        const orderCode = `#${String(order._id).padStart(4, '0')}`;
        const recipientName = order.recipientName || order.customer?.name || order.customerName || 'N/A';
        const recipientPhone = order.recipientPhone || order.customer?.phone || order.customerPhone || '';
        const shippingAddress = order.shippingAddress || '';

        // Products summary
        const productsSummaryHtml = (order.products || []).slice(0, 3).map(item => `
            <div style="font-size:0.78rem; margin-bottom:2px; color:#e2e8f0;">
                <strong>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm')}</strong>
                <span style="color:#94a3b8;">x${item.quantity}</span>
            </div>
        `).join('') + ((order.products || []).length > 3 ? `<div style="font-size:0.74rem; color:#60a5fa;">+${order.products.length - 3} sản phẩm khác...</div>` : '');

        // Payment status & method badge
        const payStatusClass = order.paymentStatus === 'paid' ? 'status-completed' : (order.paymentStatus === 'unpaid' ? 'status-pending' : 'status-cancelled');
        const paymentCellHtml = `
            <div>
                <strong style="color:var(--admin-text-main); font-size:0.82rem;">${escapeHTML(methodLabels[order.paymentMethod] || order.paymentMethod)}</strong>
                <div style="margin-top:2px;">
                    <span class="status-badge ${payStatusClass}" style="font-size:0.72rem;">${escapeHTML(paymentStatusLabels[order.paymentStatus] || order.paymentStatus)}</span>
                </div>
            </div>
        `;

        // Status Select Dropdown
        const statusBadgeClass = `status-${order.status}`;
        const statusCellHtml = `
            <select class="filter-control" style="padding: 4px 6px; font-size: 0.78rem; font-weight: 600;" onchange="handleStatusChange('${order._id}', this.value, '${order.status}')">
                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Đang chuẩn bị</option>
                <option value="ready_to_ship" ${order.status === 'ready_to_ship' ? 'selected' : ''}>Chờ lấy hàng</option>
                <option value="shipping" ${order.status === 'shipping' ? 'selected' : ''}>Đang giao</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn tất</option>
                <option value="delivery_failed" ${order.status === 'delivery_failed' ? 'selected' : ''}>Giao thất bại</option>
                <option value="returned" ${order.status === 'returned' ? 'selected' : ''}>Trả hàng</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
            </select>
        `;

        // Shipper Cell
        const shipperObj = order.shipper;
        let shipperCellHtml = '';
        if (shipperObj && (typeof shipperObj === 'object' || typeof shipperObj === 'number')) {
            const shipperName = shipperObj.name || order.shipperAssignedByName || `Shipper #${shipperObj._id || shipperObj}`;
            const shipperPhone = shipperObj.phone || '';
            shipperCellHtml = `
                <div class="shipper-cell-box">
                    <div class="shipper-assigned-pill">
                        <div>
                            <div style="font-weight:600; color:#34d399;">${escapeHTML(shipperName)}</div>
                            ${shipperPhone ? `<div style="font-size:0.72rem; color:#94a3b8;">☎ ${escapeHTML(shipperPhone)}</div>` : ''}
                        </div>
                        <button type="button" class="btn-change-shipper-sm" onclick="openAssignShipperModal('${order._id}')" title="Đổi shipper khác">
                            Đổi
                        </button>
                    </div>
                </div>
            `;
        } else {
            shipperCellHtml = `
                <div class="shipper-cell-box">
                    <button type="button" class="btn-assign-shipper" onclick="openAssignShipperModal('${order._id}')" title="Phân công shipper cho đơn hàng này">
                        + Chọn shipper
                    </button>
                </div>
            `;
        }

        // Shipping status & tracking
        const shippingStatusText = shippingStatusLabels[order.shippingStatus] || (order.shippingStatus || 'Chưa phân công');
        const trackingCode = order.trackingNumber || '';
        const shippingCellHtml = `
            <div style="font-size:0.78rem;">
                <span class="status-badge" style="background:rgba(255,255,255,0.06); color:#cbd5e1; font-size:0.72rem;">${escapeHTML(shippingStatusText)}</span>
                ${trackingCode ? `<div style="color:#60a5fa; margin-top:2px; font-family:monospace;">${escapeHTML(trackingCode)}</div>` : ''}
                ${order.shippingUnit ? `<div style="color:#94a3b8; font-size:0.72rem;">${escapeHTML(order.shippingUnit)}</div>` : ''}
            </div>
        `;

        // Action menu
        const actionCellHtml = `
            <div class="actions-cell-wrap">
                <button type="button" class="btn-detail-action" onclick="openOrderDetail('${order._id}')">
                    Xem chi tiết
                </button>
                <div class="dropdown-menu-wrapper">
                    <button type="button" class="btn-kebab-menu" onclick="toggleRowMenu('${order._id}')" title="Tác vụ khác">
                        ⋮
                    </button>
                    <div id="rowMenu_${order._id}" class="actions-dropdown-content">
                        <button type="button" class="dropdown-menu-item" onclick="openOrderDetail('${order._id}')">
                            👁️ Xem chi tiết
                        </button>
                        <button type="button" class="dropdown-menu-item" onclick="openAssignShipperModal('${order._id}')">
                            🛵 Phân công shipper
                        </button>
                        ${order.paymentStatus !== 'paid' ? `
                            <button type="button" class="dropdown-menu-item" onclick="promptMarkPaymentPaid('${order._id}')">
                                💵 Xác nhận thanh toán
                            </button>
                        ` : ''}
                        <button type="button" class="dropdown-menu-item" onclick="printOrderInvoice('${order._id}')">
                            🖨️ In hóa đơn VAT
                        </button>
                        <button type="button" class="dropdown-menu-item" onclick="promptAddOrderNote('${order._id}')">
                            📝 Thêm ghi chú nội bộ
                        </button>
                        ${!['cancelled', 'completed', 'returned'].includes(order.status) ? `
                            <button type="button" class="dropdown-menu-item danger-item" onclick="openCancelOrderModal('${order._id}')">
                                🚫 Hủy đơn hàng
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        return `
            <tr class="fade-in">
                <td style="text-align: center;">
                    <input type="checkbox" value="${order._id}" ${isSelected ? 'checked' : ''} onchange="toggleSelectOrder('${order._id}', this.checked)">
                </td>
                <td>
                    <a class="order-id-link" onclick="openOrderDetail('${order._id}')" title="Bấm để xem chi tiết">${orderCode}</a>
                </td>
                <td>
                    <div style="font-weight:600; color:var(--admin-text-main);">${escapeHTML(recipientName)}</div>
                    <div style="font-size:0.75rem; color:var(--admin-text-muted);">${escapeHTML(recipientPhone)}</div>
                    <div style="font-size:0.75rem; color:var(--admin-text-dim); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(shippingAddress)}">${escapeHTML(shippingAddress)}</div>
                </td>
                <td>${productsSummaryHtml}</td>
                <td class="td-price" style="font-weight:700; color:#38bdf8;">${fmt(order.totalAmount)}</td>
                <td>${paymentCellHtml}</td>
                <td>${statusCellHtml}</td>
                <td>${shipperCellHtml}</td>
                <td>${shippingCellHtml}</td>
                <td style="font-size:0.78rem; color:#94a3b8; white-space:nowrap;">${formatDate(order.orderDate || order.createdAt)}</td>
                <td style="text-align: center;">${actionCellHtml}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 3. PAGINATION
// ==========================================

function renderPagination(pagination) {
    const totalEl = document.getElementById('totalOrdersCount');
    if (totalEl) totalEl.textContent = Number(pagination.total || 0).toLocaleString('vi-VN');

    const pagesContainer = document.getElementById('paginationPagesList');
    if (!pagesContainer) return;

    const totalPages = pagination.totalPages || 1;
    const current = pagination.page || 1;

    let html = '';

    // Prev Button
    html += `<button type="button" class="page-num-btn" ${current <= 1 ? 'disabled' : ''} onclick="goToPage(${current - 1})" title="Trang trước">‹</button>`;

    // Page numbers with ellipsis
    const maxVisible = 5;
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button type="button" class="page-num-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="color:#64748b; padding:0 4px;">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        html += `<button type="button" class="page-num-btn ${p === current ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="color:#64748b; padding:0 4px;">...</span>`;
        html += `<button type="button" class="page-num-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Next Button
    html += `<button type="button" class="page-num-btn" ${current >= totalPages ? 'disabled' : ''} onclick="goToPage(${current + 1})" title="Trang kế tiếp">›</button>`;

    pagesContainer.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadOrders();
}

function changePageSize(size) {
    pageSize = parseInt(size) || 20;
    currentPage = 1;
    loadOrders();
}

// ==========================================
// 4. SORT & FILTERS
// ==========================================

function handleSortColumn(colKey) {
    const colFieldMap = {
        orderId: '_id',
        totalAmount: 'totalAmount',
        orderDate: 'createdAt'
    };

    const targetField = colFieldMap[colKey] || 'createdAt';

    if (currentSortBy === targetField) {
        currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
        currentSortBy = targetField;
        currentSortOrder = 'desc';
    }

    // Reset sort icons
    ['orderId', 'totalAmount', 'orderDate'].forEach(key => {
        const icon = document.getElementById(`sortIcon_${key}`);
        if (icon) icon.textContent = '↕';
    });

    const activeIcon = document.getElementById(`sortIcon_${colKey}`);
    if (activeIcon) activeIcon.textContent = currentSortOrder === 'asc' ? '↑' : '↓';

    currentPage = 1;
    loadOrders();
}

function quickFilterByStatus(status) {
    activeStatusFilter = status;
    const filterSelect = document.getElementById('filterStatus');
    if (filterSelect) filterSelect.value = status;
    currentPage = 1;
    loadOrders();
}

function applyFilters() {
    activeStatusFilter = document.getElementById('filterStatus')?.value || 'all';
    activePaymentStatus = document.getElementById('filterPaymentStatus')?.value || 'all';
    activePaymentMethod = document.getElementById('filterPaymentMethod')?.value || 'all';
    activeShippingStatus = document.getElementById('filterShippingStatus')?.value || 'all';
    activeShipper = document.getElementById('filterShipper')?.value || 'all';
    filterDateFrom = document.getElementById('filterDateFrom')?.value || '';
    filterDateTo = document.getElementById('filterDateTo')?.value || '';

    currentPage = 1;
    loadOrders();
}

function resetFilters() {
    const form = document.getElementById('orderFilterForm');
    if (form) form.reset();

    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.classList.remove('visible');

    searchQuery = '';
    activeStatusFilter = 'all';
    activePaymentStatus = 'all';
    activePaymentMethod = 'all';
    activeShippingStatus = 'all';
    activeShipper = 'all';
    filterDateFrom = '';
    filterDateTo = '';
    currentPage = 1;

    loadOrders();
}

function openModalEl(modal) {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('open', '');
    if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch (e) {}
    }
}

function closeModalEl(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    modal.removeAttribute('open');
    if (typeof modal.close === 'function') {
        try { modal.close(); } catch (e) {}
    }
}

// ==========================================
// 5. SHIPPER ASSIGNMENT FLOW
// ==========================================

let currentShipperFilterTab = 'all';
let currentShipperSearchQuery = '';

async function openAssignShipperModal(orderId) {
    currentAssignOrderId = orderId;
    const modal = document.getElementById('assignShipperModal');
    const order = loadedOrders.find(o => String(o._id) === String(orderId)) || currentDetailOrder;

    const modalTitle = document.getElementById('shipperModalTitle');
    if (modalTitle) modalTitle.textContent = `Phân công shipper - Đơn #${String(orderId).padStart(4, '0')}`;

    // Update order context strip
    const orderCodeEl = document.getElementById('shipperModalOrderCode');
    const customerEl = document.getElementById('shipperModalCustomer');
    const addressEl = document.getElementById('shipperModalAddress');
    if (orderCodeEl) orderCodeEl.textContent = `#${String(orderId).padStart(4, '0')}`;
    if (customerEl) customerEl.textContent = order?.customer?.name || order?.customerName || order?.shippingAddress?.recipientName || 'Khách hàng';
    if (addressEl) {
        const fullAddr = order?.shippingAddress?.fullAddress || order?.shippingAddress?.address || order?.customer?.address || 'TP. Hồ Chí Minh';
        addressEl.textContent = fullAddr.length > 35 ? fullAddr.substring(0, 35) + '...' : fullAddr;
        addressEl.title = fullAddr;
    }

    const reassignNotice = document.getElementById('reassignNoticeBox');
    const currentNoticeName = document.getElementById('currentShipperNameNotice');
    const confirmBtnText = document.getElementById('confirmAssignBtnText');

    if (order && order.shipper) {
        const oldName = order.shipper.name || order.shipperAssignedByName || `Shipper #${order.shipper._id || order.shipper}`;
        if (reassignNotice && currentNoticeName) {
            currentNoticeName.textContent = oldName;
            reassignNotice.style.display = 'block';
        }
        if (confirmBtnText) confirmBtnText.textContent = 'Xác nhận đổi shipper';
    } else {
        if (reassignNotice) reassignNotice.style.display = 'none';
        if (confirmBtnText) confirmBtnText.textContent = 'Xác nhận phân công';
    }

    // Reset filters
    currentShipperFilterTab = 'all';
    currentShipperSearchQuery = '';
    const searchInput = document.getElementById('shipperSearchInput');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.shipper-tab-btn').forEach(b => b.classList.remove('active'));
    const allTab = document.getElementById('tabShipperAll');
    if (allTab) allTab.classList.add('active');

    // Refresh shippers if needed
    if (!cachedShippers.length) {
        await loadShippers();
    }

    renderShipperRadioList(cachedShippers, order?.shipper?._id || order?.shipper);

    openModalEl(modal);
}

function closeShipperModal() {
    const modal = document.getElementById('assignShipperModal');
    closeModalEl(modal);
    currentAssignOrderId = null;
}

function getShipperInitials(name) {
    if (!name) return 'SP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function selectShipperItem(cardEl, shipperId) {
    document.querySelectorAll('.pro-shipper-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    const radio = cardEl.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    const allPills = document.querySelectorAll('.shipper-check-pill');
    allPills.forEach(p => p.innerHTML = '○ Chọn');
    const pill = cardEl.querySelector('.shipper-check-pill');
    if (pill) pill.innerHTML = '✓ Đã chọn';
}

function setShipperFilterTab(tab, btn) {
    currentShipperFilterTab = tab;
    document.querySelectorAll('.shipper-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyShipperFilters();
}

function filterShipperListInModal(query) {
    currentShipperSearchQuery = (query || '').toLowerCase().trim();
    applyShipperFilters();
}

function applyShipperFilters() {
    let list = [...cachedShippers];
    if (currentShipperSearchQuery) {
        list = list.filter(s => (s.name || '').toLowerCase().includes(currentShipperSearchQuery) || (s.phone || '').includes(currentShipperSearchQuery));
    }
    if (currentShipperFilterTab === 'free') {
        list = list.filter(s => (s.activeOrdersCount || 0) === 0);
    } else if (currentShipperFilterTab === 'busy') {
        list = list.filter(s => (s.activeOrdersCount || 0) > 0);
    }

    const selectedRadio = document.querySelector('input[name="selectedShipperRadio"]:checked');
    renderShipperCardsMarkup(list, selectedRadio?.value);
}

function renderShipperRadioList(shippers, selectedId = null) {
    // Update tab counts
    const totalCount = shippers.length;
    const freeCount = shippers.filter(s => (s.activeOrdersCount || 0) === 0).length;
    const busyCount = shippers.filter(s => (s.activeOrdersCount || 0) > 0).length;
    const elAll = document.getElementById('countTabAll');
    const elFree = document.getElementById('countTabFree');
    const elBusy = document.getElementById('countTabBusy');
    if (elAll) elAll.textContent = totalCount;
    if (elFree) elFree.textContent = freeCount;
    if (elBusy) elBusy.textContent = busyCount;

    renderShipperCardsMarkup(shippers, selectedId);
}

function renderShipperCardsMarkup(shippers, selectedId = null) {
    const container = document.getElementById('shipperRadioList');
    if (!container) return;

    if (!shippers.length) {
        container.innerHTML = `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--admin-text-muted);">
                <div style="font-size: 2rem; margin-bottom: 8px;">🛵</div>
                <strong style="color: var(--admin-text-main);">Không tìm thấy nhân viên giao hàng phù hợp</strong>
                <p style="font-size: 0.82rem; margin-top: 4px;">Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc "Tất cả".</p>
            </div>
        `;
        return;
    }

    container.innerHTML = shippers.map(s => {
        const isChecked = String(s._id) === String(selectedId);
        const count = s.activeOrdersCount || 0;
        const isFree = count === 0;
        const tagHtml = isFree
            ? '<span class="shipper-load-badge free">🟢 Đang rảnh (0 đơn)</span>'
            : `<span class="shipper-load-badge busy">🟡 Đang giao (${count} đơn)</span>`;

        const initials = getShipperInitials(s.name);
        const statusDotClass = isFree ? 'online' : 'delivering';
        const cardSelectedClass = isChecked ? 'selected' : '';
        const pillText = isChecked ? '✓ Đã chọn' : '○ Chọn';

        return `
            <div class="pro-shipper-card ${cardSelectedClass}" onclick="selectShipperItem(this, ${s._id})">
                <input type="radio" name="selectedShipperRadio" value="${s._id}" ${isChecked ? 'checked' : ''}>
                
                <div class="shipper-card-left">
                    <div class="shipper-avatar-circle">
                        <span>${initials}</span>
                        <span class="shipper-status-dot ${statusDotClass}" title="${isFree ? 'Đang sẵn sàng nhận đơn' : 'Đang thực hiện giao hàng'}"></span>
                    </div>
                    <div class="shipper-card-info">
                        <span class="shipper-card-name">${escapeHTML(s.name)}</span>
                        <span class="shipper-card-phone">📞 ${escapeHTML(s.phone || 'Chưa cập nhật SĐT')}</span>
                    </div>
                </div>

                <div class="shipper-card-right">
                    <div>${tagHtml}</div>
                    <span class="shipper-check-pill">${pillText}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function submitShipperAssignment() {
    if (!currentAssignOrderId) return;

    const selectedRadio = document.querySelector('input[name="selectedShipperRadio"]:checked');
    if (!selectedRadio) {
        showToast('Vui lòng chọn một người giao hàng!', 'error');
        return;
    }

    const shipperId = Number(selectedRadio.value);
    const shipperObj = cachedShippers.find(s => s._id === shipperId);
    const shipperName = shipperObj ? shipperObj.name : `Shipper #${shipperId}`;

    if (!confirm(`Bạn có chắc chắn muốn phân công shipper "${shipperName}" cho đơn #${String(currentAssignOrderId).padStart(4, '0')}?`)) {
        return;
    }

    try {
        const res = await fetch(`${EP}/${currentAssignOrderId}/assign-shipper`, {
            method: 'PATCH',
            headers: auth.getHeaders(),
            body: JSON.stringify({ shipperId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi khi phân công shipper');

        showToast(json.message || `Đã phân công ${shipperName} giao đơn!`);
        closeShipperModal();

        // Refresh table & active detail view
        await loadOrders();
        await loadShippers();

        if (currentDetailOrder && String(currentDetailOrder._id) === String(currentAssignOrderId)) {
            openOrderDetail(currentAssignOrderId);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// 6. STATUS & PAYMENT UPDATES
// ==========================================

async function handleStatusChange(orderId, newStatus, currentStatus) {
    if (newStatus === currentStatus) return;

    if (!confirm(`Chuyển trạng thái đơn #${String(orderId).padStart(4, '0')} từ "${statusLabels[currentStatus] || currentStatus}" sang "${statusLabels[newStatus] || newStatus}"?`)) {
        loadOrders();
        return;
    }

    try {
        const res = await fetch(`${EP}/${orderId}/status`, {
            method: 'PATCH',
            headers: auth.getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi cập nhật trạng thái');

        showToast(json.message || 'Đã cập nhật trạng thái đơn hàng!');
        loadOrders();

        if (currentDetailOrder && String(currentDetailOrder._id) === String(orderId)) {
            openOrderDetail(orderId);
        }
    } catch (error) {
        showToast(error.message, 'error');
        loadOrders();
    }
}

async function promptMarkPaymentPaid(orderId) {
    const transactionId = prompt('Nhập mã giao dịch / Ghi chú thanh toán xác nhận:', `PAY-${Date.now()}`);
    if (transactionId === null) return;

    try {
        const res = await fetch(`${EP}/${orderId}/payment`, {
            method: 'PATCH',
            headers: auth.getHeaders(),
            body: JSON.stringify({
                paymentStatus: 'paid',
                paymentProvider: 'manual',
                paymentTransactionId: transactionId
            })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi xác nhận thanh toán');

        showToast('Đã xác nhận đơn hàng đã thanh toán!');
        loadOrders();

        if (currentDetailOrder && String(currentDetailOrder._id) === String(orderId)) {
            openOrderDetail(orderId);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// 7. CANCEL ORDER FLOW
// ==========================================

function openCancelOrderModal(orderId) {
    currentCancelOrderId = orderId;
    const modal = document.getElementById('cancelOrderModal');
    const titleEl = document.getElementById('cancelModalTitle');
    if (titleEl) titleEl.textContent = `Hủy đơn hàng #${String(orderId).padStart(4, '0')}`;

    const formSelect = document.getElementById('cancelReasonSelect');
    if (formSelect) formSelect.value = 'customer_request';
    toggleCustomReasonField('customer_request');

    openModalEl(modal);
}

function closeCancelModal() {
    const modal = document.getElementById('cancelOrderModal');
    closeModalEl(modal);
    currentCancelOrderId = null;
}

function toggleCustomReasonField(reasonVal) {
    const customWrap = document.getElementById('customReasonWrap');
    if (customWrap) {
        customWrap.style.display = reasonVal === 'other' ? 'block' : 'none';
    }
}

async function submitCancelOrder() {
    if (!currentCancelOrderId) return;

    const reasonKey = document.getElementById('cancelReasonSelect')?.value || 'customer_request';
    const customReason = document.getElementById('cancelCustomReasonInput')?.value || '';

    try {
        const res = await fetch(`${EP}/${currentCancelOrderId}/cancel`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify({
                reason: reasonKey,
                customReason: reasonKey === 'other' ? customReason : ''
            })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi khi hủy đơn hàng');

        showToast('Đã hủy đơn hàng thành công và hoàn lại tồn kho!');
        closeCancelModal();
        loadOrders();

        if (currentDetailOrder && String(currentDetailOrder._id) === String(currentCancelOrderId)) {
            openOrderDetail(currentCancelOrderId);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// 8. ADMIN INTERNAL NOTES
// ==========================================

async function promptAddOrderNote(orderId) {
    const note = prompt('Nhập nội dung ghi chú nội bộ cho đơn hàng này:');
    if (!note || !note.trim()) return;

    try {
        const res = await fetch(`${EP}/${orderId}/notes`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify({ content: note.trim() })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi thêm ghi chú');

        showToast('Đã lưu ghi chú nội bộ!');
        if (currentDetailOrder && String(currentDetailOrder._id) === String(orderId)) {
            openOrderDetail(orderId);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// 9. CHECKBOX & BULK ACTIONS
// ==========================================

function toggleSelectOrder(orderId, isChecked) {
    if (isChecked) selectedOrderIds.add(String(orderId));
    else selectedOrderIds.delete(String(orderId));

    updateBulkSelectionToolbar();
}

function toggleSelectAllOrders(isChecked) {
    loadedOrders.forEach(o => {
        if (isChecked) selectedOrderIds.add(String(o._id));
        else selectedOrderIds.delete(String(o._id));
    });

    const tbody = document.getElementById('orderTableBody');
    if (tbody) {
        tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = isChecked);
    }

    updateBulkSelectionToolbar();
}

function clearSelectedOrders() {
    selectedOrderIds.clear();
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) selectAllCb.checked = false;

    const tbody = document.getElementById('orderTableBody');
    if (tbody) {
        tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    updateBulkSelectionToolbar();
}

function updateBulkSelectionToolbar() {
    const bar = document.getElementById('bulkActionsToolbar');
    const countEl = document.getElementById('selectedOrdersCount');
    const count = selectedOrderIds.size;

    if (countEl) countEl.textContent = count;
    if (bar) {
        if (count > 0) bar.classList.add('active');
        else bar.classList.remove('active');
    }
}

function openBulkShipperModal() {
    const modal = document.getElementById('bulkActionModal');
    const title = document.getElementById('bulkModalTitle');
    const body = document.getElementById('bulkModalBody');

    title.textContent = `Phân công shipper cho ${selectedOrderIds.size} đơn hàng`;
    body.innerHTML = `
        <div style="margin-bottom:14px; color:#cbd5e1; font-size:0.86rem;">
            Chọn shipper phụ trách giao toàn bộ <strong>${selectedOrderIds.size}</strong> đơn đã chọn:
        </div>
        <div class="filter-group">
            <label for="bulkShipperSelect">Người giao hàng</label>
            <select id="bulkShipperSelect" class="filter-control">
                ${cachedShippers.map(s => `<option value="${s._id}">${escapeHTML(s.name)} (☎ ${escapeHTML(s.phone || 'N/A')}) - Đang giao: ${s.activeOrdersCount || 0}</option>`).join('')}
            </select>
        </div>
    `;

    window._bulkActionType = 'assign_shipper';
    openModalEl(modal);
}

function openBulkStatusModal() {
    const modal = document.getElementById('bulkActionModal');
    const title = document.getElementById('bulkModalTitle');
    const body = document.getElementById('bulkModalBody');

    title.textContent = `Cập nhật trạng thái cho ${selectedOrderIds.size} đơn hàng`;
    body.innerHTML = `
        <div style="margin-bottom:14px; color:#cbd5e1; font-size:0.86rem;">
            Chọn trạng thái mới cần áp dụng cho <strong>${selectedOrderIds.size}</strong> đơn đã chọn:
        </div>
        <div class="filter-group">
            <label for="bulkStatusSelect">Trạng thái mới</label>
            <select id="bulkStatusSelect" class="filter-control">
                <option value="confirmed">Đã xác nhận</option>
                <option value="processing">Đang chuẩn bị</option>
                <option value="ready_to_ship">Chờ lấy hàng</option>
                <option value="shipping">Đang giao</option>
                <option value="completed">Hoàn tất</option>
            </select>
        </div>
    `;

    window._bulkActionType = 'update_status';
    openModalEl(modal);
}

function closeBulkModal() {
    const modal = document.getElementById('bulkActionModal');
    closeModalEl(modal);
    window._bulkActionType = null;
}

async function submitBulkAction() {
    const action = window._bulkActionType;
    if (!action || selectedOrderIds.size === 0) return;

    let payload = { action, orderIds: Array.from(selectedOrderIds).map(Number) };

    if (action === 'assign_shipper') {
        const sId = document.getElementById('bulkShipperSelect')?.value;
        if (!sId) return;
        payload.shipperId = Number(sId);
    } else if (action === 'update_status') {
        const st = document.getElementById('bulkStatusSelect')?.value;
        if (!st) return;
        payload.status = st;
    }

    try {
        const res = await fetch(`${EP}/bulk`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi thao tác hàng loạt');

        showToast(json.message || 'Đã hoàn tất thao tác hàng loạt!');
        closeBulkModal();
        clearSelectedOrders();
        loadOrders();
        loadShippers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==========================================
// 10. ORDER DETAIL MODAL & TIMELINE
// ==========================================

async function openOrderDetail(orderId) {
    const modal = document.getElementById('orderDetailModal');
    const titleEl = document.getElementById('detailModalTitle');
    const dateEl = document.getElementById('detailOrderDateText');
    const bodyEl = document.getElementById('detailModalBody');

    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `Chi tiết đơn hàng #${String(orderId).padStart(4, '0')}`;
    bodyEl.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #94a3b8;">Đang tải thông tin đơn hàng...</div>';

    openModalEl(modal);

    try {
        const res = await fetch(`${EP}/${orderId}`, { headers: auth.getHeaders() });
        const order = await res.json();
        if (!res.ok) throw new Error(order.message || 'Không thể tải chi tiết đơn hàng');

        currentDetailOrder = order;

        if (dateEl) dateEl.textContent = `Ngày đặt: ${formatDate(order.orderDate || order.createdAt)}`;

        // Render full modular layout
        bodyEl.innerHTML = buildOrderDetailHtml(order);

    } catch (error) {
        bodyEl.innerHTML = `<div style="padding: 2rem; color: #ef4444; text-align: center;">${escapeHTML(error.message)}</div>`;
    }
}

function closeOrderDetailModal() {
    const modal = document.getElementById('orderDetailModal');
    closeModalEl(modal);
    currentDetailOrder = null;
}

function buildOrderDetailHtml(order) {
    const recipientName = order.recipientName || order.customer?.name || order.customerName || 'N/A';
    const recipientPhone = order.recipientPhone || order.customer?.phone || order.customerPhone || 'N/A';
    const customerEmail = order.guestEmail || order.customer?.email || 'N/A';
    const shippingAddress = order.shippingAddress || 'N/A';
    const shipperObj = order.shipper;
    const shipperName = shipperObj?.name || order.shipperAssignedByName || 'Chưa phân công';
    const shipperPhone = shipperObj?.phone || '';

    // Products table rows
    const productsHtml = (order.products || []).map((p, idx) => {
        const prod = p.product || {};
        const image = (prod.images && prod.images[0]) || '../assets/images/placeholder.png';
        const name = p.productName || prod.name || 'Sản phẩm công nghệ';
        const lineTotal = (p.price || 0) * (p.quantity || 1);

        return `
            <tr>
                <td style="width: 45px; text-align: center;">${idx + 1}</td>
                <td>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <img src="${escapeHTML(image)}" alt="" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                        <div>
                            <strong style="color: var(--admin-text-main);">${escapeHTML(name)}</strong>
                            ${prod.sku ? `<div style="font-size: 0.72rem; color: var(--admin-text-muted);">SKU: ${escapeHTML(prod.sku)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="text-align: center;">${p.quantity}</td>
                <td style="text-align: right;">${fmt(p.price)}</td>
                <td style="text-align: right; font-weight: 700; color: #60a5fa;">${fmt(lineTotal)}</td>
            </tr>
        `;
    }).join('');

    // Admin Notes List
    const notesHtml = (order.adminNotes || []).map(n => `
        <div style="padding: 8px 12px; background: var(--admin-surface, #ffffff); border: 1px solid var(--admin-border, #e2e8f0); border-radius: 6px; margin-bottom: 6px; font-size: 0.82rem;">
            <div style="display: flex; justify-content: space-between; color: var(--admin-text-muted, #64748b); font-size: 0.74rem; margin-bottom: 2px;">
                <strong>${escapeHTML(n.createdByName || 'Admin')}</strong>
                <span>${formatDate(n.createdAt)}</span>
            </div>
            <div style="color: var(--admin-text-main, #0f172a);">${escapeHTML(n.content)}</div>
        </div>
    `).join('') || '<div style="color: var(--admin-text-muted, #64748b); font-size: 0.8rem; font-style: italic;">Chưa có ghi chú nội bộ nào.</div>';

    // Timeline Visual HTML
    const timelineEvents = (order.history && order.history.length > 0) ? order.history : (order.statusHistory || []).map(s => ({
        action: 'ORDER_STATUS_CHANGED',
        statusTo: s.status,
        note: s.description || s.title,
        changedByName: 'Hệ thống',
        createdAt: s.occurredAt
    }));

    const timelineHtml = timelineEvents.slice().reverse().map(ev => {
        let dotColor = 'green';
        if (ev.statusTo === 'cancelled' || ev.action === 'ORDER_CANCELLED') dotColor = 'red';
        else if (ev.statusTo === 'shipping') dotColor = 'purple';
        else if (ev.statusTo === 'pending') dotColor = 'amber';

        const actionText = actionLabels[ev.action] || ev.action || 'Cập nhật đơn hàng';
        const changedByStr = ev.changedByName ? `(${ev.changedByName})` : '';

        return `
            <div class="timeline-event-item">
                <div class="timeline-dot ${dotColor}"></div>
                <div class="timeline-content-card">
                    <div class="timeline-header-line">
                        <strong style="color: var(--admin-text-main);">${escapeHTML(actionText)} ${escapeHTML(changedByStr)}</strong>
                        <span class="timeline-time-str">${formatDate(ev.createdAt)}</span>
                    </div>
                    ${ev.statusTo ? `<div style="font-size:0.76rem; color:#60a5fa; margin-bottom:2px;">Trạng thái: <strong>${statusLabels[ev.statusTo] || ev.statusTo}</strong></div>` : ''}
                    ${ev.note ? `<div style="color: var(--admin-text-muted); font-size: 0.8rem;">${escapeHTML(ev.note)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <!-- Top Cards Grid -->
        <div class="order-detail-grid">
            <!-- 1. General & Customer -->
            <div class="detail-card-panel">
                <h3>👤 Khách hàng &amp; Giao hàng</h3>
                <div class="detail-info-row">
                    <span>Họ và tên:</span>
                    <span>${escapeHTML(recipientName)}</span>
                </div>
                <div class="detail-info-row">
                    <span>Số điện thoại:</span>
                    <span>${escapeHTML(recipientPhone)}</span>
                </div>
                <div class="detail-info-row">
                    <span>Email:</span>
                    <span>${escapeHTML(customerEmail)}</span>
                </div>
                <div class="detail-info-row">
                    <span>Địa chỉ:</span>
                    <span>${escapeHTML(shippingAddress)}</span>
                </div>
                ${order.note ? `
                    <div style="margin-top: 8px; padding: 6px 8px; background: rgba(59, 130, 246, 0.08); border-radius: 6px; font-size: 0.78rem;">
                        <span style="color:#94a3b8;">Ghi chú của khách:</span>
                        <div style="color:#60a5fa; font-weight:500;">${escapeHTML(order.note)}</div>
                    </div>
                ` : ''}
            </div>

            <!-- 2. Shipping & Shipper -->
            <div class="detail-card-panel">
                <h3>🛵 Vận chuyển &amp; Shipper</h3>
                <div class="detail-info-row">
                    <span>Trạng thái giao:</span>
                    <span class="status-badge" style="background: var(--admin-surface, #ffffff); border: 1px solid var(--admin-border, #e2e8f0); color: var(--admin-text-main, #0f172a);">${escapeHTML(shippingStatusLabels[order.shippingStatus] || order.shippingStatus || 'Chưa phân công')}</span>
                </div>
                <div class="detail-info-row">
                    <span>Shipper phụ trách:</span>
                    <span style="color: #34d399; font-weight: 600;">${escapeHTML(shipperName)}</span>
                </div>
                ${shipperPhone ? `
                    <div class="detail-info-row">
                        <span>SĐT Shipper:</span>
                        <span>${escapeHTML(shipperPhone)}</span>
                    </div>
                ` : ''}
                <div class="detail-info-row">
                    <span>Mã vận đơn:</span>
                    <span style="font-family: monospace; color: #60a5fa;">${escapeHTML(order.trackingNumber || 'Chưa tạo')}</span>
                </div>
                <div class="detail-info-row">
                    <span>Đơn vị vận chuyển:</span>
                    <span>${escapeHTML(order.shippingUnit || 'Cửa hàng tự giao / Hãng')}</span>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button type="button" class="btn-detail-action" style="flex:1;" onclick="openAssignShipperModal('${order._id}')">
                        🛵 Đổi / Phân công shipper
                    </button>
                </div>
            </div>

            <!-- 3. Payment & Totals -->
            <div class="detail-card-panel">
                <h3>💳 Thanh toán &amp; Tài chính</h3>
                <div class="detail-info-row">
                    <span>Phương thức:</span>
                    <span>${escapeHTML(methodLabels[order.paymentMethod] || order.paymentMethod)}</span>
                </div>
                <div class="detail-info-row">
                    <span>Trạng thái TT:</span>
                    <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-completed' : 'status-pending'}">${escapeHTML(paymentStatusLabels[order.paymentStatus] || order.paymentStatus)}</span>
                </div>
                ${order.paymentTransactionId ? `
                    <div class="detail-info-row">
                        <span>Mã giao dịch:</span>
                        <span style="font-family: monospace;">${escapeHTML(order.paymentTransactionId)}</span>
                    </div>
                ` : ''}
                ${order.paidAt ? `
                    <div class="detail-info-row">
                        <span>Thời gian TT:</span>
                        <span>${formatDate(order.paidAt)}</span>
                    </div>
                ` : ''}
                <hr style="border: 0; border-top: 1px dashed var(--admin-border, #e2e8f0); margin: 8px 0;">
                <div class="detail-info-row">
                    <span>Tạm tính hàng:</span>
                    <span>${fmt(order.subtotal || order.totalAmount)}</span>
                </div>
                ${order.discountAmount ? `
                    <div class="detail-info-row" style="color: #34d399;">
                        <span>Giảm giá (${escapeHTML(order.couponCode || 'Coupon')}):</span>
                        <span>-${fmt(order.discountAmount)}</span>
                    </div>
                ` : ''}
                <div class="detail-info-row">
                    <span>Phí vận chuyển:</span>
                    <span>${order.shippingFee ? fmt(order.shippingFee) : '0 đ (Miễn phí)'}</span>
                </div>
                <div class="detail-info-row" style="font-size: 1rem; margin-top: 6px;">
                    <strong style="color: var(--admin-text-main);">TỔNG THANH TOÁN:</strong>
                    <strong style="color: var(--admin-blue-accent, #2563eb);">${fmt(order.totalAmount)}</strong>
                </div>
            </div>
        </div>

        <!-- Products Section -->
        <div class="detail-card-panel" style="margin-bottom: 1.5rem;">
            <h3>📦 Sản phẩm trong đơn (${(order.products || []).length} mục)</h3>
            <div class="table-wrapper">
                <table class="detail-products-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">STT</th>
                            <th>Sản phẩm</th>
                            <th style="width: 70px; text-align: center;">Số lượng</th>
                            <th style="width: 120px; text-align: right;">Đơn giá</th>
                            <th style="width: 130px; text-align: right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productsHtml}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Bottom Grid: Admin Notes & Audit Timeline -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
            <!-- Admin Internal Notes -->
            <div class="detail-card-panel">
                <h3>📝 Ghi chú nội bộ Admin</h3>
                <div style="max-height: 220px; overflow-y: auto; margin-bottom: 10px;">
                    ${notesHtml}
                </div>
                <div style="display: flex; gap: 6px;">
                    <input type="text" id="newAdminNoteInput" class="filter-control" style="flex: 1;" placeholder="Nhập ghi chú mới...">
                    <button type="button" class="btn-filter-apply" onclick="submitDetailModalNote('${order._id}')">Lưu</button>
                </div>
            </div>

            <!-- Timeline Audit Trail -->
            <div class="detail-card-panel">
                <h3>⏱️ Lịch sử xử lý &amp; Vận chuyển (Timeline)</h3>
                <div class="order-timeline-list" style="max-height: 280px; overflow-y: auto; padding-right: 6px;">
                    ${timelineHtml}
                </div>
            </div>
        </div>
    `;
}

async function submitDetailModalNote(orderId) {
    const input = document.getElementById('newAdminNoteInput');
    const content = (input?.value || '').trim();
    if (!content) return;

    try {
        const res = await fetch(`${EP}/${orderId}/notes`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify({ content })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Lỗi thêm ghi chú');

        showToast('Đã thêm ghi chú nội bộ!');
        openOrderDetail(orderId);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function printCurrentDetailInvoice() {
    if (currentDetailOrder) {
        printOrderInvoice(currentDetailOrder._id);
    }
}

// ==========================================
// 11. EXPORT TO CSV
// ==========================================

function exportOrdersCsv() {
    const params = new URLSearchParams({
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
    });

    if (searchQuery) params.append('search', searchQuery);
    if (activeStatusFilter && activeStatusFilter !== 'all') params.append('status', activeStatusFilter);
    if (activePaymentStatus && activePaymentStatus !== 'all') params.append('paymentStatus', activePaymentStatus);
    if (activePaymentMethod && activePaymentMethod !== 'all') params.append('paymentMethod', activePaymentMethod);
    if (activeShippingStatus && activeShippingStatus !== 'all') params.append('shippingStatus', activeShippingStatus);
    if (activeShipper && activeShipper !== 'all') params.append('shipper', activeShipper);
    if (filterDateFrom) params.append('dateFrom', filterDateFrom);
    if (filterDateTo) params.append('dateTo', filterDateTo);

    showToast('Đang tạo file xuất đơn hàng...');

    const token = auth.getToken();
    fetch(`${EP}/export?${params.toString()}`, {
        headers: {
            Authorization: token ? `Bearer ${token}` : ''
        }
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Lỗi xuất file');
        }
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `TechEcommerce_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Đã tải xuống file CSV đơn hàng thành công!');
    })
    .catch(err => {
        showToast(err.message || 'Lỗi xuất file CSV!', 'error');
    });
}

// ==========================================
// 12. PRINT INVOICE & PACKING SLIP
// ==========================================

async function printOrderInvoice(id) {
    let order = loadedOrders.find(o => String(o._id) === String(id)) || currentDetailOrder;
    if (!order || !order.products) {
        try {
            const res = await fetch(`${EP}/${id}`, { headers: auth.getHeaders() });
            order = await res.json();
        } catch (e) {
            showToast('Không thể tải thông tin đơn hàng để in!', 'error');
            return;
        }
    }

    const recipientName = order.recipientName || order.customer?.name || order.customerName || 'Khách vãng lai';
    const recipientPhone = order.recipientPhone || order.customer?.phone || order.customerPhone || 'N/A';
    const shippingAddress = order.shippingAddress || 'Nhận tại showroom TechEcommerce';
    const orderDateFormatted = formatDate(order.orderDate || order.createdAt);
    const trackingCode = order.trackingNumber || 'CHƯA_TẠO_VẬN_ĐƠN';
    const shippingUnit = order.shippingUnit || 'Giao Hàng Nhanh / Tiêu Chuẩn';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent('https://techecommerce-shop.vercel.app/pages/account/orders.html?id=' + order._id)}`;

    const itemsRows = (order.products || []).map((item, idx) => {
        const prodName = item.product?.name || item.productName || 'Sản phẩm công nghệ';
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const total = price * qty;
        return `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${escapeHTML(prodName)}</strong></td>
                <td style="text-align:center;">${qty}</td>
                <td style="text-align:right;">${fmt(price)}</td>
                <td style="text-align:right;"><strong>${fmt(total)}</strong></td>
            </tr>
        `;
    }).join('');

    const invoiceHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Hóa đơn điện tử VAT & Phiếu đóng gói #${order._id}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
                body { background: #fff; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.5; }
                .invoice-box { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 24px; border-radius: 8px; }
                .inv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 16px; }
                .inv-company h2 { font-size: 15px; color: #1e40af; text-transform: uppercase; margin-bottom: 4px; }
                .inv-company p { font-size: 12px; color: #475569; }
                .inv-meta { text-align: right; }
                .inv-meta h1 { font-size: 17px; color: #0f172a; margin-bottom: 4px; }
                .inv-meta span { display: block; font-size: 12px; color: #64748b; }
                .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; }
                .inv-grid div h4 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
                .inv-grid div p { font-size: 12.5px; margin: 2px 0; }
                .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                .inv-table th, .inv-table td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
                .inv-table th { background: #f1f5f9; color: #334155; text-align: left; }
                .inv-totals { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
                .inv-qr { display: flex; align-items: center; gap: 12px; }
                .inv-qr img { width: 90px; height: 90px; border: 1px solid #e2e8f0; padding: 4px; border-radius: 4px; }
                .inv-sum { text-align: right; font-size: 13px; }
                .inv-sum .total-row { font-size: 16px; color: #dc2626; font-weight: bold; margin-top: 4px; }
                .inv-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; margin-top: 32px; padding-top: 16px; }
                .inv-signatures .sign-role { font-weight: 600; margin-bottom: 48px; }
                .inv-signatures .sign-note { font-size: 11px; color: #64748b; font-style: italic; }
                @media print {
                    body { padding: 0; }
                    .invoice-box { border: none; padding: 0; }
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="max-width:800px; margin:0 auto 16px auto; display:flex; justify-content:flex-end; gap:8px;">
                <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">🖨️ In Hóa Đơn / Xuất PDF</button>
                <button onclick="window.close()" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">✕ Đóng</button>
            </div>
            <div class="invoice-box">
                <div class="inv-header">
                    <div class="inv-company">
                        <h2>CÔNG TY CỔ PHẦN CÔNG NGHỆ TECHECOMMERCE VIỆT NAM</h2>
                        <p><strong>Mã số thuế:</strong> 0318992388</p>
                        <p><strong>Địa chỉ:</strong> Tầng 5, Tòa nhà Innovation, TP. Hồ Chí Minh</p>
                        <p><strong>Hotline:</strong> 0842.331.606 | <strong>Website:</strong> techecommerce-shop.vercel.app</p>
                    </div>
                    <div class="inv-meta">
                        <h1>PHIẾU ĐÓNG GÓI &amp; HÓA ĐƠN VAT</h1>
                        <span>Mã đơn: <strong>#${order._id}</strong></span>
                        <span>Mã vận đơn: <strong>${escapeHTML(trackingCode)}</strong></span>
                        <span>Ngày lập: ${orderDateFormatted}</span>
                    </div>
                </div>

                <div class="inv-grid">
                    <div>
                        <h4>Thông tin người nhận (Khách hàng)</h4>
                        <p><strong>Người nhận:</strong> ${escapeHTML(recipientName)}</p>
                        <p><strong>Điện thoại:</strong> ${escapeHTML(recipientPhone)}</p>
                        <p><strong>Địa chỉ nhận:</strong> ${escapeHTML(shippingAddress)}</p>
                    </div>
                    <div>
                        <h4>Thông tin vận chuyển &amp; Thanh toán</h4>
                        <p><strong>Đơn vị vận chuyển:</strong> ${escapeHTML(shippingUnit)}</p>
                        <p><strong>Hình thức thanh toán:</strong> ${escapeHTML(methodLabels[order.paymentMethod] || order.paymentMethod)}</p>
                        <p><strong>Trạng thái thanh toán:</strong> ${escapeHTML(paymentStatusLabels[order.paymentStatus] || order.paymentStatus)}</p>
                        <p><strong>Ghi chú giao hàng:</strong> ${escapeHTML(order.note || 'Cho xem hàng trước khi nhận')}</p>
                    </div>
                </div>

                <table class="inv-table">
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">STT</th>
                            <th>Tên sản phẩm / Thiết bị</th>
                            <th style="width:70px; text-align:center;">Số lượng</th>
                            <th style="width:110px; text-align:right;">Đơn giá</th>
                            <th style="width:120px; text-align:right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="inv-totals">
                    <div class="inv-qr">
                        <img src="${qrUrl}" alt="QR Tra cứu đơn hàng">
                        <div>
                            <strong style="font-size:12px; display:block;">MÃ QR TRA CỨU ĐƠN HÀNG</strong>
                            <small style="color:#64748b; display:block;">Quét để kiểm tra bảo hành điện tử &amp; trạng thái vận đơn</small>
                        </div>
                    </div>
                    <div class="inv-sum">
                        <p>Phí vận chuyển: <strong>${order.shippingFee ? fmt(order.shippingFee) : 'Miễn phí (0 đ)'}</strong></p>
                        <p>Thuế GTGT (VAT): <strong>Đã bao gồm</strong></p>
                        <div class="total-row">TỔNG THANH TOÁN: ${fmt(order.totalAmount)}</div>
                    </div>
                </div>

                <div class="inv-signatures">
                    <div>
                        <div class="sign-role">Người lập hóa đơn</div>
                        <div class="sign-note">(Ký &amp; ghi rõ họ tên)</div>
                    </div>
                    <div>
                        <div class="sign-role">Thủ kho xuất hàng</div>
                        <div class="sign-note">(Đã kiểm đủ số lượng &amp; niêm phong)</div>
                    </div>
                    <div>
                        <div class="sign-role">Người nhận hàng / Shipper</div>
                        <div class="sign-note">(Đã nhận nguyên vẹn niêm phong)</div>
                    </div>
                </div>
            </div>
            <script>
                window.addEventListener('load', () => {
                    setTimeout(() => window.print(), 350);
                });
            <\/script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=850,height=900,menubar=no,toolbar=no,location=no,status=no');
    if (!printWin) {
        showToast('Trình duyệt đã chặn cửa sổ in (popup). Vui lòng cho phép popup để xem hóa đơn!', 'error');
        return;
    }
    printWin.document.open();
    printWin.document.write(invoiceHtml);
    printWin.document.close();
}

function toggleRowMenu(orderId) {
    const allMenus = document.querySelectorAll('.actions-dropdown-content');
    const target = document.getElementById(`rowMenu_${orderId}`);

    allMenus.forEach(m => {
        if (m !== target) m.classList.remove('show');
    });

    if (target) {
        target.classList.toggle('show');
    }
}

// Close row dropdown when clicked outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-menu-wrapper')) {
        document.querySelectorAll('.actions-dropdown-content').forEach(m => m.classList.remove('show'));
    }
});

// ==========================================
// 13. DOM INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check Admin authorization
    if (typeof auth !== 'undefined' && !auth.isAdmin()) {
        showToast('Bạn cần quyền Quản trị viên để truy cập trang này!', 'error');
        setTimeout(() => {
            window.location.href = '../pages/auth/login.html';
        }, 1200);
        return;
    }

    // Initialize search debounce
    const searchInput = document.getElementById('orderSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (clearSearchBtn) {
                if (val) clearSearchBtn.classList.add('visible');
                else clearSearchBtn.classList.remove('visible');
            }

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchQuery = val;
                currentPage = 1;
                loadOrders();
            }, 400);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.classList.remove('visible');
            searchQuery = '';
            currentPage = 1;
            loadOrders();
        });
    }

    // Load initial shippers and orders
    loadShippers();
    loadOrders();
});

// Global bindings for inline onclicks
window.quickFilterByStatus = quickFilterByStatus;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.handleSortColumn = handleSortColumn;
window.goToPage = goToPage;
window.changePageSize = changePageSize;
window.openAssignShipperModal = openAssignShipperModal;
window.closeShipperModal = closeShipperModal;
window.filterShipperListInModal = filterShipperListInModal;
window.setShipperFilterTab = setShipperFilterTab;
window.selectShipperItem = selectShipperItem;
window.submitShipperAssignment = submitShipperAssignment;
window.handleStatusChange = handleStatusChange;
window.promptMarkPaymentPaid = promptMarkPaymentPaid;
window.openCancelOrderModal = openCancelOrderModal;
window.closeCancelModal = closeCancelModal;
window.toggleCustomReasonField = toggleCustomReasonField;
window.submitCancelOrder = submitCancelOrder;
window.promptAddOrderNote = promptAddOrderNote;
window.toggleSelectOrder = toggleSelectOrder;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.clearSelectedOrders = clearSelectedOrders;
window.openBulkShipperModal = openBulkShipperModal;
window.openBulkStatusModal = openBulkStatusModal;
window.closeBulkModal = closeBulkModal;
window.submitBulkAction = submitBulkAction;
window.openOrderDetail = openOrderDetail;
window.closeOrderDetailModal = closeOrderDetailModal;
window.submitDetailModalNote = submitDetailModalNote;
window.printCurrentDetailInvoice = printCurrentDetailInvoice;
window.printOrderInvoice = printOrderInvoice;
window.exportOrdersCsv = exportOrdersCsv;
window.toggleRowMenu = toggleRowMenu;
