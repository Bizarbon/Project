function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const STAFF_PERMISSION_MODULES = [
    { key: 'dashboard', label: 'Dashboard (Tổng quan)', desc: 'Xem báo cáo doanh thu, KPI, biểu đồ', actions: ['view'] },
    { key: 'products', label: 'Sản phẩm & Kho hàng', desc: 'Danh mục, giá bán, biến thể, tồn kho', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'orders', label: 'Đơn hàng & Giao vận', desc: 'Tạo, duyệt, cập nhật trạng thái đơn 2H', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'customers', label: 'Khách hàng', desc: 'Hồ sơ thành viên, hạng khách, tặng voucher', actions: ['view', 'edit', 'delete'] },
    { key: 'staff', label: 'Nhân viên & Phân quyền', desc: 'Quản lý nhân sự, chức vụ, ma trận quyền', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'messages', label: 'Tin nhắn & Chatbox AI', desc: 'Xem hội thoại AI, đổi trạng thái & ghi chú', actions: ['view', 'edit'] },
    { key: 'blog', label: 'Blog & Tin tức', desc: 'Viết bài mới, biên tập, xuất bản, xóa bài', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'coupons', label: 'Khuyến mãi / Voucher', desc: 'Tạo mã giảm giá, sửa hạn mức, xóa mã', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'finance', label: 'Tài chính & Thu chi', desc: 'Quản lý phiếu thu chi, lợi nhuận vận hành', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'suppliers', label: 'Nhà cung cấp', desc: 'Đối tác nhập hàng, công nợ, đơn nhập', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'qa', label: 'Q&A & Đánh giá SP', desc: 'Xem câu hỏi khách hàng, trả lời, xóa spam', actions: ['view', 'edit', 'delete'] }
];

const ACTION_LABELS = {
    view: 'Xem',
    create: 'Thêm/Viết',
    edit: 'Sửa',
    delete: 'Xóa'
};

function buildEmptyPermissions() {
    const out = {};
    STAFF_PERMISSION_MODULES.forEach(m => {
        out[m.key] = {};
        m.actions.forEach(a => { out[m.key][a] = false; });
    });
    return out;
}

function buildFullPermissions() {
    const out = {};
    STAFF_PERMISSION_MODULES.forEach(m => {
        out[m.key] = {};
        m.actions.forEach(a => { out[m.key][a] = true; });
    });
    return out;
}

function buildPresetPermissions(preset) {
    const p = buildEmptyPermissions();
    if (preset === 'super_admin') return buildFullPermissions();
    if (preset === 'store_manager') {
        const full = buildFullPermissions();
        full.staff.delete = false;
        full.finance.delete = false;
        return full;
    }
    if (preset === 'sales_cskh') {
        p.dashboard.view = true;
        p.products.view = true;
        p.orders = { view: true, create: true, edit: true, delete: false };
        p.customers = { view: true, edit: true, delete: false };
        p.messages = { view: true, edit: true };
        p.coupons.view = true;
        p.qa = { view: true, edit: true, delete: false };
        return p;
    }
    if (preset === 'warehouse') {
        p.dashboard.view = true;
        p.products = { view: true, create: true, edit: true, delete: false };
        p.orders = { view: true, create: false, edit: true, delete: false };
        p.suppliers = { view: true, create: true, edit: true, delete: false };
        return p;
    }
    if (preset === 'content_marketing') {
        p.dashboard.view = true;
        p.products.view = true;
        p.blog = { view: true, create: true, edit: true, delete: true };
        p.coupons = { view: true, create: true, edit: true, delete: false };
        p.qa = { view: true, edit: true, delete: false };
        return p;
    }
    if (preset === 'accountant') {
        p.dashboard.view = true;
        p.orders.view = true;
        p.customers.view = true;
        p.finance = { view: true, create: true, edit: true, delete: false };
        p.suppliers.view = true;
        return p;
    }
    return p;
}

