/**
 * TechEcommerce - Customer Order Detail & Live Tracking
 * Pure real data rendering, honest milestones, no fabricated inspection or fake dates
 */

const ORDER_STATUS_LABELS = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    processing: 'Đang chuẩn bị',
    ready_to_ship: 'Chờ lấy hàng',
    shipping: 'Đang giao hàng',
    completed: 'Giao thành công',
    cancelled: 'Đã hủy',
    delivery_failed: 'Giao không thành công',
    returned: 'Hoàn hoặc đổi trả',
    boom: 'Giao không thành công'
};

const ORDER_PAYMENT_LABELS = {
    unpaid: 'Chưa thanh toán',
    pending: 'Chờ xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
};

const ORDER_PAYMENT_METHODS = {
    cod: 'Thanh toán khi nhận hàng (COD)',
    bank_transfer: 'Chuyển khoản ngân hàng',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp 0%',
    ShipCOD: 'Thanh toán khi nhận hàng (COD)',
    'Thanh toán trước': 'Chuyển khoản ngân hàng',
    'Trả góp': 'Trả góp 0%'
};

function orderMoney(val) {
    return `${(Number(val) || 0).toLocaleString('vi-VN')} đ`;
}

function orderDate(value, fallback = 'Đang cập nhật') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showOrderToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3200);
    }, 100);
}

let loadedOrderData = null;

