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