function normalizePermissions(raw, fallbackFull = false) {
    const base = fallbackFull ? buildFullPermissions() : buildEmptyPermissions();
    if (!raw || typeof raw !== 'object') return base;
    STAFF_PERMISSION_MODULES.forEach(m => {
        const inc = raw[m.key] && typeof raw[m.key] === 'object' ? raw[m.key] : {};
        let hasWrite = false;
        m.actions.forEach(a => {
            if (a === 'view') return;
            const val = Boolean(inc[a]);
            base[m.key][a] = val;
            if (val) hasWrite = true;
        });
        base[m.key].view = hasWrite ? true : Boolean(inc.view);
    });
    return base;
}

function presetForPosition(position) {
    const pos = String(position || '').toLowerCase();
    if (pos.includes('quản trị')) return 'super_admin';
    if (pos.includes('quản lý')) return 'store_manager';
    if (pos.includes('thu ngân') || pos.includes('kế toán')) return 'accountant';
    if (pos.includes('thủ kho')) return 'warehouse';
    if (pos.includes('biên tập') || pos.includes('blog') || pos.includes('marketing')) return 'content_marketing';
    return 'sales_cskh';
}

const DEFAULT_STAFF_MEMBERS = [
    {
        id: 1, code: 'NV001', name: 'Vũ Phi Long', email: 'vuphilong@techecommerce.vn', phone: '0912 345 678',
        department: 'Quản trị', position: 'Quản trị viên', shift: 'Toàn thời gian', status: 'active',
        isAdmin: true, rolePreset: 'super_admin', permissions: buildPresetPermissions('super_admin'), createdAt: '2026-01-15'
    },
    {
        id: 2, code: 'NV002', name: 'Nguyễn Văn A', email: 'nguyenvana@email.com', phone: '0987 654 321',
        department: 'Bán hàng', position: 'Quản lý cửa hàng', shift: 'Ca sáng (8h-16h)', status: 'active',
        isAdmin: false, rolePreset: 'store_manager', permissions: buildPresetPermissions('store_manager'), createdAt: '2026-02-01'
    },
    {
        id: 3, code: 'NV003', name: 'Trần Thị B', email: 'tranthib@email.com', phone: '0934 567 890',
        department: 'Quản trị', position: 'Thu ngân', shift: 'Toàn thời gian', status: 'active',
        isAdmin: false, rolePreset: 'accountant', permissions: buildPresetPermissions('accountant'), createdAt: '2026-02-15'
    },
    {
        id: 4, code: 'NV004', name: 'Lê Văn C', email: 'levanc@email.com', phone: '0945 678 901',
        department: 'Marketing', position: 'Biên tập viên Blog', shift: 'Ca tối (14h-22h)', status: 'active',
        isAdmin: false, rolePreset: 'content_marketing', permissions: buildPresetPermissions('content_marketing'), createdAt: '2026-03-01'
    },
    {
        id: 5, code: 'NV005', name: 'Phạm Thị D', email: 'phamthid@email.com', phone: '0956 789 012',
        department: 'CSKH', position: 'Nhân viên tư vấn', shift: 'Toàn thời gian', status: 'active',
        isAdmin: false, rolePreset: 'sales_cskh', permissions: buildPresetPermissions('sales_cskh'), createdAt: '2026-03-10'
    },
    {
        id: 6, code: 'NV006', name: 'Hoàng Văn E', email: 'hoangvane@email.com', phone: '0967 890 123',
        department: 'Kho vận', position: 'Thủ kho', shift: 'Ca sáng (8h-16h)', status: 'active',
        isAdmin: false, rolePreset: 'warehouse', permissions: buildPresetPermissions('warehouse'), createdAt: '2026-03-20'
    }
];

let staffList = [];
let filteredStaff = [];
let modalPermissions = buildEmptyPermissions();

function getApiBase() {
    return window.API_URL || `${window.location.origin}/api`;
}

