const express = require('express');
const router = express.Router();
const StaffMember = require('../models/StaffMember');
const Customer = require('../models/Customer');
const { protect, admin } = require('../middleware/auth');

const MODULE_ACTIONS = {
    dashboard: ['view'],
    products: ['view', 'create', 'edit', 'delete'],
    orders: ['view', 'create', 'edit', 'delete'],
    customers: ['view', 'edit', 'delete'],
    staff: ['view', 'create', 'edit', 'delete'],
    messages: ['view', 'edit'],
    blog: ['view', 'create', 'edit', 'delete'],
    coupons: ['view', 'create', 'edit', 'delete'],
    finance: ['view', 'create', 'edit', 'delete'],
    suppliers: ['view', 'create', 'edit', 'delete'],
    qa: ['view', 'edit', 'delete']
};

function buildFullPermissions() {
    const out = {};
    for (const [mod, actions] of Object.entries(MODULE_ACTIONS)) {
        out[mod] = {};
        for (const act of actions) out[mod][act] = true;
    }
    return out;
}

function buildEmptyPermissions() {
    const out = {};
    for (const [mod, actions] of Object.entries(MODULE_ACTIONS)) {
        out[mod] = {};
        for (const act of actions) out[mod][act] = false;
    }
    return out;
}

function normalizePermissions(raw = {}, fallbackFull = false) {
    const base = fallbackFull ? buildFullPermissions() : buildEmptyPermissions();
    if (!raw || typeof raw !== 'object') return base;

    for (const [mod, actions] of Object.entries(MODULE_ACTIONS)) {
        const incoming = raw[mod] && typeof raw[mod] === 'object' ? raw[mod] : {};
        let hasWrite = false;
        for (const act of actions) {
            if (act === 'view') continue;
            const val = Boolean(incoming[act]);
            base[mod][act] = val;
            if (val) hasWrite = true;
        }
        base[mod].view = hasWrite ? true : Boolean(incoming.view);
    }
    return base;
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

const DEFAULT_STAFF_SEED = [
    {
        code: 'NV001',
        name: 'Vũ Phi Long',
        email: 'vuphilong@techecommerce.vn',
        phone: '0912 345 678',
        department: 'Quản trị',
        position: 'Quản trị viên',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: true,
        rolePreset: 'super_admin',
        permissions: buildPresetPermissions('super_admin')
    },
    {
        code: 'NV002',
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@email.com',
        phone: '0987 654 321',
        department: 'Bán hàng',
        position: 'Quản lý cửa hàng',
        shift: 'Ca sáng (8h-16h)',
        status: 'active',
        isAdmin: false,
        rolePreset: 'store_manager',
        permissions: buildPresetPermissions('store_manager')
    },
    {
        code: 'NV003',
        name: 'Trần Thị B',
        email: 'tranthib@email.com',
        phone: '0934 567 890',
        department: 'Quản trị',
        position: 'Thu ngân',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: false,
        rolePreset: 'accountant',
        permissions: buildPresetPermissions('accountant')
    },
    {
        code: 'NV004',
        name: 'Lê Văn C',
        email: 'levanc@email.com',
        phone: '0945 678 901',
        department: 'Kỹ thuật',
        position: 'Kỹ thuật viên',
        shift: 'Ca tối (14h-22h)',
        status: 'active',
        isAdmin: false,
        rolePreset: 'content_marketing',
        permissions: buildPresetPermissions('content_marketing')
    },
    {
        code: 'NV005',
        name: 'Phạm Thị D',
        email: 'phamthid@email.com',
        phone: '0956 789 012',
        department: 'CSKH',
        position: 'Nhân viên tư vấn',
        shift: 'Toàn thời gian',
        status: 'active',
        isAdmin: false,
        rolePreset: 'sales_cskh',
        permissions: buildPresetPermissions('sales_cskh')
    },
    {
        code: 'NV006',
        name: 'Hoàng Văn E',
        email: 'hoangvane@email.com',
        phone: '0967 890 123',
        department: 'Kho vận',
        position: 'Thủ kho',
        shift: 'Ca sáng (8h-16h)',
        status: 'active',
        isAdmin: false,
        rolePreset: 'warehouse',
        permissions: buildPresetPermissions('warehouse')
    }
];

async function ensureDefaultStaffSeeded() {
    const count = await StaffMember.countDocuments();
    if (count > 0) return;
    for (const item of DEFAULT_STAFF_SEED) {
        try {
            await new StaffMember(item).save();
        } catch (err) {
            if (err?.code !== 11000) console.warn('Seed staff item error:', err.message);
        }
    }
}

function serializeStaff(doc) {
    const isSuper = Boolean(doc.isAdmin && doc.rolePreset === 'super_admin');
    return {
        id: doc._id,
        _id: doc._id,
        code: doc.code,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        department: doc.department,
        position: doc.position,
        shift: doc.shift,
        status: doc.status || 'active',
        isAdmin: Boolean(doc.isAdmin),
        rolePreset: doc.rolePreset || (isSuper ? 'super_admin' : 'custom'),
        permissions: normalizePermissions(doc.permissions, isSuper),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : ''
    };
}

async function syncPermissionsToCustomer(staffDoc) {
    if (!staffDoc?.email) return;
    const emailNorm = String(staffDoc.email).trim().toLowerCase();
    const customer = await Customer.findOne({ email: emailNorm });
    if (!customer) return;

    const isSuper = Boolean(staffDoc.isAdmin && staffDoc.rolePreset === 'super_admin');
    const perms = normalizePermissions(staffDoc.permissions, isSuper);
    const hasAnyView = Object.values(perms).some(m => m && m.view);

    if (staffDoc.status === 'locked') {
        customer.active = false;
        customer.tokenVersion = Number(customer.tokenVersion || 0) + 1;
    } else {
        customer.active = true;
    }

    if (isSuper || hasAnyView) {
        customer.isAdmin = true;
        customer.role = isSuper ? 'admin' : 'staff';
        customer.permissions = isSuper ? null : perms;
    } else {
        customer.isAdmin = false;
        customer.role = 'customer';
        customer.permissions = null;
        customer.tokenVersion = Number(customer.tokenVersion || 0) + 1;
    }
    customer.markModified('permissions');
    await customer.save();
}

async function revokeStaffCustomerAccess(email) {
    if (!email) return;
    const customer = await Customer.findOne({ email: String(email).trim().toLowerCase() });
    if (!customer) return;
    customer.isAdmin = false;
    customer.role = 'customer';
    customer.permissions = null;
    customer.tokenVersion = Number(customer.tokenVersion || 0) + 1;
    customer.markModified('permissions');
    await customer.save();
}

function requireStaffAction(action) {
    return (req, res, next) => {
        const perms = req.user?.permissions;
        if (!perms || typeof perms !== 'object') return next(); // Super admin (no restricted matrix)
        if (perms.staff && perms.staff[action]) return next();
        return res.status(403).json({ message: 'Tài khoản của bạn không có quyền thực hiện thao tác này trong mục Nhân viên.' });
    };
}

// GET /api/staff
router.get('/', protect, admin, requireStaffAction('view'), async (req, res) => {
    try {
        await ensureDefaultStaffSeeded();
        const docs = await StaffMember.find().sort({ _id: 1 }).lean();
        res.json({ staff: docs.map(serializeStaff) });
    } catch (error) {
        console.error('GET /api/staff error:', error);
        res.status(500).json({ message: 'Không thể tải danh sách nhân viên.' });
    }
});

// POST /api/staff
router.post('/', protect, admin, requireStaffAction('create'), async (req, res) => {
    try {
        const { name, code, email, phone, department, position, shift, status, rolePreset, permissions } = req.body || {};
        if (!name || !code || !email || !phone) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ Họ tên, Mã NV, Email và Số điện thoại.' });
        }

        const cleanCode = String(code).trim().toUpperCase();
        const existing = await StaffMember.findOne({ code: cleanCode });
        if (existing) {
            return res.status(409).json({ message: `Mã nhân viên "${cleanCode}" đã tồn tại.` });
        }

        const preset = String(rolePreset || 'custom').trim();
        const isSuper = preset === 'super_admin' || String(position || '').includes('Quản trị');
        const normalizedPerms = normalizePermissions(
            permissions && Object.keys(permissions).length ? permissions : buildPresetPermissions(preset),
            isSuper && (!permissions || !Object.keys(permissions).length)
        );

        const created = await new StaffMember({
            code: cleanCode,
            name: String(name).trim(),
            email: String(email).trim().toLowerCase(),
            phone: String(phone).trim(),
            department: String(department || 'Bán hàng').trim(),
            position: String(position || 'Nhân viên tư vấn').trim(),
            shift: String(shift || 'Toàn thời gian').trim(),
            status: ['active', 'leave', 'locked'].includes(status) ? status : 'active',
            isAdmin: isSuper,
            rolePreset: preset,
            permissions: normalizedPerms
        }).save();

        await syncPermissionsToCustomer(created);
        res.status(201).json({ message: 'Đã thêm nhân viên và phân quyền thành công.', staff: serializeStaff(created) });
    } catch (error) {
        console.error('POST /api/staff error:', error);
        res.status(500).json({ message: 'Không thể tạo hồ sơ nhân viên.' });
    }
});

