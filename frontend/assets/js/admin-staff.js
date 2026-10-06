function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const DEFAULT_STAFF_MEMBERS = [
    {
        id: 1,
        code: 'NV001',
        name: 'Vũ Phi Long',
        email: 'vuphilong@shopmini.vn',
        phone: '0912 345 678',
        department: 'Quản trị',
        position: 'Quản trị viên',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-01-15'
    },
    {
        id: 2,
        code: 'NV002',
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@email.com',
        phone: '0987 654 321',
        department: 'Bán hàng',
        position: 'Quản lý cửa hàng',
        shift: 'Ca sáng (8h-16h)',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-02-01'
    },
    {
        id: 3,
        code: 'NV003',
        name: 'Trần Thị B',
        email: 'tranthib@email.com',
        phone: '0934 567 890',
        department: 'Quản trị',
        position: 'Thu ngân',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-02-15'
    },
    {
        id: 4,
        code: 'NV004',
        name: 'Lê Văn C',
        email: 'levanc@email.com',
        phone: '0945 678 901',
        department: 'Kỹ thuật',
        position: 'Kỹ thuật viên',
        shift: 'Ca tối (14h-22h)',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-03-01'
    },
    {
        id: 5,
        code: 'NV005',
        name: 'Phạm Thị D',
        email: 'phamthid@email.com',
        phone: '0956 789 012',
        department: 'CSKH',
        position: 'Nhân viên tư vấn',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-03-10'
    },
    {
        id: 6,
        code: 'NV006',
        name: 'Hoàng Văn E',
        email: 'hoangvane@email.com',
        phone: '0967 890 123',
        department: 'Kho vận',
        position: 'Thủ kho',
        shift: 'Ca sáng (8h-16h)',
        status: 'active',
        isAdmin: true,
        createdAt: '2026-03-20'
    }
];

let staffList = [];
let filteredStaff = [];

function getStoredStaff() {
    try {
        const stored = localStorage.getItem('techStaffMembers');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.warn('Could not read techStaffMembers', e);
    }
    localStorage.setItem('techStaffMembers', JSON.stringify(DEFAULT_STAFF_MEMBERS));
    return DEFAULT_STAFF_MEMBERS;
}

function saveStoredStaff(list) {
    try {
        localStorage.setItem('techStaffMembers', JSON.stringify(list));
    } catch (e) {
        console.warn('Could not save techStaffMembers', e);
    }
}

function updateStaffKpis(list) {
    const totalEl = document.getElementById('staffMetricTotal');
    const adminEl = document.getElementById('staffMetricAdmin');
    const activeEl = document.getElementById('staffMetricActive');

    const total = list.length;
    const adminCount = list.filter(s => s.isAdmin || s.position.includes('Quản trị')).length;
    const activeCount = list.filter(s => s.status === 'active').length;

    if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
    if (adminEl) adminEl.textContent = adminCount.toLocaleString('vi-VN');
    if (activeEl) activeEl.textContent = activeCount.toLocaleString('vi-VN');
}

