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
                        <input id="sharedStorefrontSearch" name="search" type="search" value="${escapeHTML(currentSearch)}" placeholder="Bạn đang tìm sản phẩm gì?">
                        <button type="submit">Tìm kiếm</button>
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
