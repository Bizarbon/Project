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

async function loadCustomers() {
    try {
        const res = await fetch(EP, { headers: auth.getHeaders() });
        const data = await res.json();

        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message || 'Lỗi từ server');

        const countEl = document.getElementById('customerCount');
        if (countEl) countEl.textContent = data.length;

        const tableBody = document.getElementById('customerTable');
        if (!tableBody) return;

        if (!data.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
                        Chưa có khách hàng nào
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = data.map((customer, index) => `
            <tr class="fade-in">
                <td style="font-weight:600;color:var(--text-muted);">${index + 1}</td>
                <td><strong>${escapeHTML(customer.name)}</strong></td>
                <td style="color:var(--primary);">${escapeHTML(customer.username || '-')}</td>
                <td>${escapeHTML(customer.phone || '-')}</td>
                <td style="color:var(--text-secondary);">${escapeHTML(customer.email || '-')}</td>
                <td style="color:var(--text-secondary);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(customer.address || '-')}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn-edit" onclick="editCustomer('${customer._id}')">Sửa</button>
                        <button class="btn-delete" onclick="deleteCustomer('${customer._id}')">Xóa</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        showToast('Lỗi tải danh sách khách hàng!', 'error');
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
