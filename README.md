# TechEcommerce

Website thương mại điện tử chuyên cung cấp thiết bị công nghệ chính hãng (Điện thoại, Laptop, Tablet, Tai nghe, Đồng hồ thông minh, Phụ kiện, Máy chơi game) với giao diện hiện đại, tối ưu SEO Semantic HTML5 và tích hợp trợ lý AI thông minh.

---

## Tech Stack

* **Backend**: Node.js, Express.js (RESTful API), CommonJS modules.
* **Database**: MongoDB (Mongoose ODM).
* **Frontend**: Vanilla HTML5 (100% Semantic SEO), Vanilla CSS (Responsive, Dark/Light Mode), Vanilla JavaScript.
* **Security & Optimization**: Helmet, CORS origin whitelisting, Express Rate Limit, JWT authentication, Bcrypt password hashing.
* **Payment Integrations**: VNPAY sandbox, MoMo gateway, OnePay, ZaloPay, Kredivo installment & Bank transfer QR.
* **Deployments**: Vercel (Serverless Express + Static CDN), Render (Node.js Web Service).

---

## Project Structure

```text
TechEcommerce/
├── backend/                        # Backend Node.js / Express
│   ├── src/                        # Mã nguồn ứng dụng backend
│   │   ├── config/                 # Cấu hình kết nối cơ sở dữ liệu (MongoDB)
│   │   ├── middleware/             # Middleware xác thực JWT và phân quyền
│   │   ├── models/                 # Mongoose schemas (Product, Order, Customer,...)
│   │   ├── routes/                 # Express API routes theo từng domain
│   │   ├── utils/                  # Tiện ích thanh toán, gửi mail, SMS, tính cước
│   │   └── app.js                  # Cấu hình Express app, middleware & static files
│   ├── scripts/                    # Scripts khởi tạo dữ liệu mẫu (seed, admin, catalog)
│   ├── server.js                   # HTTP Server entrypoint khởi chạy listener
│   ├── .env.example                # Biến môi trường mẫu cho backend
│   ├── package.json
│   └── package-lock.json
│
├── frontend/                       # Source of Truth cho giao diện web
│   ├── admin/                      # Trang quản trị (dashboard, đơn hàng, sản phẩm,...)
│   ├── assets/                     # Tài nguyên tĩnh
│   │   ├── css/                    # Stylesheets (neo-circuit, cellphones-footer, auth,...)
│   │   ├── data/                   # Dữ liệu tĩnh phụ trợ
│   │   ├── icons/                  # Biểu tượng vector SVG
│   │   ├── images/                 # Hình ảnh sản phẩm, banner, đối tác
│   │   └── js/                     # Logic giao diện (shop, auth, cart, chatbox,...)
│   ├── pages/                      # Các trang storefront (auth, catalog, checkout, legal)
│   └── index.html                  # Trang chủ storefront
│
├── public/                         # Build output đồng bộ từ frontend/ (phục vụ Vercel CDN)
├── docs/                           # Tài liệu kỹ thuật, kiến trúc và ảnh chụp màn hình
│   └── screenshots/                # Ảnh chụp kiểm thử giao diện
├── scripts/                        # Scripts phát triển, build và công cụ
│   ├── prepare-vercel.js           # Đồng bộ frontend sang public khi chạy npm run build
│   ├── seed-production.ps1         # Script kích hoạt seed dữ liệu trên môi trường deploy
│   └── tools/                      # Công cụ hỗ trợ crawl, tối ưu ảnh
│       └── scrapers/               # Bộ công cụ thu thập và kiểm định dữ liệu sản phẩm
│
├── .editorconfig
├── .gitignore                      # Danh sách tệp loại trừ Git chuẩn hóa
├── AGENTS.md                       # Quy tắc kỹ thuật Frontend Semantic & SEO
├── README.md                       # Tài liệu hướng dẫn dự án
├── render.yaml                     # Cấu hình deploy tự động lên Render.com
├── vercel.json                     # Cấu hình routing và CDN headers cho Vercel
├── server.js                       # Bridge entrypoint phục vụ Vercel Express runtime
└── package.json                    # Root package scripts điều phối dự án
```

---

## Requirements

* **Node.js**: Phiên bản `>= 18.x` (khuyên dùng Node 20.x hoặc 22.x LTS).
* **npm**: Phiên bản `>= 9.x`.
* **MongoDB**: MongoDB Server local (`mongodb://localhost:27017`) hoặc MongoDB Atlas connection URI.

---

## Installation

1. Clone kho lưu trữ về máy:
   ```bash
   git clone https://github.com/Bizarbon/Project.git
   cd Project
   ```

