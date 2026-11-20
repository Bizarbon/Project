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
├── backend/                        # Backend Node.js / Express REST API & AI Engine
│   ├── src/                        # Mã nguồn ứng dụng backend
│   │   ├── config/                 # Cấu hình kết nối cơ sở dữ liệu (MongoDB)
│   │   ├── data/                   # Dữ liệu chuẩn danh mục sản phẩm (uniformCatalog)
│   │   ├── middleware/             # Middleware xác thực JWT và phân quyền Admin/Staff
│   │   ├── models/                 # Mongoose schemas (Product, Order, Customer, ChatSession,...)
│   │   ├── routes/                 # Express REST API routes theo domain (products, orders, chat,...)
│   │   ├── services/               # Dịch vụ nghiệp vụ phân tách theo domain
│   │   │   ├── ai/                 # Động cơ AI LLM-First Agentic, 8 Tools, RAG, Memory & NLU
│   │   │   │   ├── agenticChatService.js
│   │   │   │   ├── agenticTools.js
│   │   │   │   ├── aiModelService.js
│   │   │   │   ├── consultationCoordinator.js
│   │   │   │   ├── memoryService.js
│   │   │   │   ├── ragService.js
│   │   │   │   ├── knowledgeService.js
│   │   │   │   ├── storeKnowledgeAndChitChat.js
│   │   │   │   └── nlu/            # Guardrails, phân loại ý định & trích xuất ngân sách
│   │   │   └── auth/               # Dịch vụ xác thực Google OAuth
│   │   ├── utils/                  # Tiện ích thanh toán, email, SMS, vận chuyển, trả góp
│   │   └── app.js                  # Cấu hình Express app, bảo mật Helmet/CORS & static routing
│   ├── scripts/                    # Scripts khởi tạo & đồng bộ dữ liệu mẫu MongoDB (seed)
│   ├── server.js                   # HTTP Server entrypoint
│   ├── .env.example                # Biến môi trường mẫu cho backend
│   └── package.json
│
├── frontend/                       # Source of Truth cho giao diện web (100% Semantic HTML5)
│   ├── admin/                      # Trang quản trị (dashboard, đơn hàng, sản phẩm, nhân sự, tài chính)
│   ├── assets/                     # Tài nguyên tĩnh
│   │   ├── css/                    # Stylesheets (neo-circuit, chatbox, ai-assistant, auth,...)
│   │   ├── data/                   # Dữ liệu địa giới hành chính Việt Nam
│   │   ├── icons/                  # Biểu tượng vector SVG
│   │   ├── images/                 # Hình ảnh sản phẩm, banner, logo
│   │   ├── uploads/                # Ảnh sản phẩm tải lên
│   │   └── js/                     # Logic giao diện (shop, auth, chatbox, ai-assistant, orders,...)
│   ├── pages/                      # Các trang storefront phân nhóm rõ ràng
│   │   ├── account/                # Hồ sơ cá nhân, lịch sử & chi tiết đơn hàng
│   │   ├── ai/                     # Trang Trợ lý AI toàn màn hình (assistant.html)
│   │   ├── auth/                   # Đăng nhập, đăng ký, OAuth, khôi phục mật khẩu
│   │   ├── catalog/                # Trang chi tiết sản phẩm (product.html)
│   │   ├── checkout/               # Giỏ hàng, thanh toán & kết quả giao dịch
│   │   ├── legal/                  # Chính sách bảo hành, đổi trả, giao hàng, FAQ, trả góp
│   │   ├── tools/                  # Công cụ phối góc làm việc (setup-builder.html)
│   │   └── blog.html               # Tin công nghệ & cẩm nang mua sắm
│   ├── index.html                  # Trang chủ storefront
│   ├── robots.txt
│   └── sitemap.xml
│
├── public/                         # Build output đồng bộ tự động từ frontend/ (`npm run build`)
├── tests/                          # Bộ kiểm thử tự động
│   ├── ai/                         # Kiểm thử Agentic Dual-Mode, Function Calling, Web Search & Cart
│   └── nlu/                        # Bộ kiểm thử hồi quy NLU 84 test cases (`npm run test:nlu`)
├── scripts/                        # Scripts build, deploy & phát triển cục bộ
│   ├── prepare-vercel.js           # Đồng bộ frontend/ -> public/ cho Vercel CDN
│   ├── seed-production.ps1         # Script seed an toàn cho MongoDB Atlas production
│   ├── frontend-dev-server.py      # Dev server tĩnh dự phòng
│   └── tools/                      # Công cụ xử lý ảnh sản phẩm
├── docs/                           # Tài liệu kỹ thuật, kiến trúc, bảo mật & triển khai
│   ├── DEPLOYMENT.md
│   ├── PROJECT_STRUCTURE.md
│   ├── SECURITY_AI_PAYMENT.md
│   └── TYPOGRAPHY.md
│
├── .editorconfig
├── .gitignore
├── .htmlvalidate.json
├── AGENTS.md                       # Quy chuẩn Semantic HTML5, SEO & AI Search
├── README.md
├── render.yaml                     # Cấu hình deploy Render.com
├── vercel.json                     # Cấu hình Express runtime & CDN headers Vercel
├── server.js                       # Bridge entrypoint phục vụ Vercel Express runtime
└── package.json                    # Root npm scripts điều phối toàn dự án
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