function getAuthHeaders() {
    if (window.auth && typeof window.auth.getHeaders === 'function') {
        return window.auth.getHeaders();
    }
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

function getStoredStaffFallback() {
    try {
        const stored = localStorage.getItem('techStaffMembers');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(s => {
                    const preset = s.rolePreset || presetForPosition(s.position);
                    const hasPerms = s.permissions && Object.keys(s.permissions).length > 0;
                    return {
                        ...s,
                        rolePreset: preset,
                        permissions: hasPerms
                            ? normalizePermissions(s.permissions, false)
                            : buildPresetPermissions(preset)
                    };
                });
            }
        }
    } catch (e) {
        console.warn('Could not read techStaffMembers', e);
    }
    localStorage.setItem('techStaffMembers', JSON.stringify(DEFAULT_STAFF_MEMBERS));
    return DEFAULT_STAFF_MEMBERS.map(item => ({ ...item, permissions: normalizePermissions(item.permissions) }));
}

function saveStoredStaffFallback(list) {
    try {
        localStorage.setItem('techStaffMembers', JSON.stringify(list));
    } catch (e) {
        console.warn('Could not save techStaffMembers', e);
    }
}

async function fetchStaffList() {
    try {
        const res = await fetch(`${getApiBase()}/staff`, { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.staff)) {
                staffList = data.staff.map(s => ({
                    ...s,
                    id: Number(s.id || s._id),
                    permissions: normalizePermissions(s.permissions, s.rolePreset === 'super_admin')
                }));
                saveStoredStaffFallback(staffList);
                return;
            }
        }
    } catch (err) {
        console.warn('Fallback to local staff cache:', err.message);
    }
    staffList = getStoredStaffFallback();
}

function summarizePermissions(perms) {
    const norm = normalizePermissions(perms);
    const totalMods = STAFF_PERMISSION_MODULES.length;
    let totalPossibleActions = 0;
    let grantedActions = 0;
    const viewedModules = [];
    const writeTags = new Set();

    STAFF_PERMISSION_MODULES.forEach(m => {
        totalPossibleActions += m.actions.length;
        const mp = norm[m.key] || {};
        if (mp.view) viewedModules.push(m.label.split(' (')[0].split(' &')[0]);
        m.actions.forEach(a => {
            if (mp[a]) {
                grantedActions += 1;
                if (a !== 'view') writeTags.add(ACTION_LABELS[a]);
            }
        });
    });

    const isFull = grantedActions === totalPossibleActions;
    return {
        isFull,
        viewedCount: viewedModules.length,
        totalMods,
        grantedActions,
        totalPossibleActions,
        viewedPreview: viewedModules.slice(0, 3).join(', ') + (viewedModules.length > 3 ? ` +${viewedModules.length - 3}` : ''),
        actionSummary: writeTags.size ? `Xem · ${[...writeTags].join(', ')}` : (viewedModules.length ? 'Chỉ xem' : 'Chưa cấp quyền')
    };
}

