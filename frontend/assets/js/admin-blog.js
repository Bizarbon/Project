/**
 * TechEcommerce Admin Blog Manager — Real MongoDB Persistence (/api/blog)
 */
const BLOG_API_BASE = window.API_URL || `${window.location.origin}/api`;
const DEFAULT_THUMB = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80';

function blogEsc(str) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function blogToast(msg, type = 'success') {
    if (typeof window.showLucianToast === 'function') return window.showLucianToast(msg, type);
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN');
}

let blogArticles = [];
let filteredArticles = [];

async function fetchAdminArticles() {
    const tbody = document.getElementById('blogTableBody');
    try {
        const res = await fetch(`${BLOG_API_BASE}/blog/admin/all`, {
            headers: window.auth ? auth.getHeaders() : {}
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách bài viết.');
        blogArticles = Array.isArray(data.articles) ? data.articles : [];
    } catch (err) {
        blogArticles = [];
        blogToast(err.message || 'Lỗi tải danh sách bài viết.', 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="table-loading-row" style="padding:32px;color:var(--admin-text-muted);">${blogEsc(err.message)}</td></tr>`;
        }
        return;
    }
    filteredArticles = [...blogArticles];
    updateBlogKpis(blogArticles);
    renderBlogTable(filteredArticles);
}

function updateBlogKpis(list) {
    const totalEl = document.getElementById('blogMetricTotal');
    const viewsEl = document.getElementById('blogMetricViews');
    const pubEl = document.getElementById('blogMetricPublished');

    const total = list.length;
    const views = list.reduce((sum, a) => sum + (Number(a.views) || 0), 0);
    const pub = list.filter(a => a.status === 'published').length;

    if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
    if (viewsEl) viewsEl.textContent = views.toLocaleString('vi-VN');
    if (pubEl) pubEl.textContent = pub.toLocaleString('vi-VN');
}

function renderBlogTable(list) {
    const tbody = document.getElementById('blogTableBody');
    const countEl = document.getElementById('blogTableCount');
    if (countEl) countEl.textContent = list.length;
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-loading-row" style="padding: 32px; color: var(--admin-text-muted);">Không tìm thấy bài viết nào phù hợp với bộ lọc.</td></tr>';
        return;
    }

    const canEdit = !window.auth?.canAction || auth.canAction('blog', 'edit');
    const canDelete = !window.auth?.canAction || auth.canAction('blog', 'delete');

    tbody.innerHTML = list.map((a, idx) => {
        const isPub = a.status === 'published';
        const statusBadge = isPub
            ? '<span class="status-badge status-completed" style="font-size: 0.78rem;">Đã xuất bản</span>'
            : '<span class="status-badge status-shipping" style="font-size: 0.78rem;">Bản nháp</span>';
        const thumb = a.image || DEFAULT_THUMB;

        return `
            <tr>
                <td style="color: var(--admin-text-muted); font-weight: 600;">${idx + 1}</td>
                <td>
                    <img src="${blogEsc(thumb)}" alt="${blogEsc(a.title)}" style="width: 60px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid var(--admin-border);" onerror="this.onerror=null;this.src='${DEFAULT_THUMB}'">
                </td>
                <td>
                    <div style="max-width: 320px; white-space: normal; line-height: 1.35;">
                        <strong style="color: var(--admin-text-main); display: block; margin-bottom: 4px; font-size: 0.92rem;">${blogEsc(a.title)}</strong>
                        <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${blogEsc(a.excerpt || '')}</span>
                    </div>
                </td>
                <td>
                    <span class="blog-cat-pill" style="display: inline-block; padding: 3px 9px; background: rgba(37, 99, 235, 0.12); color: var(--admin-blue-accent, #2563eb); border-radius: 999px; font-size: 0.78rem; font-weight: 700;">
                        ${blogEsc(a.category)}
                    </span>
                </td>
                <td style="color: var(--admin-text-main); font-size: 0.86rem; font-weight: 500;">${blogEsc(a.author)}</td>
                <td style="color: var(--admin-text-muted); font-size: 0.84rem;">${formatDate(a.createdAt)}</td>
                <td style="text-align: right; color: var(--admin-emerald-accent, #059669); font-weight: 700;">${(Number(a.views) || 0).toLocaleString('vi-VN')}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        ${canEdit ? `<button type="button" onclick="editBlogArticle(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.35); background: rgba(37, 99, 235, 0.12); color: var(--admin-blue-accent, #2563eb); font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Chỉnh sửa">Sửa</button>` : ''}
                        ${canEdit ? `<button type="button" onclick="togglePublishStatus(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${isPub ? 'rgba(217, 119, 6, 0.35)' : 'rgba(5, 150, 105, 0.35)'}; background: ${isPub ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${isPub ? 'var(--admin-amber-accent, #d97706)' : 'var(--admin-emerald-accent, #059669)'}; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="${isPub ? 'Chuyển thành bản nháp' : 'Xuất bản bài viết'}">${isPub ? 'Gỡ' : 'Đăng'}</button>` : ''}
                        ${canDelete ? `<button type="button" onclick="deleteBlogArticle(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(220, 38, 38, 0.35); background: rgba(239, 68, 68, 0.12); color: var(--admin-rose-accent, #dc2626); font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Xóa bài viết">Xóa</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function applyBlogFilters() {
    const query = (document.getElementById('blogSearchInput')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('blogCategorySelect')?.value || 'all';
    const status = document.getElementById('blogStatusSelect')?.value || 'all';

    filteredArticles = blogArticles.filter(a => {
        const title = (a.title || '').toLowerCase();
        const author = (a.author || '').toLowerCase();
        const tags = (Array.isArray(a.tags) ? a.tags.join(', ') : String(a.tags || '')).toLowerCase();
        return (!query || title.includes(query) || author.includes(query) || tags.includes(query))
            && (cat === 'all' || a.category === cat)
            && (status === 'all' || a.status === status);
    });

    renderBlogTable(filteredArticles);
}

function resetBlogFilters() {
    document.getElementById('blogFilterForm')?.reset();
    filteredArticles = [...blogArticles];
    renderBlogTable(filteredArticles);
}

function openBlogEditorModal(article = null) {
    const modal = document.getElementById('blogEditorModal');
    const titleEl = document.getElementById('blogModalTitle');
    const form = document.getElementById('blogEditorForm');
    if (!modal || !form) return;

    if (article) {
        titleEl.textContent = 'Chỉnh sửa bài viết';
        document.getElementById('editArticleId').value = article.id;
        document.getElementById('articleTitle').value = article.title;
        document.getElementById('articleCategory').value = article.category;
        document.getElementById('articleAuthor').value = article.author;
        document.getElementById('articleImage').value = article.image || '';
        document.getElementById('articleExcerpt').value = article.excerpt || '';
        document.getElementById('articleContent').value = article.content || '';
        document.getElementById('articleTags').value = Array.isArray(article.tags) ? article.tags.join(', ') : (article.tags || '');
        document.getElementById('articleStatus').value = article.status || 'published';
    } else {
        titleEl.textContent = 'Viết bài mới';
        form.reset();
        document.getElementById('editArticleId').value = '';
        document.getElementById('articleAuthor').value = window.auth?.getUser?.()?.name || 'TechEcommerce Team';
    }

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
}

function closeBlogEditorModal() {
    const modal = document.getElementById('blogEditorModal');
    if (!modal) return;
    if (typeof modal.close === 'function' && modal.open) modal.close();
    else modal.removeAttribute('open');
}

function editBlogArticle(id) {
    const article = blogArticles.find(a => Number(a.id) === Number(id));
    if (article) openBlogEditorModal(article);
}

async function saveBlogArticle() {
    const idVal = document.getElementById('editArticleId').value;
    const payload = {
        title: (document.getElementById('articleTitle').value || '').trim(),
        category: document.getElementById('articleCategory').value,
        author: (document.getElementById('articleAuthor').value || '').trim() || 'TechEcommerce Team',
        image: (document.getElementById('articleImage').value || '').trim() || DEFAULT_THUMB,
        excerpt: (document.getElementById('articleExcerpt').value || '').trim(),
        content: (document.getElementById('articleContent').value || '').trim(),
        tags: (document.getElementById('articleTags').value || '').trim(),
        status: document.getElementById('articleStatus').value
    };

    if (!payload.title || !payload.category || !payload.content) {
        blogToast('Vui lòng nhập đầy đủ tiêu đề, chuyên mục và nội dung!', 'error');
        return;
    }

    try {
        const url = idVal ? `${BLOG_API_BASE}/blog/${encodeURIComponent(idVal)}` : `${BLOG_API_BASE}/blog`;
        const method = idVal ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: window.auth ? auth.getHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể lưu bài viết.');

        blogToast(data.message || 'Đã lưu bài viết thành công!', 'success');
        closeBlogEditorModal();
        await fetchAdminArticles();
        applyBlogFilters();
    } catch (err) {
        blogToast(err.message || 'Lỗi lưu bài viết!', 'error');
    }
}

async function togglePublishStatus(id) {
    const article = blogArticles.find(a => Number(a.id) === Number(id));
    if (!article) return;

    const nextStatus = article.status === 'published' ? 'draft' : 'published';
    try {
        const res = await fetch(`${BLOG_API_BASE}/blog/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: window.auth ? auth.getHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể đổi trạng thái bài viết.');

        article.status = nextStatus;
        updateBlogKpis(blogArticles);
        applyBlogFilters();
        blogToast(nextStatus === 'published' ? 'Đã xuất bản bài viết!' : 'Đã chuyển bài viết sang bản nháp.');
    } catch (err) {
        blogToast(err.message || 'Lỗi cập nhật trạng thái.', 'error');
    }
}

async function deleteBlogArticle(id) {
    const article = blogArticles.find(a => Number(a.id) === Number(id));
    if (!article) return;

    const ok = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog({
            title: 'Xóa bài viết Blog',
            message: `Bạn có chắc chắn muốn xóa bài viết "${article.title}" không?`,
            confirmLabel: 'Xóa bài viết',
            danger: true
        })
        : confirm(`Bạn có chắc chắn muốn xóa bài viết: "${article.title}" không?`);
    if (!ok) return;

    try {
        const res = await fetch(`${BLOG_API_BASE}/blog/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: window.auth ? auth.getHeaders() : {}
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thể xóa bài viết.');

        blogArticles = blogArticles.filter(a => Number(a.id) !== Number(id));
        updateBlogKpis(blogArticles);
        applyBlogFilters();
        blogToast('Đã xóa bài viết thành công!');
    } catch (err) {
        blogToast(err.message || 'Lỗi xóa bài viết.', 'error');
    }
}

window.openBlogEditorModal = openBlogEditorModal;
window.closeBlogEditorModal = closeBlogEditorModal;
window.editBlogArticle = editBlogArticle;
window.saveBlogArticle = saveBlogArticle;
window.togglePublishStatus = togglePublishStatus;
window.deleteBlogArticle = deleteBlogArticle;
window.applyBlogFilters = applyBlogFilters;
window.resetBlogFilters = resetBlogFilters;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('blogTableBody')) {
        fetchAdminArticles();
    }
});
