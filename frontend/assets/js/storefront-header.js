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

    const headerHTML = `
        <header class="storefront-header account-storefront-header">
            <section class="header-main" aria-label="Thanh công cụ mua sắm">
                <div class="header-shell header-main-inner">
                    <a class="storefront-logo" href="${root}index.html" aria-label="TechEcommerce - Trang chủ">
                        <span class="storefront-logo-mark">TE</span>
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
            <nav class="header-categories" aria-label="Danh mục sản phẩm">
                <ul class="header-shell header-category-list">${categoryLinks}</ul>
            </nav>
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
})();
