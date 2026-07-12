const dotenv = require('dotenv');
const path = require('path');
const Customer = require('../models/Customer');
const connectDB = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
    try {
        const adminPassword = String(process.env.ADMIN_PASSWORD || '');
        if (adminPassword.length < 12) {
            throw new Error('ADMIN_PASSWORD phải có ít nhất 12 ký tự.');
        }

        await connectDB();

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@techecommerce.vn';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';

        const adminExists = await Customer.findOne({
            $or: [{ email: adminEmail }, { username: adminUsername }]
        });

        if (adminExists) {
            console.log('Admin already exists!');
            process.exit(0);
        }

        const adminUser = new Customer({
            name: 'Quản trị viên',
            username: adminUsername,
            email: adminEmail,
            phone: '0987654321',
            address: 'Hệ thống TechStore',
            password: adminPassword,
            isAdmin: true
        });

        await adminUser.save();
        console.log('Admin user created successfully!');
        console.log(`Username: ${adminUsername}`);
        console.log(`Email: ${adminEmail}`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
