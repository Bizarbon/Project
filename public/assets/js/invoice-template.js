/**
 * invoice-template.js
 * Trình tạo Hóa đơn Điện tử VAT & Phiếu Đóng Gói dùng chung (Admin & Khách hàng)
 * Tuân thủ Semantic HTML5, chuẩn in A4, tích hợp Logo Đầu Con Mèo & Con dấu điện tử.
 */
(function (global) {
    'use strict';

    function invEscapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function invMoney(amount) {
        return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
    }

    function readThreeDigitsVi(num, isFirstGroup) {
        const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
        const hundreds = Math.floor(num / 100);
        const tens = Math.floor((num % 100) / 10);
        const ones = num % 10;
        let out = '';

        if (hundreds > 0 || !isFirstGroup) {
            out += `${digits[hundreds]} trăm`;
        }
        if (tens > 1) {
            out += `${out ? ' ' : ''}${digits[tens]} mươi`;
            if (ones === 1) out += ' mốt';
            else if (ones === 4) out += ' tư';
            else if (ones === 5) out += ' lăm';
            else if (ones > 0) out += ` ${digits[ones]}`;
        } else if (tens === 1) {
            out += `${out ? ' ' : ''}mười`;
            if (ones === 5) out += ' lăm';
            else if (ones > 0) out += ` ${digits[ones]}`;
        } else if (ones > 0) {
            if (out) out += ' lẻ';
            out += `${out ? ' ' : ''}${digits[ones]}`;
        }
        return out;
    }

    function numberToVietnameseWords(amount) {
        const n = Math.round(Number(amount) || 0);
        if (n <= 0) return 'Không đồng';
        const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
        const groups = [];
        let rem = n;
        while (rem > 0) {
            groups.push(rem % 1000);
            rem = Math.floor(rem / 1000);
        }
        const parts = [];
        for (let i = groups.length - 1; i >= 0; i--) {
            if (groups[i] === 0) continue;
            const isFirst = parts.length === 0;
            const chunk = readThreeDigitsVi(groups[i], isFirst);
            parts.push(scales[i] ? `${chunk} ${scales[i]}` : chunk);
        }
        const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
        return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} đồng chẵn.`;
    }

    function formatTrackingDisplay(rawTracking) {
        const raw = String(rawTracking || '').trim();
        if (!raw || raw === 'CHƯA_TẠO_VẬN_ĐƠN' || raw === 'CHUA_TAO_VAN_DON') {
            return { text: 'Chờ tạo vận đơn', isPending: true };
        }
        return { text: raw, isPending: false };
    }

    function buildTechEcommerceInvoiceHtml(options = {}) {
        const order = options.order || {};
        const origin = options.origin || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
        const mode = options.mode === 'customer' ? 'customer' : 'admin';
        const autoPrint = options.autoPrint !== false;

        const logoUrl = `${origin}/assets/images/logo/tom-cat-head.png`;
        const recipientName = options.recipientName || order.recipientName || order.customer?.name || order.customerName || 'Khách hàng';
        const recipientPhone = options.recipientPhone || order.recipientPhone || order.customer?.phone || order.customerPhone || 'N/A';
        const shippingAddress = options.shippingAddress || order.shippingAddress || 'Nhận tại showroom TechEcommerce (78 Nguyễn Văn Khối, Gò Vấp, TP.HCM)';
        const orderDateFormatted = options.orderDateFormatted || '';
        const trackingInfo = formatTrackingDisplay(options.trackingCode ?? order.trackingNumber);
        const shippingUnit = options.shippingUnit || order.shippingUnit || 'Giao Hàng Nhanh / Tiêu chuẩn';
        const paymentMethodLabel = options.paymentMethodLabel || order.paymentMethod || 'COD';
        const paymentStatusLabel = options.paymentStatusLabel || order.paymentStatus || 'Chưa thanh toán';
        const rawPayStatus = String(order.paymentStatus || '').trim().toLowerCase();
        const isPaid = rawPayStatus === 'paid' || /^đã thanh toán$/i.test(String(paymentStatusLabel || '').trim());
        const deliveryNote = options.note || order.note || 'Cho xem hàng (đồng kiểm ngoại quan) trước khi nhận';
        const qrTargetUrl = options.qrTargetUrl || `https://techshopvn.vercel.app/pages/account/order-detail.html?id=${order._id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrTargetUrl)}`;

        let computedSubtotal = 0;
        const itemsRows = (order.products || []).map((item, idx) => {
            const prodName = item.product?.name || item.productName || 'Sản phẩm công nghệ';
            const variantText = [item.selectedColor, item.selectedStorage].filter(Boolean).join(' · ');
            const qty = Math.max(1, Number(item.quantity) || 1);
            const unitPrice = Number(item.price) || 0;
            const lineTotal = unitPrice * qty;
            computedSubtotal += lineTotal;
            return `
                <tr>
                    <td class="col-center">${idx + 1}</td>
                    <td class="col-product">
                        <strong class="item-name">${invEscapeHtml(prodName)}</strong>
                        ${variantText ? `<span class="item-variant">Phân loại: ${invEscapeHtml(variantText)}</span>` : '<span class="item-variant">Chính hãng nguyên seal · Bảo hành 12–24 tháng</span>'}
                    </td>
                    <td class="col-center">Chiếc</td>
                    <td class="col-center num">${qty}</td>
                    <td class="col-right num">${invMoney(unitPrice)}</td>
                    <td class="col-right num"><strong>${invMoney(lineTotal)}</strong></td>
                </tr>
            `;
        }).join('');

        const shippingFee = Number(order.shippingFee) || 0;
        const totalAmount = Number(order.totalAmount) || Math.max(computedSubtotal + shippingFee, 0);
        const explicitDiscount = Number(order.discountAmount) || Number(order.couponDiscount) || 0;
        const inferredDiscount = Math.max((computedSubtotal + shippingFee) - totalAmount, 0);
        const discountAmount = explicitDiscount > 0 ? explicitDiscount : (inferredDiscount >= 1000 ? inferredDiscount : 0);
        const amountWords = numberToVietnameseWords(totalAmount);
        const orderCodeFormatted = `#${order._id}`;
        const docTitle = mode === 'customer'
            ? `Hóa đơn điện tử VAT ${orderCodeFormatted}`
            : `Hóa đơn điện tử VAT & Phiếu đóng gói ${orderCodeFormatted}`;
        const docHeading = mode === 'customer'
            ? 'HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG (VAT)'
            : 'PHIẾU ĐÓNG GÓI &amp; HÓA ĐƠN VAT';

        const signColumnsHtml = mode === 'customer'
            ? `
                <article class="sign-box">
                    <h4 class="sign-role">Người mua hàng</h4>
                    <p class="sign-note">(Ký &amp; ghi rõ họ tên)</p>
                </article>
                <article class="sign-box sign-box-stamped">
                    <h4 class="sign-role">Đại diện TechEcommerce</h4>
                    <div class="digital-seal" aria-hidden="true">
                        <svg viewBox="0 0 140 140" width="88" height="88">
                            <circle cx="70" cy="70" r="64" fill="none" stroke="#dc2626" stroke-width="2.6"/>
                            <circle cx="70" cy="70" r="56" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="3 2"/>
                            <text x="70" y="38" text-anchor="middle" fill="#dc2626" font-size="7.2" font-weight="800" letter-spacing="0.4">TECHECOMMERCE VN</text>
                            <text x="70" y="66" text-anchor="middle" fill="#dc2626" font-size="9.5" font-weight="900">ĐÃ KÝ ĐIỆN TỬ</text>
                            <text x="70" y="81" text-anchor="middle" fill="#dc2626" font-size="8" font-weight="700">MST: 0318992388</text>
                            <text x="70" y="106" text-anchor="middle" fill="#dc2626" font-size="7.2" font-weight="800">CHÍNH HÃNG 100%</text>
                        </svg>
                    </div>
                    <p class="sign-verified">Đã ký số hợp lệ · ${invEscapeHtml(orderDateFormatted)}</p>
                </article>
            `
            : `
                <article class="sign-box sign-box-stamped">
                    <h4 class="sign-role">Người lập hóa đơn</h4>
                    <div class="digital-seal" aria-hidden="true">
                        <svg viewBox="0 0 140 140" width="84" height="84">
                            <circle cx="70" cy="70" r="64" fill="none" stroke="#dc2626" stroke-width="2.6"/>
                            <circle cx="70" cy="70" r="56" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="3 2"/>
                            <text x="70" y="38" text-anchor="middle" fill="#dc2626" font-size="7.2" font-weight="800" letter-spacing="0.4">TECHECOMMERCE VN</text>
                            <text x="70" y="66" text-anchor="middle" fill="#dc2626" font-size="9.5" font-weight="900">ĐÃ XÁC THỰC</text>
                            <text x="70" y="81" text-anchor="middle" fill="#dc2626" font-size="8" font-weight="700">MST: 0318992388</text>
                            <text x="70" y="106" text-anchor="middle" fill="#dc2626" font-size="7.2" font-weight="800">HÓA ĐƠN ĐIỆN TỬ</text>
                        </svg>
                    </div>
                    <p class="sign-note">(Ký số &amp; đóng dấu)</p>
                </article>
                <article class="sign-box">
                    <h4 class="sign-role">Thủ kho xuất hàng</h4>
                    <p class="sign-note">(Đã kiểm đủ SL &amp; nguyên seal)</p>
                </article>
                <article class="sign-box">
                    <h4 class="sign-role">Người nhận / Shipper</h4>
                    <p class="sign-note">(Đã kiểm &amp; nhận nguyên vẹn)</p>
                </article>
            `;

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${invEscapeHtml(origin)}/">
    <title>${invEscapeHtml(docTitle)}</title>
    <style>
        @page { size: A4 portrait; margin: 10mm 12mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
            background: #eef2f7;
            color: #0f172a;
            padding: 20px 16px 32px;
            font-size: 12.5px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .no-print {
            max-width: 820px;
            margin: 0 auto 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: #ffffff;
            border: 1px solid #dbe3ef;
            padding: 10px 14px;
            border-radius: 12px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
        }
        .toolbar-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
        }
        .toolbar-title img {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            object-fit: cover;
            object-position: top center;
            border: 1px solid #cbd5e1;
        }
        .toolbar-actions { display: flex; gap: 8px; }
        .btn-action {
            border: 0;
            padding: 8px 15px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-print { background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; }
        .btn-close { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

        .invoice-sheet {
            position: relative;
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            padding: 24px 26px;
            box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
            overflow: hidden;
        }
        .invoice-accent-bar {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 5px;
            background: linear-gradient(90deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%);
        }
        .inv-watermark {
            position: absolute;
            top: 52%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 240px;
            height: 240px;
            opacity: 0.045;
            pointer-events: none;
            z-index: 0;
        }
        .inv-watermark img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .inv-header {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 16px;
            margin-bottom: 18px;
        }
        .inv-brand {
            display: flex;
            align-items: center;
            gap: 14px;
            flex: 1 1 auto;
            min-width: 0;
        }
        .inv-cat-avatar {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            border: 2px solid #bfdbfe;
            background: linear-gradient(145deg, #f8fafc, #e0f2fe);
            padding: 3px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.14);
            overflow: hidden;
        }
        .inv-cat-avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            object-position: top center;
            display: block;
        }
        .inv-company-info { min-width: 0; }
        .company-kicker {
            display: inline-block;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #0369a1;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .inv-company-info h2 {
            font-size: 13.5px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            line-height: 1.3;
            margin-bottom: 5px;
        }
        .inv-company-info p {
            font-size: 11.5px;
            color: #475569;
            margin: 1px 0;
        }

        .inv-doc-meta {
            text-align: right;
            flex-shrink: 0;
            max-width: 280px;
        }
        .doc-vat-badge {
            display: inline-block;
            padding: 3px 9px;
            border-radius: 999px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.04em;
            margin-bottom: 5px;
        }
        .inv-doc-meta h1 {
            font-size: 14.5px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.01em;
            margin-bottom: 7px;
            white-space: nowrap;
        }
        .meta-dl {
            display: inline-grid;
            grid-template-columns: auto auto;
            gap: 3px 10px;
            font-size: 11.5px;
            text-align: right;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 7px 10px;
        }
        .meta-dl dt { color: #64748b; font-weight: 600; text-align: left; }
        .meta-dl dd { margin: 0; font-weight: 700; color: #0f172a; }
        .meta-badge-pending {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 4px;
            background: #fef3c7;
            color: #92400e;
            font-size: 10.5px;
            font-weight: 700;
        }
        .meta-tracking-code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11px;
            color: #1e40af;
        }

        .inv-main { position: relative; z-index: 1; }
        .inv-parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 18px;
        }
        .party-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
        }
        .party-card h3 {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #1e40af;
            border-bottom: 1px solid #dbe4f0;
            padding-bottom: 5px;
            margin-bottom: 7px;
        }
        .party-card p { font-size: 12px; color: #334155; margin: 3px 0; }
        .party-card strong { color: #0f172a; }
        .status-chip {
            display: inline-block;
            padding: 1px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
        }
        .status-chip.is-paid { background: #dcfce7; color: #166534; }
        .status-chip.is-unpaid { background: #fee2e2; color: #991b1b; }

        .inv-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
        }
        .inv-table thead th {
            background: #1e3a8a;
            color: #ffffff;
            font-size: 11.5px;
            font-weight: 700;
            padding: 9px 10px;
            text-align: left;
            border-bottom: 1px solid #1e40af;
        }
        .inv-table tbody td {
            border-bottom: 1px solid #e2e8f0;
            border-right: 1px solid #f1f5f9;
            padding: 9px 10px;
            font-size: 12px;
            vertical-align: top;
        }
        .inv-table tbody tr:nth-child(even) { background: rgba(248, 250, 252, 0.72); }
        .inv-table tbody tr:last-child td { border-bottom: 0; }
        .inv-table th.col-center, .inv-table td.col-center { text-align: center; }
        .inv-table th.col-right, .inv-table td.col-right { text-align: right; }
        .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .item-name { display: block; color: #0f172a; font-size: 12.2px; }
        .item-variant { display: block; color: #64748b; font-size: 10.8px; margin-top: 2px; }

        .inv-summary-section {
            display: grid;
            grid-template-columns: 1fr 315px;
            gap: 18px;
            align-items: stretch;
            margin-bottom: 18px;
        }
        .inv-qr-box {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
        }
        .inv-qr-box img {
            width: 86px;
            height: 86px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 4px;
            border-radius: 8px;
            flex-shrink: 0;
        }
        .inv-qr-box figcaption strong {
            display: block;
            font-size: 11.5px;
            color: #0f172a;
            margin-bottom: 3px;
        }
        .inv-qr-box figcaption p {
            font-size: 11px;
            color: #64748b;
            line-height: 1.4;
        }
        .inv-totals-box {
            background: #f8fafc;
            border: 1px solid #dbe3ef;
            border-radius: 10px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .sum-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #475569;
        }
        .sum-row dt { font-weight: 500; }
        .sum-row dd { margin: 0; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
        .sum-row.discount dd { color: #059669; }
        .sum-row.grand-total {
            margin-top: 4px;
            padding-top: 8px;
            border-top: 1.5px dashed #94a3b8;
            font-size: 14px;
        }
        .sum-row.grand-total dt { font-weight: 800; color: #0f172a; }
        .sum-row.grand-total dd { font-size: 16px; font-weight: 900; color: #dc2626; }
        .amount-words {
            font-size: 11px;
            color: #334155;
            font-style: italic;
            text-align: right;
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
        }

        .inv-footer {
            position: relative;
            z-index: 1;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
        }
        .inv-signatures {
            display: grid;
            grid-template-columns: repeat(${mode === 'customer' ? 2 : 3}, 1fr);
            gap: 16px;
            text-align: center;
            margin-bottom: 18px;
        }
        .sign-box {
            position: relative;
            min-height: 122px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .sign-role { font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
        .sign-note { font-size: 11px; color: #64748b; font-style: italic; margin-top: 74px; }
        .sign-verified { font-size: 11px; color: #059669; font-weight: 700; margin-top: 74px; }
        .digital-seal {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) rotate(-10deg);
            opacity: 0.88;
            pointer-events: none;
        }
        .legal-footnote {
            text-align: center;
            font-size: 10.5px;
            color: #64748b;
            padding-top: 10px;
            border-top: 1px dashed #e2e8f0;
        }

        @media print {
            body { background: #ffffff; padding: 0; }
            .no-print { display: none !important; }
            .invoice-sheet {
                border: none;
                border-radius: 0;
                box-shadow: none;
                padding: 10px 4px;
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <nav class="no-print" aria-label="Thanh công cụ hóa đơn">
        <div class="toolbar-title">
            <img src="${invEscapeHtml(logoUrl)}" alt="Logo TechEcommerce" onerror="this.style.display='none'">
            <span>${invEscapeHtml(docTitle)}</span>
        </div>
        <div class="toolbar-actions">
            <button type="button" class="btn-action btn-print" onclick="window.print()">🖨️ In Hóa Đơn / Lưu PDF</button>
            <button type="button" class="btn-action btn-close" onclick="window.close()">✕ Đóng</button>
        </div>
    </nav>

    <article class="invoice-sheet">
        <div class="invoice-accent-bar" aria-hidden="true"></div>
        <div class="inv-watermark" aria-hidden="true">
            <img src="${invEscapeHtml(logoUrl)}" alt="" onerror="this.style.display='none'">
        </div>

        <header class="inv-header">
            <div class="inv-brand">
                <figure class="inv-cat-avatar">
                    <img src="${invEscapeHtml(logoUrl)}" alt="Logo đầu mèo TechEcommerce" onerror="this.parentElement.style.display='none'">
                </figure>
                <div class="inv-company-info">
                    <span class="company-kicker">Đại lý công nghệ chính hãng · TechEcommerce Store</span>
                    <h2>CÔNG TY CỔ PHẦN CÔNG NGHỆ TECHECOMMERCE VIỆT NAM</h2>
                    <p><strong>Mã số thuế:</strong> 0318992388 &nbsp;|&nbsp; <strong>Ký hiệu:</strong> 1C26TTE</p>
                    <p><strong>Địa chỉ:</strong> 78 Nguyễn Văn Khối, Quận Gò Vấp, Thành phố Hồ Chí Minh</p>
                    <p><strong>Hotline:</strong> 0842.331.606 &nbsp;|&nbsp; <strong>Website:</strong> techshopvn.vercel.app</p>
                </div>
            </div>

            <div class="inv-doc-meta">
                <span class="doc-vat-badge">HÓA ĐƠN ĐIỆN TỬ · BẢN THỂ HIỆN</span>
                <h1>${docHeading}</h1>
                <dl class="meta-dl">
                    <dt>Mã đơn hàng:</dt>
                    <dd>${invEscapeHtml(orderCodeFormatted)}</dd>
                    <dt>Mã vận đơn:</dt>
                    <dd>${trackingInfo.isPending
                        ? `<span class="meta-badge-pending">${invEscapeHtml(trackingInfo.text)}</span>`
                        : `<span class="meta-tracking-code">${invEscapeHtml(trackingInfo.text)}</span>`}</dd>
                    <dt>Ngày lập:</dt>
                    <dd>${invEscapeHtml(orderDateFormatted)}</dd>
                </dl>
            </div>
        </header>

        <main class="inv-main">
            <section class="inv-parties" aria-label="Thông tin khách hàng và vận chuyển">
                <article class="party-card">
                    <h3>Thông tin người nhận (Khách hàng)</h3>
                    <p><strong>Người nhận:</strong> ${invEscapeHtml(recipientName)}</p>
                    <p><strong>Điện thoại:</strong> ${invEscapeHtml(recipientPhone)}</p>
                    <p><strong>Địa chỉ nhận:</strong> ${invEscapeHtml(shippingAddress)}</p>
                </article>
                <article class="party-card">
                    <h3>Thông tin vận chuyển &amp; Thanh toán</h3>
                    <p><strong>Đơn vị vận chuyển:</strong> ${invEscapeHtml(shippingUnit)}</p>
                    <p><strong>Hình thức thanh toán:</strong> ${invEscapeHtml(paymentMethodLabel)}</p>
                    <p><strong>Trạng thái thanh toán:</strong> <span class="status-chip ${isPaid ? 'is-paid' : 'is-unpaid'}">${invEscapeHtml(paymentStatusLabel)}</span></p>
                    <p><strong>Ghi chú giao hàng:</strong> ${invEscapeHtml(deliveryNote)}</p>
                </article>
            </section>

            <section aria-label="Chi tiết hàng hóa dịch vụ">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="col-center" style="width:42px;">STT</th>
                            <th>Tên sản phẩm / Thiết bị</th>
                            <th class="col-center" style="width:56px;">ĐVT</th>
                            <th class="col-center" style="width:48px;">SL</th>
                            <th class="col-right" style="width:118px;">Đơn giá</th>
                            <th class="col-right" style="width:128px;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </section>

            <section class="inv-summary-section" aria-label="Tổng hợp thanh toán và mã QR tra cứu">
                <figure class="inv-qr-box">
                    <img src="${invEscapeHtml(qrUrl)}" alt="Mã QR tra cứu đơn hàng ${invEscapeHtml(orderCodeFormatted)}">
                    <figcaption>
                        <strong>MÃ QR TRA CỨU ĐƠN HÀNG &amp; BẢO HÀNH</strong>
                        <p>Quét mã bằng camera điện thoại để kiểm tra bảo hành điện tử chính hãng, đối chiếu chứng từ VAT và hành trình giao nhận.</p>
                    </figcaption>
                </figure>

                <dl class="inv-totals-box">
                    <div class="sum-row">
                        <dt>Tổng tiền hàng:</dt>
                        <dd>${invMoney(computedSubtotal)}</dd>
                    </div>
                    ${discountAmount > 0 ? `
                    <div class="sum-row discount">
                        <dt>Chiết khấu / Voucher:</dt>
                        <dd>-${invMoney(discountAmount)}</dd>
                    </div>` : ''}
                    <div class="sum-row">
                        <dt>Phí vận chuyển:</dt>
                        <dd>${shippingFee > 0 ? invMoney(shippingFee) : 'Miễn phí (0 đ)'}</dd>
                    </div>
                    <div class="sum-row">
                        <dt>Thuế GTGT (VAT):</dt>
                        <dd>Đã bao gồm</dd>
                    </div>
                    <div class="sum-row grand-total">
                        <dt>TỔNG THANH TOÁN:</dt>
                        <dd>${invMoney(totalAmount)}</dd>
                    </div>
                    <p class="amount-words">Bằng chữ: <strong>${invEscapeHtml(amountWords)}</strong></p>
                </dl>
            </section>
        </main>

        <footer class="inv-footer">
            <section class="inv-signatures" aria-label="Xác nhận và chữ ký">
                ${signColumnsHtml}
            </section>
            <p class="legal-footnote">
                Chứng từ do Công ty Cổ phần Công nghệ TechEcommerce Việt Nam phát hành · Cam kết 100% chính hãng, lỗi 1 đổi 1 trong 30 ngày tại Showroom 78 Nguyễn Văn Khối, Gò Vấp, TP.HCM.
            </p>
        </footer>
    </article>
    ${autoPrint ? `
    <script>
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 400);
        });
    <\/script>` : ''}
</body>
</html>`;
    }

    global.buildTechEcommerceInvoiceHtml = buildTechEcommerceInvoiceHtml;
})(window);
