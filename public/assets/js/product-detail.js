let product = null;
let relatedProducts = [];
let wishlistIds = new Set();
let reviews = [];

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatDate(value) {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleDateString('vi-VN');
}

function specEntries(p) {
    const specs = p.specs || {};
    const items = [
        ['CPU / Chip', specs.cpu],
        ['RAM', specs.ram],
        ['Bộ nhớ', specs.storage],
        ['Màn hình', specs.screen],
        ['Camera', specs.camera],
        ['Pin', specs.battery],
        ['Hệ điều hành', specs.os],
        ['GPU', specs.gpu],
        ['Kết nối', specs.connectivity],
        ['Khối lượng', specs.weight]
    ].filter(([, value]) => value);

    if (items.length) return items;

    return [
        ['Danh mục', p.category || 'Sản phẩm công nghệ'],
        ['Mô tả', p.description || 'Đang cập nhật'],
        ['Bảo hành', p.warranty || 'Theo chính sách TechStore'],
        ['Tình trạng', p.stock > 0 ? 'Còn hàng' : 'Hết hàng']
    ];
}

function sellingPoints(p) {
    const category = String(p.category || '').toLowerCase();
    if (category.includes('điện thoại')) {
        return ['Phù hợp nhu cầu liên lạc, quay chụp và giải trí hằng ngày.', 'Có thể kết hợp ốp lưng, kính cường lực và sạc nhanh chính hãng.', 'Kiểm tra IMEI, ngoại hình và phụ kiện khi nhận hàng.'];
    }
    if (category.includes('laptop')) {
        return ['Phù hợp học tập, làm việc, lập trình và xử lý tài liệu.', 'Nên chọn RAM/SSD theo nhu cầu sử dụng lâu dài.', 'Có thể mua kèm chuột, balo, đế tản nhiệt và phần mềm bản quyền.'];
    }
    if (category.includes('tablet')) {
        return ['Tiện cho ghi chú, học online, đọc tài liệu và giải trí.', 'Nên mua kèm bút cảm ứng hoặc bàn phím nếu dùng để làm việc.', 'Pin và màn hình là hai yếu tố nên ưu tiên khi chọn tablet.'];
    }
    if (category.includes('tai nghe')) {
        return ['Phù hợp nghe nhạc, họp online và học tập.', 'Nên ưu tiên chống ồn nếu thường dùng ở nơi đông người.', 'Vệ sinh định kỳ để giữ chất lượng âm thanh và độ bền.'];
    }
    return ['Sản phẩm được quản lý tồn kho và giá bán trong hệ thống.', 'Có thể đặt hàng online, theo dõi trạng thái đơn và thanh toán linh hoạt.', 'Bảo hành theo thông tin sản phẩm và chính sách nhà cung cấp.'];
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

async function loadWishlist() {
    if (auth.isLoggedIn()) {
        const res = await fetch(`${API_URL}/customers/me/wishlist`, { headers: auth.getHeaders() });
        if (res.ok) {
            const data = await res.json();
            wishlistIds = new Set(data.map(item => Number(item._id || item)));
            return;
        }
    }
    wishlistIds = new Set(JSON.parse(localStorage.getItem('wishlist') || '[]').map(Number));
}

async function toggleWishlist(id) {
    const productId = Number(id);
    if (auth.isLoggedIn()) {
        const res = await fetch(`${API_URL}/customers/me/wishlist`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ productId, action: 'toggle' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Không cập nhật được yêu thích');
        wishlistIds = new Set(data.map(item => Number(item._id || item)));
    } else {
        if (wishlistIds.has(productId)) wishlistIds.delete(productId);
        else wishlistIds.add(productId);
        localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
    }
    renderProduct();
}

function addToCart(id) {
    if (!product || product.stock <= 0) return showToast('Sản phẩm đã hết hàng!', 'error');
    const qty = Math.max(Number(document.getElementById('detailQty').value || 1), 1);
    if (qty > product.stock) return showToast('Số lượng vượt quá tồn kho!', 'error');

    const cartKey = auth.getCartStorageKey();
    const legacyCart = localStorage.getItem('cart');
    if (legacyCart !== null && localStorage.getItem(cartKey) === null) {
        localStorage.setItem(cartKey, legacyCart);
    }
    localStorage.removeItem('cart');
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const item = cart.find(i => String(i.productId) === String(id));
    const nextQty = (item?.quantity || 0) + qty;
    if (nextQty > product.stock) return showToast('Số lượng trong giỏ đã chạm tồn kho!', 'error');
    if (item) item.quantity = nextQty;
    else cart.push({ productId: Number(id), quantity: qty });
    localStorage.setItem(cartKey, JSON.stringify(cart));
    showToast('Đã thêm vào giỏ hàng!');
}

async function loadProduct() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        document.getElementById('productDetail').innerHTML = '<div class="empty-state">Không tìm thấy mã sản phẩm</div>';
        return;
    }

    const [productRes, listRes] = await Promise.all([
        fetch(`${API_URL}/products/${id}`),
        fetch(`${API_URL}/products`)
    ]);
    if (!productRes.ok) {
        document.getElementById('productDetail').innerHTML = '<div class="empty-state">Sản phẩm không tồn tại</div>';
        return;
    }
    product = await productRes.json();
    const all = await listRes.json();
    relatedProducts = all
        .filter(p => (p.category === product.category || p.brand === product.brand) && String(p._id) !== String(product._id))
        .slice(0, 4);
    await loadReviews();
    renderProduct();
}