2. Cài đặt dependencies cho root và backend:
   ```bash
   npm install
   npm run install:backend
   ```

3. Thiết lập biến môi trường:
   ```bash
   # Tạo file .env từ file mẫu
   copy .env.example .env
   copy backend\.env.example backend\.env
   ```

---

## Environment Variables

Các biến môi trường chính trong file `.env`:

| Biến | Ý nghĩa | Mặc định |
| :--- | :--- | :--- |
| `PORT` | Cổng HTTP Server lắng nghe | `5000` |
| `NODE_ENV` | Môi trường chạy (`development` / `production`) | `development` |
| `MONGO_URI` | Chuỗi kết nối MongoDB | `mongodb://localhost:27017/ecommerce_mini` |
| `JWT_SECRET` | Khóa bí mật ký token JWT (tối thiểu 32 ký tự) | `replace-with-a-long-random-secret` |
| `JWT_EXPIRES_IN` | Thời gian hết hạn của JWT token | `7d` |
| `APP_BASE_URL` | URL gốc của ứng dụng (phục vụ CORS) | `http://localhost:5000` |
| `PAYMENT_GATEWAY_MODE` | Chế độ thanh toán (`mock` / `sandbox` / `live`) | `mock` |

---

## Development

Khởi chạy ứng dụng ở chế độ phát triển (backend tự động phục vụ thư mục `frontend/`):

```bash
# Khởi chạy server development
npm run dev

# Hoặc chạy backend trực tiếp
cd backend
npm run dev
```

Mở trình duyệt truy cập: `http://localhost:5000/`

---

## Database Seeding

Hệ thống cung cấp các lệnh tạo dữ liệu mẫu phong phú:

```bash
# Nạp toàn bộ danh mục sản phẩm chuẩn hóa
npm run seed

# Tạo tài khoản quản trị mặc định (admin)
npm run seed:admin

# Bổ sung danh mục Máy chơi game (PS5, Switch,...)
npm run seed:gaming
```

---

## Production & Build

Khi có bất kỳ thay đổi nào trong thư mục `frontend/`, luôn thực hiện lệnh build để đồng bộ sang `public/`:

```bash
npm run build
```

Khởi chạy ở chế độ Production:
```bash
npm start
```

---

## Deployment

### 1. Vercel
* Dự án đã có sẵn cấu hình [vercel.json](file:///i:/Project/vercel.json) và [server.js](file:///i:/Project/server.js).
* Build Command: `npm run build`
* Output Directory: Để mặc định (Vercel tự phục vụ file tĩnh trong `public/` và định tuyến Express qua `server.js`).

### 2. Render.com
* Dự án có sẵn [render.yaml](file:///i:/Project/render.yaml) để deploy Infrastructure as Code.
* Build Command: `npm --prefix backend ci --omit=dev`
* Start Command: `npm start`
* Health Check Path: `/api/health`

---

## Backend Architecture

Backend được tổ chức theo nguyên lý phân tách trách nhiệm (Separation of Concerns):
1. **Server Lifecycle (`backend/server.js`)**: Quản lý khởi động tiến trình, nạp cấu hình `.env`, mở kết nối MongoDB và thiết lập quét hủy đơn quá hạn định kỳ.
2. **Application Setup (`backend/src/app.js`)**: Cấu hình Express middleware (Helmet, CORS whitelist, body parsers, rate limiters, request loggers, static file routes, và global error handlers).
3. **Routing (`backend/src/routes/`)**: Định tuyến endpoint cho từng phân hệ (Auth, Product, Order, Customer, Payment, Review, Chat,...).
4. **Data Models (`backend/src/models/`)**: Định nghĩa schema Mongoose có ràng buộc validation chặt chẽ.
5. **Services & Utilities (`backend/src/utils/`)**: Xử lý logic nghiệp vụ thanh toán (VNPAY, MoMo), mã giảm giá, kiểm tra tồn kho, gửi email hóa đơn và tính phí vận chuyển.

---

## Frontend Architecture

* **Kiến trúc Vanilla Web chuẩn SEO**: Không phụ thuộc vào thư viện bên thứ ba nặng nề, tốc độ tải tức thì.
* **100% Semantic HTML5**: Tuân thủ nghiêm ngặt quy tắc tại [AGENTS.md](file:///i:/Project/AGENTS.md), sử dụng đúng thẻ ngữ nghĩa (`main`, `nav`, `section`, `article`, `figure`), hỗ trợ tối đa cho Google Search và các AI Web Crawlers.
* **Asset Sync Pipeline**: Phát triển tập trung tại `frontend/`, khi deploy hoặc build sẽ tự động dọn sạch và đồng bộ tài nguyên sang `public/` đảm bảo tính nhất quán tuyệt đối.
