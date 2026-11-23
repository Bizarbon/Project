/**
 * TechEcommerce Admin Q&A & Reviews Manager — Real MongoDB Persistence (/api/reviews)
 */
function qaEsc(str) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function qaToast(msg, type = 'success') {
    if (typeof window.showLucianToast === 'function') return window.showLucianToast(msg, type);
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN');
}

let allReviews = [];
let filteredReviews = [];

function updateKpis(list) {
    const totalEl = document.getElementById('qaMetricTotal');
    const avgEl = document.getElementById('qaMetricAvgRating');
    const visibleEl = document.getElementById('qaMetricVisible');

    const total = list.length;
    const visible = list.filter(r => r.status === 'visible').length;
    const ratings = list.map(r => Number(r.rating) || 0).filter(r => r > 0);
    const avg = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '—';

    if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
    if (avgEl) avgEl.textContent = ratings.length ? `${avg} ★` : 'Chưa có';
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
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading-row" style="padding: 32px; color: var(--admin-text-muted);">Chưa có câu hỏi hoặc đánh giá nào phù hợp.</td></tr>';
        return;
    }

    const canEdit = !window.auth?.canAction || auth.canAction('qa', 'edit');

    tbody.innerHTML = list.map(r => {
        const idStr = `#${String(r._id).padStart(4, '0')}`;
        const prodName = r.product?.name || (typeof r.product === 'string' ? r.product : 'Sản phẩm hệ thống');
        const custName = r.customerName || r.customer?.name || 'Khách hàng';
        const isVisible = r.status === 'visible';
        const statusBadge = isVisible
            ? '<span class="status-badge status-completed" style="font-size: 0.78rem;">Đang hiển thị</span>'
            : '<span class="status-badge status-boom" style="font-size: 0.78rem;">Đã ẩn</span>';

        const verifiedBadge = r.verifiedPurchase === true
            ? '<span style="display: inline-block; font-size: 0.72rem; padding: 2px 6px; background: rgba(37, 99, 235, 0.14); color: var(--admin-blue-accent, #2563eb); border-radius: 4px; margin-top: 4px; font-weight: 600;">✓ Đã mua hàng</span>'
            : '';

        const replyTag = r.adminReply
            ? `<div style="margin-top: 8px; padding: 8px 10px; background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--admin-emerald-accent, #059669); border-radius: 6px; font-size: 0.8rem; color: var(--admin-text-main);">
                 <strong style="color: var(--admin-emerald-accent, #059669);">${qaEsc(r.adminRepliedBy || 'TechEcommerce')}:</strong> ${qaEsc(r.adminReply)}
               </div>`
            : '';

        return `
            <tr>
                <td><strong>${idStr}</strong></td>
                <td>
                    <div style="font-weight: 600; color: var(--admin-text-main); max-width: 220px; white-space: normal; line-height: 1.3;">
                        ${qaEsc(prodName)}
                    </div>
                </td>
                <td>
                    <div style="color: var(--admin-text-main); font-weight: 600;">${qaEsc(custName)}</div>
                    ${verifiedBadge}
                </td>
                <td>${renderStars(r.rating)}</td>
                <td>
                    <div style="max-width: 380px; white-space: normal; line-height: 1.4;">
                        ${r.title ? `<strong style="color: var(--admin-text-main); display: block; margin-bottom: 2px;">${qaEsc(r.title)}</strong>` : ''}
                        <span style="color: var(--admin-text-main); font-size: 0.86rem;">${qaEsc(r.comment)}</span>
                        ${replyTag}
                    </div>
                </td>
                <td style="color: var(--admin-text-muted); font-size: 0.84rem;">${formatDate(r.createdAt)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        ${canEdit ? `<button type="button" onclick="toggleReviewStatus(${r._id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${isVisible ? 'rgba(220, 38, 38, 0.35)' : 'rgba(5, 150, 105, 0.35)'}; background: ${isVisible ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${isVisible ? 'var(--admin-rose-accent, #dc2626)' : 'var(--admin-emerald-accent, #059669)'}; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="${isVisible ? 'Ẩn đánh giá' : 'Hiển thị đánh giá'}">${isVisible ? 'Ẩn' : 'Hiện'}</button>` : ''}
                        ${canEdit ? `<button type="button" onclick="openQaReplyModal(${r._id})" style="padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.35); background: rgba(37, 99, 235, 0.12); color: var(--admin-blue-accent, #2563eb); font-size: 0.78rem; font-weight: 600; cursor: pointer;">${r.adminReply ? 'Sửa phản hồi' : 'Phản hồi'}</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadQaList() {
    const errorEl = document.getElementById('qaError');
    if (errorEl) errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/reviews`, { headers: auth.getHeaders() });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách Q&A và đánh giá.');
        allReviews = Array.isArray(data) ? data : [];
    } catch (error) {
        allReviews = [];
        if (errorEl) {
            errorEl.textContent = error.message || 'Lỗi kết nối máy chủ.';
            errorEl.style.display = 'block';
        }
        qaToast(error.message || 'Không thể tải danh sách đánh giá.', 'error');
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

        return (!query || prodName.includes(query) || custName.includes(query) || comment.includes(query) || title.includes(query))
            && (ratingFilter === 'all' || String(r.rating) === ratingFilter)
            && (statusFilter === 'all' || r.status === statusFilter);
    });

    renderReviewsTable(filteredReviews);
}

