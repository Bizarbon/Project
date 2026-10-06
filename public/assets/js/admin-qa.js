function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN');
}

let allReviews = [];
let filteredReviews = [];

const DEFAULT_QA_ITEMS = [
    {
        _id: 1,
        product: { _id: 1, name: 'Tai nghe Apple EarPods Lightning MWTY3ZA/A' },
        customer: { _id: 58, name: 'Vu Phi Long' },
        customerName: 'Vũ Phi Long',
        title: 'Sản phẩm tốt, giao diện đặt hàng rõ ràng',
        comment: 'Máy đúng mô tả, giá hiển thị minh bạch và checkout có mã giảm giá rất tiện.',
        verifiedPurchase: true,
        status: 'visible',
        rating: 5,
        createdAt: '2026-07-08T06:51:42.075Z'
    },
    {
        _id: 2,
        product: { _id: 2, name: 'Laptop ASUS TUF Gaming A16 FA607' },
        customer: { _id: 12, name: 'Trần Minh Hoàng' },
        customerName: 'Trần Minh Hoàng',
        title: 'Hiệu năng chiến game rất mượt',
        comment: 'Máy chạy êm, tản nhiệt tốt khi chơi Cyberpunk 2077. Cho em hỏi cửa hàng có hỗ trợ nâng cấp thêm 16GB RAM không?',
        verifiedPurchase: true,
        status: 'visible',
        rating: 5,
        createdAt: '2026-07-15T10:20:00.000Z'
    },
    {
        _id: 3,
        product: { _id: 3, name: 'iPhone 15 Pro Max 256GB' },
        customer: { _id: 24, name: 'Nguyễn Thanh Thảo' },
        customerName: 'Nguyễn Thanh Thảo',
        title: 'Bao lâu thì nhận được hàng ở Đà Nẵng?',
        comment: 'Em vừa đặt hôm qua thì khoảng mấy ngày giao tới nơi ạ? Có cho đồng kiểm trước khi thanh toán COD không shop?',
        verifiedPurchase: false,
        status: 'visible',
        rating: 5,
        createdAt: '2026-08-01T14:15:30.000Z'
    },
    {
        _id: 4,
        product: { _id: 4, name: 'Bàn phím cơ không dây Akko 3087' },
        customer: { _id: 31, name: 'Lê Quốc Bảo' },
        customerName: 'Lê Quốc Bảo',
        title: 'Switch bấm rất êm tay',
        comment: 'Gõ phím nảy, keycap PBT chất lượng. Tuy nhiên hộp hơi móp nhẹ trong lúc vận chuyển.',
        verifiedPurchase: true,
        status: 'visible',
        rating: 4,
        createdAt: '2026-08-12T09:45:00.000Z'
    },
    {
        _id: 5,
        product: { _id: 5, name: 'Củ sạc nhanh Anker 65W GaN' },
        customer: { _id: 45, name: 'Phạm Đức Anh' },
        customerName: 'Phạm Đức Anh',
        title: 'Spam quảng cáo sai quy định',
        comment: 'Nội dung liên kết ngoài không liên quan tới trải nghiệm sạc.',
        verifiedPurchase: false,
        status: 'hidden',
        rating: 1,
        createdAt: '2026-08-20T16:00:00.000Z'
    }
];

function updateKpis(list) {
    const totalEl = document.getElementById('qaMetricTotal');
    const avgEl = document.getElementById('qaMetricAvgRating');
    const visibleEl = document.getElementById('qaMetricVisible');

    const total = list.length;
    const visible = list.filter(r => r.status === 'visible').length;
    const ratings = list.map(r => Number(r.rating) || 5).filter(r => r > 0);
    const avg = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '5.0';

    if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
    if (avgEl) avgEl.textContent = `${avg} ★`;
    if (visibleEl) visibleEl.textContent = visible.toLocaleString('vi-VN');
}

function renderStars(rating) {
    const num = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    return `<span style="color: #f59e0b; font-size: 1rem; letter-spacing: 2px;">${'★'.repeat(num)}${'☆'.repeat(5 - num)}</span>`;
}