async function loadReviews() {
    if (!product) return;
    try {
        const res = await fetch(`${API_URL}/reviews/product/${product._id}`);
        reviews = res.ok ? await res.json() : [];
    } catch (error) {
        console.error('Review load error:', error);
        reviews = [];
    }
}

function renderProduct() {
    if (!product) return;
    const liked = wishlistIds.has(Number(product._id));
    const specs = specEntries(product);
    const ideas = sellingPoints(product);
    const discount = product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
    const gallery = [product.image, ...(product.images || [])].filter(Boolean);
    const uniqueGallery = [...new Set(gallery)];

    document.title = `${product.name} - TechEcommerce`;
    document.getElementById('productPageTitle').textContent = product.name;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(product._id)}`;
    document.querySelector('script[data-product-schema]')?.remove();
    const productSchema = document.createElement('script');
    productSchema.type = 'application/ld+json';
    productSchema.dataset.productSchema = 'true';
    productSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: uniqueGallery,
        description: product.description || undefined,
        sku: product.sku || undefined,
        brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
        offers: {
            '@type': 'Offer',
            priceCurrency: 'VND',
            price: Number(product.price) || 0,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: window.location.href
        },
        aggregateRating: product.rating ? {
            '@type': 'AggregateRating',
            ratingValue: Number(product.rating),
            reviewCount: Number(product.reviewCount) || reviews.length || 1
        } : undefined
    });
    document.head.appendChild(productSchema);
    document.getElementById('productDetail').innerHTML = `
        <figure class="detail-media">
            <img id="mainProductImage" src="${escapeHTML(uniqueGallery[0] || product.image)}" alt="${escapeHTML(product.name)}" onerror="this.src='https://via.placeholder.com/700x460?text=No+Image'">
            ${uniqueGallery.length > 1 ? `<nav class="detail-thumbs" aria-label="Ảnh sản phẩm">${uniqueGallery.map((src, index) => `<button type="button" onclick="document.getElementById('mainProductImage').src='${escapeHTML(src)}'" aria-label="Xem ảnh ${index + 1}"><img src="${escapeHTML(src)}" alt=""></button>`).join('')}</nav>` : ''}
        </figure>
        <article class="detail-info">
            <span class="category-badge">${escapeHTML(product.category)}</span>
            ${product.featured ? '<span class="category-badge" style="margin-left:.4rem;background:rgba(245,158,11,.16);color:var(--warning)">Nổi bật</span>' : ''}
            <h2>${escapeHTML(product.name)}</h2>
            <div style="color:var(--text-muted);font-weight:700;margin-bottom:.7rem;">
                ${escapeHTML(product.brand || 'TechStore Select')} ${product.sku ? `• SKU ${escapeHTML(product.sku)}` : ''}
            </div>
            ${product.rating ? `<div class="product-rating" style="margin-bottom:.7rem;">★ ${Number(product.rating).toFixed(1)} <span>(${product.reviewCount || 0} đánh giá)</span>${product.soldCount ? ` <span>• đã bán ${product.soldCount}</span>` : ''}</div>` : ''}
            <p class="detail-price">${fmt(product.price)}</p>
            ${discount ? `<p class="compare-price" style="font-size:1rem;margin-top:-.7rem;">${fmt(product.compareAtPrice)} • Tiết kiệm ${discount}%</p>` : ''}
            <p class="detail-desc">${escapeHTML(product.description || 'Chưa có mô tả chi tiết.')}</p>
            <dl class="detail-meta">
                <div><dt>Thương hiệu</dt><dd>${escapeHTML(product.brand || 'Đang cập nhật')}</dd></div>
                <div><dt>Ngày đăng bán</dt><dd><time datetime="${escapeHTML(product.createdAt || '')}">${formatDate(product.createdAt)}</time></dd></div>
                <div><dt>Tồn kho</dt><dd>${product.stock}</dd></div>
                <div><dt>Bảo hành</dt><dd>${escapeHTML(product.warranty || 'Không bảo hành')}</dd></div>
                <div><dt>Nhà cung cấp</dt><dd>${escapeHTML(product.supplier?.name || 'Đang cập nhật')}</dd></div>
            </dl>
            <section class="detail-section">
                <h3>Thông số kỹ thuật</h3>
                <div class="spec-grid">
                    ${specs.map(([label, value]) => `
                        <div class="spec-card">
                            <strong>${escapeHTML(label)}</strong>
                            <span>${escapeHTML(value)}</span>
                        </div>
                    `).join('')}
                </div>
            </section>
            <section class="detail-section">
                <h3>Gợi ý sử dụng</h3>
                <ul class="detail-list">
                    ${ideas.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
                </ul>
            </section>
            <section class="detail-section">
                <h3>Cam kết TechStore</h3>
                <ul class="detail-list">
                    <li>Kiểm tra tồn kho ở backend trước khi tạo đơn.</li>
                    <li>Hỗ trợ COD, chuyển khoản, MoMo và VNPay sandbox/mock.</li>
                    <li>Thông tin giá, tồn kho và bảo hành được quản lý từ trang admin.</li>
                </ul>
            </section>
            <div class="detail-actions">
                <label class="sr-only" for="detailQty">Số lượng</label>
                <input id="detailQty" type="number" min="1" max="${product.stock}" value="1" ${product.stock <= 0 ? 'disabled' : ''}>
                <button class="btn-primary" onclick="addToCart('${product._id}')" ${product.stock <= 0 ? 'disabled' : ''}>Thêm vào giỏ</button>
                <button class="btn-secondary" onclick="toggleWishlist('${product._id}').catch(err => showToast(err.message, 'error'))">${liked ? '♥ Đã thích' : '♡ Yêu thích'}</button>
            </div>
        </article>
    `;

    document.getElementById('relatedProducts').innerHTML = relatedProducts.map(p => `
        <a class="related-card" href="product.html?id=${p._id}">
            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" onerror="this.src='https://via.placeholder.com/240x160?text=No+Image'">
            <strong>${escapeHTML(p.name)}</strong>
            <small style="color:var(--text-muted)">${escapeHTML(p.brand || p.category || '')}</small>
            <span>${fmt(p.price)}</span>
        </a>
    `).join('') || '<div class="empty-state">Chưa có sản phẩm liên quan</div>';

    renderReviews();
    bindReviewForm();
}

function renderReviews() {
    const summary = document.getElementById('reviewSummary');
    const form = document.getElementById('reviewForm');
    const loginHint = document.getElementById('reviewLoginHint');
    const list = document.getElementById('reviewList');
    if (!summary || !form || !list) return;

    summary.innerHTML = product.rating
        ? `<strong style="color:var(--warning)">★ ${Number(product.rating).toFixed(1)}</strong> từ ${product.reviewCount || reviews.length} đánh giá`
        : 'Chưa có đánh giá. Hãy là người đầu tiên chia sẻ trải nghiệm.';

    form.style.display = auth.isLoggedIn() ? 'grid' : 'none';
    loginHint.innerHTML = auth.isLoggedIn()
        ? ''
        : 'Vui lòng <a href="../auth/login.html" style="color:var(--primary-light);font-weight:700">đăng nhập</a> để đánh giá sản phẩm.';

    if (!reviews.length) {
        list.innerHTML = '<div class="empty-state">Chưa có đánh giá nào cho sản phẩm này.</div>';
        return;
    }

    list.innerHTML = reviews.map(review => `
        <article class="review-card">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <strong>${escapeHTML(review.customer?.name || review.customerName || 'Khách hàng')}</strong>
                    ${review.verifiedPurchase ? '<span class="verified-review">Đã mua hàng</span>' : ''}
                    <div style="color:var(--warning);font-weight:800;">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                <span style="color:var(--text-muted);font-size:.8rem;">${formatDate(review.createdAt)}</span>
            </div>
            ${review.title ? `<h3 style="font-size:1rem;margin:.6rem 0 .25rem;">${escapeHTML(review.title)}</h3>` : ''}
            <p style="color:var(--text-secondary);">${escapeHTML(review.comment || '')}</p>
        </article>
    `).join('');
}

function bindReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!auth.isLoggedIn()) return showToast('Vui lòng đăng nhập để đánh giá!', 'error');

        try {
            const res = await fetch(`${API_URL}/reviews/product/${product._id}`, {
                method: 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify({
                    rating: Number(document.getElementById('reviewRating').value),
                    title: document.getElementById('reviewTitle').value.trim(),
                    comment: document.getElementById('reviewComment').value.trim()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Không gửi được đánh giá');
            showToast('Đã lưu đánh giá của bạn!');
            document.getElementById('reviewTitle').value = '';
            document.getElementById('reviewComment').value = '';
            await loadProduct();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadWishlist();
    await loadProduct();
});
