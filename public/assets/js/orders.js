const EP = API_URL + '/orders';
let allLoadedOrders = [];

const statusLabels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    returned: 'Hoàn/Đổi trả',
    boom: 'Khách boom',
    cancelled: 'Đã hủy'
};

const paymentLabels = {
    unpaid: 'Chưa thanh toán',
    pending: 'Chờ xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
};

const methodLabels = {
    cod: 'COD',
    bank_transfer: 'Chuyển khoản',
    vnpay: 'VNPay',
    momo: 'MoMo',
    installment: 'Trả góp',
    ShipCOD: 'COD',
    'Thanh toán trước': 'Chuyển khoản',
    'Trả góp': 'Trả góp'
};

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

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

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadOrders() {
    try {
        const res = await fetch(EP, { headers: auth.getHeaders() });
        const data = await res.json();
        if (auth.handleApiError(res, data)) return;
        if (!res.ok) throw new Error(data.message || 'Lỗi từ server');
        allLoadedOrders = data;

        document.getElementById('statTotal').textContent = data.length;
        document.getElementById('statPending').textContent = data.filter(order => order.status === 'pending').length;
        document.getElementById('statProcessing').textContent = data.filter(order => order.status === 'processing').length;
        document.getElementById('statCompleted').textContent = data.filter(order => order.status === 'completed').length;
        document.getElementById('statShipping').textContent = data.filter(order => order.status === 'shipping').length;

        const tableBody = document.querySelector('#orderTable tbody');
        if (!data.length) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted);">Chưa có đơn hàng nào</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(order => `
            <tr class="fade-in">
                <td style="font-family:monospace;color:var(--text-muted);">#${String(order._id).padStart(4, '0')}</td>
                <td>
                    <strong>${escapeHTML(order.recipientName || order.customer?.name || order.customerName || 'N/A')}</strong>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHTML(order.recipientPhone || order.customer?.phone || order.customerPhone || '')}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(order.shippingAddress || '')}</div>
                </td>
                <td>
                    <div class="order-products">
                        ${(order.products || []).map(item => `
                            <div class="order-product-item">
                                <strong>${escapeHTML(item.product?.name || item.productName || 'Sản phẩm không tồn tại')}</strong> x ${item.quantity}
                            </div>
                        `).join('')}
                    </div>
                </td>
                <td class="td-price">${fmt(order.totalAmount)}</td>
                <td>${paymentCell(order)}</td>
                <td>
                    <select class="status-select" onchange="updateStatus('${order._id}', this.value)">
                        ${Object.keys(statusLabels).map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}
                    </select>
                </td>
                <td style="font-size:0.8rem;">
                    <button type="button" class="tracking-action" onclick="updateTracking('${order._id}', '${escapeHTML(order.trackingNumber || '')}', '${escapeHTML(order.shippingUnit || '')}')">
                        ${order.trackingNumber ? escapeHTML(order.trackingNumber) : 'Chờ hãng vận chuyển'}
                    </button>
                    <div style="color:var(--text-muted);margin-top:0.2rem;max-width:220px;">
                        ${order.shippingUnit
                            ? escapeHTML(order.shippingUnit)
                            : escapeHTML(order.shippingMetadata?.shipment?.message || 'Tự tạo sau khi cấu hình API đơn vị vận chuyển.')}
                    </div>
                </td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">${formatDate(order.orderDate || order.createdAt)}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button class="btn-print-slip" type="button" onclick="printOrderInvoice('${order._id}')" title="In Hóa đơn VAT & Phiếu đóng gói giao hàng">
                            🖨️ In Hóa đơn
                        </button>
                        <button class="btn-delete" onclick="deleteOrder('${order._id}')">Xóa</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Lỗi tải danh sách đơn hàng!', 'error');
    }
}

function paymentCell(order) {
    const canMarkPaid = order.paymentStatus !== 'paid' && ['cod', 'bank_transfer', 'installment', 'ShipCOD', 'Thanh toán trước', 'Trả góp'].includes(order.paymentMethod);
    return `
        <div style="font-size:0.82rem;line-height:1.5;">
            <strong>${methodLabels[order.paymentMethod] || escapeHTML(order.paymentMethod)}</strong>
            <div class="pay-status pay-${order.paymentStatus}">${paymentLabels[order.paymentStatus] || order.paymentStatus}</div>
            ${order.paymentTransactionId ? `<div style="color:var(--text-muted);">Mã GD: ${escapeHTML(order.paymentTransactionId)}</div>` : ''}
            ${canMarkPaid ? `<button class="btn-edit btn-sm" onclick="markPaymentPaid('${order._id}')">Xác nhận đã thanh toán</button>` : ''}
        </div>
    `;
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi cập nhật');
        showToast(`Đã cập nhật trạng thái: ${statusLabels[status] || status}`);
        loadOrders();
    } catch (error) {
        showToast(error.message || 'Lỗi cập nhật!', 'error');
        loadOrders();
    }
}

