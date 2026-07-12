const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const STATIC_DEV_PORTS = new Set(['5500', '5501']);
const API_URL = LOCAL_HOSTS.has(window.location.hostname) && STATIC_DEV_PORTS.has(window.location.port)
    ? 'http://localhost:5000/api'
    : `${window.location.origin}/api`;
window.API_URL = API_URL;
const ADMIN_CACHE_VERSION = 'v=techecommerce-20260709-2';

(function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
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

const auth = {
    getToken: () => localStorage.getItem('token'),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) {
            return null;
        }
    },
    isLoggedIn: () => !!localStorage.getItem('token'),
    isAdmin: () => {
        const user = auth.getUser();
        return Boolean(user && user.isAdmin);
    },
    getCartStorageKey: () => auth.isLoggedIn()
        ? cartStorageKeyForUser(auth.getUser())
        : 'cart:guest',
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = `${getAppBasePath()}index.html`;
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
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
        };
    },
    handleApiError: (res, data) => {
        const message = data?.message || '';
        if (res.status === 401 && (message.includes('token') || message.includes('quyền'))) {
            alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!');
            auth.logout();
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
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
    updateThemeToggle();
}

function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function updateThemeToggle() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    button.textContent = isDark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    button.title = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
}

function renderThemeToggle() {
    if (document.getElementById('themeToggle')) return;
    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', toggleTheme);
    document.body.appendChild(button);
    updateThemeToggle();
}

window.setTheme = setTheme;
window.toggleTheme = toggleTheme;

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
                <div class="user-profile-btn">
                    <div class="user-avatar">${avatar}</div>
                    <div class="user-info">
                        <span class="user-name">${name}</span>
                        <span class="user-role">${isAdmin ? 'Quản trị viên' : 'Thành viên'}</span>
                    </div>
                </div>
                <div class="dropdown-menu">
                    ${isAdmin ? `<a href="${base}admin/dashboard.html?${ADMIN_CACHE_VERSION}" class="dropdown-item">Tổng quan</a>` : ''}
                    <a href="${base}pages/account/orders.html" class="dropdown-item">📋 Đơn hàng của tôi</a>
                    <a href="${base}pages/account/profile.html" class="dropdown-item">👤 Hồ sơ cá nhân</a>
                    <a href="#" class="dropdown-item logout" onclick="auth.logout()">🚪 Đăng xuất</a>
                </div>
            </div>
        `;
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
