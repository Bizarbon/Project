const EP = API_URL + '/customers';
let currentAvatar = '';
let pendingAvatar = null;

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

function syncLocalShoppingAddress(fullAddress) {
    const address = String(fullAddress || '').trim();
    const locationLabel = document.querySelector('[data-shopping-location-label]') || document.getElementById('profileLocationLabel');
    if (!address) {
        localStorage.removeItem('shoppingAddress');
        localStorage.removeItem('shoppingLocation');
        if (locationLabel) locationLabel.textContent = 'Hồ Chí Minh';
        return;
    }

    let current = null;
    try {
        current = JSON.parse(localStorage.getItem('shoppingAddress') || 'null');
    } catch (error) {
        current = null;
    }
    const parts = address.split(',').map(part => part.trim()).filter(Boolean);
    const lastPart = parts.at(-1) || 'Địa chỉ đã lưu';
    const derivedLabel = /^việt\s*nam$/iu.test(lastPart) && parts.length > 1 ? parts.at(-2) : lastPart;
    const label = current?.fullAddress === address && current.label
        ? current.label
        : derivedLabel.replace(/^(Thành phố|Tỉnh)\s+/u, '');
    const nextAddress = { ...(current || {}), fullAddress: address, label };

    localStorage.setItem('shoppingAddress', JSON.stringify(nextAddress));
    localStorage.setItem('shoppingLocation', label);
    if (locationLabel) locationLabel.textContent = label;
}

function renderProfileAvatar(avatar, name = '') {
    const image = document.getElementById('profileAvatarImage');
    const initial = document.getElementById('profileInitial');
    const hasAvatar = Boolean(avatar);
    image.hidden = !hasAvatar;
    initial.hidden = hasAvatar;
    if (hasAvatar) image.src = avatar;
    else image.removeAttribute('src');
    initial.textContent = (name || 'U').charAt(0).toUpperCase();
}

function compressAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('Tệp ảnh không hợp lệ.'));
            image.onload = () => {
                const maxSize = 512;
                const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
                const width = Math.max(Math.round(image.width * ratio), 1);
                const height = Math.max(Math.round(image.height * ratio), 1);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function setupAvatarEditor() {
    const input = document.getElementById('profileAvatarInput');
    const removeButton = document.getElementById('removeAvatarBtn');
    input?.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            input.value = '';
            return showToast('Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP.', 'error');
        }
        if (file.size > 2 * 1024 * 1024) {
            input.value = '';
            return showToast('Ảnh đại diện không được vượt quá 2 MB.', 'error');
        }
        try {
            pendingAvatar = await compressAvatar(file);
            renderProfileAvatar(pendingAvatar, document.getElementById('pName').value);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    removeButton?.addEventListener('click', () => {
        pendingAvatar = '';
        input.value = '';
        renderProfileAvatar('', document.getElementById('pName').value);
    });
}

function setupProfileHeader() {
    const header = document.querySelector('.storefront-header');
    const locationLabel = document.querySelector('[data-shopping-location-label]') || document.getElementById('profileLocationLabel');
    if (locationLabel) locationLabel.textContent = localStorage.getItem('shoppingLocation') || 'Hồ Chí Minh';
    if (!header) return;
    const updateHeight = () => document.documentElement.style.setProperty('--storefront-header-height', `${header.offsetHeight}px`);
    updateHeight();
    if ('ResizeObserver' in window) new ResizeObserver(updateHeight).observe(header);
    else window.addEventListener('resize', updateHeight);
}

// Load Profie
async function loadProfile() {
    const user = auth.getUser();
    if (!user) {
        window.location.href = '../auth/login.html';
        return;
    }

    try {
        const res = await fetch(`${EP}/${user.id}`, { headers: auth.getHeaders() });
        const data = await res.json();
        
        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message);

        // Update Bio Card
        currentAvatar = data.avatar || '';
        pendingAvatar = null;
        renderProfileAvatar(currentAvatar, data.name);
        document.getElementById('profileName').textContent = data.name;
        document.getElementById('profileUsername').textContent = '@' + data.username;
        
        const badge = document.getElementById('profileRoleBadge');
        badge.textContent = data.isAdmin ? 'Quản trị viên' : 'Thành viên';
        badge.className = `role-badge ${data.isAdmin ? 'role-admin' : 'role-member'}`;

        const joinDate = new Date(data.createdAt).toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        document.getElementById('profileJoinDate').textContent = joinDate;

        // Populate Form
        document.getElementById('pName').value = data.name;
        document.getElementById('pPhone').value = data.phone || '';
        document.getElementById('pEmail').value = data.email || '';
        document.getElementById('pAddress').value = data.address || '';
        if (data.address) syncLocalShoppingAddress(data.address);

    } catch (err) {
        console.error('Profile error:', err);
    }
}

// Handle Update
const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.getUser();
        
        const payload = {
            name: document.getElementById('pName').value.trim(),
            phone: document.getElementById('pPhone').value.trim(),
            email: document.getElementById('pEmail').value.trim(),
            address: document.getElementById('pAddress').value.trim()
        };

        if (pendingAvatar !== null) payload.avatar = pendingAvatar;

        const newPass = document.getElementById('pPassword').value;
        const confirmPass = document.getElementById('pPasswordConfirm').value;
        const currentPass = document.getElementById('pCurrentPassword').value;
        if (newPass !== confirmPass) return showToast('Mật khẩu xác nhận chưa khớp.', 'error');
        if (newPass && (newPass.length < 8 || !/[a-z]/.test(newPass) || !/[A-Z]/.test(newPass) || !/\d/.test(newPass))) {
            return showToast('Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.', 'error');
        }
        if (newPass && !currentPass) return showToast('Vui lòng nhập mật khẩu hiện tại.', 'error');
        if (newPass) {
            payload.password = newPass;
            payload.currentPassword = currentPass;
        }

        try {
            const res = await fetch(`${EP}/${user.id}`, {
                method: 'PUT',
                headers: auth.getHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            showToast('Cập nhật hồ sơ thành công!');

            if (data.sessionInvalidated) {
                showToast('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
                setTimeout(() => auth.logout(), 900);
                return;
            }
            
            // Update local storage name if it changed
            user.name = payload.name;
            user.avatar = data.avatar || '';
            user.address = data.address || payload.address;
            localStorage.setItem('user', JSON.stringify(user));
            syncLocalShoppingAddress(user.address);
            document.getElementById('pPassword').value = '';
            document.getElementById('pPasswordConfirm').value = '';
            document.getElementById('pCurrentPassword').value = '';
            
            // Reload UI
            loadProfile();
            if (typeof updateNavbar === 'function') updateNavbar();

        } catch (err) {
            showToast(err.message || 'Lỗi khi cập nhật!', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupProfileHeader();
    setupAvatarEditor();
    loadProfile();
});

window.addEventListener('storage', event => {
    if (event.key !== 'shoppingAddress' || !event.newValue) return;
    try {
        const address = JSON.parse(event.newValue);
        const addressInput = document.getElementById('pAddress');
        if (addressInput && address?.fullAddress) addressInput.value = address.fullAddress;
        const locationLabel = document.querySelector('[data-shopping-location-label]') || document.getElementById('profileLocationLabel');
        if (locationLabel && address?.label) locationLabel.textContent = address.label;
    } catch (error) {
        console.error('Shopping address sync error:', error);
    }
});
