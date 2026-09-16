const nodemailer = require('nodemailer');
const Customer = require('../models/Customer');

let transporter = null;

function envValue(name) {
    return String(process.env[name] || '').trim();
}

function emailEnabled() {
    return String(process.env.EMAIL_ENABLED || '').toLowerCase() === 'true'
        && Boolean(envValue('SMTP_USER'))
        && Boolean(envValue('SMTP_PASS'));
}

function mailTransport() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: envValue('SMTP_HOST') || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 465,
        secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false',
        auth: {
            user: envValue('SMTP_USER'),
            pass: envValue('SMTP_PASS')
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true
    });
    return transporter;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function money(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function orderUrl(order) {
    const vercelHost = envValue('VERCEL_PROJECT_PRODUCTION_URL') || envValue('VERCEL_URL');
    const vercelBase = vercelHost
        ? (/^https?:\/\//i.test(vercelHost) ? vercelHost : `https://${vercelHost}`)
        : '';
    const base = envValue('FRONTEND_BASE_URL')
        || envValue('APP_BASE_URL')
        || vercelBase
        || envValue('RENDER_EXTERNAL_URL')
        || 'http://localhost:5000';
    const path = order.customer
        ? `/pages/account/order-detail.html?id=${encodeURIComponent(order._id)}`
        : `/pages/checkout/payment.html?orderId=${encodeURIComponent(order._id)}`;
    return `${base.replace(/\/$/, '')}${path}`;
}

function appBaseUrl() {
    const vercelHost = envValue('VERCEL_PROJECT_PRODUCTION_URL') || envValue('VERCEL_URL');
    const vercelBase = vercelHost
        ? (/^https?:\/\//i.test(vercelHost) ? vercelHost : `https://${vercelHost}`)
        : '';
    return (
        envValue('FRONTEND_BASE_URL')
        || envValue('APP_BASE_URL')
        || vercelBase
        || envValue('RENDER_EXTERNAL_URL')
        || 'http://localhost:5000'
    ).replace(/\/$/, '');
}

function productRows(order) {
    return (order.products || []).map(item => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHTML(item.productName || `Sản phẩm #${item.product}`)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${Number(item.quantity || 0)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${money(item.price)}</td>
        </tr>`).join('');
}

function emailShell(title, intro, order, closing) {
    return `<!doctype html>
    <html lang="vi"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f">
      <main style="max-width:680px;margin:0 auto;padding:28px 16px">
        <section style="background:#fff;border:1px solid #dbe5f0;border-radius:14px;padding:28px">
          <p style="margin:0 0 8px;color:#1672d4;font-weight:700">TechEcommerce</p>
          <h1 style="margin:0 0 16px;font-size:24px">${escapeHTML(title)}</h1>
          <p style="line-height:1.6">${escapeHTML(intro)}</p>
          <p><strong>Mã đơn:</strong> #${escapeHTML(order._id)}<br>
             <strong>Người nhận:</strong> ${escapeHTML(order.recipientName)}<br>
             <strong>Số điện thoại:</strong> ${escapeHTML(order.recipientPhone)}<br>
             <strong>Địa chỉ:</strong> ${escapeHTML(order.shippingAddress)}<br>
             <strong>Thanh toán:</strong> ${escapeHTML(order.paymentMethod)} — ${escapeHTML(order.paymentStatus)}</p>
          <table style="width:100%;border-collapse:collapse;margin:18px 0">
            <thead><tr><th style="padding:8px;text-align:left">Sản phẩm</th><th style="padding:8px">SL</th><th style="padding:8px;text-align:right">Đơn giá</th></tr></thead>
            <tbody>${productRows(order)}</tbody>
          </table>
          <p style="font-size:18px"><strong>Tổng cộng: ${money(order.totalAmount)}</strong></p>
          <p style="margin:24px 0"><a href="${escapeHTML(orderUrl(order))}" style="background:#1672d4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Xem đơn hàng</a></p>
          <p style="line-height:1.6">${escapeHTML(closing)}</p>
        </section>
      </main>
    </body></html>`;
}

async function sendMessage({ to, subject, html }) {
    if (!emailEnabled() || !to) return { skipped: true };
    const fromName = envValue('EMAIL_FROM_NAME') || 'TechEcommerce';
    const fromEmail = envValue('EMAIL_FROM') || envValue('SMTP_USER');
    const info = await mailTransport().sendMail({
        from: `"${fromName.replace(/["\r\n]/g, '')}" <${fromEmail}>`,
        to,
        subject,
        html
    });
    return { skipped: false, messageId: info.messageId };
}