function renderStaffTable(list) {
    const tbody = document.getElementById('staffTableBody');
    const countEl = document.getElementById('staffTableCount');
    if (countEl) countEl.textContent = list.length;
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading-row" style="padding: 32px; color: #94a3b8;">Không tìm thấy nhân viên nào phù hợp với bộ lọc.</td></tr>';
        return;
    }

    const statusBadges = {
        active: '<span class="status-badge status-completed" style="font-size: 0.78rem;">Đang làm việc</span>',
        leave: '<span class="status-badge status-shipping" style="font-size: 0.78rem;">Nghỉ phép</span>',
        locked: '<span class="status-badge status-boom" style="font-size: 0.78rem;">Tạm khóa</span>'
    };

    tbody.innerHTML = list.map(s => {
        const statusHtml = statusBadges[s.status] || statusBadges.active;
        const isSuper = s.isAdmin;
        const roleBadge = isSuper
            ? '<span style="display:inline-block; font-size:0.72rem; padding: 2px 6px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-radius: 4px; margin-top: 4px;">★ Quản trị viên</span>'
            : '';

        return `
            <tr>
                <td><strong style="color: var(--admin-blue-accent, #2563eb);">${escapeHTML(s.code)}</strong></td>
                <td>
                    <div style="font-weight: 700; color: var(--admin-text-main); font-size: 0.94rem;">${escapeHTML(s.name)}</div>
                    ${roleBadge}
                </td>
                <td>
                    <div style="color: var(--admin-text-main); font-weight: 500;">${escapeHTML(s.position)}</div>
                </td>
                <td>
                    <span style="display: inline-block; padding: 3px 8px; background: rgba(59, 130, 246, 0.15); color: var(--admin-blue-accent, #2563eb); border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                        ${escapeHTML(s.department)}
                    </span>
                </td>
                <td>
                    <div style="font-size: 0.84rem; color: var(--admin-text-main); font-weight: 500;">✉ ${escapeHTML(s.email)}</div>
                    <div style="font-size: 0.82rem; color: var(--admin-text-muted); margin-top: 2px;">☎ ${escapeHTML(s.phone)}</div>
                </td>
                <td style="color: var(--admin-text-main); font-size: 0.84rem;">${escapeHTML(s.shift)}</td>
                <td>${statusHtml}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button type="button" onclick="editStaffMember(${s.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Chỉnh sửa hồ sơ">
                            Sửa
                        </button>
                        <button type="button" onclick="toggleStaffStatus(${s.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: ${s.status === 'locked' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${s.status === 'locked' ? '#34d399' : '#f87171'}; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="${s.status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}">
                            ${s.status === 'locked' ? 'Mở' : 'Khóa'}
                        </button>
                        <button type="button" onclick="deleteStaffMember(${s.id})" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="Xóa nhân viên">
                            Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function applyStaffFilters() {
    const query = (document.getElementById('staffSearchInput')?.value || '').trim().toLowerCase();
    const dept = document.getElementById('staffDeptSelect')?.value || 'all';
    const status = document.getElementById('staffStatusSelect')?.value || 'all';

    filteredStaff = staffList.filter(s => {
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();

        const matchQuery = !query || name.includes(query) || code.includes(query) || email.includes(query) || phone.includes(query);
        const matchDept = dept === 'all' || s.department === dept;
        const matchStatus = status === 'all' || s.status === status;

        return matchQuery && matchDept && matchStatus;
    });

    renderStaffTable(filteredStaff);
}

function resetStaffFilters() {
    const form = document.getElementById('staffFilterForm');
    if (form) form.reset();
    filteredStaff = [...staffList];
    renderStaffTable(filteredStaff);
}

function openStaffModal(staff = null) {
    const modal = document.getElementById('staffModal');
    const titleEl = document.getElementById('staffModalTitle');
    const form = document.getElementById('staffForm');
    if (!modal || !form) return;

    if (staff) {
        titleEl.textContent = 'Chỉnh sửa hồ sơ nhân viên';
        document.getElementById('editStaffId').value = staff.id;
        document.getElementById('staffFullName').value = staff.name;
        document.getElementById('staffCode').value = staff.code;
        document.getElementById('staffEmail').value = staff.email;
        document.getElementById('staffPhone').value = staff.phone;
        document.getElementById('staffDepartment').value = staff.department;
        document.getElementById('staffPosition').value = staff.position;
        document.getElementById('staffShift').value = staff.shift;
        document.getElementById('staffStatus').value = staff.status;
    } else {
        titleEl.textContent = 'Thêm nhân viên mới';
        form.reset();
        document.getElementById('editStaffId').value = '';
        const nextNum = staffList.length + 1;
        document.getElementById('staffCode').value = `NV${String(nextNum).padStart(3, '0')}`;
        document.getElementById('staffStatus').value = 'active';
    }

    if (typeof modal.showModal === 'function') {
        modal.showModal();
    } else {
        modal.setAttribute('open', '');
    }
}

function closeStaffModal() {
    const modal = document.getElementById('staffModal');
    if (!modal) return;
    if (typeof modal.close === 'function') {
        modal.close();
    } else {
        modal.removeAttribute('open');
    }
}

function editStaffMember(id) {
    const staff = staffList.find(s => s.id === id);
    if (staff) openStaffModal(staff);
}

function saveStaffMember() {
    const idVal = document.getElementById('editStaffId').value;
    const name = (document.getElementById('staffFullName').value || '').trim();
    const code = (document.getElementById('staffCode').value || '').trim();
    const email = (document.getElementById('staffEmail').value || '').trim();
    const phone = (document.getElementById('staffPhone').value || '').trim();
    const department = document.getElementById('staffDepartment').value;
    const position = document.getElementById('staffPosition').value;
    const shift = document.getElementById('staffShift').value;
    const status = document.getElementById('staffStatus').value;

    if (!name || !code || !email || !phone) return;

    if (idVal) {
        const targetId = Number(idVal);
        const idx = staffList.findIndex(s => s.id === targetId);
        if (idx !== -1) {
            staffList[idx] = {
                ...staffList[idx],
                name,
                code,
                email,
                phone,
                department,
                position,
                shift,
                status,
                isAdmin: position.includes('Quản trị') || staffList[idx].isAdmin
            };
        }
    } else {
        const newId = staffList.length ? Math.max(...staffList.map(s => s.id)) + 1 : 1;
        const newStaff = {
            id: newId,
            code,
            name,
            email,
            phone,
            department,
            position,
            shift,
            status,
            isAdmin: position.includes('Quản trị'),
            createdAt: new Date().toISOString().slice(0, 10)
        };
        staffList.unshift(newStaff);
    }

    saveStoredStaff(staffList);
    updateStaffKpis(staffList);
    closeStaffModal();
    applyStaffFilters();
}

function toggleStaffStatus(id) {
    const staff = staffList.find(s => s.id === id);
    if (!staff) return;

    staff.status = staff.status === 'locked' ? 'active' : 'locked';
    saveStoredStaff(staffList);
    updateStaffKpis(staffList);
    applyStaffFilters();
}

function deleteStaffMember(id) {
    const staff = staffList.find(s => s.id === id);
    if (!staff) return;

    if (confirm(`Bạn có chắc chắn muốn xóa nhân viên "${staff.name}" (${staff.code}) không?`)) {
        staffList = staffList.filter(s => s.id !== id);
        saveStoredStaff(staffList);
        updateStaffKpis(staffList);
        applyStaffFilters();
    }
}

window.openStaffModal = openStaffModal;
window.closeStaffModal = closeStaffModal;
window.editStaffMember = editStaffMember;
window.saveStaffMember = saveStaffMember;
window.toggleStaffStatus = toggleStaffStatus;
window.deleteStaffMember = deleteStaffMember;
window.applyStaffFilters = applyStaffFilters;
window.resetStaffFilters = resetStaffFilters;

document.addEventListener('DOMContentLoaded', () => {
    staffList = getStoredStaff();
    filteredStaff = [...staffList];
    updateStaffKpis(staffList);
    renderStaffTable(filteredStaff);
});
