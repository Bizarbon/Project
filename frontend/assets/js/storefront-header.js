(function renderSharedStorefrontHeader() {
    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
    const currentCategory = new URLSearchParams(window.location.search).get('category') || '';
    const currentSearch = new URLSearchParams(window.location.search).get('search') || '';
    const categories = [
        ['all', 'Tất cả sản phẩm', 'grid-3x3.svg'],
        ['Điện thoại', 'Điện thoại', 'smartphone.svg'],
        ['Laptop', 'Laptop', 'laptop.svg'],
        ['Tablet', 'Tablet', 'tablet.svg'],
        ['Tai nghe', 'Tai nghe', 'headphones.svg'],
        ['Đồng hồ thông minh', 'Đồng hồ thông minh', 'watch.svg'],
        ['Phụ kiện', 'Phụ kiện', 'cable.svg'],
        ['Máy chơi game', 'Máy chơi game', 'gaming.svg']
    ];

    const categoryLinks = categories.map(([value, label, icon]) => {
        const active = currentCategory === value || (!currentCategory && value === 'all' && /index\.html$|\/$/.test(window.location.pathname));
        return `<li><a href="${root}index.html?category=${encodeURIComponent(value)}#catalogStart"${active ? ' class="active" aria-current="page"' : ''}><img src="${root}assets/icons/${icon}" alt="">${label}</a></li>`;
    }).join('');

    const location = localStorage.getItem('shoppingLocation') || 'Hồ Chí Minh';
    let cartCount = 0;
    try {
        const cartKey = window.auth?.getCartStorageKey?.() || 'cart:guest';
        const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
        cartCount = Array.isArray(cart) ? cart.reduce((total, item) => total + Math.max(Number(item.quantity) || 1, 1), 0) : 0;
    } catch (error) {
        cartCount = 0;
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const isAccountPage = currentPath.includes('/account/') || document.body.classList.contains('account-page');

    const headerHTML = `
        <header class="storefront-header account-storefront-header">
            <section class="header-main" aria-label="Thanh công cụ mua sắm">
                <div class="header-shell header-main-inner">
                    <a class="storefront-logo" href="${root}index.html" aria-label="TechEcommerce - Trang chủ">
                        <span class="storefront-logo-mark" aria-hidden="true">
                            <img src="${root}assets/images/logo/techecommerce-logo.svg" alt="TechEcommerce" width="40" height="40" class="storefront-logo-img">
                        </span>
                        <span class="storefront-logo-text">TechEcommerce</span>
                    </a>
                    <form class="header-search" action="${root}index.html" method="get" role="search">
                        <label class="sr-only" for="sharedStorefrontSearch">Tìm kiếm sản phẩm</label>
                        <span class="header-search-icon" aria-hidden="true">⌕</span>
                        <input id="sharedStorefrontSearch" name="search" type="search" value="${escapeHTML(currentSearch)}" placeholder="Bạn đang tìm sản phẩm gì?" autocomplete="off">
                        <button type="button" class="header-search-camera-btn" id="headerVisualSearchBtn" title="Tìm kiếm bằng hình ảnh (AI Visual Search)" aria-label="Tìm kiếm bằng hình ảnh">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                        <input type="file" id="headerVisualSearchInput" accept="image/*" style="display:none" aria-hidden="true">
                        <button type="submit">Tìm kiếm</button>
                        <section id="sharedLiveSearchResults" class="live-search-dropdown" aria-label="Gợi ý tìm kiếm tức thì" hidden></section>
                    </form>
                    <nav class="header-actions" aria-label="Tài khoản và giỏ hàng">
                        <span id="nav-auth-section"></span>
                        <a class="header-action-btn" href="${root}index.html?openCart=1" aria-label="Mở giỏ hàng">
                            <span class="header-action-icon" aria-hidden="true">🛒</span>
                            <span class="header-action-copy"><small>Đơn hàng</small><strong>Giỏ hàng</strong></span>
                            <span class="header-cart-badge"${cartCount ? '' : ' hidden'}>${cartCount}</span>
                        </a>
                        <a class="header-action-btn" href="${root}index.html?openAddress=1" aria-label="Chọn khu vực giao hàng">
                            <span class="header-action-icon" aria-hidden="true">⌖</span>
                            <span class="header-action-copy"><small>Khu vực</small><strong data-shopping-location-label>${escapeHTML(location)}</strong></span>
                        </a>
                    </nav>
                </div>
            </section>
            ${isAccountPage ? '' : `
            <nav class="header-categories" aria-label="Danh mục sản phẩm">
                <button type="button" class="category-scroll-arrow category-scroll-prev" aria-label="Cuộn danh mục sang trái" hidden>‹</button>
                <ul class="header-shell header-category-list">${categoryLinks}</ul>
                <button type="button" class="category-scroll-arrow category-scroll-next" aria-label="Cuộn danh mục sang phải" hidden>›</button>
            </nav>`}
        </header>`;

    const template = document.createElement('template');
    template.innerHTML = headerHTML.trim();
    const nextHeader = template.content.firstElementChild;
    const existingHeader = document.querySelector('body > .storefront-header');
    const legacyNavigation = document.querySelector('body > nav');

    if (existingHeader) existingHeader.replaceWith(nextHeader);
    else if (legacyNavigation) legacyNavigation.replaceWith(nextHeader);
    else document.body.prepend(nextHeader);

    if (typeof window.updateNavbar === 'function') window.updateNavbar();

    // Attach drag and arrow scroll
    if (typeof window.setupCategoryDragScroll === 'function') {
        window.setupCategoryDragScroll(nextHeader);
    } else {
        setupCategoryDragScroll(nextHeader);
    }

    // Attach Live Search & Visual AI Search
    setupStorefrontLiveSearch(nextHeader, root);
})();

function setupCategoryDragScroll(navEl) {
    if (!navEl) return;
    const list = navEl.querySelector('.header-category-list') || (navEl.classList.contains('header-category-list') ? navEl : null);
    if (!list) return;

    if (list._dragScrollInit) return;
    list._dragScrollInit = true;

    const prevBtn = navEl.querySelector('.category-scroll-prev');
    const nextBtn = navEl.querySelector('.category-scroll-next');

    list.querySelectorAll('img, button, a').forEach(el => {
        el.setAttribute('draggable', 'false');
    });

    function updateArrows() {
        const canScroll = list.scrollWidth > (list.clientWidth + 4);
        if (!canScroll) {
            if (prevBtn) prevBtn.hidden = true;
            if (nextBtn) nextBtn.hidden = true;
            return;
        }
        const maxScroll = list.scrollWidth - list.clientWidth;
        if (prevBtn) prevBtn.hidden = list.scrollLeft <= 6;
        if (nextBtn) nextBtn.hidden = list.scrollLeft >= (maxScroll - 6);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', e => {
            e.preventDefault();
            list.scrollBy({ left: -220, behavior: 'smooth' });
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', e => {
            e.preventDefault();
            list.scrollBy({ left: 220, behavior: 'smooth' });
        });
    }

    list.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });

    // Drag-to-scroll via mouse
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let hasMoved = false;

    list.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        isDown = true;
        hasMoved = false;
        startX = e.clientX;
        scrollStart = list.scrollLeft;
        list.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', e => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) {
            hasMoved = true;
        }
        if (hasMoved) {
            e.preventDefault();
            list.scrollLeft = scrollStart - dx;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        list.classList.remove('is-dragging');
    });

    list.addEventListener('click', e => {
        if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
            hasMoved = false;
        }
    }, true);

    // Mouse wheel horizontal scroll
    list.addEventListener('wheel', e => {
        if (list.scrollWidth > list.clientWidth) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                list.scrollLeft += e.deltaY;
            }
        }
    }, { passive: false });

    setTimeout(updateArrows, 60);
    setTimeout(updateArrows, 350);
}
window.setupCategoryDragScroll = setupCategoryDragScroll;

