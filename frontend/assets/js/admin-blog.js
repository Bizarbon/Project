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

const DEFAULT_BLOG_POSTS = [
    {
        id: 1,
        title: 'Đánh giá chi tiết Laptop ASUS TUF Gaming A16 FA607: Cỗ máy gaming đáng mua nhất phân khúc',
        category: 'Đánh giá',
        author: 'Vũ Phi Long',
        excerpt: 'Sở hữu vi xử lý AMD Ryzen thế hệ mới cùng card đồ họa Radeon mạnh mẽ, ASUS TUF A16 mang lại hiệu năng ổn định vượt bậc cho cả game thủ lẫn người làm sáng tạo nội dung.',
        content: 'Laptop gaming ASUS TUF Gaming A16 FA607 là một trong những sản phẩm nổi bật nhất năm nay. Với màn hình tần số quét cao 165Hz, độ phân giải 2K sắc nét và hệ thống tản nhiệt buồng hơi hiện đại, thiết bị đáp ứng trọn vẹn từ các tựa game eSports đến các tựa game AAA hạng nặng.',
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80',
        tags: 'laptop, asus, tuf gaming, review',
        views: 1420,
        status: 'published',
        createdAt: '2026-07-10T08:30:00.000Z'
    },
    {
        id: 2,
        title: 'Top 5 phụ kiện Apple không thể thiếu cho góc làm việc tối giản năm 2026',
        category: 'Tư vấn',
        author: 'TechEcommerce Editorial',
        excerpt: 'Từ củ sạc đa cổng GaN, tai nghe EarPods Lightning tiện lợi đến bàn phím Magic Keyboard và dock sạc MagSafe tiện ích.',
        content: 'Một góc làm việc thông minh không thể thiếu những món phụ kiện tối ưu hóa trải nghiệm. Bài viết tổng hợp 5 món đồ công nghệ đáng đầu tư nhất giúp không gian của bạn gọn gàng và nâng cao năng suất làm việc gấp đôi.',
        image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80',
        tags: 'apple, earpods, phu-kien, setup',
        views: 980,
        status: 'published',
        createdAt: '2026-07-25T14:15:00.000Z'
    },
    {
        id: 3,
        title: 'Hướng dẫn tối ưu hóa Windows 11 giúp tăng tốc độ mở ứng dụng và chơi game không giật lag',
        category: 'Thủ thuật',
        author: 'Admin Support',
        excerpt: 'Tổng hợp các mẹo tinh chỉnh hệ thống, quản lý ứng dụng khởi động và bật chế độ Game Mode chuẩn xác nhất.',
        content: 'Sau một thời gian sử dụng, hệ điều hành có thể bị chậm do các tiến trình nền và tệp tin rác. Hãy áp dụng ngay 6 bước thiết lập đơn giản để máy tính của bạn luôn chạy mượt mà như lúc mới cài đặt.',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        tags: 'windows11, meo-hay, toi-uu, gaming',
        views: 2310,
        status: 'published',
        createdAt: '2026-08-05T11:00:00.000Z'
    },
    {
        id: 4,
        title: 'Xu hướng chip xử lý AI trên smartphone và máy tính cá nhân trong nửa cuối 2026',
        category: 'Tin tức',
        author: 'Vũ Phi Long',
        excerpt: 'Cuộc đua NPU tích hợp trực tiếp trên vi xử lý di động đang định hình lại toàn bộ hệ sinh thái phần mềm tương lai.',
        content: 'Trí tuệ nhân tạo cục bộ (On-device AI) đang dần thay thế hoàn toàn các giải pháp đám mây nhờ khả năng xử lý nhanh, bảo mật dữ liệu người dùng tuyệt đối và không phụ thuộc vào kết nối mạng liên tục.',
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
        tags: 'ai, chip, tin-tuc, smartphone',
        views: 850,
        status: 'published',
        createdAt: '2026-08-18T09:20:00.000Z'
    },
    {
        id: 5,
        title: 'Kế hoạch phát hành các dòng màn hình OLED cong 240Hz sắp tới (Bản nháp)',
        category: 'Tin tức',
        author: 'TechEcommerce Editorial',
        excerpt: 'Dự thảo thông tin kỹ thuật và chính sách đặt trước các mẫu màn hình gaming cao cấp sắp cập bến.',
        content: 'Bản thảo nội bộ ghi nhận các thông số kỹ thuật sơ bộ của dòng màn hình QD-OLED mới, chờ phê duyệt trước khi công bố ra mắt.',
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
        tags: 'oled, monitor, draft',
        views: 0,
        status: 'draft',
        createdAt: '2026-09-01T15:40:00.000Z'
    }
];

let blogArticles = [];
let filteredArticles = [];

function getStoredArticles() {
    try {
        const stored = localStorage.getItem('techBlogArticles');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.warn('Could not read techBlogArticles', e);
    }
    localStorage.setItem('techBlogArticles', JSON.stringify(DEFAULT_BLOG_POSTS));
    return DEFAULT_BLOG_POSTS;
}