// PUT /api/staff/:id
router.put('/:id', protect, admin, requireStaffAction('edit'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const doc = await StaffMember.findById(id);
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy hồ sơ nhân viên.' });

        const { name, code, email, phone, department, position, shift, status, rolePreset, permissions } = req.body || {};
        if (code && String(code).trim().toUpperCase() !== doc.code) {
            const dup = await StaffMember.findOne({ code: String(code).trim().toUpperCase(), _id: { $ne: id } });
            if (dup) return res.status(409).json({ message: `Mã nhân viên "${code}" đã được sử dụng.` });
            doc.code = String(code).trim().toUpperCase();
        }
        if (name) doc.name = String(name).trim();
        if (email) doc.email = String(email).trim().toLowerCase();
        if (phone) doc.phone = String(phone).trim();
        if (department) doc.department = String(department).trim();
        if (position) doc.position = String(position).trim();
        if (shift) doc.shift = String(shift).trim();
        if (['active', 'leave', 'locked'].includes(status)) doc.status = status;

        const nextPreset = String(rolePreset || doc.rolePreset || 'custom').trim();
        doc.rolePreset = nextPreset;
        doc.isAdmin = nextPreset === 'super_admin' || String(doc.position || '').includes('Quản trị');

        if (permissions && typeof permissions === 'object') {
            doc.permissions = normalizePermissions(permissions, false);
            doc.markModified('permissions');
        }

        await doc.save();
        await syncPermissionsToCustomer(doc);
        res.json({ message: 'Đã cập nhật hồ sơ và phân quyền nhân viên.', staff: serializeStaff(doc) });
    } catch (error) {
        console.error('PUT /api/staff/:id error:', error);
        res.status(500).json({ message: 'Không thể cập nhật hồ sơ nhân viên.' });
    }
});

