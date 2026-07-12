const COUPON_EP = API_URL + '/coupons';
let coupons = [];

function fmtCouponMoney(value) {
    return (Number(value) || 0).toLocaleString('vi-VN') + ' đ';
}

function couponToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

async function loadCoupons() {
    try {
        const res = await fetch(COUPON_EP, { headers: auth.getHeaders() });
        coupons = await res.json();
        if (!res.ok) throw new Error(coupons.message || 'Không tải được mã giảm giá');
        renderCoupons();
    } catch (error) {
        couponToast(error.message, 'error');
    }
}

function renderCoupons() {
    document.getElementById('couponCount').textContent = coupons.length;
    const tbody = document.getElementById('couponTableBody');
    if (!coupons.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">Chưa có mã giảm giá</td></tr>';
        return;
    }

    tbody.innerHTML = coupons.map(coupon => `
        <tr>
            <td><strong>${escapeHTML(coupon.code)}</strong></td>
            <td>${escapeHTML(coupon.name)}</td>
            <td>${coupon.type === 'percent' ? `${coupon.value}%` : fmtCouponMoney(coupon.value)}</td>
            <td>
                Tối thiểu ${fmtCouponMoney(coupon.minOrderValue)}
                ${coupon.maxDiscount ? `<br><span style="color:var(--text-muted)">Tối đa ${fmtCouponMoney(coupon.maxDiscount)}</span>` : ''}
            </td>
            <td>${coupon.usedCount || 0}${coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</td>
            <td><span class="status-badge ${coupon.active ? 'status-completed' : 'status-cancelled'}">${coupon.active ? 'Đang bật' : 'Tạm tắt'}</span></td>
            <td>
                <div class="td-actions">
                    <button class="btn-edit" onclick="editCoupon('${coupon._id}')">Sửa</button>
                    <button class="btn-delete" onclick="deleteCoupon('${coupon._id}')">Xóa</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function couponFormPayload() {
    return {
        code: document.getElementById('code').value.trim(),
        name: document.getElementById('name').value.trim(),
        type: document.getElementById('type').value,
        value: Number(document.getElementById('value').value),
        minOrderValue: Number(document.getElementById('minOrderValue').value || 0),
        maxDiscount: Number(document.getElementById('maxDiscount').value || 0),
        usageLimit: Number(document.getElementById('usageLimit').value || 0),
        active: document.getElementById('active').value === 'true'
    };
}

function resetCouponForm() {
    document.getElementById('couponForm').reset();
    document.getElementById('couponId').value = '';
    document.getElementById('couponFormTitle').textContent = 'Thêm mã giảm giá';
    document.getElementById('active').value = 'true';
}

function editCoupon(id) {
    const coupon = coupons.find(item => String(item._id) === String(id));
    if (!coupon) return;
    document.getElementById('couponId').value = coupon._id;
    document.getElementById('code').value = coupon.code;
    document.getElementById('name').value = coupon.name;
    document.getElementById('type').value = coupon.type;
    document.getElementById('value').value = coupon.value;
    document.getElementById('minOrderValue').value = coupon.minOrderValue || 0;
    document.getElementById('maxDiscount').value = coupon.maxDiscount || 0;
    document.getElementById('usageLimit').value = coupon.usageLimit || 0;
    document.getElementById('active').value = coupon.active ? 'true' : 'false';
    document.getElementById('couponFormTitle').textContent = 'Sửa mã giảm giá';
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteCoupon(id) {
    if (!confirm('Bạn có chắc muốn xóa mã giảm giá này?')) return;
    try {
        const res = await fetch(`${COUPON_EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Không xóa được mã giảm giá');
        couponToast('Đã xóa mã giảm giá');
        loadCoupons();
    } catch (error) {
        couponToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('couponForm').addEventListener('submit', async event => {
        event.preventDefault();
        const id = document.getElementById('couponId').value;
        try {
            const res = await fetch(id ? `${COUPON_EP}/${id}` : COUPON_EP, {
                method: id ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(couponFormPayload())
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Không lưu được mã giảm giá');
            couponToast(id ? 'Đã cập nhật mã giảm giá' : 'Đã tạo mã giảm giá');
            resetCouponForm();
            loadCoupons();
        } catch (error) {
            couponToast(error.message, 'error');
        }
    });
    loadCoupons();
});