async function notifyOrderCreated(order, customer) {
    if (!emailEnabled()) return { configured: false };
    const adminEmail = envValue('ORDER_NOTIFICATION_EMAIL') || 'banphan272004@gmail.com';
    const customerEmail = String(customer?.email || '').trim();
    const jobs = [];

    if (!order.adminOrderEmailSentAt && adminEmail) {
        jobs.push(sendMessage({
            to: adminEmail,
            subject: `[TechEcommerce] Đơn hàng mới #${order._id}`,
            html: emailShell(
                `Đơn hàng mới #${order._id}`,
                `${order.recipientName} vừa đặt một đơn hàng mới.`,
                order,
                'Vui lòng kiểm tra thanh toán và chuẩn bị xử lý đơn hàng.'
            )
        }).then(result => {
            if (!result.skipped) order.adminOrderEmailSentAt = new Date();
            return result;
        }));
    }

    if (!order.customerOrderEmailSentAt && customerEmail) {
        jobs.push(sendMessage({
            to: customerEmail,
            subject: `TechEcommerce đã nhận đơn hàng #${order._id}`,
            html: emailShell(
                `Cảm ơn bạn đã đặt hàng`,
                `Xin chào ${customer.name || order.recipientName}, TechEcommerce đã nhận đơn hàng #${order._id}.`,
                order,
                'Cảm ơn bạn đã mua sắm tại TechEcommerce. Chúng tôi sẽ cập nhật khi thanh toán và vận chuyển được xác nhận.'
            )
        }).then(result => {
            if (!result.skipped) order.customerOrderEmailSentAt = new Date();
            return result;
        }));
    }

    const results = await Promise.allSettled(jobs);
    if (order.isModified()) await order.save();
    results.filter(result => result.status === 'rejected').forEach(result => {
        console.error('Order email error:', result.reason?.message || result.reason);
    });
    return { configured: true, results };
}

async function notifyPaymentConfirmed(order) {
    if (!emailEnabled() || order.paymentConfirmationEmailSentAt) return { configured: emailEnabled() };
    const customer = order.customer ? await Customer.findById(order.customer) : null;
    const customerEmail = String(customer?.email || order.guestEmail || '').trim();
    if (!customerEmail) return { configured: true, skipped: true };

    try {
        const result = await sendMessage({
            to: customerEmail,
            subject: `Thanh toán đơn hàng #${order._id} đã được xác nhận`,
            html: emailShell(
                'Thanh toán thành công',
                `TechEcommerce đã xác nhận thanh toán cho đơn hàng #${order._id}.`,
                order,
                'Đơn hàng đã chuyển sang bước kiểm hàng và đóng gói. Cảm ơn bạn đã tin tưởng TechEcommerce.'
            )
        });
        if (!result.skipped) {
            order.paymentConfirmationEmailSentAt = new Date();
            await order.save();
        }
        return result;
    } catch (error) {
        console.error('Payment email error:', error.message);
        return { error: error.message };
    }
}

async function sendPasswordResetEmail(customer, token) {
    const resetUrl = `${appBaseUrl()}/pages/auth/reset-password.html?token=${encodeURIComponent(token)}`;
    return sendMessage({
        to: customer.email,
        subject: 'Đặt lại mật khẩu TechEcommerce',
        html: `<!doctype html>
        <html lang="vi"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f">
          <main style="max-width:640px;margin:0 auto;padding:28px 16px">
            <section style="background:#fff;border:1px solid #dbe5f0;border-radius:14px;padding:28px">
              <p style="margin:0 0 8px;color:#1672d4;font-weight:700">TechEcommerce</p>
              <h1 style="margin:0 0 16px;font-size:24px">Đặt lại mật khẩu</h1>
              <p style="line-height:1.6">Xin chào ${escapeHTML(customer.name)}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
              <p style="margin:24px 0"><a href="${escapeHTML(resetUrl)}" style="display:inline-block;background:#1672d4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Tạo mật khẩu mới</a></p>
              <p style="line-height:1.6">Liên kết có hiệu lực trong 15 phút và chỉ sử dụng được một lần. Nếu bạn không yêu cầu thay đổi, hãy bỏ qua email này.</p>
              <p style="line-height:1.6;color:#52677d">Vì lý do bảo mật, TechEcommerce không bao giờ yêu cầu bạn gửi lại mật khẩu qua email.</p>
            </section>
          </main>
        </body></html>`
    });
}

async function sendPasswordChangedEmail(customer) {
    return sendMessage({
        to: customer.email,
        subject: 'Mật khẩu TechEcommerce đã được thay đổi',
        html: `<!doctype html>
        <html lang="vi"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f">
          <main style="max-width:640px;margin:0 auto;padding:28px 16px">
            <section style="background:#fff;border:1px solid #dbe5f0;border-radius:14px;padding:28px">
              <p style="margin:0 0 8px;color:#1672d4;font-weight:700">TechEcommerce</p>
              <h1 style="margin:0 0 16px;font-size:24px">Mật khẩu đã được cập nhật</h1>
              <p style="line-height:1.6">Xin chào ${escapeHTML(customer.name)}, mật khẩu tài khoản của bạn vừa được thay đổi thành công.</p>
              <p style="line-height:1.6">Nếu bạn không thực hiện thay đổi này, hãy liên hệ cửa hàng ngay để được hỗ trợ bảo vệ tài khoản.</p>
            </section>
          </main>
        </body></html>`
    });
}

module.exports = {
    emailEnabled,
    notifyOrderCreated,
    notifyPaymentConfirmed,
    sendPasswordResetEmail,
    sendPasswordChangedEmail
};
