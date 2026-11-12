const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const STATIC_DEV_PORTS = new Set(['5500', '5501']);
const API_URL = LOCAL_HOSTS.has(window.location.hostname) && STATIC_DEV_PORTS.has(window.location.port)
    ? 'http://localhost:5000/api'
    : `${window.location.origin}/api`;
window.API_URL = API_URL;
window.GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '209752916771-2971mlsgd9gbmgpg666ff21e6guf3nb6.apps.googleusercontent.com';
const ADMIN_CACHE_VERSION = 'v=techecommerce-20260709-2';

(function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function cartStorageKeyForUser(user) {
    const identity = user?.id ?? user?._id ?? user?.username ?? user?.email;
    return identity ? `cart:user:${String(identity)}` : 'cart:guest';
}

function readStoredCart(key) {
    try {
        const cart = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(cart) ? cart : [];
    } catch (error) {
        return [];
    }
}

function mergeStoredCarts(primaryCart, incomingCart) {
    const merged = new Map();
    [...primaryCart, ...incomingCart].forEach(item => {
        const productId = String(item?.productId ?? '');
        if (!productId) return;
        const current = merged.get(productId);
        const quantity = Math.max(Number(item.quantity) || 1, 1);
        if (current) current.quantity += quantity;
        else merged.set(productId, { productId: item.productId, quantity });
    });
    return [...merged.values()];
}

// Immediate Theme Initialization
(function initTheme() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.dataset.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {}
})();

const auth = {
    getToken: () => localStorage.getItem('token'),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) {
            return null;
        }
    },
    isTokenExpired: (token) => {
        if (!token) return true;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return true;
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            const payload = JSON.parse(jsonPayload);
            if (!payload.exp) return false;
            return payload.exp * 1000 <= Date.now();
        } catch (e) {
            return true;
        }
    },
    clearSession: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
    isLoggedIn: () => {
        const token = localStorage.getItem('token');
        if (!token) return false;
        if (auth.isTokenExpired(token)) {
            auth.clearSession();
            return false;
        }
        return true;
    },
    isAdmin: () => {
        if (!auth.isLoggedIn()) return false;
        const user = auth.getUser();
        return Boolean(user && user.isAdmin);
    },
    getCartStorageKey: () => auth.isLoggedIn()
        ? cartStorageKeyForUser(auth.getUser())
        : 'cart:guest',
    logout: () => {
        auth.clearSession();
        window.location.href = `${getAppBasePath()}index.html`;
    },
    logoutQuietly: () => {
        auth.clearSession();
        if (typeof updateNavbar === 'function') {
            updateNavbar();
        }
    },
    saveAuth: (token, user) => {
        const guestCart = readStoredCart('cart:guest');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        const userCartKey = cartStorageKeyForUser(user);
        const userCart = readStoredCart(userCartKey);
        if (guestCart.length) {
            localStorage.setItem(userCartKey, JSON.stringify(mergeStoredCarts(userCart, guestCart)));
            localStorage.removeItem('cart:guest');
        }
    },
    getHeaders: () => {
        const token = auth.isLoggedIn() ? localStorage.getItem('token') : null;
        return {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
        };
    },
    handleApiError: (res, data) => {
        const message = data?.message || '';
        if (res.status === 401 && (message.includes('token') || message.includes('quyền') || message.includes('hết hạn'))) {
            auth.logoutQuietly();
            return true;
        }
        return false;
    }
};

window.auth = auth;
window.isLoggedIn = auth.isLoggedIn;
window.isAdmin = auth.isAdmin;
window.escapeHTML = escapeHTML;

function getAppBasePath() {
    const path = window.location.pathname.replace(/\\/g, '/');

    if (path.includes('/admin/')) return '../';

    const pagesIndex = path.indexOf('/pages/');
    if (pagesIndex >= 0) {
        const pagePath = path.slice(pagesIndex + '/pages/'.length);
        const depth = Math.max(pagePath.split('/').length - 1, 0);
        return '../'.repeat(depth + 1);
    }

    return '';
}

