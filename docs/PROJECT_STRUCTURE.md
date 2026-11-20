# TechEcommerce — Kiến trúc & Cây thư mục chuẩn

Xem thêm [Bảo mật, AI và Thanh toán](SECURITY_AI_PAYMENT.md) và [Hướng dẫn Triển khai](DEPLOYMENT.md).

```text
TechEcommerce/
├── backend/                        # Node.js / Express REST API & AI Agentic Engine
│   ├── src/
│   │   ├── config/                 # Kết nối MongoDB (db.js)
│   │   ├── data/                   # Dữ liệu danh mục chuẩn hóa (uniformCatalog.js)
│   │   ├── middleware/             # Xác thực JWT & phân quyền (auth.js)
│   │   ├── models/                 # Mongoose schemas (Product, Order, Customer, ChatSession, KnowledgeArticle,...)
│   │   ├── routes/                 # REST API endpoints theo domain (auth, products, orders, chat, payment,...)
│   │   ├── services/
│   │   │   ├── ai/                 # Động cơ AI LLM-First (agenticChatService, agenticTools, aiModelService, ragService, memoryService, nlu/)
│   │   │   └── auth/               # Dịch vụ Google OAuth (googleAuthService.js)
│   │   ├── utils/                  # Tiện ích thanh toán, email, SMS, trả góp, vận chuyển
│   │   └── app.js                  # Express app chính (Helmet, CORS, Rate Limit, Static serving)
│   ├── scripts/                    # 7 script seed dữ liệu chuẩn cho MongoDB
│   ├── server.js                   # HTTP listener entrypoint
│   └── package.json
├── frontend/                       # Source of Truth giao diện (100% Semantic HTML5)
│   ├── admin/                      # Hệ thống quản trị (11 trang quản lý)
│   ├── assets/                     # css/, js/, icons/, images/, uploads/, data/
│   ├── pages/                      # account/, ai/, auth/, catalog/, checkout/, legal/, tools/, blog.html
│   ├── index.html                  # Trang chủ cửa hàng
│   ├── robots.txt
│   └── sitemap.xml
├── public/                         # Thư mục xuất bản tự động từ frontend/ (`npm run build`)
├── tests/
│   ├── ai/                         # Kiểm thử Agentic Dual-Mode, Function Calling, Web Search & Add-to-Cart
│   └── nlu/                        # Kiểm thử hồi quy NLU 84 test cases
├── scripts/                        # prepare-vercel.js, seed-production.ps1, frontend-dev-server.py, tools/
├── docs/                           # Tài liệu triển khai, bảo mật, typography & cấu trúc dự án
├── AGENTS.md                       # Quy chuẩn Semantic HTML5, SEO & AI Search
├── package.json                    # Scripts điều phối toàn dự án
├── server.js                       # Bridge entrypoint cho Vercel Express runtime
├── vercel.json                     # Cấu hình deploy Vercel
└── render.yaml                     # Cấu hình deploy Render.com
```

## Lệnh thường dùng

```powershell
# Khởi chạy website (Backend API + Frontend tại http://127.0.0.1:5000)
npm start

# Đồng bộ mã nguồn frontend/ -> public/ trước khi deploy
npm run build

# Chạy bộ kiểm thử hồi quy NLU (84 test cases)
npm run test:nlu

# Chạy bộ kiểm thử AI Agentic Dual-Mode (Tool Calling, Web Search, Add-to-Cart)
npm run test:ai

# Seed dữ liệu mẫu MongoDB
npm run seed
npm run seed:admin
```
