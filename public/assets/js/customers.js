const EP = API_URL + '/customers';

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

let allCustomers = [];
let currentSegmentFilter = 'all';

async function loadCustomers() {
    try {
        const res = await fetch(`${EP}/rfm-segmentation`, { headers: auth.getHeaders() });
        const data = await res.json();

        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message || 'Lỗi từ server');

        allCustomers = data.customers || [];

        // Update RFM counts
        if (data.summary) {
            const countEl = document.getElementById('customerCount');
            if (countEl) countEl.textContent = data.summary.total || allCustomers.length;
            const vipEl = document.getElementById('rfmVipCount');
            if (vipEl) vipEl.textContent = data.summary.champion || 0;
            const potEl = document.getElementById('rfmPotentialCount');
            if (potEl) potEl.textContent = data.summary.potential || 0;
            const riskEl = document.getElementById('rfmAtRiskCount');
            if (riskEl) riskEl.textContent = data.summary.at_risk || 0;
            const newEl = document.getElementById('rfmNewCount');
            if (newEl) newEl.textContent = data.summary.new || 0;
        }

        renderCustomerTable();
    } catch (error) {
        console.error('Error:', error);
        showToast('Lỗi tải dữ liệu khách hàng RFM!', 'error');
    }
}

function filterBySegment(segment, btn) {
    currentSegmentFilter = segment;
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCustomerTable();
}

