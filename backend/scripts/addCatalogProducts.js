const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const connectDB = require('../config/db');
const Product = require('../models/Product');

const PRODUCT_CATEGORIES = new Set([
    'Điện thoại',
    'Laptop',
    'Tablet',
    'Tai nghe',
    'Đồng hồ thông minh',
    'Phụ kiện',
    'Máy chơi game'
]);

const catalogProducts = [
    {
        name: 'iPhone 16 Pro 256GB',
        brand: 'Apple',
        price: 28990000,
        description: 'Điện thoại màn hình Super Retina XDR OLED 6,3 inch, chip A18 Pro và bộ nhớ 256GB.',
        category: 'Điện thoại',
        stock: 18,
        image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Apple A18 Pro',
            ram: '',
            storage: '256GB',
            screen: 'OLED Super Retina XDR 6,3 inch, ProMotion 120Hz',
            camera: 'Camera chính 48MP',
            battery: 'Pin lithium-ion, hỗ trợ sạc nhanh',
            os: 'iOS',
            connectivity: '5G, Wi-Fi 7, Bluetooth 5.3',
            weight: '199g'
        },
        tags: ['Apple', 'iPhone', '5G', 'camera'],
        featured: true
    },
    {
        name: 'Samsung Galaxy Z Fold6 256GB',
        brand: 'Samsung',
        price: 37990000,
        description: 'Điện thoại gập với màn hình chính Dynamic AMOLED 2X 7,6 inch, RAM 12GB và bộ nhớ 256GB.',
        category: 'Điện thoại',
        stock: 9,
        image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Snapdragon 8 Gen 3 for Galaxy',
            ram: '12GB',
            storage: '256GB',
            screen: 'Dynamic AMOLED 2X 7,6 inch, 120Hz',
            camera: '50MP + 12MP + 10MP',
            battery: '4.400mAh',
            os: 'Android',
            connectivity: '5G, Wi-Fi 6E, Bluetooth 5.3',
            weight: '239g'
        },
        tags: ['Samsung', 'Galaxy', 'điện thoại gập', '5G'],
        featured: true
    },
    {
        name: 'Google Pixel 9 Pro 256GB',
        brand: 'Google',
        price: 24990000,
        description: 'Điện thoại Android màn hình LTPO OLED 6,3 inch, chip Google Tensor G4 và bộ nhớ 256GB.',
        category: 'Điện thoại',
        stock: 12,
        image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Google Tensor G4',
            ram: '16GB',
            storage: '256GB',
            screen: 'LTPO OLED 6,3 inch, 120Hz',
            camera: '50MP + 48MP + 48MP',
            battery: '4.700mAh',
            os: 'Android',
            connectivity: '5G, Wi-Fi 7, Bluetooth 5.3',
            weight: '199g'
        },
        tags: ['Google', 'Pixel', 'Android', 'camera'],
        featured: false
    },
    {
        name: 'Xiaomi 14T Pro 512GB',
        brand: 'Xiaomi',
        price: 17990000,
        description: 'Điện thoại màn hình AMOLED 144Hz, chip Dimensity 9300+ và bộ nhớ 512GB.',
        category: 'Điện thoại',
        stock: 21,
        image: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'MediaTek Dimensity 9300+',
            ram: '12GB',
            storage: '512GB',
            screen: 'AMOLED 6,67 inch, 144Hz',
            camera: 'Camera chính 50MP',
            battery: '5.000mAh',
            os: 'Xiaomi HyperOS',
            connectivity: '5G, Wi-Fi 7, Bluetooth 5.4',
            weight: '209g'
        },
        tags: ['Xiaomi', '5G', 'AMOLED', 'sạc nhanh'],
        featured: false
    },
    {
        name: 'MacBook Air 13 inch M4 16GB 256GB',
        brand: 'Apple',
        price: 26990000,
        description: 'Laptop mỏng nhẹ với chip Apple M4, RAM hợp nhất 16GB và màn hình Liquid Retina 13,6 inch.',
        category: 'Laptop',
        stock: 15,
        image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Apple M4, CPU 10 lõi',
            ram: '16GB unified memory',
            storage: '256GB SSD',
            screen: 'Liquid Retina 13,6 inch, 2560 x 1664',
            battery: 'Tối đa 18 giờ phát video',
            os: 'macOS',
            gpu: 'GPU tích hợp Apple',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, Thunderbolt 4',
            weight: '1,24kg'
        },
        tags: ['Apple', 'MacBook', 'mỏng nhẹ', 'văn phòng'],
        featured: true
    },
    {
        name: 'Dell XPS 14 9440 Core Ultra 7',
        brand: 'Dell',
        price: 42990000,
        description: 'Laptop 14,5 inch dành cho công việc sáng tạo, trang bị Intel Core Ultra 7, RAM 32GB và SSD 1TB.',
        category: 'Laptop',
        stock: 8,
        image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Intel Core Ultra 7 155H',
            ram: '32GB LPDDR5x',
            storage: '1TB NVMe SSD',
            screen: '14,5 inch 3.2K OLED',
            battery: 'Pin tích hợp',
            os: 'Windows 11',
            gpu: 'NVIDIA GeForce RTX 4050',
            connectivity: 'Wi-Fi 7, Bluetooth, Thunderbolt 4',
            weight: 'Khoảng 1,68kg'
        },
        tags: ['Dell', 'XPS', 'OLED', 'đồ họa'],
        featured: false
    },
    {
        name: 'ASUS Zenbook 14 OLED UX3405',
        brand: 'ASUS',
        price: 26990000,
        description: 'Laptop OLED 14 inch 3K 120Hz, Intel Core Ultra 7, RAM 16GB và SSD 1TB.',
        category: 'Laptop',
        stock: 14,
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Intel Core Ultra 7 155H',
            ram: '16GB LPDDR5X',
            storage: '1TB NVMe PCIe 4.0 SSD',
            screen: 'OLED 14 inch 3K, 120Hz',
            battery: 'Pin tích hợp',
            os: 'Windows 11',
            gpu: 'Intel Arc Graphics',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, Thunderbolt 4',
            weight: 'Khoảng 1,2kg'
        },
        tags: ['ASUS', 'Zenbook', 'OLED', 'mỏng nhẹ'],
        featured: false
    },
    {
        name: 'Lenovo Legion 5i Gen 9',
        brand: 'Lenovo',
        price: 35990000,
        description: 'Laptop gaming màn hình 16 inch WQXGA 165Hz, Intel Core i7 và đồ họa GeForce RTX 4060.',
        category: 'Laptop',
        stock: 10,
        image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Intel Core i7-14650HX',
            ram: '16GB DDR5',
            storage: '1TB NVMe SSD',
            screen: '16 inch WQXGA, 165Hz',
            battery: 'Pin tích hợp',
            os: 'Windows 11',
            gpu: 'NVIDIA GeForce RTX 4060',
            connectivity: 'Wi-Fi 6E, Bluetooth, USB-C',
            weight: 'Khoảng 2,3kg'
        },
        tags: ['Lenovo', 'Legion', 'gaming', 'RTX 4060'],
        featured: true
    },
    {
        name: 'iPad 11 inch A16 128GB',
        brand: 'Apple',
        price: 9990000,
        description: 'Máy tính bảng 11 inch với chip A16, màn hình Liquid Retina và bộ nhớ 128GB.',
        category: 'Tablet',
        stock: 24,
        image: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Apple A16',
            ram: '',
            storage: '128GB',
            screen: 'Liquid Retina 11 inch, 2360 x 1640',
            camera: 'Camera sau 12MP',
            battery: 'Pin lithium-polymer',
            os: 'iPadOS',
            connectivity: 'Wi-Fi 6, Bluetooth 5.3, USB-C',
            weight: '477g'
        },
        tags: ['Apple', 'iPad', 'học tập', 'giải trí'],
        featured: false
    },
    {
        name: 'Samsung Galaxy Tab S10+ 256GB',
        brand: 'Samsung',
        price: 24990000,
        description: 'Máy tính bảng màn hình Dynamic AMOLED 2X 12,4 inch, RAM 12GB và bộ nhớ 256GB.',
        category: 'Tablet',
        stock: 13,
        image: 'https://images.unsplash.com/photo-1527698266440-12104e498b76?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'MediaTek Dimensity 9300+',
            ram: '12GB',
            storage: '256GB',
            screen: 'Dynamic AMOLED 2X 12,4 inch, 120Hz',
            camera: 'Camera kép phía sau',
            battery: '10.090mAh',
            os: 'Android',
            connectivity: 'Wi-Fi, Bluetooth, USB-C',
            weight: 'Khoảng 571g'
        },
        tags: ['Samsung', 'Galaxy Tab', 'AMOLED', 'S Pen'],
        featured: false
    },
    {
        name: 'Xiaomi Pad 7 Pro 256GB',
        brand: 'Xiaomi',
        price: 12990000,
        description: 'Máy tính bảng 11,2 inch 3.2K 144Hz, chip Snapdragon 8s Gen 3 và bộ nhớ 256GB.',
        category: 'Tablet',
        stock: 17,
        image: 'https://images.unsplash.com/photo-1587033411391-5d9e51cce126?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Snapdragon 8s Gen 3',
            ram: '8GB',
            storage: '256GB',
            screen: '11,2 inch 3.2K, 144Hz',
            camera: 'Camera sau 50MP',
            battery: '8.850mAh',
            os: 'Xiaomi HyperOS',
            connectivity: 'Wi-Fi 7, Bluetooth, USB-C',
            weight: 'Khoảng 500g'
        },
        tags: ['Xiaomi', 'tablet', '144Hz', 'giải trí'],
        featured: false
    },
    {
        name: 'Sony WF-1000XM5',
        brand: 'Sony',
        price: 5490000,
        description: 'Tai nghe true wireless chống ồn chủ động, hỗ trợ LDAC, kết nối đa điểm và chuẩn kháng nước IPX4.',
        category: 'Tai nghe',
        stock: 28,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
        specs: {
            battery: 'Tối đa 8 giờ khi bật chống ồn',
            os: 'Tương thích iOS, Android, Windows và macOS',
            connectivity: 'Bluetooth 5.3, LDAC, kết nối đa điểm',
            weight: 'Khoảng 5,9g mỗi bên'
        },
        tags: ['Sony', 'true wireless', 'chống ồn', 'LDAC'],
        featured: false
    },
    {
        name: 'Bose QuietComfort Ultra Headphones',
        brand: 'Bose',
        price: 9990000,
        description: 'Tai nghe chụp tai không dây với chống ồn chủ động, âm thanh không gian và kết nối Bluetooth.',
        category: 'Tai nghe',
        stock: 11,
        image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
        specs: {
            battery: 'Pin sạc tích hợp',
            os: 'Tương thích iOS, Android, Windows và macOS',
            connectivity: 'Bluetooth, USB-C và cáp âm thanh',
            weight: 'Khoảng 253g'
        },
        tags: ['Bose', 'over-ear', 'chống ồn', 'âm thanh không gian'],
        featured: false
    },
    {
        name: 'JBL Tour One M2',
        brand: 'JBL',
        price: 6490000,
        description: 'Tai nghe chụp tai chống ồn thích ứng, driver 40mm và thời lượng nghe nhạc tối đa 50 giờ.',
        category: 'Tai nghe',
        stock: 19,
        image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=80',
        specs: {
            battery: 'Tối đa 50 giờ khi tắt chống ồn',
            os: 'Tương thích iOS, Android, Windows và macOS',
            connectivity: 'Bluetooth 5.3 và cáp âm thanh',
            weight: '278g'
        },
        tags: ['JBL', 'over-ear', 'chống ồn', 'Bluetooth 5.3'],
        featured: false
    },
    {
        name: 'Apple Watch Series 10 GPS 46mm',
        brand: 'Apple',
        price: 11990000,
        description: 'Đồng hồ thông minh vỏ nhôm 46mm, màn hình Retina OLED luôn bật và chip S10 SiP.',
        category: 'Đồng hồ thông minh',
        stock: 16,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
        specs: {
            storage: '64GB',
            screen: 'Retina LTPO3 OLED Always-On, 46mm',
            battery: 'Tối đa 18 giờ sử dụng thông thường',
            os: 'watchOS',
            connectivity: 'Wi-Fi, Bluetooth, GPS',
            weight: '36,4g'
        },
        tags: ['Apple', 'Apple Watch', 'sức khỏe', 'GPS'],
        featured: false
    },
    {
        name: 'Samsung Galaxy Watch Ultra 47mm',
        brand: 'Samsung',
        price: 13990000,
        description: 'Đồng hồ thông minh vỏ titanium 47mm, màn hình Super AMOLED và định vị GPS băng tần kép.',
        category: 'Đồng hồ thông minh',
        stock: 12,
        image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80',
        specs: {
            cpu: 'Exynos W1000',
            ram: '2GB',
            storage: '32GB',
            screen: 'Super AMOLED 47mm',
            battery: '590mAh',
            os: 'Wear OS',
            connectivity: 'Bluetooth 5.3, Wi-Fi, NFC, GPS băng tần kép',
            weight: '60,5g'
        },
        tags: ['Samsung', 'Galaxy Watch', 'titanium', 'GPS'],
        featured: false
    },
    {
        name: 'Garmin Venu 3',
        brand: 'Garmin',
        price: 10990000,
        description: 'Đồng hồ GPS với màn hình AMOLED, theo dõi sức khỏe và thời lượng pin tối đa 14 ngày.',
        category: 'Đồng hồ thông minh',
        stock: 14,
        image: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=80',
        specs: {
            screen: 'AMOLED cảm ứng',
            battery: 'Tối đa 14 ngày ở chế độ đồng hồ thông minh',
            os: 'Garmin OS',
            connectivity: 'Bluetooth, Wi-Fi, GPS, NFC',
            weight: 'Khoảng 47g'
        },
        tags: ['Garmin', 'GPS', 'sức khỏe', 'thể thao'],
        featured: false
    },
    {
        name: 'Logitech MX Keys S',
        brand: 'Logitech',
        price: 2790000,
        description: 'Bàn phím không dây kích thước đầy đủ, phím có đèn nền và hỗ trợ kết nối nhiều thiết bị.',
        category: 'Phụ kiện',
        stock: 32,
        image: 'https://images.unsplash.com/photo-1593640495253-23196b27a87f?auto=format&fit=crop&w=900&q=80',
        specs: {
            battery: 'Pin sạc qua USB-C',
            os: 'Tương thích Windows, macOS, Linux, ChromeOS, iPadOS và Android',
            connectivity: 'Bluetooth Low Energy, Logi Bolt, USB-C'
        },
        tags: ['Logitech', 'bàn phím', 'văn phòng', 'Bluetooth'],
        featured: false
    },
    {
        name: 'Anker Prime Charger 100W GaN',
        brand: 'Anker',
        price: 2190000,
        description: 'Củ sạc GaN công suất tối đa 100W với hai cổng USB-C và một cổng USB-A.',
        category: 'Phụ kiện',
        stock: 40,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
        specs: {
            battery: 'Công suất tối đa 100W',
            os: 'Tương thích thiết bị sạc qua USB',
            connectivity: '2 cổng USB-C, 1 cổng USB-A',
            weight: 'Khoảng 170g'
        },
        tags: ['Anker', 'củ sạc', 'GaN', 'USB-C'],
        featured: false
    },
    {
        name: 'Samsung Portable SSD T7 Shield 1TB',
        brand: 'Samsung',
        price: 2990000,
        description: 'Ổ SSD di động 1TB chuẩn USB 3.2 Gen 2, kháng bụi nước IP65 và tốc độ đọc tối đa 1.050MB/s.',
        category: 'Phụ kiện',
        stock: 26,
        image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=80',
        specs: {
            storage: '1TB',
            os: 'Tương thích Windows, macOS và Android',
            connectivity: 'USB 3.2 Gen 2, USB-C',
            weight: '98g'
        },
        tags: ['Samsung', 'SSD', 'USB-C', 'IP65'],
        featured: false
    }
].map(product => ({
    ...product,
    compareAtPrice: 0,
    minStock: 5,
    warranty: 'Theo chính sách bảo hành của hãng',
    images: [product.image],
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    active: true
}));

