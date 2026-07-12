const dotenv = require('dotenv');
const path = require('path');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const connectDB = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Dữ liệu sản phẩm mẫu - chia theo danh mục
const sampleProducts = [
    // ===== ĐIỆN THOẠI =====
    {
        name: 'iPhone 15 Pro Max',
        price: 29990000,
        description: 'Chip A17 Pro, camera 48MP, titanium design',
        category: 'Điện thoại',
        stock: 50,
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400'
    },
    {
        name: 'Samsung Galaxy S24 Ultra',
        price: 27990000,
        description: 'Galaxy AI, S Pen, camera 200MP',
        category: 'Điện thoại',
        stock: 45,
        image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400'
    },
    {
        name: 'Google Pixel 8 Pro',
        price: 22990000,
        description: 'Tensor G3, camera AI tốt nhất Android',
        category: 'Điện thoại',
        stock: 30,
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400'
    },
    {
        name: 'Xiaomi 14 Ultra',
        price: 19990000,
        description: 'Camera Leica, Snapdragon 8 Gen 3',
        category: 'Điện thoại',
        stock: 35,
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'
    },
    {
        name: 'OPPO Find X7 Ultra',
        price: 23990000,
        description: 'Camera Hasselblad, màn hình 2K AMOLED',
        category: 'Điện thoại',
        stock: 20,
        image: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400'
    },

    // ===== LAPTOP =====
    {
        name: 'MacBook Pro M3 Max',
        price: 75990000,
        description: 'Chip M3 Max, RAM 36GB, SSD 1TB, màn hình Liquid Retina XDR',
        category: 'Laptop',
        stock: 15,
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400'
    },
    {
        name: 'MacBook Air M3',
        price: 27990000,
        description: 'Mỏng nhẹ, chip M3, pin 18 giờ',
        category: 'Laptop',
        stock: 40,
        image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400'
    },
    {
        name: 'Dell XPS 15',
        price: 35990000,
        description: 'Intel Core i9, RTX 4060, màn OLED 3.5K',
        category: 'Laptop',
        stock: 25,
        image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400'
    },
    {
        name: 'ASUS ROG Zephyrus G16',
        price: 42990000,
        description: 'RTX 4070, Intel Core i9, 240Hz gaming',
        category: 'Laptop',
        stock: 18,
        image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400'
    },
    {
        name: 'ThinkPad X1 Carbon Gen 11',
        price: 32990000,
        description: 'Doanh nhân, Intel Evo, 1.12kg siêu nhẹ',
        category: 'Laptop',
        stock: 22,
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400'
    },

    // ===== TABLET =====
    {
        name: 'iPad Pro M4 12.9"',
        price: 28990000,
        description: 'Chip M4, màn hình OLED tandem, Apple Pencil Pro',
        category: 'Tablet',
        stock: 30,
        image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400'
    },
    {
        name: 'iPad Air M2',
        price: 16990000,
        description: 'Chip M2, màn hình 10.9 inch Liquid Retina',
        category: 'Tablet',
        stock: 40,
        image: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400'
    },
    {
        name: 'Samsung Galaxy Tab S9 Ultra',
        price: 25990000,
        description: 'Snapdragon 8 Gen 2, S Pen, Dynamic AMOLED 2X',
        category: 'Tablet',
        stock: 20,
        image: 'https://images.unsplash.com/photo-1632882765546-1ee75f53becb?w=400'
    },
    {
        name: 'iPad Mini 6',
        price: 12990000,
        description: 'Nhỏ gọn, A15 Bionic, màn hình 8.3 inch',
        category: 'Tablet',
        stock: 35,
        image: 'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=400'
    },

    // ===== TAI NGHE =====
    {
        name: 'AirPods Pro 2 (USB-C)',
        price: 6490000,
        description: 'Chống ồn chủ động, Adaptive Audio, chip H2',
        category: 'Tai nghe',
        stock: 100,
        image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400'
    },
    {
        name: 'Sony WH-1000XM5',
        price: 8490000,
        description: 'Chống ồn #1 thế giới, 30 giờ pin, LDAC',
        category: 'Tai nghe',
        stock: 55,
        image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400'
    },
    {
        name: 'Samsung Galaxy Buds3 Pro',
        price: 4990000,
        description: 'ANC thông minh, Hi-Fi 24bit, chống nước IPX7',
        category: 'Tai nghe',
        stock: 70,
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400'
    },
    {
        name: 'AirPods Max',
        price: 12990000,
        description: 'Over-ear cao cấp, Spatial Audio, vỏ nhôm nguyên khối',
        category: 'Tai nghe',
        stock: 25,
        image: 'https://images.unsplash.com/photo-1625245488600-f03fef636a3c?w=400'
    },

    // ===== ĐỒNG HỒ THÔNG MINH =====
    {
        name: 'Apple Watch Ultra 2',
        price: 21990000,
        description: 'Titanium, GPS + Cellular, 72 giờ pin, lặn biển',
        category: 'Đồng hồ thông minh',
        stock: 20,
        image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400'
    },
    {
        name: 'Apple Watch Series 9',
        price: 10990000,
        description: 'Chip S9, Double Tap, màn hình sáng 2000 nits',
        category: 'Đồng hồ thông minh',
        stock: 60,
        image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400'
    },
    {
        name: 'Samsung Galaxy Watch 6',
        price: 7990000,
        description: 'BioActive Sensor, Wear OS, bezel xoay',
        category: 'Đồng hồ thông minh',
        stock: 40,
        image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400'
    },

    // ===== PHỤ KIỆN =====
    {
        name: 'Logitech MX Master 3S',
        price: 2490000,
        description: 'Chuột không dây, 8K DPI, sạc USB-C, multi-device',
        category: 'Phụ kiện',
        stock: 80,
        image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400'
    },
    {
        name: 'Samsung Monitor 32" 4K',
        price: 11990000,
        description: 'Màn hình 4K UHD, HDR10, USB-C 65W',
        category: 'Phụ kiện',
        stock: 30,
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400'
    },
    {
        name: 'Keychron K8 Pro',
        price: 2290000,
        description: 'Bàn phím cơ Gateron, RGB, kết nối 3 chế độ',
        category: 'Phụ kiện',
        stock: 65,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400'
    },
    {
        name: 'Apple Magic Keyboard',
        price: 3490000,
        description: 'Touch ID, bàn phím số, kết nối Bluetooth',
        category: 'Phụ kiện',
        stock: 45,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400'
    },
    {
        name: 'Anker PowerCore 26800mAh',
        price: 1290000,
        description: 'Sạc dự phòng, 3 cổng USB, sạc nhanh PD 45W',
        category: 'Phụ kiện',
        stock: 90,
        image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400'
    },
    {
        name: 'Apple Pencil Pro',
        price: 3290000,
        description: 'Haptic feedback, tìm kiếm, barrel roll',
        category: 'Phụ kiện',
        stock: 50,
        image: 'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=400'
    }
];