function renderReviewsTable(list) {
    const tbody = document.getElementById('qaTableBody');
    const countEl = document.getElementById('qaTableCount');
    if (countEl) countEl.textContent = list.length;
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading-row" style="padding: 32px; color: #94a3b8;">Không tìm thấy câu hỏi hoặc đánh giá nào phù hợp.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(r => {
        const idStr = `#${String(r._id).padStart(4, '0')}`;
        const prodName = r.product?.name || (typeof r.product === 'string' ? r.product : 'Sản phẩm hệ thống');
        const custName = r.customerName || r.customer?.name || 'Khách hàng';
        const isVisible = r.status === 'visible';
        const statusBadge = isVisible
            ? '<span class="status-badge status-completed" style="font-size: 0.78rem;">Đang hiển thị</span>'
            : '<span class="status-badge status-boom" style="font-size: 0.78rem;">Đã ẩn</span>';

        const verifiedBadge = r.verifiedPurchase
            ? '<span style="display: inline-block; font-size: 0.72rem; padding: 2px 6px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-radius: 4px; margin-top: 4px;">✓ Đã mua hàng</span>'
            : '';

        const replyData = getStoredReply(r._id);
        const replyTag = replyData
            ? `<div style="margin-top: 6px; padding: 6px 10px; background: rgba(16, 185, 129, 0.12); border-left: 2px solid #10b981; border-radius: 4px; font-size: 0.78rem; color: #6ee7b7;">
                 <strong>TechEcommerce:</strong> ${escapeHTML(replyData.reply)}
               </div>`
            : '';

        return `
            <tr>
                <td><strong>${idStr}</strong></td>
                <td>
                    <div style="font-weight: 600; color: var(--admin-text-main); max-width: 220px; white-space: normal; line-height: 1.3;">
                        ${escapeHTML(prodName)}
                    </div>
                </td>
                <td>
                    <div style="color: var(--admin-text-main); font-weight: 600;">${escapeHTML(custName)}</div>
                    ${verifiedBadge}
                </td>
                <td>${renderStars(r.rating)}</td>
                <td>
                    <div style="max-width: 380px; white-space: normal; line-height: 1.4;">
                        ${r.title ? `<strong style="color: var(--admin-text-main); display: block; margin-bottom: 2px;">${escapeHTML(r.title)}</strong>` : ''}
                        <span style="color: var(--admin-text-main); font-size: 0.86rem;">${escapeHTML(r.comment)}</span>
                        ${replyTag}
                    </div>
                </td>
                <td style="color: var(--admin-text-muted); font-size: 0.84rem;">${formatDate(r.createdAt)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button type="button" onclick="toggleReviewStatus(${r._id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: ${isVisible ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isVisible ? '#f87171' : '#34d399'}; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="${isVisible ? 'Ẩn đánh giá' : 'Hiển thị đánh giá'}">
                            ${isVisible ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button type="button" onclick="openQaReplyModal(${r._id})" style="padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                            Phản hồi
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStoredReply(reviewId) {
    try {
        const stored = JSON.parse(localStorage.getItem('adminQaReplies') || '{}');
        return stored[reviewId] || null;
    } catch (e) {
        return null;
    }
}

function saveStoredReply(reviewId, replyText) {
    try {
        const stored = JSON.parse(localStorage.getItem('adminQaReplies') || '{}');
        stored[reviewId] = {
            reply: replyText,
            repliedAt: new Date().toISOString()
        };
        localStorage.setItem('adminQaReplies', JSON.stringify(stored));
    } catch (e) {
        console.warn('Cannot save reply to localStorage', e);
    }
}

async function loadQaList() {
    const errorEl = document.getElementById('qaError');
    if (errorEl) errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/reviews`, { headers: auth.getHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                // Combine with default items if count is small so admin has rich view
                const ids = new Set(data.map(d => d._id));
                const combined = [...data];
                DEFAULT_QA_ITEMS.forEach(item => {
                    if (!ids.has(item._id)) combined.push(item);
                });
                allReviews = combined;
            } else {
                allReviews = DEFAULT_QA_ITEMS;
            }
        } else {
            allReviews = DEFAULT_QA_ITEMS;
        }
    } catch (error) {
        console.warn('API /reviews failed, using fallback seed data', error);
        allReviews = DEFAULT_QA_ITEMS;
    }

    filteredReviews = [...allReviews];
    updateKpis(allReviews);
    renderReviewsTable(filteredReviews);
}