function saveStoredArticles(articles) {
    try {
        localStorage.setItem('techBlogArticles', JSON.stringify(articles));
    } catch (e) {
        console.warn('Could not save techBlogArticles', e);
    }
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
        tbody.innerHTML = '<tr><td colspan="9" class="table-loading-row" style="padding: 32px; color: #94a3b8;">Không tìm thấy bài viết nào phù hợp với bộ lọc.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((a, idx) => {
        const isPub = a.status === 'published';
        const statusBadge = isPub
            ? '<span class="status-badge status-completed" style="font-size: 0.78rem;">Đã xuất bản</span>'
            : '<span class="status-badge status-shipping" style="font-size: 0.78rem;">Bản nháp</span>';

        const thumb = a.image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=80';

        return `
            <tr>
                <td style="color: var(--admin-text-muted); font-weight: 600;">${idx + 1}</td>
                <td>
                    <img src="${escapeHTML(thumb)}" alt="${escapeHTML(a.title)}" style="width: 60px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid var(--admin-border);" onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=80'">
                </td>
                <td>
                    <div style="max-width: 320px; white-space: normal; line-height: 1.35;">
                        <strong style="color: var(--admin-text-main); display: block; margin-bottom: 4px; font-size: 0.92rem;">${escapeHTML(a.title)}</strong>
                        <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${escapeHTML(a.excerpt || '')}</span>
                    </div>
                </td>
                <td>
                    <span style="display: inline-block; padding: 3px 8px; background: rgba(59, 130, 246, 0.15); color: var(--admin-blue-accent, #2563eb); border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                        ${escapeHTML(a.category)}
                    </span>
                </td>
                <td style="color: var(--admin-text-main); font-size: 0.86rem; font-weight: 500;">${escapeHTML(a.author)}</td>
                <td style="color: var(--admin-text-muted); font-size: 0.84rem;">${formatDate(a.createdAt)}</td>
                <td style="text-align: right; color: #10b981; font-weight: 600;">${(Number(a.views) || 0).toLocaleString('vi-VN')}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button type="button" onclick="editBlogArticle(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Chỉnh sửa">
                            Sửa
                        </button>
                        <button type="button" onclick="togglePublishStatus(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: ${isPub ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isPub ? '#fbbf24' : '#34d399'}; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="${isPub ? 'Chuyển thành bản nháp' : 'Xuất bản bài viết'}">
                            ${isPub ? 'Gỡ' : 'Đăng'}
                        </button>
                        <button type="button" onclick="deleteBlogArticle(${a.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Xóa bài viết">
                            Xóa
                        </button>
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
        const tags = (a.tags || '').toLowerCase();

        const matchQuery = !query || title.includes(query) || author.includes(query) || tags.includes(query);
        const matchCat = cat === 'all' || a.category === cat;
        const matchStatus = status === 'all' || a.status === status;

        return matchQuery && matchCat && matchStatus;
    });

    renderBlogTable(filteredArticles);
}

function resetBlogFilters() {
    const form = document.getElementById('blogFilterForm');
    if (form) form.reset();
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
        document.getElementById('articleTags').value = article.tags || '';
        document.getElementById('articleStatus').value = article.status || 'published';
    } else {
        titleEl.textContent = 'Viết bài mới';
        form.reset();
        document.getElementById('editArticleId').value = '';
        document.getElementById('articleAuthor').value = 'TechEcommerce Team';
    }

    if (typeof modal.showModal === 'function') {
        modal.showModal();
    } else {
        modal.setAttribute('open', '');
    }
}

function closeBlogEditorModal() {
    const modal = document.getElementById('blogEditorModal');
    if (!modal) return;
    if (typeof modal.close === 'function') {
        modal.close();
    } else {
        modal.removeAttribute('open');
    }
}

function editBlogArticle(id) {
    const article = blogArticles.find(a => a.id === id);
    if (article) openBlogEditorModal(article);
}

function saveBlogArticle() {
    const idVal = document.getElementById('editArticleId').value;
    const title = (document.getElementById('articleTitle').value || '').trim();
    const category = document.getElementById('articleCategory').value;
    const author = (document.getElementById('articleAuthor').value || '').trim();
    const image = (document.getElementById('articleImage').value || '').trim();
    const excerpt = (document.getElementById('articleExcerpt').value || '').trim();
    const content = (document.getElementById('articleContent').value || '').trim();
    const tags = (document.getElementById('articleTags').value || '').trim();
    const status = document.getElementById('articleStatus').value;

    if (!title || !category || !content) return;

    if (idVal) {
        // Update existing
        const targetId = Number(idVal);
        const idx = blogArticles.findIndex(a => a.id === targetId);
        if (idx !== -1) {
            blogArticles[idx] = {
                ...blogArticles[idx],
                title,
                category,
                author: author || 'TechEcommerce Team',
                image: image || blogArticles[idx].image,
                excerpt,
                content,
                tags,
                status
            };
        }
    } else {
        // Create new
        const newId = blogArticles.length ? Math.max(...blogArticles.map(a => a.id)) + 1 : 1;
        const newArticle = {
            id: newId,
            title,
            category,
            author: author || 'TechEcommerce Team',
            image: image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
            excerpt,
            content,
            tags,
            views: 0,
            status,
            createdAt: new Date().toISOString()
        };
        blogArticles.unshift(newArticle);
    }

    saveStoredArticles(blogArticles);
    updateBlogKpis(blogArticles);
    closeBlogEditorModal();
    applyBlogFilters();
}

function togglePublishStatus(id) {
    const article = blogArticles.find(a => a.id === id);
    if (!article) return;

    article.status = article.status === 'published' ? 'draft' : 'published';
    saveStoredArticles(blogArticles);
    updateBlogKpis(blogArticles);
    applyBlogFilters();
}

function deleteBlogArticle(id) {
    const article = blogArticles.find(a => a.id === id);
    if (!article) return;

    if (confirm(`Bạn có chắc chắn muốn xóa bài viết: "${article.title}" không?`)) {
        blogArticles = blogArticles.filter(a => a.id !== id);
        saveStoredArticles(blogArticles);
        updateBlogKpis(blogArticles);
        applyBlogFilters();
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
    blogArticles = getStoredArticles();
    filteredArticles = [...blogArticles];
    updateBlogKpis(blogArticles);
    renderBlogTable(filteredArticles);
});