async function markPaymentPaid(id) {
    const transactionId = prompt('Nhập mã giao dịch/ghi chú xác nhận:', `MANUAL-${Date.now()}`);
    if (transactionId === null) return;
    try {
        const res = await fetch(`${EP}/${id}/payment`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ paymentStatus: 'paid', paymentProvider: 'manual', paymentTransactionId: transactionId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi xác nhận thanh toán');
        showToast('Đã xác nhận thanh toán!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateTracking(id, currentTracking, currentUnit) {
    const trackingNumber = prompt('Nhập mã vận đơn do hãng vận chuyển cấp:', currentTracking);
    if (trackingNumber === null) return;
    const shippingUnit = prompt('Nhập đơn vị giao hàng (VD: GHTK, SPX):', currentUnit || 'GHTK');
    if (shippingUnit === null) return;

    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ trackingNumber, shippingUnit, status: 'shipping' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi cập nhật mã vận đơn');
        showToast('Đã lưu mã vận đơn và chuyển trạng thái đang giao!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteOrder(id) {
    if (!confirm('Xóa đơn hàng này? Tồn kho sẽ được hoàn nếu đơn chưa hoàn kho.')) return;

    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi xóa đơn hàng');
        showToast('Đã xóa đơn hàng!');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadOrders);

function printOrderInvoice(id) {
    const order = allLoadedOrders.find(o => String(o._id) === String(id));
    if (!order) {
        showToast('Không tìm thấy thông tin đơn hàng để in!', 'error');
        return;
    }

    const recipientName = order.recipientName || order.customer?.name || order.customerName || 'Khách vãng lai';
    const recipientPhone = order.recipientPhone || order.customer?.phone || order.customerPhone || 'N/A';
    const shippingAddress = order.shippingAddress || 'Nhận tại showroom TechEcommerce';
    const orderDateFormatted = formatDate(order.orderDate || order.createdAt);
    const trackingCode = order.trackingNumber || 'CHƯA_TẠO_VẬN_ĐƠN';
    const shippingUnit = order.shippingUnit || 'Giao Hàng Nhanh / Tiêu Chuẩn';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent('https://techecommerce-shop.vercel.app/pages/account/order-detail.html?id=' + order._id)}`;

    const itemsRows = (order.products || []).map((item, idx) => {
        const prodName = item.product?.name || item.productName || 'Sản phẩm công nghệ';
        const qty = item.quantity || 1;
        const price = item.price || (order.totalAmount / (order.products.length || 1));
        const total = price * qty;
        return `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${escapeHTML(prodName)}</strong></td>
                <td style="text-align:center;">${qty}</td>
                <td style="text-align:right;">${fmt(price)}</td>
                <td style="text-align:right;"><strong>${fmt(total)}</strong></td>
            </tr>
        `;
    }).join('');

    const invoiceHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Hóa đơn điện tử VAT & Phiếu đóng gói #${order._id}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
                body { background: #fff; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.5; }
                .invoice-box { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 24px; border-radius: 8px; }
                .inv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 16px; }
                .inv-company h2 { font-size: 15px; color: #1e40af; text-transform: uppercase; margin-bottom: 4px; }
                .inv-company p { font-size: 12px; color: #475569; }
                .inv-meta { text-align: right; }
                .inv-meta h1 { font-size: 17px; color: #0f172a; margin-bottom: 4px; }
                .inv-meta span { display: block; font-size: 12px; color: #64748b; }
                .inv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; }
                .inv-grid div h4 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
                .inv-grid div p { font-size: 12.5px; margin: 2px 0; }
                .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                .inv-table th, .inv-table td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
                .inv-table th { background: #f1f5f9; color: #334155; text-align: left; }
                .inv-totals { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
                .inv-qr { display: flex; align-items: center; gap: 12px; }
                .inv-qr img { width: 90px; height: 90px; border: 1px solid #e2e8f0; padding: 4px; border-radius: 4px; }
                .inv-sum { text-align: right; font-size: 13px; }
                .inv-sum .total-row { font-size: 16px; color: #dc2626; font-weight: bold; margin-top: 4px; }
                .inv-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; margin-top: 32px; padding-top: 16px; }
                .inv-signatures .sign-role { font-weight: 600; margin-bottom: 48px; }
                .inv-signatures .sign-note { font-size: 11px; color: #64748b; font-style: italic; }
                @media print {
                    body { padding: 0; }
                    .invoice-box { border: none; padding: 0; }
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="max-width:800px; margin:0 auto 16px auto; display:flex; justify-content:flex-end; gap:8px;">
                <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">🖨️ In Hóa Đơn / Xuất PDF</button>
                <button onclick="window.close()" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">✕ Đóng</button>
            </div>
            <div class="invoice-box">
                <div class="inv-header">
                    <div class="inv-company">
                        <h2>CÔNG TY CỔ PHẦN CÔNG NGHỆ TECHECOMMERCE VIỆT NAM</h2>
                        <p><strong>Mã số thuế:</strong> 0318992388</p>
                        <p><strong>Địa chỉ:</strong> Tầng 5, Tòa nhà Innovation, TP. Hồ Chí Minh</p>
                        <p><strong>Hotline:</strong> 0842.331.606 | <strong>Website:</strong> techecommerce-shop.vercel.app</p>
                    </div>
                    <div class="inv-meta">
                        <h1>PHIẾU ĐÓNG GÓI &amp; HÓA ĐƠN VAT</h1>
                        <span>Mã đơn: <strong>#${order._id}</strong></span>
                        <span>Mã vận đơn: <strong>${escapeHTML(trackingCode)}</strong></span>
                        <span>Ngày lập: ${orderDateFormatted}</span>
                    </div>
                </div>

                <div class="inv-grid">
                    <div>
                        <h4>Thông tin người nhận (Khách hàng)</h4>
                        <p><strong>Người nhận:</strong> ${escapeHTML(recipientName)}</p>
                        <p><strong>Điện thoại:</strong> ${escapeHTML(recipientPhone)}</p>
                        <p><strong>Địa chỉ nhận:</strong> ${escapeHTML(shippingAddress)}</p>
                    </div>
                    <div>
                        <h4>Thông tin vận chuyển &amp; Thanh toán</h4>
                        <p><strong>Đơn vị vận chuyển:</strong> ${escapeHTML(shippingUnit)}</p>
                        <p><strong>Hình thức thanh toán:</strong> ${escapeHTML(methodLabels[order.paymentMethod] || order.paymentMethod)}</p>
                        <p><strong>Trạng thái thanh toán:</strong> ${escapeHTML(paymentLabels[order.paymentStatus] || order.paymentStatus)}</p>
                        <p><strong>Ghi chú giao hàng:</strong> ${escapeHTML(order.customerNotes || 'Cho xem hàng trước khi nhận')}</p>
                    </div>
                </div>

                <table class="inv-table">
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">STT</th>
                            <th>Tên sản phẩm / Thiết bị</th>
                            <th style="width:70px; text-align:center;">Số lượng</th>
                            <th style="width:110px; text-align:right;">Đơn giá</th>
                            <th style="width:120px; text-align:right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="inv-totals">
                    <div class="inv-qr">
                        <img src="${qrUrl}" alt="QR Tra cứu đơn hàng">
                        <div>
                            <strong style="font-size:12px; display:block;">MÃ QR TRA CỨU ĐƠN HÀNG</strong>
                            <small style="color:#64748b; display:block;">Quét để kiểm tra bảo hành điện tử &amp; trạng thái vận đơn</small>
                        </div>
                    </div>
                    <div class="inv-sum">
                        <p>Phí vận chuyển: <strong>Miễn phí (0 đ)</strong></p>
                        <p>Thuế GTGT (VAT): <strong>Đã bao gồm</strong></p>
                        <div class="total-row">TỔNG THANH TOÁN: ${fmt(order.totalAmount)}</div>
                    </div>
                </div>

                <div class="inv-signatures">
                    <div>
                        <div class="sign-role">Người lập hóa đơn</div>
                        <div class="sign-note">(Ký &amp; ghi rõ họ tên)</div>
                    </div>
                    <div>
                        <div class="sign-role">Thủ kho xuất hàng</div>
                        <div class="sign-note">(Đã kiểm đủ số lượng &amp; niêm phong)</div>
                    </div>
                    <div>
                        <div class="sign-role">Người nhận hàng / Shipper</div>
                        <div class="sign-note">(Đã nhận nguyên vẹn niêm phong)</div>
                    </div>
                </div>
            </div>
            <script>
                window.addEventListener('load', () => {
                    setTimeout(() => window.print(), 350);
                });
            <\/script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=850,height=900,menubar=no,toolbar=no,location=no,status=no');
    if (!printWin) {
        showToast('Trình duyệt đã chặn cửa sổ in (popup). Vui lòng cho phép mở popup để xem hóa đơn!', 'error');
        return;
    }
    printWin.document.open();
    printWin.document.write(invoiceHtml);
    printWin.document.close();
}
