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
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="zaloBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#0084FF"/>
                        <stop offset="100%" stop-color="#0062E8"/>
                    </linearGradient>
                    <filter id="zaloBubbleShadow" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#003580" flood-opacity="0.2"/>
                    </filter>
                </defs>
                <rect width="100" height="100" rx="24" fill="url(#zaloBgGrad)"/>
                <rect x="1" y="1" width="98" height="98" rx="23" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
                <path d="M50 16 C28 16 13 29.5 13 46 C13 54.8 17.5 62.6 24.8 67.8 C24 73 21 78.5 17.5 82.5 C16.8 83.3 17.5 84.5 18.6 84.2 C26.2 81.8 33.2 78 37.8 75 C41.6 76.3 45.7 77 50 77 C72 77 87 63.5 87 46 C87 29.5 72 16 50 16 Z" fill="#FFFFFF" filter="url(#zaloBubbleShadow)"/>
                <g transform="translate(22.5, 18.5) scale(2.3)">
                    <path fill="#0068FF" d="M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 01-.5763-.5729l-.0006.0005a3.273 3.273 0 01-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 011.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 01-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 01-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9453 0 1.0746.8697 1.9453 1.945 1.9453z"/>
                </g>
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
