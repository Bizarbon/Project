const EP = API_URL + '/suppliers';

let editingId = null;

const policyLabels = {
    no_return: 'Không đổi trả',
    '7_days': '7 ngày',
    '15_days': '15 ngày',
    '30_days': '30 ngày',
    negotiable: 'Thỏa thuận'
};

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

async function loadSuppliers() {
    try {
        const res = await fetch(EP, { headers: auth.getHeaders() });
        const data = await res.json();
        renderCards(data);
        const countEl = document.getElementById('supplierCount');
        if (countEl) countEl.textContent = `(${data.length} nhà cung cấp)`;
    } catch (error) {
        document.getElementById('supplierCards').innerHTML =
            '<div class="empty-state"><p>Không thể kết nối server</p></div>';
    }
}

function renderCards(suppliers) {
    const container = document.getElementById('supplierCards');
    if (!container) return;

    if (!suppliers.length) {
        container.innerHTML = '<div class="empty-state"><p>Chưa có nhà cung cấp nào</p></div>';
        return;
    }

    container.innerHTML = suppliers.map(supplier => `
        <div class="supplier-card fade-in">
            <div class="supplier-card-header">
                <div class="supplier-name">${escapeHTML(supplier.name)}</div>
                <span class="policy-badge policy-${supplier.returnPolicy}">${policyLabels[supplier.returnPolicy] || supplier.returnPolicy}</span>
            </div>
            <ul class="supplier-info-list">
                ${supplier.phone ? `<li><span>Điện thoại</span><span>${escapeHTML(supplier.phone)}</span></li>` : ''}
                ${supplier.email ? `<li><span>Email</span><span>${escapeHTML(supplier.email)}</span></li>` : ''}
                ${supplier.address ? `<li><span>Địa chỉ</span><span>${escapeHTML(supplier.address)}</span></li>` : ''}
                <li><span>Giao hàng</span><span class="delivery-badge">Trong <strong>${supplier.deliveryTime}</strong> ngày</span></li>
            </ul>
            ${supplier.notes ? `<div class="supplier-notes">${escapeHTML(supplier.notes)}</div>` : ''}
            <div class="supplier-actions">
                <button class="btn-edit" onclick="editSupplier('${supplier._id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteSupplier('${supplier._id}', '${escapeHTML(supplier.name)}')">Xóa</button>
            </div>
        </div>
    `).join('');
}

const supplierForm = document.getElementById('supplierForm');
if (supplierForm) {
    supplierForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            name: document.getElementById('sName').value.trim(),
            phone: document.getElementById('sPhone').value.trim(),
            email: document.getElementById('sEmail').value.trim(),
            address: document.getElementById('sAddress').value.trim(),
            deliveryTime: parseInt(document.getElementById('sDelivery').value, 10) || 3,
            returnPolicy: document.getElementById('sPolicy').value,
            notes: document.getElementById('sNotes').value.trim()
        };

        if (!payload.name) {
            showToast('Vui lòng nhập tên nhà cung cấp!', 'error');
            return;
        }

        try {
            const url = editingId ? `${EP}/${editingId}` : EP;
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: auth.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(editingId ? 'Đã cập nhật nhà cung cấp!' : 'Đã thêm nhà cung cấp!');
                resetForm();
                loadSuppliers();
                return;
            }

            const err = await res.json();
            showToast(err.message || 'Lỗi lưu thông tin', 'error');
        } catch (error) {
            showToast('Có lỗi xảy ra. Thử lại sau!', 'error');
        }
    });
}

async function editSupplier(id) {
    try {
        const res = await fetch(`${EP}/${id}`, { headers: auth.getHeaders() });
        const supplier = await res.json();
        editingId = id;
        document.getElementById('sName').value = supplier.name || '';
        document.getElementById('sPhone').value = supplier.phone || '';
        document.getElementById('sEmail').value = supplier.email || '';
        document.getElementById('sAddress').value = supplier.address || '';
        document.getElementById('sDelivery').value = supplier.deliveryTime || 3;
        document.getElementById('sPolicy').value = supplier.returnPolicy || '7_days';
        document.getElementById('sNotes').value = supplier.notes || '';
        document.getElementById('formTitle').textContent = 'Chỉnh sửa nhà cung cấp';
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.textContent = 'Cập nhật';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast('Không tải được thông tin!', 'error');
    }
}

async function deleteSupplier(id, name) {
    if (!confirm(`Xóa nhà cung cấp "${name}"?`)) return;
    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        if (res.ok) {
            showToast('Đã xóa nhà cung cấp!');
            loadSuppliers();
            return;
        }

        const data = await res.json();
        showToast(data.message || 'Lỗi xóa nhà cung cấp!', 'error');
    } catch (error) {
        showToast('Có lỗi xảy ra!', 'error');
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('supplierForm').reset();
    document.getElementById('sDelivery').value = 3;
    document.getElementById('formTitle').textContent = 'Thêm nhà cung cấp mới';
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.textContent = 'Lưu thông tin';
}

document.addEventListener('DOMContentLoaded', loadSuppliers);
