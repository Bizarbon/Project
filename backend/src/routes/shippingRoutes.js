const express = require('express');
const { quoteShipping } = require('../utils/shipping');
const { shippingProviderStatus } = require('../utils/shippingProvider');

const router = express.Router();

router.get('/provider', (req, res) => res.json(shippingProviderStatus()));

router.post('/quote', (req, res) => {
    try {
        return res.json(quoteShipping({
            provinceCode: req.body.provinceCode,
            address: req.body.address
        }));
    } catch (error) {
        return res.status(error.statusCode || 400).json({ message: error.message });
    }
});

module.exports = router;
