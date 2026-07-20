const ORDER_STATUS_LABELS = {
    pending: 'Chờ xác nhận',
    processing: 'Đang kiểm hàng',
    shipping: 'Đang giao hàng',
    completed: 'Đã giao hàng',
    cancelled: 'Đã hủy',
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
    installment: 'Trả góp'
};

const DELIVERY_STEPS = [
    {
        status: 'pending',
        title: 'Đã tiếp nhận đơn hàng',
        description: 'Đơn hàng đã được ghi nhận và đang chờ cửa hàng xác nhận.'
    },
    {
        status: 'processing',
        title: 'Kiểm hàng và đóng gói',
        description: 'Cửa hàng kiểm tra ngoại quan, phụ kiện và niêm phong sản phẩm.'
    },
    {
        status: 'shipping',
        title: 'Đang giao hàng',
        description: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển.'
    },
    {
        status: 'completed',
        title: 'Giao hàng thành công',
        description: 'Người nhận đã nhận hàng và có thể gửi đánh giá sản phẩm.'
    }
];

function orderMoney(value) {
    return `${(Number(value) || 0).toLocaleString('vi-VN')} đ`;
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

function estimatedDelivery(order) {
    if (order.estimatedDeliveryAt) return orderDate(order.estimatedDeliveryAt);
    const start = new Date(order.orderDate || order.createdAt);
    if (Number.isNaN(start.getTime())) return 'Đang cập nhật';
    start.setDate(start.getDate() + 3);
    return orderDate(start);
}

function historyFor(order, status) {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    return history.find(entry => entry.status === status);
}

function stepState(order, index) {
    const currentIndex = DELIVERY_STEPS.findIndex(step => step.status === order.status);
    if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'boom') {
        return index === 0 ? 'is-complete' : '';
    }
    if (index < currentIndex || order.status === 'completed') return 'is-complete';
    if (index === currentIndex) return 'is-current';
    return '';
}

function renderTimeline(order) {
    return DELIVERY_STEPS.map((step, index) => {
        const history = historyFor(order, step.status);
        const isInitial = step.status === 'pending';
        const state = stepState(order, index);
        const occurredAt = history?.occurredAt
            || (isInitial ? order.orderDate || order.createdAt : null)
            || (step.status === order.status ? order.deliveredAt || order.updatedAt : null);
        return `
            <li class="delivery-step ${state}"${state === 'is-current' ? ' aria-current="step"' : ''}>
                <span class="delivery-step-marker" aria-hidden="true">${index + 1}</span>
                <article class="delivery-step-content">
                    <h3>${escapeHTML(history?.title || step.title)}</h3>
                    <p>${escapeHTML(history?.description || step.description)}</p>
                    ${occurredAt
                        ? `<time datetime="${new Date(occurredAt).toISOString()}">${orderDate(occurredAt)}</time>`
                        : `<span class="delivery-step-time">${state ? 'Đã hoàn tất - chưa lưu thời gian' : 'Chưa đến bước này'}</span>`}
                </article>
            </li>
        `;
    }).join('');
}

function productImage(item) {
    return item.product?.image || item.product?.images?.[0] || 'https://placehold.co/176x144?text=TechEcommerce';
}

function renderProducts(order) {
    return (order.products || []).map(item => `
        <article class="tracking-product">
            <img src="${escapeHTML(productImage(item))}" alt="${escapeHTML(item.product?.name || item.productName || 'Sản phẩm')}" loading="lazy">
            <div>
                <h3>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm')}</h3>
                <p>${orderMoney(item.price)} × ${Number(item.quantity) || 1}</p>
            </div>
            ${item.product?._id ? `<a href="../catalog/product.html?id=${encodeURIComponent(item.product._id)}">Xem sản phẩm</a>` : ''}
        </article>
    `).join('');
}