window.getAppBasePath = getAppBasePath;

function setTheme(theme) {
    const validThemes = ['light', 'dark', 'high-contrast'];
    const nextTheme = validThemes.includes(theme) ? theme : 'light';
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    updateThemeToggle();
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: nextTheme } }));
}

function toggleTheme() {
    const current = document.documentElement.dataset.theme || localStorage.getItem('theme') || 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
}

/* Lucian UX/UI Prompt #021 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#021 */
function updateThemeToggle() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const currentTheme = document.documentElement.dataset.theme || 'light';
    const isDark = currentTheme === 'dark';
    const isHighContrast = currentTheme === 'high-contrast';

    button.classList.toggle('is-dark', isDark);
    button.classList.toggle('is-high-contrast', isHighContrast);
    button.setAttribute('aria-checked', isDark || isHighContrast ? 'true' : 'false');

    let label = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    let title = isDark ? 'Giao diện: Tối. Bấm để chuyển sang Sáng' : 'Giao diện: Sáng. Bấm để chuyển sang Tối';
    if (isHighContrast) {
        label = 'Chuyển sang giao diện sáng';
        title = 'Giao diện: Tương phản cao. Bấm để chuyển sang Sáng';
    }

    button.setAttribute('aria-label', label);
    button.title = title;
    const srLabel = button.querySelector('.u021-sr-label');
    if (srLabel) {
        srLabel.textContent = `Chế độ giao diện: ${currentTheme}`;
    }

    let hcBadge = button.querySelector('.u021-hc-badge');
    if (isHighContrast) {
        if (!hcBadge) {
            hcBadge = document.createElement('span');
            hcBadge.className = 'u021-hc-badge';
            hcBadge.setAttribute('aria-hidden', 'true');
            hcBadge.textContent = '⚡HC';
            button.appendChild(hcBadge);
        }
    } else if (hcBadge) {
        hcBadge.remove();
    }
}

function renderThemeToggle() {
    if (document.getElementById('themeToggle')) return;
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/pages/auth/') || document.body.classList.contains('auth-cellphones-body') || document.querySelector('[data-auth-page]')) {
        return;
    }
    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.className = 'theme-toggle u021-sw-host';
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', document.documentElement.dataset.theme === 'dark' ? 'true' : 'false');
    button.innerHTML = `
        <span class="sr-only u021-sr-label">${document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        <span class="u021-stage" aria-hidden="true">
            <span class="u021-halo">
                <span class="u021-r u021-r1"></span>
                <span class="u021-r u021-r2"></span>
                <span class="u021-r u021-r3"></span>
            </span>
            <span class="u021-stars">
                <span class="u021-sp u021-p1"></span>
                <span class="u021-sp u021-p2"></span>
                <span class="u021-sp u021-p3"></span>
                <span class="u021-sd u021-d1"></span>
                <span class="u021-sd u021-d2"></span>
                <span class="u021-sd u021-d3"></span>
                <span class="u021-sd u021-d4"></span>
                <span class="u021-sd u021-d5"></span>
                <span class="u021-sd u021-d6"></span>
            </span>
            <span class="u021-clouds">
                <span class="u021-cl u021-cb u021-cb1"></span>
                <span class="u021-cl u021-cb u021-cb2"></span>
                <span class="u021-cl u021-cb u021-cb3"></span>
                <span class="u021-cl u021-cb u021-cb4"></span>
                <span class="u021-cl u021-cf u021-cf1"></span>
                <span class="u021-cl u021-cf u021-cf2"></span>
                <span class="u021-cl u021-cf u021-cf3"></span>
                <span class="u021-cl u021-cf u021-cf4"></span>
                <span class="u021-cl u021-cf u021-cf5"></span>
            </span>
            <span class="u021-knob">
                <span class="u021-moon">
                    <span class="u021-cr u021-cr1"></span>
                    <span class="u021-cr u021-cr2"></span>
                    <span class="u021-cr u021-cr3"></span>
                </span>
            </span>
        </span>
    `;
    button.addEventListener('click', toggleTheme);
    document.body.appendChild(button);
    updateThemeToggle();
}