function setupStorefrontLiveSearch(headerEl, root) {
    if (!headerEl) return;
    const form = headerEl.querySelector('.header-search');
    const input = headerEl.querySelector('#sharedStorefrontSearch');
    const dropdown = headerEl.querySelector('#sharedLiveSearchResults');
    const cameraBtn = headerEl.querySelector('#headerVisualSearchBtn');
    const cameraInput = headerEl.querySelector('#headerVisualSearchInput');

    if (!form || !input || !dropdown) return;

    const apiUrl = (typeof window !== 'undefined' && window.API_URL) ? window.API_URL : (root.includes('techecommerce-shop.vercel.app') ? 'https://techecommerce-shop.vercel.app/api' : 'http://localhost:5000/api');
    function saveRecentSearch(term) {
        if (!term || term.trim().length < 2) return;
        const clean = term.trim();
        try {
            let list = JSON.parse(localStorage.getItem('techecommerce_recent_searches') || '[]');
            list = [clean, ...list.filter(x => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
            localStorage.setItem('techecommerce_recent_searches', JSON.stringify(list));
        } catch (e) {}
    }

    function getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem('techecommerce_recent_searches') || '[]');
        } catch (e) {
            return [];
        }
    }

    function clearRecentSearches() {
        try {
            localStorage.removeItem('techecommerce_recent_searches');
        } catch (e) {}
        renderTrending();
    }

    function removeRecentSearch(index) {
        try {
            let list = getRecentSearches();
            list.splice(index, 1);
            localStorage.setItem('techecommerce_recent_searches', JSON.stringify(list));
        } catch (e) {}
        renderTrending();
    }

    const trendingList = [
        { rank: 1, term: 'iPhone 16 Pro Max', tag: 'HOT', tagType: 'hot' },
        { rank: 2, term: 'MacBook Air M3', tag: 'MỚI', tagType: 'new' },
        { rank: 3, term: 'Samsung Galaxy S24 Ultra', tag: 'AI', tagType: 'ai' },
        { rank: 4, term: 'Sony WH-1000XM5', tag: '', tagType: '' },
        { rank: 5, term: 'Logitech MX Keys S', tag: '', tagType: '' },
        { rank: 6, term: 'Củ sạc Anker 65W GaN', tag: 'SALE', tagType: 'hot' }
    ];

    let cachedHotProducts = null;
    async function getHotProducts() {
        if (cachedHotProducts) return cachedHotProducts;
        try {
            const res = await fetch(`${apiUrl}/products?limit=3`);
            if (res.ok) {
                const data = await res.json();
                cachedHotProducts = Array.isArray(data) ? data.slice(0, 3) : [];
                return cachedHotProducts;
            }
        } catch (e) {}
        return [];
    }

    let debounceTimer = null;
    let selectedIndex = -1;

    function formatVND(val) {
        return (Number(val) || 0).toLocaleString('vi-VN') + ' đ';
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function highlightMatch(text, query) {
        if (!query || !text) return escapeHTML(text);
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapeHTML(text).replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    async function renderTrending() {
        const recents = getRecentSearches();
        const hotProducts = await getHotProducts();

        let html = '';

        // Section 1: Lịch sử tìm kiếm (nếu có)
        if (recents.length > 0) {
            html += `
                <div class="search-section search-section-history">
                    <div class="search-section-header">
                        <span class="search-section-title"><span class="section-icon">🕒</span> Tìm kiếm gần đây</span>
                        <button type="button" class="btn-clear-history" id="btnClearSearchHistory">Xóa tất cả</button>
                    </div>
                    <div class="search-history-chips">
                        ${recents.map((term, idx) => `
                            <span class="history-chip" data-search-term="${escapeHTML(term)}">
                                <span class="history-chip-text">${escapeHTML(term)}</span>
                                <button type="button" class="history-chip-remove" data-remove-index="${idx}" aria-label="Xóa">×</button>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Section 2: Xu hướng tìm kiếm
        html += `
            <div class="search-section search-section-trending">
                <div class="search-section-header">
                    <span class="search-section-title"><span class="section-icon">🔥</span> Xu hướng tìm kiếm</span>
                    <span class="search-section-badge">PHỔ BIẾN</span>
                </div>
                <div class="search-trending-grid">
                    ${trendingList.map(item => `
                        <button type="button" class="trending-rank-btn" data-search-term="${escapeHTML(item.term)}">
                            <span class="rank-badge rank-badge-${item.rank <= 3 ? item.rank : 'other'}">${item.rank}</span>
                            <span class="rank-title">${escapeHTML(item.term)}</span>
                            ${item.tag ? `<span class="rank-tag rank-tag-${item.tagType}">${item.tag}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Section 3: Gợi ý sản phẩm nổi bật
        if (hotProducts.length > 0) {
            html += `
                <div class="search-section search-featured-box">
                    <div class="search-section-header">
                        <span class="search-section-title"><span class="section-icon">⚡</span> Gợi ý mua sắm hàng đầu</span>
                    </div>
                    <div class="search-featured-list">
                        ${hotProducts.map(p => {
                            const discount = p.compareAtPrice && p.compareAtPrice > p.price;
                            const percent = discount ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
                            return `
                                <a class="search-featured-card" href="${root}pages/catalog/product.html?id=${p._id}">
                                    <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="search-featured-thumb" loading="lazy" onerror="this.src='${root}assets/images/logo/techecommerce-logo.svg'">
                                    <div class="search-featured-info">
                                        <strong class="search-featured-title">${escapeHTML(p.name)}</strong>
                                        <div class="search-featured-price-row">
                                            <span class="search-featured-price">${formatVND(p.price)}</span>
                                            ${discount ? `<del class="search-featured-compare">${formatVND(p.compareAtPrice)}</del>` : ''}
                                            ${percent > 0 ? `<span class="search-featured-badge">-${percent}%</span>` : ''}
                                        </div>
                                    </div>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Section 4: Tip Footer
        html += `
            <div class="live-search-tip-footer">
                <span>💡 <strong>Mẹo:</strong> Gõ từ 2 ký tự để tìm kiếm tức thì</span>
                <span>📷 AI Visual Search</span>
            </div>
        `;

        dropdown.innerHTML = html;

        // Bind click events
        dropdown.querySelector('#btnClearSearchHistory')?.addEventListener('click', e => {
            e.stopPropagation();
            clearRecentSearches();
        });

        dropdown.querySelectorAll('.history-chip-remove').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = Number(btn.getAttribute('data-remove-index'));
                removeRecentSearch(idx);
            });
        });

        dropdown.querySelectorAll('.history-chip, .trending-rank-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const term = btn.getAttribute('data-search-term');
                if (term) {
                    input.value = term;
                    saveRecentSearch(term);
                    performSearch(term);
                }
            });
        });

        dropdown.hidden = false;
        selectedIndex = -1;
    }

    function renderProductsList(products, query) {
        if (!products.length) {
            dropdown.innerHTML = `
                <div class="live-search-empty">
                    <p>Không tìm thấy sản phẩm khớp với "<strong>${escapeHTML(query)}</strong>"</p>
                </div>
                <header class="live-search-header">
                    <span class="live-search-title">🔥 Gợi ý từ khóa thịnh hành</span>
                </header>
                <nav class="live-search-trending-chips" aria-label="Từ khóa gợi ý">
                    ${trendingSearches.map(term => `
                        <button type="button" class="trending-chip" data-search-term="${escapeHTML(term)}">
                            <span>🔍</span> ${escapeHTML(term)}
                        </button>
                    `).join('')}
                </nav>
            `;
            bindChipClicks();
            dropdown.hidden = false;
            selectedIndex = -1;
            return;
        }

        dropdown.innerHTML = `
            <header class="live-search-header">
                <span class="live-search-title">⚡ Sản phẩm gợi ý (${products.length})</span>
            </header>
            <ul class="live-search-list">
                ${products.map(p => {
                    const discount = p.compareAtPrice > p.price;
                    return `
                        <li class="live-search-item">
                            <a class="live-search-link" href="${root}pages/catalog/product.html?id=${p._id}">
                                <figure class="live-search-thumb">
                                    <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='${root}assets/images/logo/techecommerce-logo.svg'">
                                </figure>
                                <div class="live-search-meta">
                                    <strong class="live-search-name">${highlightMatch(p.name, query)}</strong>
                                    <div class="live-search-price-row">
                                        <span class="live-search-price">${formatVND(p.price)}</span>
                                        ${discount ? `<del class="live-search-compare">${formatVND(p.compareAtPrice)}</del>` : ''}
                                        <span class="live-search-stock ${p.stock > 0 ? 'in' : 'out'}">${p.stock > 0 ? '✓ Còn hàng' : 'Tạm hết'}</span>
                                    </div>
                                </div>
                            </a>
                        </li>
                    `;
                }).join('')}
            </ul>
            <footer class="live-search-footer">
                <a class="live-search-view-all" href="${root}index.html?search=${encodeURIComponent(query)}">
                    Xem tất cả kết quả cho "<strong>${escapeHTML(query)}</strong>" ➔
                </a>
            </footer>
        `;
        dropdown.hidden = false;
        selectedIndex = -1;
    }

    function bindChipClicks() {
        dropdown.querySelectorAll('.trending-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const term = btn.getAttribute('data-search-term');
                input.value = term;
                performSearch(term);
            });
        });
    }

    async function performSearch(query) {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            renderTrending();
            return;
        }
        try {
            const res = await fetch(`${apiUrl}/products?search=${encodeURIComponent(trimmed)}&limit=5`);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            renderProductsList(data, trimmed);
        } catch (err) {
            console.error('Live search error:', err);
        }
    }

    // Input events
    input.addEventListener('input', e => {
        clearTimeout(debounceTimer);
        const query = e.target.value;
        if (query.trim().length < 2) {
            if (query.trim().length === 0) dropdown.hidden = true;
            else renderTrending();
            return;
        }
        debounceTimer = setTimeout(() => performSearch(query), 200);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 2) performSearch(query);
        else renderTrending();
    });

    // Keyboard navigation
    input.addEventListener('keydown', e => {
        if (dropdown.hidden) return;
        const items = dropdown.querySelectorAll('.live-search-link, .trending-chip');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection(items);
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && items[selectedIndex]) {
                e.preventDefault();
                items[selectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            dropdown.hidden = true;
        }
    });

    function updateSelection(items) {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add('is-focused');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('is-focused');
            }
        });
    }

    // Click outside to close
    document.addEventListener('click', e => {
        if (!form.contains(e.target)) {
            dropdown.hidden = true;
        }
    });

    // Camera Visual AI Search
    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', () => {
            cameraInput.click();
        });

        cameraInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            dropdown.hidden = false;
            dropdown.innerHTML = `
                <div class="visual-search-loading">
                    <div class="visual-search-spinner" aria-hidden="true"></div>
                    <strong>🔍 AI đang phân tích thiết bị từ hình ảnh...</strong>
                    <p>Nhận diện model, thương hiệu và thông số kỹ thuật...</p>
                </div>
            `;

            const reader = new FileReader();
            reader.onload = async () => {
                const base64Data = reader.result;
                try {
                    const res = await fetch(`${apiUrl}/chat/visual-search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image: base64Data,
                            filename: file.name
                        })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message || 'Không thể tìm kiếm bằng hình ảnh');

                    const detected = result.detectedItem || 'Thiết bị công nghệ';
                    const products = result.products || [];

                    dropdown.innerHTML = `
                        <header class="visual-search-result-badge">
                            <span class="badge-ai-chip">✨ AI Visual Search</span>
                            <div class="visual-detected-title">Nhận diện: <strong>${escapeHTML(detected)}</strong></div>
                            <small>${escapeHTML(result.description || '')}</small>
                        </header>
                        <header class="live-search-header" style="margin-top:0.5rem;">
                            <span class="live-search-title">Sản phẩm tương thích (${products.length})</span>
                        </header>
                        <ul class="live-search-list">
                            ${products.map(p => `
                                <li class="live-search-item">
                                    <a class="live-search-link" href="${root}pages/catalog/product.html?id=${p._id}">
                                        <figure class="live-search-thumb">
                                            <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy">
                                        </figure>
                                        <div class="live-search-meta">
                                            <strong class="live-search-name">${escapeHTML(p.name)}</strong>
                                            <div class="live-search-price-row">
                                                <span class="live-search-price">${formatVND(p.price)}</span>
                                                <span class="live-search-stock ${p.stock > 0 ? 'in' : 'out'}">${p.stock > 0 ? '✓ Còn hàng' : 'Tạm hết'}</span>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                        <footer class="live-search-footer">
                            <a class="live-search-view-all" href="${root}index.html?search=${encodeURIComponent(detected)}">
                                Xem tất cả dòng máy & phụ kiện liên quan ➔
                            </a>
                        </footer>
                    `;
                } catch (err) {
                    console.error('Visual search error:', err);
                    dropdown.innerHTML = `
                        <div class="live-search-empty">
                            <p>⚠️ Không thể nhận diện được hình ảnh này. Vui lòng thử lại với ảnh rõ nét hơn!</p>
                        </div>
                    `;
                }
            };
            reader.readAsDataURL(file);
            cameraInput.value = '';
        });
    }
}
window.setupStorefrontLiveSearch = setupStorefrontLiveSearch;