function renderReviewSection(order) {
    if (order.status !== 'completed') {
        return '<p class="tracking-review-locked">Đánh giá sẽ được mở sau khi đơn hàng được giao thành công.</p>';
    }

    return `<div class="tracking-reviews">${(order.products || []).map(item => {
        const productId = item.product?._id || item.product;
        if (!productId) return '';
        const productName = item.product?.name || item.productName || 'Sản phẩm';
        return `
            <article class="tracking-review-card">
                <img src="${escapeHTML(productImage(item))}" alt="${escapeHTML(productName)}" loading="lazy">
                <div>
                    <h3>${escapeHTML(productName)}</h3>
                    <p>Chia sẻ trải nghiệm kiểm hàng và sử dụng sản phẩm.</p>
                </div>
                <button class="btn-primary" type="button" data-review-toggle="${productId}">Đánh giá</button>
                <form class="tracking-review-form" data-review-form="${productId}" hidden>
                    <label>
                        Số sao
                        <select name="rating" required>
                            <option value="5">5 sao - Rất hài lòng</option>
                            <option value="4">4 sao - Hài lòng</option>
                            <option value="3">3 sao - Bình thường</option>
                            <option value="2">2 sao - Chưa hài lòng</option>
                            <option value="1">1 sao - Rất không hài lòng</option>
                        </select>
                    </label>
                    <label class="review-title-field">
                        Tiêu đề
                        <input name="title" type="text" maxlength="120" placeholder="Tóm tắt trải nghiệm của bạn">
                    </label>
                    <label>
                        Nội dung đánh giá
                        <textarea name="comment" maxlength="1500" required placeholder="Sản phẩm, đóng gói và quá trình nhận hàng như thế nào?"></textarea>
                    </label>
                    <button class="btn-primary" type="submit">Gửi đánh giá</button>
                </form>
            </article>
        `;
    }).join('')}</div>`;
}

function exceptionNotice(order) {
    if (!['cancelled', 'returned', 'boom'].includes(order.status)) return '';
    const history = historyFor(order, order.status);
    return `<p class="tracking-cancelled"><strong>${escapeHTML(ORDER_STATUS_LABELS[order.status])}:</strong> ${escapeHTML(history?.description || 'Vui lòng liên hệ cửa hàng nếu bạn cần hỗ trợ thêm.')}</p>`;
}

