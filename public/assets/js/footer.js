(function renderSharedFooter() {
    const adminVersion = 'v=techecommerce-20260709-2';
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const isAdminPage = currentPath.includes('/admin/');

    function fallbackBasePath() {
        const path = currentPath;
        if (path.includes('/admin/')) return '../';

        const pagesIndex = path.indexOf('/pages/');
        if (pagesIndex >= 0) {
            const pagePath = path.slice(pagesIndex + '/pages/'.length);
            const depth = Math.max(pagePath.split('/').length - 1, 0);
            return '../'.repeat(depth + 1);
        }

        return '';
    }

    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : fallbackBasePath();
    const year = new Date().getFullYear();
    const adminLinks = window.auth?.isAdmin?.()
        ? `
            <li><a href="${root}admin/dashboard.html?${adminVersion}">Quản trị</a></li>
            <li><a href="${root}admin/finance.html?${adminVersion}">Tài chính</a></li>`
        : '';

    const storefrontFooterHTML = `
        <footer class="site-footer">
            <section class="footer-top" aria-label="Thông tin TechEcommerce">
                <section class="footer-brand footer-col" aria-labelledby="footerBrandTitle">
                    <h2 class="footer-logo" id="footerBrandTitle">TechEcommerce</h2>
                    <p>Nền tảng mua sắm công nghệ dành cho điện thoại, laptop, phụ kiện và thiết bị thông minh. Hỗ trợ tư vấn AI, đặt hàng, thanh toán và theo dõi đơn nhanh chóng.</p>
                    <nav class="footer-social" aria-label="Liên kết nhanh TechEcommerce">
                        <a class="social-btn" href="${root}index.html" title="Cửa hàng">TC</a>
                        <a class="social-btn" href="${root}pages/account/orders.html" title="Đơn hàng">OD</a>
                        <a class="social-btn" href="${root}pages/legal/faq.html" title="Hỗ trợ">AI</a>
                        <a class="social-btn" href="${root}pages/legal/warranty.html" title="Bảo hành">WR</a>
                    </nav>
                    <p class="payment-badges" aria-label="Phương thức thanh toán hỗ trợ">
                        <span class="payment-badge">COD</span>
                        <span class="payment-badge">MoMo</span>
                        <span class="payment-badge">VNPay</span>
                    </p>
                </section>

                <nav class="footer-col" aria-labelledby="footerFunctionsTitle">
                    <h2 id="footerFunctionsTitle">Chức năng</h2>
                    <ul>
                        <li><a href="${root}index.html">Cửa hàng</a></li>
                        <li><a href="${root}pages/account/orders.html">Đơn hàng của tôi</a></li>
                        <li><a href="${root}pages/account/profile.html">Hồ sơ cá nhân</a></li>
                        ${adminLinks}
                    </ul>
                </nav>

                <nav class="footer-col" aria-labelledby="footerSupportTitle">
                    <h2 id="footerSupportTitle">Hỗ trợ</h2>
                    <ul>
                        <li><a href="${root}pages/legal/faq.html">Câu hỏi thường gặp</a></li>
                        <li><a href="${root}pages/legal/shipping.html">Chính sách vận chuyển</a></li>
                        <li><a href="${root}pages/legal/warranty.html">Bảo hành sản phẩm</a></li>
                        <li><a href="${root}pages/legal/return-policy.html">Đổi trả</a></li>
                        <li><a href="${root}pages/legal/terms.html">Điều khoản sử dụng</a></li>
                        <li><a href="${root}pages/legal/privacy.html">Chính sách bảo mật</a></li>
                    </ul>
                </nav>

                <section class="footer-col footer-newsletter" aria-labelledby="footerContactTitle">
                    <h2 id="footerContactTitle">Liên hệ</h2>
                    <ul class="footer-contact-list">
                        <li><span class="contact-icon">PIN</span><a href="${root}index.html?openAddress=1">64 Nguyễn Văn Bảo, Gò Vấp, TP.HCM</a></li>
                        <li><span class="contact-icon">TEL</span><a href="tel:12345678">1234 5678 - 1824 5678</a></li>
                        <li><span class="contact-icon">MAIL</span><a href="mailto:vuphilong@techecommerce.vn">vuphilong@techecommerce.vn</a></li>
                    </ul>
                    <form class="newsletter-form" id="footerNewsletterForm">
                        <label class="sr-only" for="footerNewsletterEmail">Email nhận ưu đãi</label>
                        <input id="footerNewsletterEmail" name="email" type="email" placeholder="Email của bạn..." autocomplete="email" required>
                        <button type="submit">Đăng ký</button>
                    </form>
                    <small class="newsletter-status" id="footerNewsletterStatus" role="status"></small>
                </section>
            </section>
            <hr class="footer-divider">
            <section class="footer-bottom" aria-label="Thông tin pháp lý">
                <p class="footer-bottom-left">© ${year} TechEcommerce. Made in Vietnam.</p>
                <nav class="footer-bottom-right" aria-label="Chính sách pháp lý">
                    <a href="${root}pages/legal/terms.html">Điều khoản</a>
                    <a href="${root}pages/legal/privacy.html">Bảo mật</a>
                    <a href="${root}pages/legal/cookie.html">Cookie</a>
                </nav>
            </section>
        </footer>
    `;

    const footerHTML = isAdminPage
        ? storefrontFooterHTML.replace('class="site-footer"', 'class="site-footer admin-footer"')
        : storefrontFooterHTML;

    const existingFooter = document.querySelector('.site-footer');
    if (existingFooter) existingFooter.outerHTML = footerHTML;
    else document.body.insertAdjacentHTML('beforeend', footerHTML);

    const newsletterForm = document.getElementById('footerNewsletterForm');
    const newsletterStatus = document.getElementById('footerNewsletterStatus');
    newsletterForm?.addEventListener('submit', event => {
        event.preventDefault();
        const input = newsletterForm.querySelector('input[type="email"]');
        const email = input.value.trim().toLocaleLowerCase('vi');
        let subscriptions = [];
        try {
            subscriptions = JSON.parse(localStorage.getItem('newsletterSubscriptions') || '[]');
            if (!Array.isArray(subscriptions)) subscriptions = [];
        } catch (error) {
            subscriptions = [];
        }
        if (!subscriptions.includes(email)) subscriptions.push(email);
        localStorage.setItem('newsletterSubscriptions', JSON.stringify(subscriptions));
        newsletterStatus.textContent = 'Đăng ký nhận ưu đãi thành công.';
        input.value = '';
    });
})();
