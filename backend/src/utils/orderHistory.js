const ORDER_ACTIONS = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
    PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
    PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
    SHIPPER_ASSIGNED: 'SHIPPER_ASSIGNED',
    SHIPPER_REASSIGNED: 'SHIPPER_REASSIGNED',
    SHIPPING_STATUS_CHANGED: 'SHIPPING_STATUS_CHANGED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    RETURN_REQUESTED: 'RETURN_REQUESTED',
    RETURN_COMPLETED: 'RETURN_COMPLETED',
    REFUND_CREATED: 'REFUND_CREATED',
    ADMIN_NOTE_ADDED: 'ADMIN_NOTE_ADDED',
    COD_COLLECTED: 'COD_COLLECTED',
    COD_RECONCILED: 'COD_RECONCILED'
};

const ORDER_STATUS_LABELS = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    processing: 'Đang chuẩn bị / Đóng gói',
    ready_to_ship: 'Chờ lấy hàng',
    shipping: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    delivery_failed: 'Giao thất bại',
    returned: 'Đã hoàn / Đổi trả',
    boom: 'Giao thất bại (Khách không nhận)',
    return_requested: 'Yêu cầu trả hàng'
};

const SHIPPING_STATUS_LABELS = {
    unassigned: 'Chưa phân công',
    assigned: 'Đã phân công shipper',
    waiting_pickup: 'Chờ lấy hàng',
    picked_up: 'Đã lấy hàng',
    delivering: 'Đang giao',
    delivered: 'Giao thành công',
    delivery_failed: 'Giao thất bại',
    returned: 'Đã hoàn hàng'
};

const PAYMENT_STATUS_LABELS = {
    unpaid: 'Chưa thanh toán',
    pending: 'Chờ xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
};

const CANCEL_REASONS = {
    customer_request: 'Khách yêu cầu hủy',
    out_of_stock: 'Hết hàng / Hết phân loại',
    cannot_contact: 'Không liên hệ được với người nhận',
    wrong_info: 'Sai thông tin giao hàng / giá',
    payment_failed: 'Thanh toán thất bại / Quá hạn',
    other: 'Lý do khác'
};

// State machine defining allowed transitions for orders
const ALLOWED_ORDER_TRANSITIONS = {
    pending: ['confirmed', 'processing', 'cancelled'],
    confirmed: ['processing', 'ready_to_ship', 'cancelled'],
    processing: ['ready_to_ship', 'shipping', 'cancelled'],
    ready_to_ship: ['shipping', 'cancelled'],
    shipping: ['completed', 'delivery_failed', 'returned', 'boom'],
    delivery_failed: ['shipping', 'returned', 'boom'],
    boom: ['shipping', 'returned'],
    completed: ['return_requested'],
    return_requested: ['returned', 'completed'],
    returned: [], // terminal
    cancelled: [] // terminal
};

function canTransitionOrderStatus(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;
    const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
}

function getStatusTitle(status) {
    switch (status) {
        case 'pending': return 'Đã tiếp nhận đơn hàng';
        case 'confirmed': return 'Đã xác nhận đơn hàng';
        case 'processing': return 'Đang kiểm hàng và đóng gói';
        case 'ready_to_ship': return 'Đã đóng gói - Chờ bàn giao';
        case 'shipping': return 'Đã bàn giao vận chuyển - Đang giao';
        case 'completed': return 'Giao hàng thành công';
        case 'cancelled': return 'Đơn hàng đã hủy';
        case 'delivery_failed': return 'Giao hàng không thành công';
        case 'boom': return 'Khách hàng từ chối nhận hàng';
        case 'return_requested': return 'Tiếp nhận yêu cầu đổi trả';
        case 'returned': return 'Đã hoàn kho đổi trả';
        default: return ORDER_STATUS_LABELS[status] || status;
    }
}

function addOrderHistory(order, {
    action,
    statusFrom = '',
    statusTo = '',
    user = null,
    note = '',
    metadata = {}
}) {
    if (!order) return;

    if (!Array.isArray(order.history)) {
        order.history = [];
    }

    const changedBy = user ? (user._id || user.id || null) : null;
    const changedByName = user ? (user.name || user.username || 'Quản trị viên') : 'Hệ thống';

    const historyEntry = {
        action: action || ORDER_ACTIONS.ORDER_STATUS_CHANGED,
        statusFrom: statusFrom || '',
        statusTo: statusTo || '',
        changedBy,
        changedByName,
        note: String(note || '').trim(),
        metadata: metadata || {},
        createdAt: new Date()
    };

    order.history.push(historyEntry);

    // Keep legacy statusHistory array in sync
    if (statusTo && (!order.statusHistory || !order.statusHistory.some(s => s.status === statusTo && Math.abs(new Date(s.occurredAt || 0) - Date.now()) < 2000))) {
        if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
        order.statusHistory.push({
            status: statusTo,
            title: getStatusTitle(statusTo),
            description: note || `Trạng thái được cập nhật bởi ${changedByName}.`,
            occurredAt: new Date()
        });
    }

    return historyEntry;
}

module.exports = {
    ORDER_ACTIONS,
    ORDER_STATUS_LABELS,
    SHIPPING_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
    CANCEL_REASONS,
    ALLOWED_ORDER_TRANSITIONS,
    canTransitionOrderStatus,
    getStatusTitle,
    addOrderHistory
};
