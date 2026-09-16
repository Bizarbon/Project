require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { expireOverduePayments } = require('./src/utils/paymentExpiry');

const PORT = process.env.PORT || 5000;

async function startServer() {
    await connectDB();
    const expiryTimer = setInterval(() => {
        expireOverduePayments().catch(error => console.error('Payment expiry sweep error:', error.message));
    }, 60000);
    expiryTimer.unref();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`TechEcommerce running at http://0.0.0.0:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch(error => {
        console.error('Server startup error:', error.message);
        process.exit(1);
    });
}

module.exports = app;