function renderOrder(order) {
    const orderCode = `#${String(order._id).padStart(4, '0')}`;
    document.title = `${orderCode} - Quá trình giao hàng - TechEcommerce`;
    document.getElementById('trackingTitle').textContent = `Đơn hàng ${orderCode}`;
    document.getElementById('trackingSubtitle').textContent = `${ORDER_STATUS_LABELS[order.status] || order.status} · Đặt lúc ${orderDate(order.orderDate || order.createdAt)}`;

    document.getElementById('trackingContent').innerHTML = `
        ${exceptionNotice(order)}
        <section class="tracking-summary" aria-label="Tóm tắt giao hàng">
            <article><small>Trạng thái</small><strong>${escapeHTML(ORDER_STATUS_LABELS[order.status] || order.status)}</strong></article>
            <article><small>Đơn vị vận chuyển</small><strong>${escapeHTML(order.shippingUnit || 'Đang phân công')}</strong></article>
            <article><small>${order.status === 'completed' ? 'Thời gian nhận' : 'Dự kiến giao'}</small><strong>${order.status === 'completed' ? orderDate(order.deliveredAt || order.updatedAt) : estimatedDelivery(order)}</strong></article>
        </section>

        <div class="tracking-layout">
            <div>
                <section id="journey" class="tracking-panel">
                    <h2>Hành trình đơn hàng</h2>
                    <ol class="delivery-timeline">${renderTimeline(order)}</ol>
                </section>

                <section id="inspection" class="tracking-panel">
                    <h2>Thông tin kiểm hàng</h2>
                    <ul class="inspection-list">
                        <li><span>Kiểm tra ngoại quan</span><strong>${order.status === 'pending' ? 'Chờ kiểm tra' : 'Đã kiểm tra'}</strong></li>
                        <li><span>Đối chiếu sản phẩm và số lượng</span><strong>${order.status === 'pending' ? 'Chờ kiểm tra' : 'Đã đối chiếu'}</strong></li>
                        <li><span>Phụ kiện và niêm phong</span><strong>${order.status === 'pending' ? 'Chờ kiểm tra' : 'Đạt yêu cầu'}</strong></li>
                    </ul>
                    ${order.inspectionNote ? `<p>${escapeHTML(order.inspectionNote)}</p>` : ''}
                </section>

                <section id="products" class="tracking-panel">
                    <h2>Sản phẩm trong đơn</h2>
                    <div class="tracking-products">${renderProducts(order)}</div>
                </section>

                <section id="review" class="tracking-panel">
                    <h2>Đánh giá sau khi nhận hàng</h2>
                    ${renderReviewSection(order)}
                </section>
            </div>

            <aside class="tracking-panel" aria-label="Thông tin nhận hàng">
                <h2>Thông tin giao nhận</h2>
                <dl class="tracking-meta">
                    <div><dt>Người nhận</dt><dd>${escapeHTML(order.recipientName || order.customerName || '')}</dd></div>
                    <div><dt>Số điện thoại</dt><dd>${escapeHTML(order.recipientPhone || order.customerPhone || '')}</dd></div>
                    <div><dt>Địa chỉ</dt><dd>${escapeHTML(order.shippingAddress || '')}</dd></div>
                    <div><dt>Mã vận đơn</dt><dd>${escapeHTML(order.trackingNumber || 'Chưa có')}</dd></div>
                    <div><dt>Thanh toán</dt><dd>${escapeHTML(ORDER_PAYMENT_METHODS[order.paymentMethod] || order.paymentMethod || '')}</dd></div>
                    <div><dt>Trạng thái tiền</dt><dd>${escapeHTML(ORDER_PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus || '')}</dd></div>
                    <div><dt>Tổng cộng</dt><dd><strong>${orderMoney(order.totalAmount)}</strong></dd></div>
                </dl>
            </aside>
        </div>
    `;

    bindReviewActions();
}

function bindReviewActions() {
    document.querySelectorAll('[data-review-toggle]').forEach(button => {
        button.addEventListener('click', () => {
            const form = document.querySelector(`[data-review-form="${button.dataset.reviewToggle}"]`);
            if (!form) return;
            form.hidden = !form.hidden;
            button.textContent = form.hidden ? 'Đánh giá' : 'Đóng biểu mẫu';
        });
    });

    document.querySelectorAll('[data-review-form]').forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const productId = form.dataset.reviewForm;
            const payload = Object.fromEntries(new FormData(form).entries());
            payload.rating = Number(payload.rating);
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Đang gửi...';

            try {
                const response = await fetch(`${API_URL}/reviews/product/${productId}`, {
                    method: 'POST',
                    headers: auth.getHeaders(),
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Không gửi được đánh giá.');
                showOrderToast('Cảm ơn bạn đã đánh giá sản phẩm.');
                form.reset();
                form.hidden = true;
            } catch (error) {
                showOrderToast(error.message, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Gửi đánh giá';
            }
        });
    });
}

function showOrderToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.remove(), 3200);
}

async function loadOrderTracking() {
    if (!auth.isLoggedIn()) {
        window.location.href = '../auth/login.html';
        return;
    }

    const orderId = new URLSearchParams(window.location.search).get('id');
    if (!orderId || !/^\d+$/.test(orderId)) {
        document.getElementById('trackingContent').innerHTML = '<p class="empty-state">Mã đơn hàng không hợp lệ.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, { headers: auth.getHeaders() });
        const data = await response.json();
        if (auth.handleApiError(response, data)) return;
        if (!response.ok) throw new Error(data.message || 'Không tải được đơn hàng.');
        renderOrder(data);
    } catch (error) {
        document.getElementById('trackingContent').innerHTML = `<p class="empty-state">${escapeHTML(error.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadOrderTracking);
