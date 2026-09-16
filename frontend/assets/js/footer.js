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

    // Ensure cellphones-footer.css is loaded
    if (!document.getElementById('cellphonesFooterCss')) {
        const link = document.createElement('link');
        link.id = 'cellphonesFooterCss';
        link.rel = 'stylesheet';
        link.href = `${root}assets/css/cellphones-footer.css?v=20260914-3`;
        document.head.appendChild(link);
    }

    const adminLinks = window.auth?.isAdmin?.()
        ? `
            <li><a href="${root}admin/dashboard.html?${adminVersion}">Quản trị hệ thống</a></li>
            <li><a href="${root}admin/finance.html?${adminVersion}">Báo cáo tài chính</a></li>`
        : '';

    const storefrontFooterHTML = `
        <footer id="layout-footer" class="site-footer cps-footer">
            <div class="cps-footer-main">
                <!-- Cột 1: Thương hiệu, Mạng xã hội & Thanh toán -->
                <section class="cps-footer-col cps-col-brand" aria-labelledby="footerBrandTitle">
                    <h2 class="cps-footer-brand-title" id="footerBrandTitle">TechEcommerce</h2>
                    <p class="cps-brand-desc">Nền tảng mua sắm công nghệ dành cho điện thoại, laptop, phụ kiện và thiết bị thông minh. Hỗ trợ tư vấn AI, đặt hàng, thanh toán và theo dõi đơn nhanh chóng.</p>
                    
                    <section class="cps-social-wrap" aria-label="Mạng xã hội TechEcommerce">
                        <ul class="cps-social-list">
                            <li><a href="https://www.youtube.com/" target="_blank" rel="noopener nofollow" title="YouTube"><img src="${root}assets/images/footer/social-youtube.png" alt="YouTube" width="30" height="30" loading="lazy"></a></li>
                            <li><a href="https://www.facebook.com/" target="_blank" rel="noopener nofollow" title="Facebook"><img src="${root}assets/images/footer/social-facebook.png" alt="Facebook" width="30" height="30" loading="lazy"></a></li>
                            <li><a href="https://www.instagram.com/" target="_blank" rel="noopener nofollow" title="Instagram"><img src="${root}assets/images/footer/social-instagram.png" alt="Instagram" width="30" height="30" loading="lazy"></a></li>
                            <li><a href="https://www.tiktok.com/" target="_blank" rel="noopener nofollow" title="TikTok"><img src="${root}assets/images/footer/social-tiktok.png" alt="TikTok" width="30" height="30" loading="lazy"></a></li>
                            <li><a href="https://zalo.me/0842331606" target="_blank" rel="noopener nofollow" title="Zalo"><img src="${root}assets/images/footer/social-zalo.png" alt="Zalo" width="30" height="30" loading="lazy"></a></li>
                        </ul>
                    </section>

                    <section class="cps-payment-wrap" aria-labelledby="footerPaymentTitle">
                        <h3 class="cps-sub-title" id="footerPaymentTitle">Phương thức thanh toán</h3>
                        <ul class="cps-payment-grid">
                            <li><img src="${root}assets/images/footer/vnpay.png" alt="VNPAY" loading="lazy" width="42" height="26"></li>
                            <li><img src="${root}assets/images/footer/momo.png" alt="MoMo" loading="lazy" width="42" height="26"></li>
                            <li><img src="${root}assets/images/footer/onepay.png" alt="OnePay" loading="lazy" width="42" height="26"></li>
                            <li><img src="${root}assets/images/footer/zalopay.png" alt="ZaloPay" loading="lazy" width="42" height="26"></li>
                            <li><img src="${root}assets/images/footer/kredivo.png" alt="Kredivo" loading="lazy" width="42" height="26"></li>
                        </ul>
                    </section>

                    <div class="cps-cert-badge">
                        <a href="http://online.gov.vn/" target="_blank" rel="noopener nofollow" title="Đã đăng ký Bộ Công Thương">
                            <img src="${root}assets/images/footer/bocongthuong.png" alt="Đã thông báo Bộ Công Thương" width="104" height="34" loading="lazy">
                        </a>
                    </div>
                </section>

                <!-- Cột 2: Chức năng -->
                <nav class="cps-footer-col footer-col" aria-labelledby="footerFunctionsTitle">
                    <h3 class="cps-footer-title" id="footerFunctionsTitle">Chức năng</h3>
                    <ul class="cps-nav-list">
                        <li><a href="${root}index.html">Cửa hàng</a></li>
                        <li><a href="${root}pages/account/orders.html">Đơn hàng của tôi</a></li>
                        <li><a href="${root}pages/account/profile.html">Hồ sơ cá nhân</a></li>
                        <li><a href="${root}index.html?search=khuyen+mai">Khuyến mãi hot</a></li>
                        <li><a href="${root}index.html?search=tra+gop">Trả góp 0%</a></li>
                        ${adminLinks}
                    </ul>
                </nav>

                <!-- Cột 3: Hỗ trợ & Chính sách -->
                <nav class="cps-footer-col footer-col" aria-labelledby="footerSupportTitle">
                    <h3 class="cps-footer-title" id="footerSupportTitle">Hỗ trợ & Chính sách</h3>
                    <ul class="cps-nav-list">
                        <li><a href="${root}pages/legal/faq.html">Câu hỏi thường gặp</a></li>
                        <li><a href="${root}pages/legal/shipping.html">Chính sách vận chuyển</a></li>
                        <li><a href="${root}pages/legal/warranty.html">Bảo hành sản phẩm</a></li>
                        <li><a href="${root}pages/legal/return-policy.html">Chính sách đổi trả</a></li>
                        <li><a href="${root}pages/legal/terms.html">Điều khoản sử dụng</a></li>
                        <li><a href="${root}pages/legal/privacy.html">Chính sách bảo mật</a></li>
                    </ul>
                </nav>

                <!-- Cột 4: Tổng đài, Liên hệ & Đăng ký nhận tin -->
                <section class="cps-footer-col cps-col-contact" aria-labelledby="footerContactTitle">
                    <h3 class="cps-footer-title" id="footerContactTitle">Liên hệ & Hỗ trợ</h3>
                    <ul class="cps-hotline-list">
                        <li>Mua hàng: <a href="tel:18002097"><strong>1800.2097</strong></a> <span class="cps-time-badge">(7h30 - 22h00)</span></li>
                        <li>Khiếu nại: <a href="tel:18002063"><strong>1800.2063</strong></a> <span class="cps-time-badge">(8h00 - 21h30)</span></li>
                    </ul>
                    <address class="cps-address-list">
                        <p>📍 <a href="${root}index.html?openAddress=1">64 Nguyễn Văn Bảo, Gò Vấp, TP.HCM</a> <a class="cps-map-link" href="https://www.google.com/maps/search/?api=1&query=64+Nguyen+Van+Bao+Go+Vap+Ho+Chi+Minh" target="_blank" rel="noopener">(xem bản đồ)</a></p>
                        <p>✉️ <a href="mailto:vuphilong@techecommerce.vn">vuphilong@techecommerce.vn</a></p>
                    </address>

                    <section class="cps-newsletter-compact" aria-labelledby="footerNewsletterTitle">
                        <p class="cps-newsletter-heading" id="footerNewsletterTitle">Giảm 10% đơn đầu tiên khi đăng ký nhận tin</p>
                        <form class="cps-compact-form" id="footerNewsletterForm" novalidate>
                            <label class="sr-only" for="footerNewsletterEmail">Email nhận ưu đãi</label>
                            <div class="cps-compact-input-wrap">
                                <input id="footerNewsletterEmail" name="email" type="email" placeholder="Email của bạn..." autocomplete="email" required>
                                <button type="submit">Đăng ký</button>
                            </div>
                            <p class="newsletter-status" id="footerNewsletterStatus" role="status" aria-live="polite"></p>
                        </form>
                    </section>
                </section>
            </div>

            <!-- Thanh Bản quyền & Điều hướng dưới cùng -->
            <section class="cps-footer-bottom" aria-label="Thông tin pháp lý">
                <div class="cps-bottom-container">
                    <p class="cps-copyright">© ${year} TechEcommerce. Tất cả các quyền được bảo lưu.</p>
                    <nav class="cps-bottom-nav" aria-label="Chính sách pháp lý">
                        <a href="${root}pages/legal/terms.html">Điều khoản</a>
                        <span class="cps-sep">•</span>
                        <a href="${root}pages/legal/privacy.html">Bảo mật</a>
                        <span class="cps-sep">•</span>
                        <a href="${root}pages/legal/cookie.html">Cookie</a>
                        <button type="button" class="cps-back-to-top" id="footerBackToTop">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 11 6-6 6 6M12 5v14"/></svg>
                            Lên đầu trang
                        </button>
                    </nav>
                </div>
            </section>
        </footer>
    `;

    const footerHTML = isAdminPage
        ? storefrontFooterHTML.replace('class="site-footer cps-footer"', 'class="site-footer cps-footer admin-footer"')
        : storefrontFooterHTML;
    const footerPlaceholder = document.getElementById('site-footer') || document.querySelector('.site-footer');

    if (footerPlaceholder) footerPlaceholder.outerHTML = footerHTML;
    else document.body.insertAdjacentHTML('beforeend', footerHTML);

    // Newsletter submit handler
    const newsletterForm = document.getElementById('footerNewsletterForm');
    const newsletterInput = document.getElementById('footerNewsletterEmail');
    const newsletterStatus = document.getElementById('footerNewsletterStatus');
    newsletterForm?.addEventListener('submit', event => {
        event.preventDefault();
        const email = (newsletterInput?.value || '').trim().toLocaleLowerCase('vi');
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!newsletterStatus) return;
        newsletterStatus.className = 'newsletter-status';

        if (!isValidEmail) {
            newsletterStatus.textContent = 'Vui lòng nhập email hợp lệ.';
            newsletterStatus.classList.add('is-error');
            newsletterInput?.focus();
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

    // Back to top smooth scroll
    document.getElementById('footerBackToTop')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Floating Zalo button - stacked vertically above AI chat
    if (!document.getElementById('zaloFloatingBtn')) {
        const zaloBtn = document.createElement('a');
        zaloBtn.id = 'zaloFloatingBtn';
        zaloBtn.className = 'zalo-floating-btn rhythmic-pulse-shake-zalo';
        zaloBtn.href = 'https://zalo.me/0842331606';
        zaloBtn.target = '_blank';
        zaloBtn.rel = 'noopener noreferrer';
        zaloBtn.setAttribute('aria-label', 'Chat Zalo trực tiếp: 0842331606');
        zaloBtn.title = 'Chat Zalo với cửa hàng qua số 0842331606';
        zaloBtn.innerHTML = `
            <svg viewBox="0 0 100 100" width="38" height="38" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10C27.9 10 10 26.2 10 46.2c0 10.7 5.1 20.3 13.3 26.9-.5 4.4-2.5 11-5.4 14.4-.7.9.2 2 1.3 1.7 8.1-3.1 15-6.8 18.9-8.8 3.5.8 7.3 1.2 11.9 1.2 22.1 0 40-16.2 40-36.2S72.1 10 50 10z" fill="#0068FF"/>
                <text x="50" y="55" fill="#ffffff" font-family="'Inter', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="25" font-weight="900" text-anchor="middle" letter-spacing="-0.5px">Zalo</text>
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