function validateCatalog() {
    if (catalogProducts.length !== 20) {
        throw new Error(`Catalog phải có đúng 20 sản phẩm, hiện có ${catalogProducts.length}.`);
    }

    const names = new Set();

    for (const product of catalogProducts) {
        if (names.has(product.name)) {
            throw new Error(`Tên sản phẩm bị trùng trong catalog: ${product.name}`);
        }
        if (!PRODUCT_CATEGORIES.has(product.category)) {
            throw new Error(`Danh mục không hợp lệ: ${product.category}`);
        }
        names.add(product.name);
    }
}

async function addCatalogProducts() {
    validateCatalog();
    await connectDB();

    let added = 0;
    let skipped = 0;

    for (const productData of catalogProducts) {
        const existingProduct = await Product.findOne({
            name: productData.name
        }).select('_id name');

        if (existingProduct) {
            skipped += 1;
            console.log(`Bỏ qua sản phẩm đã có: ${existingProduct.name}`);
            continue;
        }

        const product = new Product(productData);
        await product.save();
        added += 1;
        console.log(`Đã thêm #${product._id}: ${product.name}`);
    }

    const categorySummary = await Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$category', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    console.log(`Hoàn tất: thêm ${added}, bỏ qua ${skipped}.`);
    console.table(categorySummary.map(item => ({
        category: item._id,
        total: item.total
    })));
}

addCatalogProducts()
    .catch(error => {
        console.error('Không thể thêm catalog sản phẩm:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