window.setTheme = setTheme;
window.toggleTheme = toggleTheme;

/* Visual Haptic Feedback Engine for Silent & Deaf/Hard of Hearing UX */
function triggerVisualHaptic(type = 'success') {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    let beacon = document.getElementById('visualHapticBeacon');
    if (!beacon) {
        beacon = document.createElement('div');
        beacon.id = 'visualHapticBeacon';
        beacon.className = 'visual-haptic-beacon';
        beacon.setAttribute('aria-hidden', 'true');
        document.body.appendChild(beacon);
    }
    const flashClass = type === 'warning' || type === 'error' ? 'is-flashing-warning' : 'is-flashing-success';
    beacon.classList.remove('is-flashing-success', 'is-flashing-warning');
    void beacon.offsetWidth;
    beacon.classList.add(flashClass);
    clearTimeout(beacon._timer);
    beacon._timer = setTimeout(() => {
        beacon.classList.remove(flashClass);
    }, 450);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            if (type === 'warning' || type === 'error') {
                navigator.vibrate([60, 50, 60]);
            } else {
                navigator.vibrate([35, 40, 35]);
            }
        } catch (_) {}
    }

    if (window.TechMascot && typeof window.TechMascot.setState === 'function') {
        if (type === 'success') {
            window.TechMascot.setState('happy');
            clearTimeout(window.__mascotHappyTimer);
            window.__mascotHappyTimer = setTimeout(() => {
                if (window.TechMascot.getState?.() === 'happy') {
                    window.TechMascot.setState('idle');
                }
            }, 1800);
        }
    }
}
window.triggerVisualHaptic = triggerVisualHaptic;

/* Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070 */
(function initLucianStackingToasts() {
    const TOAST_MAX = 4;
    const TOAST_TTL = 4200;
    const TOAST_META = {
        success: {
            title: 'Thành công',
            icon: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.3 5 8.8 9.5 3.6"/></svg>'
        },
        error: {
            title: 'Thông báo lỗi',
            icon: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="round" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9"/></svg>'
        },
        warning: {
            title: 'Lưu ý',
            icon: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 3v3.8"/><circle cx="6" cy="9.2" r=".6" fill="currentColor"/></svg>'
        },
        info: {
            title: 'Thông tin',
            icon: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="3.2" r=".6" fill="currentColor"/><path d="M6 5.6V9"/></svg>'
        }
    };

    let zoneEl = null;
    let listEl = null;
    let hoverZone = false;

    function ensureToastZone() {
        if (listEl && document.body.contains(listEl)) return listEl;
        zoneEl = document.getElementById('lucianToastZone');
        if (!zoneEl) {
            zoneEl = document.createElement('aside');
            zoneEl.id = 'lucianToastZone';
            zoneEl.className = 'u070-zone';
            zoneEl.setAttribute('aria-label', 'Thông báo hệ thống');
            zoneEl.innerHTML = '<ol class="u070-list" aria-live="polite" aria-relevant="additions"></ol>';
            document.body.appendChild(zoneEl);
        }
        listEl = zoneEl.querySelector('.u070-list');
        if (!zoneEl._u070Bound) {
            zoneEl._u070Bound = true;
            zoneEl.addEventListener('pointerenter', (e) => {
                if (e.pointerType && e.pointerType !== 'mouse') return;
                hoverZone = true;
                zoneEl.classList.add('is-hover');
                pauseAllToasts();
                restackToasts();
            });
            zoneEl.addEventListener('pointerleave', () => {
                hoverZone = false;
                zoneEl.classList.remove('is-hover');
                resumeAllToasts();
                restackToasts();
            });
        }
        return listEl;
    }

    function activeToasts() {
        if (!listEl) return [];
        return [...listEl.children].filter(el => !el.classList.contains('is-out'));
    }

    function restackToasts() {
        const items = activeToasts();
        let offset = 0;
        items.forEach((el, idx) => {
            el.style.setProperty('--i', idx);
            el.style.setProperty('--stack-y', offset + 'px');
            offset += (el.offsetHeight || 68) + 10;
        });
        if (listEl) {
            listEl.style.height = hoverZone && items.length
                ? Math.max(offset - 10, 74) + 'px'
                : (items[0]?.offsetHeight || 74) + 'px';
        }
    }

    function dismissToast(el) {
        if (!el || el.classList.contains('is-out')) return;
        clearTimeout(el._timer);
        el.classList.add('is-out');
        restackToasts();
        setTimeout(() => {
            el.remove();
            restackToasts();
        }, 280);
    }

    function startToastTimer(el, ms) {
        el._remain = ms;
        el._start = performance.now();
        const bar = el.querySelector('.u070-bar > i');
        if (bar) {
            bar.style.transition = 'none';
            bar.style.transform = `scaleX(${Math.max(0, Math.min(1, ms / TOAST_TTL))})`;
            void bar.offsetWidth;
            bar.style.transition = `transform ${ms}ms linear`;
            bar.style.transform = 'scaleX(0)';
        }
        el._timer = setTimeout(() => dismissToast(el), ms);
    }

    function pauseAllToasts() {
        activeToasts().forEach(el => {
            if (!el._timer) return;
            clearTimeout(el._timer);
            el._timer = null;
            const elapsed = performance.now() - (el._start || performance.now());
            el._remain = Math.max(450, (el._remain || TOAST_TTL) - elapsed);
            const bar = el.querySelector('.u070-bar > i');
            if (bar) {
                const ratio = Math.max(0, Math.min(1, el._remain / TOAST_TTL));
                bar.style.transition = 'none';
                bar.style.transform = `scaleX(${ratio})`;
            }
        });
    }

    function resumeAllToasts() {
        activeToasts().forEach(el => startToastTimer(el, el._remain || 2200));
    }

    function showLucianToast(message, type = 'success') {
        if (!document.body) return;
        const list = ensureToastZone();
        const normType = TOAST_META[type] ? type : 'success';
        const meta = TOAST_META[normType];
        const li = document.createElement('li');
        li.className = `u070-t toast toast-${normType} show is-enter`;
        li.dataset.type = normType;
        li.setAttribute('role', normType === 'error' ? 'alert' : 'status');
        li.innerHTML = `
            <span class="u070-ic">${meta.icon}</span>
            <div class="u070-tx">
                <p class="u070-ti">${meta.title}</p>
                <p class="u070-de toast-msg">${escapeHTML(String(message ?? ''))}</p>
            </div>
            <button type="button" class="u070-x" aria-label="Đóng thông báo">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9"/></svg>
            </button>
            <span class="u070-bar" aria-hidden="true"><i></i></span>
        `;
        li.querySelector('.u070-x').addEventListener('click', (e) => {
            e.stopPropagation();
            dismissToast(li);
        });

        let startX = null;
        li.addEventListener('pointerdown', e => {
            if (e.target.closest('.u070-x')) return;
            startX = e.clientX;
        });
        li.addEventListener('pointermove', e => {
            if (startX === null) return;
            const dx = Math.max(0, e.clientX - startX);
            li.style.transform = `translate3d(${dx}px, 0, 0)`;
            li.style.opacity = String(Math.max(0.2, 1 - dx / 180));
        });
        const endDrag = e => {
            if (startX === null) return;
            const dx = (e.clientX || startX) - startX;
            startX = null;
            li.style.transform = '';
            li.style.opacity = '';
            if (dx > 85) dismissToast(li);
        };
        li.addEventListener('pointerup', endDrag);
        li.addEventListener('pointercancel', endDrag);

        list.prepend(li);
        requestAnimationFrame(() => {
            li.classList.remove('is-enter');
            restackToasts();
        });

        const items = activeToasts();
        if (items.length > TOAST_MAX) {
            items.slice(TOAST_MAX).forEach(dismissToast);
        }

        if (!hoverZone) {
            startToastTimer(li, TOAST_TTL);
        } else {
            li._remain = TOAST_TTL;
        }
    }

    window.showLucianToast = showLucianToast;
    if (typeof window.showToast !== 'function') {
        window.showToast = showLucianToast;
    }
})();

