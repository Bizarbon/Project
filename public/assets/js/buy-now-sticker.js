/**
 * ==========================================================================
 * TechEcommerce Floating "MUA HÀNG NGAY" Cat Mascot Sticker Controller
 * File: frontend/assets/js/buy-now-sticker.js
 * Quản lý sticker nổi con mèo "MUA HÀNG NGAY !!", điều hướng và đóng/mở
 * ==========================================================================
 */
(function initBuyNowSticker() {
    const STORAGE_KEY = 'techecommerce_hide_buy_sticker';

    function init() {
        const sticker = document.getElementById('floatingBuySticker');
        const closeBtn = document.getElementById('buyStickerClose');
        const link = document.getElementById('buyStickerLink');

        if (!sticker) return;

        // Kiểm tra xem người dùng đã đóng sticker trong phiên này chưa
        try {
            if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
                sticker.classList.add('is-closed');
                return;
            }
        } catch (e) {
            // ignore
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                sticker.classList.add('is-closed');
                try {
                    sessionStorage.setItem(STORAGE_KEY, 'true');
                } catch (err) {
                    // ignore
                }
            });
        }

        if (link) {
            link.addEventListener('click', (e) => {
                const target = document.getElementById('flashSaleShowcase') || 
                               document.getElementById('catalogStart') || 
                               document.querySelector('.product-grid') ||
                               document.getElementById('productSections');
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.classList.add('target-highlight');
                    setTimeout(() => target.classList.remove('target-highlight'), 1200);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
