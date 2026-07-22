# Bảo mật, AI giọng nói và thanh toán

Tài liệu này mô tả các chức năng được bổ sung theo góp ý của giảng viên cho TechEcommerce.

## 1. Bảo mật và xác thực

- Mật khẩu được băm bằng bcrypt với 12 vòng salt, không trả về qua API.
- Mật khẩu phải dài 8-72 ký tự và có chữ hoa, chữ thường, chữ số.
- JWT có thời hạn mặc định 2 giờ, có `issuer`, `audience` và `tokenVersion`.
- Đổi mật khẩu yêu cầu mật khẩu hiện tại và làm mất hiệu lực phiên đăng nhập cũ.
- Tài khoản bị khóa 15 phút sau 5 lần đăng nhập sai liên tiếp.
- API đăng nhập, chatbot và API chung đều có giới hạn tần suất truy cập.
- Helmet bổ sung HTTP security headers; CORS chỉ chấp nhận cùng nguồn hoặc tên miền được cấu hình.

Biến môi trường bắt buộc khi chạy production:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=mot-chuoi-ngau-nhien-toi-thieu-32-ky-tu
JWT_EXPIRES_IN=2h
APP_BASE_URL=https://ten-mien-cua-ban.vercel.app
FRONTEND_BASE_URL=https://ten-mien-cua-ban.vercel.app
```

Không đưa file `.env`, mật khẩu MongoDB, `JWT_SECRET` hoặc khóa thanh toán lên GitHub.

## 2. Gợi ý sản phẩm thông minh

API `GET /api/products/recommendations` chấm điểm sản phẩm dựa trên:

- Danh mục và thương hiệu trong lịch sử mua hàng.
- Danh sách yêu thích của khách hàng.
- Ngân sách, từ khóa nhu cầu và sản phẩm đang xem.
- Điểm đánh giá, lượt bán, trạng thái nổi bật và tồn kho.

Khách chưa đăng nhập vẫn nhận được gợi ý theo độ phổ biến. Khách đã đăng nhập nhận gợi ý cá nhân hóa và lý do đề xuất.

## 3. Chatbot và nhận dạng giọng nói

Chatbot có thể:

- Tư vấn sản phẩm theo ngân sách, loại thiết bị, thương hiệu và nhu cầu.
- Trả về thẻ sản phẩm để khách mở trang chi tiết.
- Tra cứu đơn hàng thuộc đúng tài khoản đang đăng nhập.
- Giải đáp thanh toán, vận chuyển, bảo hành và đổi trả.
- Nhận câu hỏi bằng giọng nói tiếng Việt và đọc câu trả lời khi bật chế độ giọng nói.

Nhận dạng giọng nói sử dụng Web Speech API của trình duyệt. Micro chỉ hoạt động trên HTTPS hoặc `localhost`, cần người dùng cấp quyền và phụ thuộc khả năng hỗ trợ của trình duyệt.

## 4. VNPay

Chế độ trình diễn không cần tài khoản cổng thanh toán:

```env
PAYMENT_GATEWAY_MODE=mock
```

Chế độ VNPay Sandbox:

```env
PAYMENT_GATEWAY_MODE=sandbox
VNPAY_TMN_CODE=ma-website-vnpay
VNPAY_HASH_SECRET=chuoi-bi-mat-vnpay
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
APP_BASE_URL=https://ten-mien-cua-ban.vercel.app
```

URL nhận kết quả máy chủ cần khai báo với VNPay:

```text
https://ten-mien-cua-ban.vercel.app/api/payments/vnpay/ipn
```

Luồng xử lý:

1. Máy chủ tạo `vnp_TxnRef` duy nhất, nhân số tiền VND với 100 và ký HMAC-SHA512.
2. Khách được chuyển sang VNPay để thanh toán.
3. Return URL chỉ hiển thị kết quả cho khách, không tự xác nhận đơn hàng.
4. IPN kiểm tra mã website, chữ ký, số tiền và trạng thái trước khi ghi nhận thanh toán.
5. Giao dịch thất bại được đánh dấu và hoàn lại tồn kho đúng một lần.

## 5. Kịch bản trình bày

1. Đăng ký bằng mật khẩu yếu để chứng minh hệ thống từ chối.
2. Đăng nhập và hỏi chatbot: `Laptop học lập trình dưới 20 triệu`.
3. Bật biểu tượng micro, đọc câu hỏi và xem chatbot trả lời bằng giọng nói.
4. Thêm sản phẩm vào giỏ, tạo đơn và chọn VNPay ở chế độ mock hoặc sandbox.
5. Mở hồ sơ, đổi mật khẩu và chứng minh token cũ không còn hiệu lực.

## 6. QR thanh toán và email đơn hàng

Sau khi tạo đơn bằng VNPay, MoMo, chuyển khoản hoặc trả góp, frontend mở trang
`/pages/checkout/payment.html?orderId=...`. Trang này chỉ lấy thông tin thanh
toán của đơn thuộc đúng tài khoản đang đăng nhập hoặc token bảo mật của đơn
khách vãng lai, sau đó thăm dò trạng thái thanh toán từ backend.

- Khách vãng lai chỉ dùng chuyển khoản ngân hàng, VNPay hoặc MoMo. COD và trả góp bị chặn ở cả
  frontend lẫn backend.
- Token khách là giá trị ngẫu nhiên; MongoDB chỉ lưu hash. Biết mã số đơn không
  đủ để xem địa chỉ, QR hoặc trạng thái đơn của người khác.
- Mã thanh toán trực tuyến hết hạn sau 15 phút. Backend tự hủy đơn chưa thanh
  toán và hoàn số lượng sản phẩm về kho.

- VNPay/MoMo: QR chứa URL do cổng thanh toán tạo. Backend chỉ đánh dấu đã thanh
  toán sau khi chữ ký, số tiền và trạng thái callback/IPN hợp lệ.
- Chuyển khoản thủ công: hiển thị số tài khoản, chủ tài khoản, số tiền và nội
  dung `TECHxxxxxx`. Quản trị viên đối soát và xác nhận đơn. Nếu sau này dùng
  dịch vụ đối soát, dịch vụ có thể gọi
  `POST /api/payments/bank/webhook` với dữ liệu
  `reference`, `amount`, `transactionId`, `status` và header
  `x-bank-webhook-secret` để tự xác nhận.
- Trả góp: mặc định dùng chế độ tiếp nhận hồ sơ nội bộ cho khách đã đăng nhập.
  Khi có hợp đồng đối tác tài chính, cấu hình URL thật để chuyển sang cổng đối tác.

Các biến chuyển khoản/trả góp cần cấu hình trên Vercel:

```env
BANK_ACCOUNT_NO=SO_TAI_KHOAN_THAT
BANK_ACCOUNT_NAME=TEN_CHU_TAI_KHOAN_KHONG_DAU
BANK_NAME=TEN_NGAN_HANG
# QR tĩnh hoặc payload QR là tùy chọn, không bắt buộc với chuyển khoản thủ công.
BANK_QR_IMAGE_URL=
BANK_QR_PAYLOAD=
BANK_WEBHOOK_SECRET=CHUOI_BI_MAT_NGAU_NHIEN
PAYMENT_QR_EXPIRES_MINUTES=15
INSTALLMENT_MODE=internal_review
INSTALLMENT_TERMS=3,6,9,12
INSTALLMENT_DOWN_PAYMENT_PERCENT=30
INSTALLMENT_ANNUAL_RATE_PERCENT=0
INSTALLMENT_PAYMENT_URL=https://doi-tac.example/pay?order={orderId}&amount={amount}&ref={reference}
```

`INSTALLMENT_PAYMENT_URL` chỉ là mẫu cấu hình; các biến `{orderId}`, `{amount}` và
`{reference}` được thay bằng dữ liệu đơn. Production phải dùng URL/API thật do
đối tác tài chính cung cấp, không dùng tên miền ví dụ.

Email dùng SMTP và không được ghi mật khẩu vào Git. Với Gmail cá nhân, bật xác
minh hai bước rồi tạo App Password riêng cho website:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=banphan272004@gmail.com
SMTP_PASS=APP_PASSWORD_16_KY_TU
EMAIL_FROM_NAME=TechEcommerce
EMAIL_FROM=banphan272004@gmail.com
ORDER_NOTIFICATION_EMAIL=banphan272004@gmail.com
```

