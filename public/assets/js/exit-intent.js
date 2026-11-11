/**
 * TechEcommerce Exit-Intent & Cart Recovery System (Trụ cột 04)
 * 100% Semantic HTML5, WCAG Accessible, Light & Dark Theme Compatible
 * Showroom: 78 Nguyễn Văn Khối, Phường 11, Quận Gò Vấp, TP.HCM · Hotline: 0842.331.606
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'te_exit_intent_dismissed';
    const COUPON_CODE = 'GIUGIA200';
    const COUPON_VALUE = 200000;
    const MIN_ORDER = 2000000;

    let hasTriggered = false;
    let idleTimer = null;
    let modalEl = null;

    function isDismissed() {
        try {
            return sessionStorage.getItem(STORAGE_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }

    function markDismissed() {
        try {
            sessionStorage.setItem(STORAGE_KEY, 'true');
        } catch (_) {}
    }

    function formatVnd(num) {
        return Number(num || 0).toLocaleString('vi-VN') + ' ₫';
    }

    function showNotification(msg) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
            return;
        }
        const toast = document.createElement('aside');
        toast.className = 'te-exit-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function buildModalHtml() {
        const dialog = document.createElement('dialog');
        dialog.className = 'te-exit-modal';
        dialog.id = 'teExitModal';
        dialog.setAttribute('aria-labelledby', 'teExitTitle');
        dialog.setAttribute('aria-describedby', 'teExitDesc');

        dialog.innerHTML = `
            <article class="te-exit-card">
                <button type="button" class="te-exit-close" id="teExitCloseBtn" aria-label="Đóng thông báo">×</button>
                
                <header class="te-exit-header">
                    <span class="te-exit-pill">🎁 ĐẶC QUYỀN GIỮ DEAL 24H · DÀNH RIÊNG CHO BẠN</span>
                    <h2 class="te-exit-title" id="teExitTitle">Đừng Vội Rời Đi! TechEcommerce Tặng Bạn Mã Giữ Giá 200.000 ₫</h2>
                    <p class="te-exit-desc" id="teExitDesc">
                        Ưu đãi bảo lưu riêng cho phiên truy cập hôm nay. Bạn được giảm ngay <strong>${formatVnd(COUPON_VALUE)}</strong> cho đơn từ ${formatVnd(MIN_ORDER)} và nhận trọn bộ chính sách bảo hành vàng!
                    </p>
                </header>

                <section class="te-exit-coupon-box" aria-label="Mã giảm giá độc quyền">
                    <div class="te-coupon-left">
                        <span class="te-coupon-label">MÃ GIỮ GIÁ ĐỘC QUYỀN 24H</span>
                        <strong class="te-coupon-code">${COUPON_CODE}</strong>
                        <span class="te-coupon-rule">Giảm ${formatVnd(COUPON_VALUE)} cho đơn từ ${formatVnd(MIN_ORDER)}</span>
                    </div>
                    <button type="button" class="te-coupon-copy-btn" id="teExitCopyBtn" aria-label="Sao chép mã ${COUPON_CODE}">
                        📋 Sao chép
                    </button>
                </section>

                <section class="te-exit-trust-grid" aria-label="3 cam kết an tâm mua sắm">
                    <article class="te-trust-item">
                        <span class="te-trust-icon" aria-hidden="true">🚚</span>
                        <strong>Giao Hỏa Tốc 2H</strong>
                        <span>Nội thành TP.HCM, hẹn giờ nhận máy chuẩn xác</span>
                    </article>
                    <article class="te-trust-item">
                        <span class="te-trust-icon" aria-hidden="true">📦</span>
                        <strong>Đồng Kiểm 100%</strong>
                        <span>Khui hộp kiểm tra ngoại quan, ưng ý mới trả tiền</span>
                    </article>
                    <article class="te-trust-item">
                        <span class="te-trust-icon" aria-hidden="true">🔄</span>
                        <strong>Lỗi 1 Đổi 1 Trong 30 Ngày</strong>
                        <span>Phần cứng lỗi đổi mới 100% nguyên seal cùng model</span>
                    </article>
                </section>

                <footer class="te-exit-actions">
                    <button type="button" class="te-exit-btn-primary" id="teExitApplyBtn">
                        ⚡ Áp Mã Giảm 200K & Mua Ngay
                    </button>
                    <button type="button" class="te-exit-btn-secondary" id="teExitChatAiBtn">
                        💬 Nhờ AI Giữ Giá & Quà Tặng
                    </button>
                </footer>

                <footer class="te-exit-footer-address">
                    <address class="te-exit-address">
                        📍 Showroom duy nhất: <strong>78 Nguyễn Văn Khối, Phường 11, Quận Gò Vấp, Thành phố Hồ Chí Minh</strong> · Hotline: <strong>0842.331.606</strong>
                    </address>
                </footer>
            </article>
        `;

        return dialog;
    }

    function openModal() {
        if (hasTriggered || isDismissed()) return;
        hasTriggered = true;

        if (!modalEl) {
            modalEl = buildModalHtml();
            document.body.appendChild(modalEl);
            attachModalEvents();
        }

        if (typeof modalEl.showModal === 'function') {
            modalEl.showModal();
        } else {
            modalEl.setAttribute('open', '');
        }
        modalEl.classList.add('is-visible');
        document.body.classList.add('te-exit-open');
    }

    function closeModal() {
        if (!modalEl) return;
        modalEl.classList.remove('is-visible');
        document.body.classList.remove('te-exit-open');
        setTimeout(() => {
            if (typeof modalEl.close === 'function') {
                modalEl.close();
            } else {
                modalEl.removeAttribute('open');
            }
        }, 200);
        markDismissed();
    }

    function applyVoucherAndProceed() {
        const couponPayload = {
            code: COUPON_CODE,
            value: COUPON_VALUE,
            type: 'fixed',
            discountAmount: COUPON_VALUE,
            minOrderValue: MIN_ORDER,
            name: 'Mã Giữ Giá 24H Exit-Intent'
        };

        try {
            sessionStorage.setItem('appliedCoupon', JSON.stringify(couponPayload));
            localStorage.setItem('checkout_coupon', COUPON_CODE);
        } catch (_) {}

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(COUPON_CODE).catch(() => {});
        }

        closeModal();
        showNotification(`🎉 Đã kích hoạt mã ${COUPON_CODE} (-${formatVnd(COUPON_VALUE)}) vào phiên mua hàng của bạn!`);

        // Tự động đồng bộ với giỏ hàng nếu trang có sẵn logic coupon
        const couponInput = document.getElementById('couponCode');
        if (couponInput) {
            couponInput.value = COUPON_CODE;
            const applyBtn = document.getElementById('applyCouponBtn');
            if (applyBtn) {
                applyBtn.click();
                return;
            }
        }

        // Nếu có hàm mở giỏ hàng trực tiếp
        if (typeof window.openCartDrawer === 'function') {
            window.openCartDrawer();
            return;
        }

        // Nếu đang ở trang chi tiết sản phẩm, mở modal thanh toán 1 chạm nếu có
        if (typeof window.openExpressCheckoutModal === 'function') {
            window.openExpressCheckoutModal();
            return;
        }
    }

    function openChatWithAi() {
        closeModal();

        const triggerQuestion = 'Tôi đang phân vân giá và muốn giữ giá ưu đãi 24h cùng mã GIUGIA200, tư vấn giúp tôi nhé!';

        // Nếu Chatbox AI có hàm toàn cục
        if (window.__techEcommerceChat && typeof window.__techEcommerceChat.send === 'function') {
            if (typeof window.__techEcommerceChat.open === 'function') window.__techEcommerceChat.open();
            window.__techEcommerceChat.send(triggerQuestion);
            return;
        }

        // Hoặc mở bằng nút toggle DOM
        const toggleBtn = document.querySelector('.ai-chat-toggle') || document.querySelector('#aiChatToggleBtn');
        if (toggleBtn) toggleBtn.click();

        setTimeout(() => {
            const input = document.getElementById('aiChatInput') || document.querySelector('.ai-chat-input');
            const form = document.getElementById('aiChatForm') || document.querySelector('.ai-chat-form');
            if (input && form) {
                input.value = triggerQuestion;
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }, 300);
    }

    function copyCouponCode(btn) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(COUPON_CODE).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '✓ Đã chép!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(() => {});
        }
    }

    function attachModalEvents() {
        const closeBtn = document.getElementById('teExitCloseBtn');
        const copyBtn = document.getElementById('teExitCopyBtn');
        const applyBtn = document.getElementById('teExitApplyBtn');
        const chatAiBtn = document.getElementById('teExitChatAiBtn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (copyBtn) copyBtn.addEventListener('click', () => copyCouponCode(copyBtn));
        if (applyBtn) applyBtn.addEventListener('click', applyVoucherAndProceed);
        if (chatAiBtn) chatAiBtn.addEventListener('click', openChatWithAi);

        // Click outside backdrop to close
        modalEl.addEventListener('click', (e) => {
            const rect = modalEl.getBoundingClientRect();
            const isInDialog = (
                rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                rect.left <= e.clientX && e.clientX <= rect.left + rect.width
            );
            if (!isInDialog) {
                closeModal();
            }
        });

        // ESC key to close
        modalEl.addEventListener('cancel', () => {
            markDismissed();
        });
    }

    // 1. Nhận diện rê chuột lên trên để rời trang (clientY <= 12)
    function onMouseLeave(e) {
        if (e.clientY <= 12 && !hasTriggered && !isDismissed()) {
            openModal();
        }
    }

    // 2. Nhận diện chuyển tab / ẩn trang
    let tabLeft = false;
    function onVisibilityChange() {
        if (document.hidden) {
            tabLeft = true;
        } else if (tabLeft && !hasTriggered && !isDismissed()) {
            openModal();
            tabLeft = false;
        }
    }

    // 3. Khách phân vân bất động quá 45 giây trên trang
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        if (!hasTriggered && !isDismissed()) {
            idleTimer = setTimeout(() => {
                openModal();
            }, 45000);
        }
    }

    function init() {
        // Trì hoãn 5 giây ban đầu để khách kịp xem nội dung trước khi lắng nghe exit-intent
        setTimeout(() => {
            document.addEventListener('mouseleave', onMouseLeave);
            document.addEventListener('visibilitychange', onVisibilityChange);
            ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
                document.addEventListener(evt, resetIdleTimer, { passive: true });
            });
            resetIdleTimer();
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Xuất API toàn cục để có thể gọi thử từ console hoặc sự kiện
    window.TechEcommerceExitIntent = {
        open: openModal,
        close: closeModal,
        code: COUPON_CODE
    };
})();