const sampleCustomers = [
    {
        name: 'Vũ Phi Long',
        username: 'vuphilong',
        email: 'vuphilong@shopmini.vn',
        phone: '0987654321',
        address: 'IUH - Gò Vấp, TP.HCM'
    },
    {
        name: 'Nguyễn Văn A',
        username: 'nguyenvana',
        email: 'nguyenvana@email.com',
        phone: '0901234567',
        address: '123 Đường Lê Lợi, Q1, TP.HCM'
    },
    {
        name: 'Trần Thị B',
        username: 'tranthib',
        email: 'tranthib@email.com',
        phone: '0912345678',
        address: '456 Đường Nguyễn Huệ, Q1, TP.HCM'
    },
    {
        name: 'Lê Văn C',
        username: 'levanc',
        email: 'levanc@email.com',
        phone: '0923456789',
        address: '789 Đường Hai Bà Trưng, Q3, TP.HCM'
    },
    {
        name: 'Phạm Thị D',
        username: 'phamthid',
        email: 'phamthid@email.com',
        phone: '0934567890',
        address: '100 Đường CMT8, Q10, TP.HCM'
    },
    {
        name: 'Hoàng Văn E',
        username: 'hoangvane',
        email: 'hoangvane@email.com',
        phone: '0945678901',
        address: '200 Đường 3/2, Q11, TP.HCM'
    }
];

// Hàm seed dữ liệu
const seedData = async () => {
    try {
        const customerPassword = String(process.env.SEED_CUSTOMER_PASSWORD || '');
        if (customerPassword.length < 12) {
            throw new Error('SEED_CUSTOMER_PASSWORD phải có ít nhất 12 ký tự.');
        }

        await connectDB();

        console.log('🗑️  Đang xóa dữ liệu cũ...');
        await Product.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});

        console.log('📦 Đang thêm sản phẩm...');
        const products = [];
        for (let p of sampleProducts) {
            products.push(await new Product(p).save());
        }
        console.log(`✅ Đã thêm ${products.length} sản phẩm`);

        console.log('👥 Đang thêm khách hàng...');
        const customers = [];
        for (const customer of sampleCustomers) {
            customers.push(await new Customer({
                ...customer,
                password: customerPassword,
                isAdmin: false
            }).save());
        }
        console.log(`✅ Đã thêm ${customers.length} khách hàng`);

        console.log('🛒 Đang thêm đơn hàng mẫu...');
        const sampleOrders = [
            {
                customer: customers[0]._id,
                customerName: customers[0].name,
                customerPhone: customers[0].phone,
                products: [
                    {
                        product: products[0]._id,
                        productName: products[0].name,
                        quantity: 1,
                        price: products[0].price
                    },
                    {
                        product: products[14]._id,
                        productName: products[14].name,
                        quantity: 1,
                        price: products[14].price
                    }
                ],
                totalAmount: products[0].price + products[14].price,
                status: 'completed'
            },
            {
                customer: customers[1]._id,
                customerName: customers[1].name,
                customerPhone: customers[1].phone,
                products: [
                    {
                        product: products[5]._id,
                        productName: products[5].name,
                        quantity: 1,
                        price: products[5].price
                    }
                ],
                totalAmount: products[5].price,
                status: 'processing'
            },
            {
                customer: customers[2]._id,
                customerName: customers[2].name,
                customerPhone: customers[2].phone,
                products: [
                    {
                        product: products[10]._id,
                        productName: products[10].name,
                        quantity: 1,
                        price: products[10].price
                    },
                    {
                        product: products[18]._id,
                        productName: products[18].name,
                        quantity: 1,
                        price: products[18].price
                    }
                ],
                totalAmount: products[10].price + products[18].price,
                status: 'pending'
            }
        ];

        const orders = [];
        for (let o of sampleOrders) {
            orders.push(await new Order(o).save());
        }
        console.log(`✅ Đã thêm ${orders.length} đơn hàng`);

        // Thống kê theo danh mục
        const categories = [...new Set(sampleProducts.map(p => p.category))];
        console.log('\n🎉 Seed data thành công!');
        console.log('📊 Thống kê:');
        console.log(`   - Sản phẩm: ${products.length}`);
        categories.forEach(cat => {
            const count = sampleProducts.filter(p => p.category === cat).length;
            console.log(`     • ${cat}: ${count} sản phẩm`);
        });
        console.log(`   - Khách hàng: ${customers.length}`);
        console.log(`   - Đơn hàng: ${orders.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi seed data:', error);
        process.exit(1);
    }
};

seedData();