function renderCustomerTable() {
    const tableBody = document.getElementById('customerTable');
    if (!tableBody) return;

    let filtered = allCustomers;
    if (currentSegmentFilter !== 'all') {
        filtered = allCustomers.filter(c => c.segment === currentSegmentFilter);
    }

    if (!filtered.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                    Không có khách hàng nào trong phân khúc này.
                </td>
            </tr>`;
        return;
    }

    const badgeStyles = {
        champion: 'background:rgba(245, 158, 11, 0.15); color:#f59e0b; border:1px solid rgba(245, 158, 11, 0.3);',
        potential: 'background:rgba(47, 128, 237, 0.15); color:var(--primary); border:1px solid rgba(47, 128, 237, 0.3);',
        at_risk: 'background:rgba(239, 68, 68, 0.15); color:var(--danger); border:1px solid rgba(239, 68, 68, 0.3);',
        new: 'background:rgba(16, 185, 129, 0.15); color:var(--success); border:1px solid rgba(16, 185, 129, 0.3);',
        lead: 'background:rgba(150, 150, 150, 0.15); color:var(--text-muted); border:1px solid rgba(150, 150, 150, 0.3);'
    };

    tableBody.innerHTML = filtered.map((customer, index) => {
        const segStyle = badgeStyles[customer.segment] || badgeStyles.lead;
        const totalSpentText = (customer.totalSpent || 0).toLocaleString('vi-VN') + ' đ';
        const recencyText = customer.daysSinceLastOrder !== null
            ? (customer.daysSinceLastOrder === 0 ? 'Hôm nay' : `${customer.daysSinceLastOrder} ngày trước`)
            : 'Chưa mua hàng';

        return `
            <tr class="fade-in">
                <td style="font-weight:600;color:var(--text-muted);">${index + 1}</td>
                <td>
                    <div style="font-weight:700; color:var(--text-primary);">${escapeHTML(customer.name)}</div>
                    <small style="color:var(--text-muted);">@${escapeHTML(customer.username || '')}</small>
                </td>
                <td>
                    <span style="display:inline-block; padding:0.25rem 0.6rem; border-radius:50px; font-size:0.75rem; font-weight:700; ${segStyle}">
                        ${escapeHTML(customer.segmentLabel || 'Khách hàng')}
                    </span>
                </td>
                <td>
                    <div style="font-weight:700; color:var(--primary);">${totalSpentText}</div>
                    <small style="color:var(--text-secondary);">${customer.orderCount || 0} đơn hoàn thành</small>
                </td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">
                    ${escapeHTML(recencyText)}
                </td>
                <td>
                    <div style="font-size:0.85rem;">📞 ${escapeHTML(customer.phone || '-')}</div>
                    <small style="color:var(--text-muted);">✉️ ${escapeHTML(customer.email || '-')}</small>
                </td>
                <td>
                    <div class="td-actions" style="display:flex; gap:0.4rem;">
                        <button type="button" class="btn-sm btn-secondary" title="Tặng voucher ưu đãi" onclick="openSingleVoucherModal('${customer._id}', '${escapeHTML(customer.name)}')">
                            🎁 Tặng mã
                        </button>
                        <button class="btn-edit" onclick="editCustomer('${customer._id}')">Sửa</button>
                        <button class="btn-delete" onclick="deleteCustomer('${customer._id}')">Xóa</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openVoucherModal(segment, code, value, type, name) {
    const dialog = document.getElementById('voucherDialog');
    if (!dialog) return;
    document.getElementById('vSegment').value = segment;
    document.getElementById('vCode').value = code;
    document.getElementById('vName').value = name;
    document.getElementById('vType').value = type;
    document.getElementById('vValue').value = value;
    document.getElementById('voucherDialogTitle').textContent = `🎁 Phát hành Voucher cho nhóm ${segment.toUpperCase()}`;
    dialog.showModal();
}

function openSingleVoucherModal(customerId, customerName) {
    const dialog = document.getElementById('voucherDialog');
    if (!dialog) return;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `VIP-${customerName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${randomSuffix}`;
    document.getElementById('vSegment').value = `customer_${customerId}`;
    document.getElementById('vCode').value = code;
    document.getElementById('vName').value = `Ưu đãi riêng cho khách ${customerName}`;
    document.getElementById('vType').value = 'percent';
    document.getElementById('vValue').value = 10;
    document.getElementById('voucherDialogTitle').textContent = `🎁 Tặng mã riêng cho khách: ${customerName}`;
    dialog.showModal();
}

async function submitVoucherCampaign() {
    const dialog = document.getElementById('voucherDialog');
    const segment = document.getElementById('vSegment').value;
    const code = document.getElementById('vCode').value;
    const name = document.getElementById('vName').value;
    const type = document.getElementById('vType').value;
    const value = document.getElementById('vValue').value;
    const minOrderValue = document.getElementById('vMinOrder').value;

    try {
        const res = await fetch(`${EP}/send-segment-voucher`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify({ segment, code, name, type, value, minOrderValue })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi khi gửi voucher');

        showToast(`Đã phát hành mã ${code} thành công!`);
        if (dialog) dialog.close();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

const customerForm = document.getElementById('customerForm');
if (customerForm) {
    customerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const id = document.getElementById('customerId').value;
        const data = {
            name: document.getElementById('name').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim()
        };
        const password = document.getElementById('password').value;
        if (!id && !password) {
            showToast('Vui lòng nhập mật khẩu ban đầu cho khách hàng.', 'error');
            return;
        }
        if (password) data.password = password;

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${EP}/${id}` : EP;
            const res = await fetch(url, {
                method,
                headers: auth.getHeaders(),
                body: JSON.stringify(data)
            });

            if (res.ok) {
                showToast(id ? 'Cập nhật thành công!' : 'Thêm khách hàng thành công!');
                resetForm();
                loadCustomers();
                return;
            }

            const err = await res.json();
            showToast(err.message || 'Có lỗi khi lưu thông tin!', 'error');
        } catch (error) {
            console.error('Error:', error);
            showToast('Có lỗi xảy ra!', 'error');
        }
    });
}

async function editCustomer(id) {
    try {
        const res = await fetch(`${EP}/${id}`, { headers: auth.getHeaders() });
        const customer = await res.json();

        document.getElementById('customerId').value = customer._id;
        document.getElementById('name').value = customer.name || '';
        document.getElementById('username').value = customer.username || '';
        document.getElementById('email').value = customer.email || '';
        document.getElementById('phone').value = customer.phone || '';
        document.getElementById('address').value = customer.address || '';
        document.getElementById('formTitle').textContent = 'Sửa khách hàng';

        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error:', error);
        showToast('Không tải được thông tin khách hàng!', 'error');
    }
}

async function deleteCustomer(id) {
    if (!confirm('Xóa khách hàng này?')) return;

    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        if (res.ok) {
            showToast('Đã xóa khách hàng!');
            loadCustomers();
            return;
        }

        const data = await res.json();
        showToast(data.message || 'Lỗi xóa khách hàng!', 'error');
    } catch (error) {
        console.error('Error:', error);
        showToast('Lỗi xóa khách hàng!', 'error');
    }
}

function resetForm() {
    document.getElementById('customerForm').reset();
    document.getElementById('customerId').value = '';
    document.getElementById('formTitle').textContent = 'Thêm khách hàng mới';
}

document.addEventListener('DOMContentLoaded', loadCustomers);
