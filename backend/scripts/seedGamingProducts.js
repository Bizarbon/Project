const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const connectDB = require('../config/db');
const Product = require('../models/Product');

const gamingProducts = [
    {
        name: 'Sony PlayStation 5 (PS5) Slim Standard Edition 1TB',
        brand: 'Sony',
        price: 13990000,
        compareAtPrice: 15490000,
        description: 'Máy chơi game thế hệ mới hỗ trợ đồ họa 4K 120Hz, ray-tracing, ổ cứng SSD siêu tốc 1TB và tay cầm DualSense phản hồi xúc giác chân thực.',
        category: 'Máy chơi game',
        stock: 15,
        image: 'assets/images/gaming/ps5.png',
        images: ['assets/images/gaming/ps5.png'],
        specs: {
            cpu: 'AMD Zen 2 8 nhân 16 luồng 3.5GHz',
            ram: '16GB GDDR6',
            storage: 'SSD 1TB NVMe siêu tốc',
            screen: 'Đầu ra 4K 120Hz, HDR, hỗ trợ 8K',
            gpu: 'AMD RDNA 2 10.3 TFLOPS',
            connectivity: 'Wi-Fi 6, Bluetooth 5.1, LAN Gigabit, HDMI 2.1',
            weight: '3.2 kg'
        },
        tags: ['Sony', 'PlayStation', 'PS5', 'Gaming Console', '4K'],
        featured: true,
        rating: 5.0,
        reviewCount: 48,
        soldCount: 120,
        warranty: '12 tháng chính hãng Sony Việt Nam'
    },
    {
        name: 'Sony PlayStation 4 (PS4) Slim 1TB Chính Hãng',
        brand: 'Sony',
        price: 7490000,
        compareAtPrice: 8490000,
        description: 'Cỗ máy chơi game huyền thoại với kho game độc quyền đồ sộ, thiết kế mỏng nhẹ, tiết kiệm điện năng và ổ cứng 1TB rộng rãi.',
        category: 'Máy chơi game',
        stock: 22,
        image: 'assets/images/gaming/ps4.png',
        images: ['assets/images/gaming/ps4.png'],
        specs: {
            cpu: 'AMD Jaguar 8 nhân x86-64',
            ram: '8GB GDDR5',
            storage: 'HDD 1TB SATA',
            screen: 'Độ phân giải Full HD 1080p, hỗ trợ HDR',
            gpu: 'AMD Radeon 1.84 TFLOPS',
            connectivity: 'Wi-Fi ac, Bluetooth 4.0, HDMI',
            weight: '2.1 kg'
        },
        tags: ['Sony', 'PS4', 'PlayStation', 'Gaming Console'],
        featured: false,
        rating: 4.8,
        reviewCount: 35,
        soldCount: 95,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Nintendo Switch OLED Model White Edition 64GB',
        brand: 'Nintendo',
        price: 8290000,
        compareAtPrice: 9190000,
        description: 'Máy chơi game cầm tay màn hình OLED 7 inch rực rỡ, chân dựng bản rộng linh hoạt, bộ nhớ 64GB cùng trải nghiệm chơi game đỉnh cao mọi lúc mọi nơi.',
        category: 'Máy chơi game',
        stock: 20,
        image: 'assets/images/gaming/nintendo-switch.png',
        images: ['assets/images/gaming/nintendo-switch.png'],
        specs: {
            cpu: 'NVIDIA Custom Tegra',
            ram: '4GB LPDDR4',
            storage: '64GB (hỗ trợ thẻ nhớ MicroSD tới 2TB)',
            screen: 'OLED 7 inch cảm ứng đa điểm (1280x720)',
            battery: 'Pin Lithium-ion 4310mAh (4.5 - 9 giờ chơi)',
            connectivity: 'Wi-Fi, Bluetooth 4.1, Dock hỗ trợ cổng LAN',
            weight: '420g (kèm Joy-Con)'
        },
        tags: ['Nintendo', 'Switch', 'OLED', 'Handheld', 'Gaming'],
        featured: true,
        rating: 4.9,
        reviewCount: 52,
        soldCount: 140,
        warranty: '12 tháng chính hãng Nintendo'
    },
    {
        name: 'Tay Cầm Không Dây Sony DualSense Wireless Controller PS5',
        brand: 'Sony',
        price: 1890000,
        compareAtPrice: 2190000,
        description: 'Tay cầm chơi game đỉnh cao tích hợp Haptic Feedback cảm nhận lực chân thực, Adaptive Triggers và micro đàm thoại tích hợp chất lượng cao.',
        category: 'Máy chơi game',
        stock: 35,
        image: 'assets/images/gaming/dualsense-controller.png',
        images: ['assets/images/gaming/dualsense-controller.png'],
        specs: {
            connectivity: 'Bluetooth 5.1 / Cáp USB-C',
            battery: 'Pin sạc tích hợp 1560mAh',
            weight: '280g',
            os: 'Tương thích PS5, Windows PC, iOS, Android'
        },
        tags: ['Sony', 'DualSense', 'Tay cầm game', 'Phụ kiện game', 'PS5'],
        featured: true,
        rating: 4.9,
        reviewCount: 64,
        soldCount: 210,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Tai Nghe Gaming Chụp Tai HyperX Cloud III Wireless',
        brand: 'HyperX',
        price: 2990000,
        compareAtPrice: 3490000,
        description: 'Tai nghe gaming không dây cao cấp với thời lượng pin lên đến 120 giờ, âm thanh không gian DTS Spatial Audio 3D và đệm mút hoạt tính cực êm ái.',
        category: 'Máy chơi game',
        stock: 28,
        image: 'assets/images/gaming/gaming-headset.png',
        images: ['assets/images/gaming/gaming-headset.png'],
        specs: {
            connectivity: 'Không dây 2.4GHz không trễ / Cáp USB-C',
            battery: 'Lên tới 120 giờ sử dụng liên tục',
            weight: '330g',
            os: 'Tương thích PS5, PS4, Nintendo Switch, PC, Mobile'
        },
        tags: ['HyperX', 'Tai nghe gaming', 'Phụ kiện game', 'Wireless'],
        featured: false,
        rating: 4.9,
        reviewCount: 39,
        soldCount: 88,
        warranty: '24 tháng chính hãng'
    }
];

async function seedGaming() {
    await connectDB();
    console.log('Connected to MongoDB. Seeding gaming products...');

    const Counter = require('../models/Counter');
    const highestProduct = await Product.findOne().sort({ _id: -1 }).select('_id');
    const maxId = highestProduct ? highestProduct._id : 0;
    await Counter.findByIdAndUpdate(
        'productId',
        { $max: { seq: maxId } },
        { upsert: true }
    );
    console.log(`Synced Counter productId seq to at least: ${maxId}`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of gamingProducts) {
        const existing = await Product.findOne({ name: item.name });
        if (existing) {
            Object.assign(existing, item);
            await existing.save();
            updatedCount++;
            console.log(`Updated: #${existing._id} - ${existing.name}`);
        } else {
            const newProd = new Product(item);
            await newProd.save();
            createdCount++;
            console.log(`Created: #${newProd._id} - ${newProd.name}`);
        }
    }

    console.log(`Seeding complete: ${createdCount} created, ${updatedCount} updated.`);
    const total = await Product.countDocuments({ category: 'Máy chơi game' });
    console.log(`Total "Máy chơi game" products in DB: ${total}`);
}

seedGaming()
    .catch(err => {
        console.error('Seed error:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
