const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');

const INITIAL_SHIPPERS = [
    {
        name: 'Nguyễn Văn A',
        username: 'shipper_vana',
        phone: '0901234567',
        email: 'shipper.vana@techecommerce.vn',
        role: 'shipper',
        active: true,
        shipperStatus: 'available'
    },
    {
        name: 'Trần Văn B',
        username: 'shipper_vanb',
        phone: '0987654321',
        email: 'shipper.vanb@techecommerce.vn',
        role: 'shipper',
        active: true,
        shipperStatus: 'available'
    },
    {
        name: 'Lê Văn C',
        username: 'shipper_vanc',
        phone: '0912345678',
        email: 'shipper.vanc@techecommerce.vn',
        role: 'shipper',
        active: true,
        shipperStatus: 'available'
    }
];

async function ensureShippersSeeded() {
    try {
        const count = await Customer.countDocuments({ role: 'shipper' });
        if (count > 0) return;

        const defaultPassword = await bcrypt.hash('ShipperPass@2026', 10);

        for (const s of INITIAL_SHIPPERS) {
            const exists = await Customer.findOne({ $or: [{ username: s.username }, { phone: s.phone }] });
            if (!exists) {
                await Customer.create({
                    ...s,
                    password: defaultPassword
                });
            } else {
                exists.role = 'shipper';
                exists.active = true;
                if (!exists.shipperStatus) exists.shipperStatus = 'available';
                await exists.save();
            }
        }
        console.log('[Seed] Default shippers verified in database.');
    } catch (err) {
        console.error('[Seed] Could not seed shippers:', err.message);
    }
}

module.exports = {
    ensureShippersSeeded
};