function resetQaFilters() {
    document.getElementById('qaFilterForm')?.reset();
    filteredReviews = [...allReviews];
    renderReviewsTable(filteredReviews);
}

async function toggleReviewStatus(reviewId) {
    const target = allReviews.find(r => Number(r._id) === Number(reviewId));
    if (!target) return;

    const newStatus = target.status === 'visible' ? 'hidden' : 'visible';
    try {
        const res = await fetch(`${API_URL}/reviews/${reviewId}/status`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể cập nhật trạng thái hiển thị.');

        target.status = newStatus;
        updateKpis(allReviews);
        applyQaFilters();
        qaToast(newStatus === 'visible' ? 'Đã hiển thị lại đánh giá.' : 'Đã ẩn đánh giá khỏi trang sản phẩm.');
    } catch (e) {
        qaToast(e.message || 'Lỗi cập nhật trạng thái.', 'error');
    }
}

function openQaReplyModal(reviewId) {
    const target = allReviews.find(r => Number(r._id) === Number(reviewId));
    if (!target) return;

    const modal = document.getElementById('qaReplyModal');
    if (!modal) return;

    document.getElementById('replyCustomerName').textContent = target.customerName || target.customer?.name || 'Khách hàng';
    document.getElementById('replyProductName').textContent = target.product?.name || 'Sản phẩm';
    document.getElementById('replyQuestionText').textContent = `"${target.comment || target.title || ''}"`;
    document.getElementById('replyReviewId').value = reviewId;
    document.getElementById('adminReplyInput').value = target.adminReply || '';

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
}

function closeQaReplyModal() {
    const modal = document.getElementById('qaReplyModal');
    if (!modal) return;
    if (typeof modal.close === 'function' && modal.open) modal.close();
    else modal.removeAttribute('open');
}

async function submitQaReply() {
    const id = Number(document.getElementById('replyReviewId')?.value);
    const replyText = (document.getElementById('adminReplyInput')?.value || '').trim();
    if (!id || !replyText) {
        qaToast('Vui lòng nhập nội dung phản hồi!', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/reviews/${id}/reply`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ adminReply: replyText })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể lưu phản hồi.');

        const target = allReviews.find(r => Number(r._id) === id);
        if (target && data.review) {
            target.adminReply = data.review.adminReply;
            target.adminRepliedBy = data.review.adminRepliedBy;
            target.adminRepliedAt = data.review.adminRepliedAt;
        }
        closeQaReplyModal();
        applyQaFilters();
        qaToast('Đã gửi phản hồi chính thức lên trang sản phẩm!', 'success');
    } catch (err) {
        qaToast(err.message || 'Lỗi lưu phản hồi!', 'error');
    }
}

window.applyQaFilters = applyQaFilters;
window.resetQaFilters = resetQaFilters;
window.toggleReviewStatus = toggleReviewStatus;
window.openQaReplyModal = openQaReplyModal;
window.closeQaReplyModal = closeQaReplyModal;
window.submitQaReply = submitQaReply;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('qaTableBody')) {
        loadQaList();
    }
});