function updateStaffKpis(list) {
    const totalEl = document.getElementById('staffMetricTotal');
    const adminEl = document.getElementById('staffMetricAdmin');
    const activeEl = document.getElementById('staffMetricActive');

    const total = list.length;
    const adminCount = list.filter(s => {
        const sum = summarizePermissions(s.permissions);
        return sum.isFull || s.rolePreset === 'super_admin' || String(s.position || '').includes('Quản trị');
    }).length;
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

    const canEdit = !window.auth?.canAction || window.auth.canAction('staff', 'edit');
    const canDelete = !window.auth?.canAction || window.auth.canAction('staff', 'delete');

    tbody.innerHTML = list.map(s => {
        const statusHtml = statusBadges[s.status] || statusBadges.active;
        const sum = summarizePermissions(s.permissions);
        const roleBadge = sum.isFull
            ? '<span style="display:inline-block; font-size:0.71rem; padding: 2px 6px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-radius: 4px; margin-top: 4px;">★ Toàn quyền hệ thống</span>'
            : '';

        const permPillClass = sum.isFull ? 'is-full' : (sum.viewedCount > 0 ? 'is-scoped' : 'is-none');
        const permPillText = sum.isFull
            ? `Toàn quyền (${sum.totalMods}/${sum.totalMods} mục)`
            : `${sum.viewedCount}/${sum.totalMods} mục · ${sum.grantedActions} quyền`;

        return `
            <tr>
                <td><strong style="color: var(--admin-blue-accent, #2563eb);">${escapeHTML(s.code)}</strong></td>
                <td>
                    <div style="font-weight: 700; color: var(--admin-text-main); font-size: 0.92rem;">${escapeHTML(s.name)}</div>
                    ${roleBadge}
                </td>
                <td>
                    <div style="color: var(--admin-text-main); font-weight: 600; font-size: 0.85rem;">${escapeHTML(s.position)}</div>
                    <span style="display: inline-block; margin-top: 4px; padding: 2px 7px; background: rgba(59, 130, 246, 0.14); color: var(--admin-blue-accent, #3b82f6); border-radius: 4px; font-size: 0.74rem; font-weight: 600;">
                        ${escapeHTML(s.department)}
                    </span>
                </td>
                <td>
                    <div class="staff-perm-summary">
                        <span class="staff-perm-pill ${permPillClass}">${escapeHTML(permPillText)}</span>
                        <span class="staff-perm-detail" title="${escapeHTML(sum.viewedPreview)}">${escapeHTML(sum.actionSummary)}${!sum.isFull && sum.viewedPreview ? ` (${escapeHTML(sum.viewedPreview)})` : ''}</span>
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.82rem; color: var(--admin-text-main); font-weight: 500;">✉ ${escapeHTML(s.email)}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-muted); margin-top: 2px;">☎ ${escapeHTML(s.phone)}</div>
                </td>
                <td style="color: var(--admin-text-main); font-size: 0.82rem;">${escapeHTML(s.shift)}</td>
                <td>${statusHtml}</td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; align-items: center;">
                        ${canEdit ? `
                        <button type="button" onclick="editStaffMember(${s.id}, true)" style="padding: 5px 9px; border-radius: 6px; border: 1px solid rgba(139, 92, 246, 0.35); background: rgba(139, 92, 246, 0.16); color: #a78bfa; font-size: 0.76rem; font-weight: 600; cursor: pointer;" title="Chỉnh phân quyền từng mục">
                            Phân quyền
                        </button>
                        <button type="button" onclick="editStaffMember(${s.id}, false)" style="padding: 5px 9px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 0.76rem; font-weight: 600; cursor: pointer;" title="Chỉnh sửa hồ sơ">
                            Sửa
                        </button>
                        <button type="button" onclick="toggleStaffStatus(${s.id})" style="padding: 5px 9px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: ${s.status === 'locked' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${s.status === 'locked' ? '#34d399' : '#fbbf24'}; font-size: 0.76rem; font-weight: 600; cursor: pointer;" title="${s.status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}">
                            ${s.status === 'locked' ? 'Mở' : 'Khóa'}
                        </button>` : ''}
                        ${canDelete ? `
                        <button type="button" onclick="deleteStaffMember(${s.id})" style="padding: 5px 9px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.76rem; font-weight: 600; cursor: pointer;" title="Xóa nhân viên">
                            Xóa
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPermissionMatrix() {
    const tbody = document.getElementById('staffPermissionMatrixBody');
    if (!tbody) return;

    tbody.innerHTML = STAFF_PERMISSION_MODULES.map(mod => {
        const modPerms = modalPermissions[mod.key] || {};
        const renderCell = (action) => {
            if (!mod.actions.includes(action)) {
                return '<td><span class="rbac-na-dash" aria-label="Không áp dụng">—</span></td>';
            }
            const checked = Boolean(modPerms[action]);
            const ariaTitle = `${ACTION_LABELS[action]} mục ${mod.label}`;
            return `
                <td>
                    <input type="checkbox"
                           class="rbac-checkbox"
                           data-mod="${mod.key}"
                           data-act="${action}"
                           ${checked ? 'checked' : ''}
                           aria-label="${escapeHTML(ariaTitle)}"
                           onchange="onPermissionCheckboxChange('${mod.key}', '${action}', this.checked)">
                </td>
            `;
        };

        return `
            <tr>
                <td>
                    <span class="rbac-module-name">${escapeHTML(mod.label)}</span>
                    <span class="rbac-module-desc">${escapeHTML(mod.desc)}</span>
                </td>
                ${renderCell('view')}
                ${renderCell('create')}
                ${renderCell('edit')}
                ${renderCell('delete')}
            </tr>
        `;
    }).join('');

    syncPermissionIndicators();
}

function syncPermissionIndicators() {
    const sum = summarizePermissions(modalPermissions);
    const pill = document.getElementById('rbacSummaryPill');
    if (pill) {
        pill.textContent = sum.isFull
            ? `Toàn quyền (${sum.totalMods}/${sum.totalMods} mục · ${sum.grantedActions} quyền)`
            : `Đang cấp: ${sum.viewedCount}/${sum.totalMods} mục · ${sum.grantedActions} quyền`;
    }

    ['view', 'create', 'edit', 'delete'].forEach(act => {
        const colBox = document.getElementById(`rbacColAll_${act}`);
        if (!colBox) return;
        const applicable = STAFF_PERMISSION_MODULES.filter(m => m.actions.includes(act));
        const checkedCount = applicable.filter(m => modalPermissions[m.key]?.[act]).length;
        colBox.checked = applicable.length > 0 && checkedCount === applicable.length;
        colBox.indeterminate = checkedCount > 0 && checkedCount < applicable.length;
    });

    const activePreset = document.getElementById('staffRolePreset')?.value || 'custom';
    document.querySelectorAll('.rbac-preset-btn[data-preset]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === activePreset);
    });
}

function onPermissionCheckboxChange(modKey, action, isChecked) {
    if (!modalPermissions[modKey]) modalPermissions[modKey] = {};
    modalPermissions[modKey][action] = Boolean(isChecked);

    const modDef = STAFF_PERMISSION_MODULES.find(m => m.key === modKey);
    if (modDef) {
        if (action !== 'view' && isChecked) {
            modalPermissions[modKey].view = true;
        } else if (action === 'view' && !isChecked) {
            modDef.actions.forEach(a => { modalPermissions[modKey][a] = false; });
        }
    }

    const presetInput = document.getElementById('staffRolePreset');
    if (presetInput) presetInput.value = 'custom';
    renderPermissionMatrix();
}

function togglePermissionColumn(action, isChecked) {
    STAFF_PERMISSION_MODULES.forEach(mod => {
        if (!mod.actions.includes(action)) return;
        if (!modalPermissions[mod.key]) modalPermissions[mod.key] = {};
        modalPermissions[mod.key][action] = Boolean(isChecked);
        if (action !== 'view' && isChecked) {
            modalPermissions[mod.key].view = true;
        } else if (action === 'view' && !isChecked) {
            mod.actions.forEach(a => { modalPermissions[mod.key][a] = false; });
        }
    });
    const presetInput = document.getElementById('staffRolePreset');
    if (presetInput) presetInput.value = 'custom';
    renderPermissionMatrix();
}

function applyRolePreset(presetKey) {
    modalPermissions = buildPresetPermissions(presetKey);
    const presetInput = document.getElementById('staffRolePreset');
    if (presetInput) presetInput.value = presetKey;
    renderPermissionMatrix();
}

function setBulkPermissions(mode) {
    modalPermissions = buildEmptyPermissions();
    if (mode === 'readonly') {
        STAFF_PERMISSION_MODULES.forEach(m => { modalPermissions[m.key].view = true; });
    }
    const presetInput = document.getElementById('staffRolePreset');
    if (presetInput) presetInput.value = 'custom';
    renderPermissionMatrix();
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

function openStaffModal(staff = null, focusPermissions = false) {
    const modal = document.getElementById('staffModal');
    const titleEl = document.getElementById('staffModalTitle');
    const form = document.getElementById('staffForm');
    if (!modal || !form) return;

    if (staff) {
        titleEl.textContent = focusPermissions
            ? `Phân quyền & Hồ sơ: ${staff.name}`
            : 'Chỉnh sửa hồ sơ nhân viên & Phân quyền';
        document.getElementById('editStaffId').value = staff.id;
        document.getElementById('staffFullName').value = staff.name || '';
        document.getElementById('staffCode').value = staff.code || '';
        document.getElementById('staffEmail').value = staff.email || '';
        document.getElementById('staffPhone').value = staff.phone || '';
        document.getElementById('staffDepartment').value = staff.department || 'Bán hàng';
        document.getElementById('staffPosition').value = staff.position || 'Nhân viên tư vấn';
        document.getElementById('staffShift').value = staff.shift || 'Toàn thời gian';
        document.getElementById('staffStatus').value = staff.status || 'active';
        const preset = staff.rolePreset || presetForPosition(staff.position);
        document.getElementById('staffRolePreset').value = preset;
        modalPermissions = normalizePermissions(staff.permissions, preset === 'super_admin');
    } else {
        titleEl.textContent = 'Thêm nhân viên mới & Cấp quyền';
        form.reset();
        document.getElementById('editStaffId').value = '';
        const nextNum = staffList.length ? Math.max(...staffList.map(s => Number(s.id) || 0)) + 1 : 1;
        document.getElementById('staffCode').value = `NV${String(nextNum).padStart(3, '0')}`;
        document.getElementById('staffStatus').value = 'active';
        document.getElementById('staffRolePreset').value = 'sales_cskh';
        modalPermissions = buildPresetPermissions('sales_cskh');
    }

    renderPermissionMatrix();

    if (typeof modal.showModal === 'function') {
        modal.showModal();
    } else {
        modal.setAttribute('open', '');
    }

    if (focusPermissions) {
        setTimeout(() => {
            document.getElementById('staffPermissionsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
    } else {
        const scrollBody = modal.querySelector('.dash-modal-scroll-body');
        if (scrollBody) scrollBody.scrollTop = 0;
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

function editStaffMember(id, focusPermissions = false) {
    const staff = staffList.find(s => Number(s.id) === Number(id));
    if (staff) openStaffModal(staff, focusPermissions);
}

async function saveStaffMember() {
    const idVal = document.getElementById('editStaffId').value;
    const name = (document.getElementById('staffFullName').value || '').trim();
    const code = (document.getElementById('staffCode').value || '').trim().toUpperCase();
    const email = (document.getElementById('staffEmail').value || '').trim().toLowerCase();
    const phone = (document.getElementById('staffPhone').value || '').trim();
    const department = document.getElementById('staffDepartment').value;
    const position = document.getElementById('staffPosition').value;
    const shift = document.getElementById('staffShift').value;
    const status = document.getElementById('staffStatus').value;
    const rolePreset = document.getElementById('staffRolePreset').value || 'custom';
    const permissions = normalizePermissions(modalPermissions, false);

    if (!name || !code || !email || !phone) return;

    const payload = { name, code, email, phone, department, position, shift, status, rolePreset, permissions };
    let savedFromServer = null;

    try {
        const url = idVal ? `${getApiBase()}/staff/${encodeURIComponent(idVal)}` : `${getApiBase()}/staff`;
        const method = idVal ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 400 || res.status === 403 || res.status === 409) {
                alert(data.message || 'Không thể lưu hồ sơ nhân viên.');
                return;
            }
        } else if (data.staff) {
            savedFromServer = data.staff;
        }
    } catch (err) {
        console.warn('API /staff unavailable, saving locally:', err.message);
    }

    if (idVal) {
        const targetId = Number(idVal);
        const idx = staffList.findIndex(s => Number(s.id) === targetId);
        if (idx !== -1) {
            staffList[idx] = savedFromServer || {
                ...staffList[idx],
                ...payload,
                isAdmin: rolePreset === 'super_admin' || position.includes('Quản trị')
            };
        }
    } else {
        const newId = savedFromServer?.id || (staffList.length ? Math.max(...staffList.map(s => Number(s.id) || 0)) + 1 : 1);
        staffList.unshift(savedFromServer || {
            id: newId,
            ...payload,
            isAdmin: rolePreset === 'super_admin' || position.includes('Quản trị'),
            createdAt: new Date().toISOString().slice(0, 10)
        });
    }

    saveStoredStaffFallback(staffList);

    // Nếu vừa cập nhật phân quyền của chính tài khoản đang đăng nhập -> cập nhật session ngay
    try {
        const currentUser = window.auth?.getUser?.();
        if (currentUser && currentUser.email && String(currentUser.email).toLowerCase() === email) {
            currentUser.permissions = permissions;
            localStorage.setItem('user', JSON.stringify(currentUser));
            if (typeof window.applyAdminPermissions === 'function') window.applyAdminPermissions();
        }
    } catch (_) { }

    updateStaffKpis(staffList);
    closeStaffModal();
    applyStaffFilters();
    if (typeof window.showToast === 'function') {
        window.showToast('Đã lưu hồ sơ & phân quyền nhân viên thành công!');
    }
}

async function toggleStaffStatus(id) {
    const staff = staffList.find(s => Number(s.id) === Number(id));
    if (!staff) return;

    const nextStatus = staff.status === 'locked' ? 'active' : 'locked';
    try {
        await fetch(`${getApiBase()}/staff/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: nextStatus })
        });
    } catch (_) { }

    staff.status = nextStatus;
    saveStoredStaffFallback(staffList);
    updateStaffKpis(staffList);
    applyStaffFilters();
}

async function deleteStaffMember(id) {
    const staff = staffList.find(s => Number(s.id) === Number(id));
    if (!staff) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${staff.name}" (${staff.code}) không?`)) return;

    try {
        const res = await fetch(`${getApiBase()}/staff/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok && (res.status === 403 || res.status === 400)) {
            const errData = await res.json().catch(() => ({}));
            alert(errData.message || 'Bạn không có quyền xóa nhân viên này.');
            return;
        }
    } catch (_) { }

    staffList = staffList.filter(s => Number(s.id) !== Number(id));
    saveStoredStaffFallback(staffList);
    updateStaffKpis(staffList);
    applyStaffFilters();
}

window.openStaffModal = openStaffModal;
window.closeStaffModal = closeStaffModal;
window.editStaffMember = editStaffMember;
window.saveStaffMember = saveStaffMember;
window.toggleStaffStatus = toggleStaffStatus;
window.deleteStaffMember = deleteStaffMember;
window.applyStaffFilters = applyStaffFilters;
window.resetStaffFilters = resetStaffFilters;
window.onPermissionCheckboxChange = onPermissionCheckboxChange;
window.togglePermissionColumn = togglePermissionColumn;
window.applyRolePreset = applyRolePreset;
window.setBulkPermissions = setBulkPermissions;

document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('staffSearchInput');
    const deptSelect = document.getElementById('staffDeptSelect');
    const statusSelect = document.getElementById('staffStatusSelect');
    if (searchInput) searchInput.addEventListener('input', applyStaffFilters);
    if (deptSelect) deptSelect.addEventListener('change', applyStaffFilters);
    if (statusSelect) statusSelect.addEventListener('change', applyStaffFilters);

    await fetchStaffList();
    filteredStaff = [...staffList];
    updateStaffKpis(staffList);
    renderStaffTable(filteredStaff);
});
