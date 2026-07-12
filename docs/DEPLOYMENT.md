# Deploy TechEcommerce to Vercel

TechEcommerce runs as one Express application on Vercel. The files in `frontend/` are copied to `public/` during the build and served by Vercel's CDN. MongoDB Atlas stores production data.

## 1. Production source

```text
Repository: https://github.com/Bizarbon/Project
Branch: techecommerce-deploy
```

The deployment branch does not contain the previous mock Google or Facebook login pages. Never commit `.env`, database credentials, or payment secrets.

## 2. Import the project

1. Open `https://vercel.com/new` and sign in with GitHub.
2. Import `Bizarbon/Project`.
3. Select the `techecommerce-deploy` branch.
4. Keep the project root as `./`.
5. Vercel reads `vercel.json`; do not set a separate output directory.

## 3. Environment variables

Add these variables for Production, Preview, and Development as needed:

```text
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/ecommerce?retryWrites=true&w=majority
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
NODE_ENV=production
PAYMENT_GATEWAY_MODE=mock
```

`MONGO_URI` must use the Atlas database user password, not the Atlas account password. Keep Atlas Network Access configured for Vercel's dynamic outbound addresses. For a graduation demo, `0.0.0.0/0` can be used with a strong database password.

Vercel automatically provides `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`. The payment callback helpers use these values, so `APP_BASE_URL` and `FRONTEND_BASE_URL` are optional.

## 4. Deploy

Click **Deploy**. The build performs these steps automatically:

```text
npm install
npm run build
```

The build synchronizes `frontend/` to the tracked `public/` directory so Vercel can discover and serve the static storefront through its CDN.

## 5. Seed production data once

Do not seed on every deployment. After the first production deployment, set `MONGO_URI` temporarily in a trusted local terminal and run:

```powershell
$env:MONGO_URI='YOUR_ATLAS_CONNECTION_STRING'
$env:SEED_CUSTOMER_PASSWORD='YOUR_PRIVATE_DEMO_PASSWORD'
$env:ADMIN_PASSWORD='YOUR_PRIVATE_ADMIN_PASSWORD'
npm run seed
npm run seed:admin
Remove-Item Env:MONGO_URI
Remove-Item Env:SEED_CUSTOMER_PASSWORD
Remove-Item Env:ADMIN_PASSWORD
```

Review the seed scripts and set a private administrator password before running them against production.

## 6. Verify production

Check these routes on the generated `.vercel.app` domain:

```text
/
/api/health
/pages/auth/login.html
/pages/auth/register.html
/pages/legal/privacy.html
```

Then test registration, login, product loading, cart persistence, address selection, order creation, profile editing, chatbot responses, and admin authorization.

## Vercel notes

- Vercel Functions limit request and response payloads to 4.5 MB. Keep avatar payloads below this limit.
- Express reuses the cached Mongoose connection when the function instance stays warm.
- Frontend assets are served from `public/`; `express.static()` is used only for local and traditional Node hosting.
- Mock payment mode is suitable only for the graduation demonstration. Configure signed sandbox credentials before enabling real VNPay or MoMo flows.
- Do not reintroduce pages that imitate third-party login screens. Use real OAuth integrations when social login is implemented.