// PATCH /api/staff/:id/status
router.patch('/:id/status', protect, admin, requireStaffAction('edit'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const doc = await StaffMember.findById(id);
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy hồ sơ nhân viên.' });

        const nextStatus = ['active', 'leave', 'locked'].includes(req.body?.status)
            ? req.body.status
            : (doc.status === 'locked' ? 'active' : 'locked');
        doc.status = nextStatus;
        await doc.save();
        await syncPermissionsToCustomer(doc);
        res.json({ message: 'Đã cập nhật trạng thái nhân viên.', staff: serializeStaff(doc) });
    } catch (error) {
        console.error('PATCH /api/staff/:id/status error:', error);
        res.status(500).json({ message: 'Không thể cập nhật trạng thái nhân viên.' });
    }
});

// DELETE /api/staff/:id
router.delete('/:id', protect, admin, requireStaffAction('delete'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const deleted = await StaffMember.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Không tìm thấy hồ sơ nhân viên.' });
        await revokeStaffCustomerAccess(deleted.email);
        res.json({ message: 'Đã xóa hồ sơ nhân viên và thu hồi quyền quản trị.' });
    } catch (error) {
        console.error('DELETE /api/staff/:id error:', error);
        res.status(500).json({ message: 'Không thể xóa hồ sơ nhân viên.' });
    }
});

module.exports = router;
module.exports.MODULE_ACTIONS = MODULE_ACTIONS;
module.exports.normalizePermissions = normalizePermissions;
module.exports.buildFullPermissions = buildFullPermissions;
