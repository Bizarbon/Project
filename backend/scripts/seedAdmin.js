const dotenv = require('dotenv');
const path = require('path');
const Customer = require('../models/Customer');
const connectDB = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminExists = await Customer.findOne({
            $or: [{ email: 'admin@techstore.vn' }, { email: 'admin@shopmini.vn' }, { username: 'admin' }]
        });

        if (adminExists) {
            console.log('Admin already exists!');
            process.exit(0);
        }

        const adminUser = new Customer({
            name: 'Quản trị viên',
            username: 'admin',
            email: 'admin@techstore.vn',
            phone: '0987654321',
            address: 'Hệ thống TechStore',
            password: 'admin123@password',
            isAdmin: true
        });

        await adminUser.save();
        console.log('Admin user created successfully!');
        console.log('Username: admin');
        console.log('Email: admin@techstore.vn');
        console.log('Password: admin123@password');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
