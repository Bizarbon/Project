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
            <section class="footer-top" aria-label="Thông tin TechEcommerce">
                <section class="footer-brand footer-col" aria-labelledby="footerBrandTitle">
                    <h2 class="footer-logo" id="footerBrandTitle">TechEcommerce</h2>
                    <p>Nền tảng mua sắm công nghệ dành cho điện thoại, laptop, phụ kiện và thiết bị thông minh. Hỗ trợ tư vấn AI, đặt hàng, thanh toán và theo dõi đơn nhanh chóng.</p>
                    <nav class="footer-social" aria-label="Mạng xã hội TechEcommerce">
                        <a class="social-btn" href="https://www.facebook.com/" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">${icon('facebook')}</a>
                        <a class="social-btn" href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">${icon('instagram')}</a>
                        <a class="social-btn" href="https://www.tiktok.com/" target="_blank" rel="noopener" aria-label="TikTok" title="TikTok">${icon('tiktok')}</a>
                        <a class="social-btn" href="https://zalo.me/" target="_blank" rel="noopener" aria-label="Zalo" title="Zalo">${icon('zalo')}</a>
                    </nav>
                    <section class="footer-trust-row" aria-label="Thanh toán và chứng nhận">
                        <div class="payment-badges" aria-label="Phương thức thanh toán">
                            <span class="payment-badge"><b class="payment-mark">COD</b><span>Thanh toán khi nhận</span></span>
                            <span class="payment-badge"><b class="payment-mark">M</b><span>MoMo</span></span>
                            <span class="payment-badge"><b class="payment-mark">V</b><span>VNPay</span></span>
                            <span class="payment-badge"><b class="payment-mark">VISA</b><span>Visa</span></span>
                            <span class="payment-badge"><b class="payment-mark">MC</b><span>Mastercard</span></span>
                        </div>
                        <span class="commerce-trust">${icon('shield')} Đã đăng ký Bộ Công Thương</span>
                    </section>
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
                    <address class="footer-contact-list">
                        <p><span class="contact-icon">${icon('pin')}</span><a href="${root}index.html?openAddress=1">64 Nguyễn Văn Bảo, Gò Vấp, TP.HCM</a> <a class="map-link" href="https://www.google.com/maps/search/?api=1&query=64+Nguyen+Van+Bao+Go+Vap+Ho+Chi+Minh" target="_blank" rel="noopener">(xem bản đồ)</a></p>
                        <p><span class="contact-icon">${icon('phone')}</span><a href="tel:12345678">1234 5678 - 1824 5678</a></p>
                        <p><span class="contact-icon">${icon('clock')}</span><span>8:00 - 22:00 mỗi ngày</span></p>
                        <p><span class="contact-icon">${icon('mail')}</span><a href="mailto:vuphilong@techecommerce.vn">vuphilong@techecommerce.vn</a></p>
                    </address>
                    <p class="newsletter-offer">Giảm 10% đơn đầu tiên khi đăng ký nhận tin</p>
                    <form class="newsletter-form" id="footerNewsletterForm" novalidate>
                        <label class="sr-only" for="footerNewsletterEmail">Email nhận ưu đãi</label>
                        <input id="footerNewsletterEmail" name="email" type="email" placeholder="Email của bạn..." autocomplete="email" required>
                        <button type="submit">Đăng ký</button>
                    </form>
                    <small class="newsletter-status" id="footerNewsletterStatus" role="status" aria-live="polite"></small>
                </section>
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

    const newsletterForm = document.getElementById('footerNewsletterForm');
    const newsletterInput = document.getElementById('footerNewsletterEmail');
    const newsletterStatus = document.getElementById('footerNewsletterStatus');
    newsletterForm?.addEventListener('submit', event => {
        event.preventDefault();
        const email = newsletterInput.value.trim().toLocaleLowerCase('vi');
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        newsletterStatus.className = 'newsletter-status';
        if (!isValidEmail) {
            newsletterStatus.textContent = 'Vui lòng nhập email hợp lệ.';
            newsletterStatus.classList.add('is-error');
            newsletterInput.focus();
            return;
        }

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
        newsletterStatus.classList.add('is-success');
        newsletterForm.reset();
    });

    document.getElementById('footerBackToTop')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Floating Zalo button - positioned horizontally beside AI chat
    if (!document.getElementById('zaloFloatingBtn')) {
        const zaloBtn = document.createElement('a');
        zaloBtn.id = 'zaloFloatingBtn';
        zaloBtn.className = 'zalo-floating-btn rhythmic-pulse-shake-zalo';
        zaloBtn.href = 'https://zalo.me/0842331606';
        zaloBtn.target = '_blank';
        zaloBtn.rel = 'noopener noreferrer';
        zaloBtn.setAttribute('aria-label', 'Tư vấn trực tiếp qua Zalo: 0842331606');
        zaloBtn.title = 'Chat Zalo với cửa hàng (0842331606)';
        zaloBtn.innerHTML = `
            <svg viewBox="0 0 48 48" width="34" height="34" fill="none" aria-hidden="true">
                <path d="M24 4C12.95 4 4 12.51 4 23c0 4.88 1.9 9.35 5.16 12.75L7.4 42.1c-.24.87.62 1.63 1.45 1.28l8.36-3.57C20.08 40.54 22 41 24 41c11.05 0 20-8.51 20-19S35.05 4 24 4z" fill="#0068FF"/>
                <path d="M13.5 27.5l4.8-6.5h-4.6v-2h6.6v1.8l-4.8 6.5h4.8v2h-6.8v-1.8zm9-8.5h2.2v10.3h-2.2V19zm5.5 0h2.2v8.3h4v2H28V19zm8 5.2c0-3 2.1-5.4 5-5.4s5 2.4 5 5.4c0 3-2.1 5.4-5 5.4s-5-2.4-5-5.4zm7.8 0c0-1.9-1.2-3.4-2.8-3.4s-2.8 1.5-2.8 3.4 1.2 3.4 2.8 3.4 2.8-1.5 2.8-3.4z" fill="#fff"/>
            </svg>
        `;
        document.body.appendChild(zaloBtn);
    }

    // Attach pulse-shake effect to AI chat toggle
    function attachAiShake() {
        const aiToggle = document.querySelector('.ai-chat-toggle');
        if (aiToggle && !aiToggle.classList.contains('rhythmic-pulse-shake-ai')) {
            aiToggle.classList.add('rhythmic-pulse-shake-ai');
        }
    }
    attachAiShake();
    setTimeout(attachAiShake, 1000);
})();
