# Deploy TechEcommerce to Render

TechEcommerce is deployed as one Node.js web service. Express serves both `/api/*` and the static files in `frontend/`, while MongoDB Atlas stores production data.

## 1. Prepare MongoDB Atlas

1. Create an Atlas project and an M0 cluster.
2. Create a database user with a strong, unique password.
3. In **Network Access**, allow connections from Render. For a school demo on Render Free, use `0.0.0.0/0` and protect the database with a strong user/password.
4. Copy the Node.js connection string and set the database name to `ecommerce`:

```text
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/ecommerce?retryWrites=true&w=majority
```

Encode special characters in the username or password before placing them in the URI.

## 2. Push the project to GitHub

Run these commands from the `Web/ecommerce` directory:

```powershell
git init
git add .
git commit -m "Prepare TechEcommerce for production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/techecommerce.git
git push -u origin main
```

Confirm that `backend/.env`, `node_modules`, and log files are not visible on GitHub.

## 3. Create the Render service

The repository includes `render.yaml`, so use **New > Blueprint** in Render and select the GitHub repository.

Render reads these settings automatically:

```text
Runtime: Node
Build command: npm --prefix backend ci --omit=dev
Start command: npm start
Health check: /api/health
```

When prompted for `MONGO_URI`, paste the Atlas connection string. Render generates `JWT_SECRET` automatically.

The first deployment uses mock payment mode. VNPay and MoMo can be enabled later by setting `PAYMENT_GATEWAY_MODE=real` and adding all gateway sandbox secrets.

## 4. Seed production data once

Do not add seed commands to every deployment. Seed only once from a trusted machine:

```powershell
$env:MONGO_URI='mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/ecommerce'
npm run seed
npm run seed:admin
Remove-Item Env:MONGO_URI
```

Review seed scripts before running them against a database that already contains orders or customers.

## 5. Verify the deployment

Open the Render URL and verify:

```text
https://YOUR-SERVICE.onrender.com/
https://YOUR-SERVICE.onrender.com/api/health
https://YOUR-SERVICE.onrender.com/pages/auth/login.html
https://YOUR-SERVICE.onrender.com/pages/legal/privacy.html
```

Then test registration, login, product loading, cart, address suggestions, order creation and the admin pages.

## 6. Add a custom domain

In Render, open **Settings > Custom Domains**, add the domain, configure the DNS records shown by Render and click **Verify**. Render provisions and renews HTTPS automatically.

## Production checklist

- Never commit `.env` or payment/database secrets.
- Replace mock social login before treating it as a real authentication provider.
- Keep payment gateways in mock or sandbox mode until callback URLs and signatures are verified.
- Use HTTPS and a long random `JWT_SECRET`.
- Back up Atlas before reseeding or changing schemas.
- Replace the public Photon demo with a dedicated geocoder for sustained commercial traffic.