async function loadOrderDetail() {
    if (!auth.isLoggedIn()) {
        window.location.href = '../auth/login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    const contentEl = document.getElementById('trackingContent');

    if (!orderId) {
        contentEl.innerHTML = `
            <article class="orders-status-box">
                <span class="orders-status-icon" aria-hidden="true">⚠️</span>
                <h2>Thiếu mã đơn hàng</h2>
                <p>Không tìm thấy thông tin mã đơn hàng cần xem.</p>
                <a href="orders.html" class="btn-primary">Quay lại danh sách đơn hàng</a>
            </article>
        `;
        return;
    }

    try {
        const res = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}`, {
            headers: auth.getHeaders()
        });
        const order = await res.json();
        if (auth.handleApiError(res, order)) return;

        if (!res.ok || !order._id) {
            contentEl.innerHTML = `
                <article class="orders-status-box">
                    <span class="orders-status-icon" aria-hidden="true">❌</span>
                    <h2>Không tìm thấy đơn hàng</h2>
                    <p>${escapeHTML(order.message || 'Đơn hàng không tồn tại hoặc bạn không có quyền xem.')}</p>
                    <a href="orders.html" class="btn-primary">Về danh sách đơn hàng</a>
                </article>
            `;
            return;
        }

        renderOrderDetail(order);
    } catch (err) {
        console.error('loadOrderDetail error:', err);
        contentEl.innerHTML = `
            <article class="orders-status-box">
                <span class="orders-status-icon" aria-hidden="true">⚠️</span>
                <h2>Lỗi tải dữ liệu</h2>
                <p>Không thể kết nối đến máy chủ. Vui lòng thử lại sau.</p>
                <button type="button" class="btn-primary" onclick="loadOrderDetail()">Tải lại</button>
            </article>
        `;
    }
}

function getTimelineSteps(order) {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    
    // Status rank to determine completed/current/upcoming
    const orderStatus = order.status;
    const isCancelled = orderStatus === 'cancelled' || orderStatus === 'boom' || orderStatus === 'delivery_failed';

    const shipperObj = order.shipper;
    const shipperName = (typeof shipperObj === 'object' && shipperObj?.name) ? shipperObj.name : (order.shipperAssignedByName || '');
    const shipperPhone = (typeof shipperObj === 'object' && shipperObj?.phone) ? shipperObj.phone : '';

    const getHistoryTime = (st) => {
        const h = history.find(e => e.status === st);
        return h ? h.occurredAt : null;
    };

    // Standard 4 milestone steps
    const steps = [
        {
            key: 'created',
            title: 'Tiếp nhận đơn hàng',
            desc: 'Đơn hàng được gửi thành công lên hệ thống TechEcommerce.',
            time: order.orderDate || order.createdAt,
            completed: true,
            current: orderStatus === 'pending' && !shipperName
        },
        {
            key: 'processing',
            title: 'Chuẩn bị hàng & Đóng gói',
            desc: shipperName ? `Kho kỹ thuật chuẩn bị kiện hàng. Đã phân công cho shipper: ${shipperName}.` : 'Kho kỹ thuật kiểm tra ngoại quan, niêm phong và đóng gói kiện hàng.',
            time: getHistoryTime('processing') || (orderStatus === 'processing' || orderStatus === 'shipping' || orderStatus === 'completed' || shipperName ? (order.shipperAssignedAt || order.updatedAt) : null),
            completed: ['processing', 'ready_to_ship', 'shipping', 'completed'].includes(orderStatus) || Boolean(shipperName),
            current: (orderStatus === 'processing' || orderStatus === 'ready_to_ship' || (orderStatus === 'pending' && Boolean(shipperName))) && orderStatus !== 'shipping' && orderStatus !== 'completed'
        },
        {
            key: 'shipping',
            title: 'Bàn giao vận chuyển',
            desc: shipperName 
                ? `Shipper phụ trách: ${shipperName}${shipperPhone ? ` (☎ ${shipperPhone})` : ''} · Đang phụ trách vận chuyển đến địa chỉ của bạn.`
                : (order.shippingUnit ? `Đã bàn giao cho đơn vị vận chuyển: ${order.shippingUnit}` : 'Đang điều phối shipper hoặc đơn vị vận chuyển.'),
            time: getHistoryTime('shipping') || (orderStatus === 'shipping' || orderStatus === 'completed' ? (order.shipperAssignedAt || null) : null),
            completed: ['shipping', 'completed'].includes(orderStatus),
            current: orderStatus === 'shipping'
        },
        {
            key: 'completed',
            title: 'Giao hàng thành công',
            desc: 'Người nhận đã kiểm tra và nhận hàng hoàn tất.',
            time: order.deliveredAt || getHistoryTime('completed'),
            completed: orderStatus === 'completed',
            current: orderStatus === 'completed'
        }
    ];

    if (isCancelled) {
        steps.push({
            key: 'cancelled',
            title: ORDER_STATUS_LABELS[orderStatus] || 'Đơn hàng đã hủy',
            desc: 'Đơn hàng đã kết thúc xử lý hoặc bị hủy theo yêu cầu.',
            time: order.updatedAt || Date.now(),
            completed: true,
            current: true,
            isDanger: true
        });
    }

    return steps;
}

function renderOrderDetail(order) {
    loadedOrderData = order;
    const orderCode = `#${String(order._id).padStart(4, '0')}`;
    const statusText = ORDER_STATUS_LABELS[order.status] || order.status;
    const orderTime = orderDate(order.orderDate || order.createdAt);

    // Update Headings & Breadcrumb
    document.title = `${orderCode} - Chi tiết đơn hàng - TechEcommerce`;
    document.getElementById('breadcrumbOrderCode').textContent = `Đơn hàng ${orderCode}`;
    document.getElementById('trackingTitle').textContent = `Đơn hàng ${orderCode}`;
    document.getElementById('trackingSubtitle').textContent = `Đặt lúc ${orderTime}`;

    const badgeEl = document.getElementById('headerStatusBadge');
    badgeEl.textContent = statusText;
    badgeEl.className = `cust-badge status-${order.status}`;

    // Calculate subtotal and shipping
    const subtotal = order.subtotal || (order.products || []).reduce((acc, p) => acc + (p.price * (p.quantity || 1)), 0);
    const discount = order.discountAmount || 0;
    const finalTotal = order.totalAmount || (subtotal - discount);
    const shippingFee = (finalTotal > (subtotal - discount)) ? (finalTotal - (subtotal - discount)) : 0;

    // Timeline HTML
    const steps = getTimelineSteps(order);
    const timelineHtml = steps.map((s, idx) => {
        let stepClass = '';
        if (s.completed && !s.current) stepClass = 'is-completed';
        else if (s.current) stepClass = s.isDanger ? 'is-completed' : 'is-current';

        return `
            <li class="timeline-step-item ${stepClass}">
                <div class="timeline-marker" aria-hidden="true">${idx + 1}</div>
                <div class="timeline-body">
                    <div class="timeline-title-row">
                        <strong class="timeline-step-name">${escapeHTML(s.title)}</strong>
                        ${s.time ? `<time class="timeline-time">${orderDate(s.time)}</time>` : ''}
                    </div>
                    <p class="timeline-desc">${escapeHTML(s.desc)}</p>
                </div>
            </li>
        `;
    }).join('');

    // Products table rows
    const productsRowsHtml = (order.products || []).map(item => {
        const prod = item.product || {};
        const name = prod.name || item.productName || 'Sản phẩm công nghệ';
        const img = prod.image || prod.images?.[0] || 'https://placehold.co/120x120?text=TechEcommerce';
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const lineTotal = price * qty;
        const prodUrl = prod._id ? `../catalog/product.html?id=${encodeURIComponent(prod._id)}` : '#';

        return `
            <tr>
                <td>
                    <div class="table-product-cell">
                        <figure class="table-product-thumb">
                            <img src="${escapeHTML(img)}" alt="${escapeHTML(name)}" loading="lazy">
                        </figure>
                        <div class="table-product-meta">
                            <a class="table-product-title" href="${prodUrl}">${escapeHTML(name)}</a>
                            <span class="table-product-variant">${escapeHTML(prod.category || 'Chính hãng TechEcommerce')}</span>
                        </div>
                    </div>
                </td>
                <td style="text-align:center;">${orderMoney(price)}</td>
                <td style="text-align:center;">× ${qty}</td>
                <td style="text-align:right; font-weight:700; color:var(--neo-text,#0f172a);">${orderMoney(lineTotal)}</td>
            </tr>
        `;
    }).join('');

    // Inspection section: ONLY show if inspectionNote is provided
    const inspectionHtml = order.inspectionNote ? `
        <article class="detail-card-panel">
            <h2 class="panel-title">
                <span class="panel-title-icon" aria-hidden="true">📋</span>
                <span>Ghi chú kiểm tra & Bàn giao</span>
            </h2>
            <p style="margin:0; font-size:0.92rem; color:var(--neo-text,#0f172a); line-height:1.5;">${escapeHTML(order.inspectionNote)}</p>
        </article>
    ` : '';

    // Reviews section (if completed)
    const reviewHtml = order.status === 'completed' ? `
        <article class="detail-card-panel">
            <h2 class="panel-title">
                <span class="panel-title-icon" aria-hidden="true">⭐</span>
                <span>Đánh giá trải nghiệm sản phẩm</span>
            </h2>
            <div class="review-prompt-box">
                <p style="margin:0 0 0.75rem; font-size:0.9rem; color:var(--neo-muted,#64748b);">Đơn hàng đã được giao thành công. Bạn hãy chia sẻ đánh giá về chất lượng sản phẩm và dịch vụ nhé!</p>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    ${(order.products || []).map(p => {
                        const pid = p.product?._id || p.product;
                        const pname = p.product?.name || p.productName || 'Sản phẩm';
                        return pid ? `<a href="../catalog/product.html?id=${pid}#reviews" class="btn-back-list" style="font-size:0.82rem;">Đánh giá: ${escapeHTML(pname)}</a>` : '';
                    }).join('')}
                </div>
            </div>
        </article>
    ` : '';

    const shipperObj = order.shipper;
    const shipperName = (typeof shipperObj === 'object' && shipperObj?.name) ? shipperObj.name : (order.shipperAssignedByName || '');
    const shipperPhone = (typeof shipperObj === 'object' && shipperObj?.phone) ? shipperObj.phone : '';

    const shippingStatusMap = {
        unassigned: 'Chưa phân công',
        assigned: 'Đã phân công shipper · Chuẩn bị giao',
        waiting_pickup: 'Shipper đang đến lấy hàng',
        picked_up: 'Shipper đã nhận hàng từ kho',
        delivering: 'Shipper đang trên đường giao hàng',
        delivered: 'Giao hàng thành công',
        delivery_failed: 'Giao hàng không thành công',
        returned: 'Đã chuyển hoàn'
    };
    const shippingStatusText = shippingStatusMap[order.shippingStatus] || (shipperName ? 'Đã phân công shipper' : 'Đang điều phối');
    const canCancel = order.status === 'pending' && !shipperName;

    const fullContentHtml = `
        ${shipperName ? `
            <aside class="shipper-assigned-banner reveal" style="margin-bottom: 1.5rem; padding: 1.15rem 1.4rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span style="font-size: 2.2rem;" aria-hidden="true">🛵</span>
                    <div>
                        <strong style="color: #047857; font-size: 1.05rem; display: block;">Đơn hàng đã được phân công Shipper</strong>
                        <p style="margin: 3px 0 0; color: var(--neo-muted, #64748b); font-size: 0.9rem;">
                            Shipper phụ trách: <strong style="color: var(--neo-text, #0f172a);">${escapeHTML(shipperName)}</strong> · Trạng thái: <strong style="color: #047857;">${escapeHTML(shippingStatusText)}</strong>
                        </p>
                    </div>
                </div>
                ${shipperPhone ? `
                    <a href="tel:${escapeHTML(shipperPhone)}" class="btn-primary" style="padding: 0.6rem 1.15rem; font-size: 0.88rem; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
                        <span>📞 Liên hệ Shipper:</span> <strong>${escapeHTML(shipperPhone)}</strong>
                    </a>
                ` : ''}
            </aside>
        ` : ''}

        <div class="detail-layout-grid">
            <!-- Left Column: Timeline & Items -->
            <div class="detail-main-column">
                <!-- Timeline panel -->
                <article class="detail-card-panel">
                    <h2 class="panel-title">
                        <span class="panel-title-icon" aria-hidden="true">📍</span>
                        <span>Hành trình đơn hàng</span>
                    </h2>
                    <ol class="timeline-steps-list">
                        ${timelineHtml}
                    </ol>
                </article>

                <!-- Products table panel -->
                <article class="detail-card-panel">
                    <h2 class="panel-title">
                        <span class="panel-title-icon" aria-hidden="true">🛍️</span>
                        <span>Sản phẩm trong đơn (${order.products?.length || 0})</span>
                    </h2>
                    <div style="overflow-x:auto;">
                        <table class="order-items-table">
                            <thead>
                                <tr>
                                    <th scope="col">Sản phẩm</th>
                                    <th scope="col" style="text-align:center;">Đơn giá</th>
                                    <th scope="col" style="text-align:center;">Số lượng</th>
                                    <th scope="col" style="text-align:right;">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </article>

                ${inspectionHtml}
                ${reviewHtml}
            </div>

            <!-- Right Column: Shipping Info & Payment Breakdown -->
            <aside class="detail-sidebar-column" aria-label="Tóm tắt giao nhận và thanh toán">
                <!-- Recipient & Shipping Panel -->
                <article class="detail-card-panel">
                    <h2 class="panel-title">
                        <span class="panel-title-icon" aria-hidden="true">🚚</span>
                        <span>Thông tin giao nhận</span>
                    </h2>
                    <dl class="info-field-grid">
                        <div class="info-field-row">
                            <dt>Người nhận:</dt>
                            <dd>${escapeHTML(order.recipientName || order.customerName || 'N/A')}</dd>
                        </div>
                        <div class="info-field-row">
                            <dt>Số điện thoại:</dt>
                            <dd>${escapeHTML(order.recipientPhone || order.customerPhone || 'N/A')}</dd>
                        </div>
                        <div class="info-field-row">
                            <dt>Địa chỉ nhận:</dt>
                            <dd>${escapeHTML(order.shippingAddress || 'Nhận tại showroom TechEcommerce')}</dd>
                        </div>
                        <div class="info-field-row">
                            <dt>Shipper phụ trách:</dt>
                            <dd>${shipperName ? `<strong style="color: #047857;">🛵 ${escapeHTML(shipperName)}</strong>` : 'Đang điều phối'}</dd>
                        </div>
                        ${shipperPhone ? `
                            <div class="info-field-row">
                                <dt>SĐT Shipper:</dt>
                                <dd><a href="tel:${escapeHTML(shipperPhone)}" style="color: var(--primary, #2563eb); font-weight: 700; text-decoration: underline;">📞 ${escapeHTML(shipperPhone)}</a></dd>
                            </div>
                        ` : ''}
                        <div class="info-field-row">
                            <dt>Trạng thái giao:</dt>
                            <dd><span style="color: #047857; font-weight: 600;">${escapeHTML(shippingStatusText)}</span></dd>
                        </div>
                        <div class="info-field-row">
                            <dt>Đơn vị giao:</dt>
                            <dd>${escapeHTML(order.shippingUnit || (shipperName ? 'Cửa hàng tự giao / Shipper TechEcommerce' : 'Đang điều phối'))}</dd>
                        </div>
                        <div class="info-field-row">
                            <dt>Mã vận đơn:</dt>
                            <dd>${escapeHTML(order.trackingNumber || 'Chờ đơn vị vận chuyển tiếp nhận')}</dd>
                        </div>
                    </dl>
                </article>

                <!-- Payment Breakdown Panel -->
                <article class="detail-card-panel">
                    <h2 class="panel-title">
                        <span class="panel-title-icon" aria-hidden="true">💳</span>
                        <span>Chi tiết thanh toán</span>
                    </h2>
                    <dl class="financial-breakdown-list">
                        <div class="financial-row">
                            <dt>Hình thức:</dt>
                            <dd>${escapeHTML(ORDER_PAYMENT_METHODS[order.paymentMethod] || order.paymentMethod || 'COD')}</dd>
                        </div>
                        <div class="financial-row">
                            <dt>Trạng thái tiền:</dt>
                            <dd>${escapeHTML(ORDER_PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus || 'Chưa thanh toán')}</dd>
                        </div>
                        <div class="financial-row">
                            <dt>Tạm tính hàng:</dt>
                            <dd>${orderMoney(subtotal)}</dd>
                        </div>
                        <div class="financial-row">
                            <dt>Phí giao hàng:</dt>
                            <dd>${shippingFee > 0 ? orderMoney(shippingFee) : 'Miễn phí'}</dd>
                        </div>
                        ${discount > 0 ? `
                            <div class="financial-row discount">
                                <dt>Giảm giá (${escapeHTML(order.couponCode || 'Voucher')}):</dt>
                                <dd>- ${orderMoney(discount)}</dd>
                            </div>
                        ` : ''}
                        <div class="financial-total-row">
                            <dt>Tổng thanh toán:</dt>
                            <dd>${orderMoney(finalTotal)}</dd>
                        </div>
                    </dl>

                    <button type="button" class="btn-invoice-full" onclick="printCustomerInvoice()">
                        <span aria-hidden="true">🖨️</span>
                        <span>In Hóa Đơn Điện Tử VAT</span>
                    </button>

                    ${canCancel ? `
                        <button type="button" class="btn-cancel-order-large" onclick="cancelCurrentDetailOrder('${order._id}')">
                            Hủy đơn hàng này
                        </button>
                    ` : ''}
                </article>
            </aside>
        </div>
    `;

    document.getElementById('trackingContent').innerHTML = fullContentHtml;
}

async function cancelCurrentDetailOrder(id) {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return;
    try {
        const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
            method: 'POST',
            headers: auth.getHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            showOrderToast(data.message || 'Không thể hủy đơn hàng lúc này.', 'error');
            return;
        }
        showOrderToast('Đã hủy đơn hàng thành công.');
        loadOrderDetail();
    } catch (err) {
        showOrderToast('Lỗi kết nối khi gửi yêu cầu hủy đơn.', 'error');
    }
}