Khi nhận đơn, hệ thống gửi thông báo cho cửa hàng và thư xác nhận/cảm ơn cho
khách có email. Khi callback thanh toán hợp lệ hoặc admin xác nhận tiền, khách
nhận thêm email xác nhận thanh toán. Lỗi gửi email được ghi log nhưng không làm
mất đơn hàng đã tạo.

## 7. Phí vận chuyển và mã vận đơn

Khi khách chọn Tỉnh/Thành, backend tự đề xuất phí theo khu vực và tự tính lại
phí khi tạo đơn; giá gửi từ trình duyệt không được tin cậy. Các mức mặc định là
30.000đ nội thành TP.HCM, 35.000đ khu vực lân cận, 40.000đ miền Nam, 45.000đ
miền Trung/Tây Nguyên và 50.000đ miền Bắc. Có thể thay đổi bằng các biến
`SHIPPING_FEE_*` trong `.env`.

Khi chưa nối API hãng vận chuyển, hệ thống tạo mã giao vận nội bộ theo cú pháp
`TECH-YYYYMMDD-XXXXXX` để cửa hàng và khách cùng đối chiếu. Mã này được ghi rõ
là mã TechEcommerce, không phải mã GHN. Khi cấu hình GHN, backend thay bằng mã
`order_code` do GHN trả về. Adapter GHN cần `GHN_TOKEN`, `GHN_SHOP_ID`, loại
dịch vụ, khối lượng/kích thước mặc định cùng mã địa bàn GHN.
