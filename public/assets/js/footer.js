(function renderSharedFooter() {
    const adminVersion = 'v=techecommerce-20260709-2';
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const isAdminPage = currentPath.includes('/admin/');

    function fallbackBasePath() {
        if (isAdminPage) return '../';

        const pagesIndex = currentPath.indexOf('/pages/');
        if (pagesIndex >= 0) {
            const pagePath = currentPath.slice(pagesIndex + '/pages/'.length);
            return '../'.repeat(Math.max(pagePath.split('/').length - 1, 0) + 1);
        }

        return '';
    }

    const root = typeof window.getAppBasePath === 'function'
        ? window.getAppBasePath()
        : fallbackBasePath();
    const year = new Date().getFullYear();
    const adminLinks = window.auth?.isAdmin?.()
        ? `
            <li><a href="${root}admin/dashboard.html?${adminVersion}">Quản trị</a></li>
            <li><a href="${root}admin/finance.html?${adminVersion}">Tài chính</a></li>`
        : '';

    const icon = (name) => {
        const paths = {
            facebook: '<path d="M14 3h4v4h-4v3h4v4h-4v7h-4v-7H7v-4h3V7a4 4 0 0 1 4-4Z"/>',
            instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
            tiktok: '<path d="M15 3v11.2a4.8 4.8 0 1 1-4-4.7v4.1a1.3 1.3 0 1 0 0 1.3V3h4Zm0 0c.4 2 1.7 3.4 4 3.8"/>',
            zalo: '<path d="M5 5h14v10H9l-4 4V5Z"/><path d="M8 9h5M8 12h3"/>',
            pin: '<path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/>',
            phone: '<path d="M6.5 3.5 9 6 7.3 8.4a14 14 0 0 0 4.3 4.3L14 11l2.5 2.5-1.7 3.1a2 2 0 0 1-2.3 1C7.6 16 4 12.4 2.4 7.5a2 2 0 0 1 1-2.3l3.1-1.7Z"/>',
            clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
            mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
            shield: '<path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
            arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
            top: '<path d="m6 11 6-6 6 6M12 5v14"/>'
        };
        return `<svg class="footer-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">${paths[name] || ''}</svg>`;
    };

    const storefrontFooterHTML = `
        <footer class="site-footer">
            <section class="footer-top footer-primary" aria-labelledby="footerBrandTitle">
                <header class="footer-brand footer-col">
                    <h2 class="footer-logo" id="footerBrandTitle">TechEcommerce</h2>
                    <p>Cửa hàng trực tuyến dành cho điện thoại, laptop, phụ kiện và thiết bị thông minh.</p>
                </header>
                <nav class="footer-directory" aria-label="Danh mục và chính sách">
                    <ul>
                        <li><a href="${root}index.html">Cửa hàng</a></li>
                        <li><a href="${root}pages/account/orders.html">Đơn hàng của tôi</a></li>
                        <li><a href="${root}pages/legal/faq.html">Hỗ trợ mua hàng</a></li>
                        <li><a href="${root}pages/legal/shipping.html">Vận chuyển</a></li>
                        <li><a href="${root}pages/legal/warranty.html">Bảo hành</a></li>
                        <li><a href="${root}pages/legal/return-policy.html">Đổi trả</a></li>
                        ${adminLinks}
                    </ul>
                </nav>
            </section>
            <hr class="footer-divider">
            <section class="footer-bottom" aria-label="Thông tin pháp lý">
                <p class="footer-bottom-left">© ${year} TechEcommerce. Made in Vietnam.</p>
                <nav class="footer-bottom-right" aria-label="Chính sách pháp lý">
                    <a href="${root}pages/legal/terms.html">Điều khoản</a>
                    <a href="${root}pages/legal/privacy.html">Bảo mật</a>
                    <a href="${root}pages/legal/cookie.html">Cookie</a>
                    <button type="button" class="back-to-top" id="footerBackToTop">${icon('top')} Lên đầu trang</button>
                </nav>
            </section>
        </footer>
    `;

    const footerHTML = isAdminPage
        ? storefrontFooterHTML.replace('class="site-footer"', 'class="site-footer admin-footer"')
        : storefrontFooterHTML;
    const footerPlaceholder = document.getElementById('site-footer') || document.querySelector('.site-footer');

    if (footerPlaceholder) footerPlaceholder.outerHTML = footerHTML;
    else document.body.insertAdjacentHTML('beforeend', footerHTML);

    document.getElementById('footerBackToTop')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();