function updateNavbar() {
    const authSection = document.getElementById('nav-auth-section');
    if (!authSection) return;

    const isAdmin = auth.isAdmin();
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'inline-block' : 'none';
    });

    const base = getAppBasePath();
    const isStorefrontHeader = Boolean(authSection.closest('.storefront-header'));

    if (auth.isLoggedIn()) {
        const user = auth.getUser() || {};
        const name = escapeHTML(user.name || 'User');
        const initial = escapeHTML((user.name || 'U').charAt(0).toUpperCase());
        const avatar = user.avatar
            ? `<img src="${escapeHTML(user.avatar)}" alt="Ảnh đại diện ${name}">`
            : initial;
        authSection.innerHTML = `
            <div class="user-menu-container">
                <button type="button" class="user-profile-btn" aria-label="Menu tài khoản" aria-haspopup="true" aria-expanded="false">
                    <div class="user-avatar">${avatar}</div>
                    <div class="user-info">
                        <span class="user-name">${name}</span>
                        <span class="user-role">${isAdmin ? 'Quản trị viên' : 'Thành viên'}</span>
                    </div>
                </button>
                <div class="dropdown-menu" role="menu">
                    ${isAdmin ? `<a href="${base}admin/dashboard.html" class="dropdown-item" role="menuitem">📊 Dashboard</a>` : ''}
                    <a href="${base}pages/account/orders.html" class="dropdown-item" role="menuitem">📋 Đơn hàng của tôi</a>
                    <a href="${base}pages/account/orders.html?view=history" class="dropdown-item" role="menuitem">📦 Lịch sử mua hàng</a>
                    <a href="${base}pages/account/profile.html" class="dropdown-item" role="menuitem">👤 Hồ sơ cá nhân</a>
                    <a href="#" class="dropdown-item logout" role="menuitem" onclick="auth.logout()">🚪 Đăng xuất</a>
                </div>
            </div>
        `;

        const container = authSection.querySelector('.user-menu-container');
        const btn = authSection.querySelector('.user-profile-btn');
        if (btn && container) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = container.classList.toggle('open');
                btn.setAttribute('aria-expanded', String(isOpen));
            });
        }

        if (!window.__userMenuClickBound) {
            window.__userMenuClickBound = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.user-menu-container')) {
                    document.querySelectorAll('.user-menu-container.open').forEach(el => {
                        el.classList.remove('open');
                        el.querySelector('.user-profile-btn')?.setAttribute('aria-expanded', 'false');
                    });
                }
            });
        }
    } else {
        authSection.innerHTML = isStorefrontHeader
            ? `
                <a href="${base}pages/auth/login.html" class="header-account-link">
                    <span class="header-action-icon" aria-hidden="true">♙</span>
                    <span class="header-action-copy">
                        <small>Tài khoản</small>
                        <strong>Đăng nhập</strong>
                    </span>
                </a>
            `
            : `
                <div class="auth-btns">
                    <a href="${base}pages/auth/login.html" class="btn-login">Đăng nhập</a>
                    <a href="${base}pages/auth/register.html" class="btn-register">Đăng ký</a>
                </div>
            `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderThemeToggle();

    if (window.location.pathname.includes('/admin/')) {
        if (!auth.isLoggedIn() || !auth.isAdmin()) {
            alert('Bạn không có quyền truy cập trang quản trị!');
            window.location.href = '../pages/auth/login.html';
            return;
        }
    }
    updateNavbar();
});