function applyQaFilters() {
    const query = (document.getElementById('qaSearchInput')?.value || '').trim().toLowerCase();
    const ratingFilter = document.getElementById('qaRatingSelect')?.value || 'all';
    const statusFilter = document.getElementById('qaStatusSelect')?.value || 'all';

    filteredReviews = allReviews.filter(r => {
        const prodName = (r.product?.name || '').toLowerCase();
        const custName = (r.customerName || r.customer?.name || '').toLowerCase();
        const comment = (r.comment || '').toLowerCase();
        const title = (r.title || '').toLowerCase();

        const matchQuery = !query || prodName.includes(query) || custName.includes(query) || comment.includes(query) || title.includes(query);
        const matchRating = ratingFilter === 'all' || String(r.rating) === ratingFilter;
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;

        return matchQuery && matchRating && matchStatus;
    });

    renderReviewsTable(filteredReviews);
}

function resetQaFilters() {
    const form = document.getElementById('qaFilterForm');
    if (form) form.reset();
    filteredReviews = [...allReviews];
    renderReviewsTable(filteredReviews);
}

async function toggleReviewStatus(reviewId) {
    const target = allReviews.find(r => r._id === reviewId);
    if (!target) return;

    const newStatus = target.status === 'visible' ? 'hidden' : 'visible';

    // Attempt backend update
    try {
        await fetch(`${API_URL}/reviews/${reviewId}/status`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
    } catch (e) {
        console.warn('Backend status toggle failed, updating locally', e);
    }

    target.status = newStatus;
    updateKpis(allReviews);
    applyQaFilters();
}

function openQaReplyModal(reviewId) {
    const target = allReviews.find(r => r._id === reviewId);
    if (!target) return;

    const modal = document.getElementById('qaReplyModal');
    const custEl = document.getElementById('replyCustomerName');
    const prodEl = document.getElementById('replyProductName');
    const qEl = document.getElementById('replyQuestionText');
    const inputEl = document.getElementById('adminReplyInput');
    const idInput = document.getElementById('replyReviewId');

    if (!modal) return;

    custEl.textContent = target.customerName || target.customer?.name || 'Khách hàng';
    prodEl.textContent = target.product?.name || 'Sản phẩm';
    qEl.textContent = `"${target.comment || target.title}"`;
    idInput.value = reviewId;

    const existing = getStoredReply(reviewId);
    inputEl.value = existing?.reply || '';

    if (typeof modal.showModal === 'function') {
        modal.showModal();
    } else {
        modal.setAttribute('open', '');
    }
}

function closeQaReplyModal() {
    const modal = document.getElementById('qaReplyModal');
    if (!modal) return;
    if (typeof modal.close === 'function') {
        modal.close();
    } else {
        modal.removeAttribute('open');
    }
}

function submitQaReply() {
    const id = Number(document.getElementById('replyReviewId')?.value);
    const replyText = (document.getElementById('adminReplyInput')?.value || '').trim();
    if (!id || !replyText) return;

    saveStoredReply(id, replyText);
    closeQaReplyModal();
    renderReviewsTable(filteredReviews);
}

window.applyQaFilters = applyQaFilters;
window.resetQaFilters = resetQaFilters;
window.toggleReviewStatus = toggleReviewStatus;
window.openQaReplyModal = openQaReplyModal;
window.closeQaReplyModal = closeQaReplyModal;
window.submitQaReply = submitQaReply;

document.addEventListener('DOMContentLoaded', () => {
    loadQaList();
});
