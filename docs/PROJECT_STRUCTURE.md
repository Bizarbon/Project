# Ecommerce Project Structure

Xem thêm [Bảo mật, AI giọng nói và thanh toán](SECURITY_AI_PAYMENT.md) để cấu hình và trình bày các chức năng mới.

```text
ecommerce/
  backend/                Express API, MongoDB models, business routes
    config/               Database and environment configuration
    middleware/           Authentication and authorization middleware
    models/               Mongoose schemas
    routes/               REST API routes
    scripts/              Seed, enrichment, and maintenance scripts
    storage/logs/         Local runtime and test logs
    utils/                Shared backend helpers
    server.js             API entry point
  frontend/               Static client application
    admin/                Admin screens
    assets/
      css/                Stylesheets
      images/             Static images
      js/                 Browser JavaScript modules
    pages/
      account/            Customer account and order pages
      auth/               Login, register, and social login mock pages
      catalog/            Product detail pages
      checkout/           Payment result and checkout flow pages
      legal/              Policy and support pages
    storage/logs/         Local frontend server logs
    index.html            Storefront entry page
  docs/                   Technical and project documentation
```

## Common Commands

Run backend:

```powershell
cd I:\Project\Web\ecommerce\backend
npm start
```

Run frontend:

```powershell
cd I:\Project\Web\ecommerce\frontend
python -m http.server 5500
```

Seed data:

```powershell
cd I:\Project\Web\ecommerce\backend
npm run seed
npm run seed:admin
npm run seed:enrich
npm run seed:features
```