function printCustomerInvoice() {
    if (!loadedOrderData) {
        showOrderToast('Chưa tải được thông tin đơn hàng để in!', 'error');
        return;
    }
    const order = loadedOrderData;
    const recipientName = order.recipientName || order.customer?.name || order.customerName || 'Quý Khách';
    const recipientPhone = order.recipientPhone || order.customer?.phone || order.customerPhone || 'N/A';
    const shippingAddress = order.shippingAddress || 'Nhận tại showroom TechEcommerce';
    const orderDateFormatted = orderDate(order.orderDate || order.createdAt);
    const trackingCode = order.trackingNumber || 'CHƯA_TẠO_VẬN_ĐƠN';
    const shippingUnit = order.shippingUnit || 'Giao Hàng Tiêu Chuẩn';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent('https://techecommerce-shop.vercel.app/pages/account/order-detail.html?id=' + order._id)}`;

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
                <td style="text-align:right;">${orderMoney(price)}</td>
                <td style="text-align:right;"><strong>${orderMoney(total)}</strong></td>
            </tr>
        `;
    }).join('');

    const invoiceHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Hóa đơn điện tử VAT #${order._id}</title>
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
                .inv-sign { display: grid; grid-template-columns: 1fr 1fr; text-align: center; margin-top: 30px; }
                .inv-sign h5 { font-size: 12px; color: #334155; margin-bottom: 40px; }
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div class="inv-header">
                    <div class="inv-company">
                        <h2>HỆ THỐNG BÁN LẺ CÔNG NGHỆ TECHECOMMERCE</h2>
                        <p>Trụ sở chính: Showroom TechEcommerce, TP. Hồ Chí Minh</p>
                        <p>Hotline: 1800 2097 | Email: support@techecommerce.vn</p>
                    </div>
                    <div class="inv-meta">
                        <h1>HÓA ĐƠN ĐIỆN TỬ VAT</h1>
                        <span>Mã đơn: <strong>#${String(order._id).padStart(4, '0')}</strong></span>
                        <span>Ngày lập: ${orderDateFormatted}</span>
                    </div>
                </div>

                <div class="inv-grid">
                    <div>
                        <h4>Khách hàng & Nhận hàng</h4>
                        <p><strong>Người nhận:</strong> ${escapeHTML(recipientName)}</p>
                        <p><strong>Điện thoại:</strong> ${escapeHTML(recipientPhone)}</p>
                        <p><strong>Địa chỉ:</strong> ${escapeHTML(shippingAddress)}</p>
                    </div>
                    <div>
                        <h4>Thanh toán & Vận chuyển</h4>
                        <p><strong>Phương thức:</strong> ${ORDER_PAYMENT_METHODS[order.paymentMethod] || order.paymentMethod || 'COD'}</p>
                        <p><strong>Trạng thái tiền:</strong> ${ORDER_PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}</p>
                        <p><strong>Đơn vị vận chuyển:</strong> ${escapeHTML(shippingUnit)}</p>
                        <p><strong>Mã vận đơn:</strong> ${escapeHTML(trackingCode)}</p>
                    </div>
                </div>

                <table class="inv-table">
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">STT</th>
                            <th>Tên sản phẩm</th>
                            <th style="width:60px; text-align:center;">Số lượng</th>
                            <th style="width:120px; text-align:right;">Đơn giá</th>
                            <th style="width:130px; text-align:right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="inv-totals">
                    <div class="inv-qr">
                        <img src="${qrUrl}" alt="Mã QR tra cứu hóa đơn">
                        <div>
                            <p style="font-weight:700;">Quét mã tra cứu điện tử</p>
                            <small style="color:#64748b;">Hóa đơn hợp lệ theo quy chuẩn bán lẻ</small>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:14px; margin-bottom:4px;">Tổng tiền thanh toán:</p>
                        <h2 style="color:#2563eb; font-size:20px;">${orderMoney(order.totalAmount)}</h2>
                    </div>
                </div>

                <div class="inv-sign">
                    <div>
                        <h5>NGƯỜI MUA HÀNG</h5>
                        <p style="color:#94a3b8; font-size:11px;">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div>
                        <h5>ĐẠI DIỆN TECHECOMMERCE</h5>
                        <p style="color:#059669; font-weight:700;">ĐÃ KÝ ĐIỆN TỬ HỢP LỆ</p>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); };
            </script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.write(invoiceHtml);
        printWin.document.close();
    } else {
        alert('Trình duyệt đang chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để in hóa đơn!');
    }
}

document.addEventListener('DOMContentLoaded', loadOrderDetail);
