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
    },
    {
        name: 'Sony PlayStation 5 (PS5) Slim Standard Edition',
        brand: 'Sony',
        price: 13990000,
        compareAtPrice: 15490000,
        description: 'Thế hệ PS5 Slim mới nhỏ gọn hơn 30%, tích hợp sẵn ổ đĩa Ultra HD Blu-ray, ổ cứng nâng cấp lên 1TB SSD siêu tốc và tay cầm DualSense phản hồi lực chân thực.',
        category: 'Máy chơi game',
        stock: 25,
        image: '/assets/images/products/ps5-slim-standard.jpg',
        images: ['/assets/images/products/ps5-slim-standard.jpg'],
        specs: {
            cpu: 'x86-64-AMD Ryzen Zen 2 8 nhân / 16 luồng - xung nhịp lên đến 3.5GHz',
            ram: '16GB GDDR6',
            storage: 'SSD 1TB NVMe tốc độ 5.5GB/s',
            screen: 'Hỗ trợ TV 4K 120Hz, 8K, VRR',
            gpu: 'AMD Radeon RDNA 2 tốc độ 2.23GHz (10.3 TFLOPS)',
            connectivity: 'Wi-Fi 6 (802.11ax), Bluetooth 5.1, LAN 1Gbps, 2x USB-C',
            weight: '3.2 kg'
        },
        tags: ['Máy chơi game', 'Sony', 'PlayStation 5', 'PS5 Slim', 'Console'],
        featured: true,
        rating: 5.0,
        reviewCount: 420,
        soldCount: 950,
        warranty: '12 tháng chính hãng Sony Việt Nam'
    },
    {
        name: 'Sony PlayStation 5 (PS5) Slim Digital Edition',
        brand: 'Sony',
        price: 11990000,
        compareAtPrice: 13490000,
        description: 'Phiên bản không ổ đĩa gọn gàng, tối ưu cho game thủ mua game online qua PlayStation Store, giữ nguyên 100% hiệu năng đồ họa và ổ cứng 1TB SSD như bản Standard.',
        category: 'Máy chơi game',
        stock: 20,
        image: '/assets/images/products/ps5-slim-digital.jpg',
        images: ['/assets/images/products/ps5-slim-digital.jpg'],
        specs: {
            cpu: 'AMD Zen 2 8 nhân 16 luồng',
            ram: '16GB GDDR6',
            storage: '1TB Custom SSD',
            os: 'PlayStation OS',
            gpu: 'AMD RDNA 2 10.3 TFLOPS',
            weight: '2.6kg'
        },
        tags: ['Máy chơi game', 'Sony', 'PS5 Digital', 'Slim', 'Console'],
        rating: 4.8,
        reviewCount: 190,
        soldCount: 480,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Sony PlayStation 4 Pro 1TB 4K HDR',
        brand: 'Sony',
        price: 6990000,
        compareAtPrice: 8490000,
        description: 'Cỗ máy chơi game huyền thoại với kho game độc quyền đồ sộ, đồ họa nâng cấp 4K HDR, tiết kiệm điện năng và ổ cứng 1TB rộng rãi.',
        category: 'Máy chơi game',
        stock: 15,
        image: '/assets/images/products/ps4-pro.jpg',
        images: ['/assets/images/products/ps4-pro.jpg'],
        specs: {
            cpu: 'AMD Jaguar 8 nhân x86-64',
            ram: '8GB GDDR5',
            storage: 'HDD 1TB SATA',
            screen: 'Độ phân giải 4K HDR 2160p',
            gpu: 'AMD Radeon 4.2 TFLOPS',
            connectivity: 'Wi-Fi ac, Bluetooth 4.0, HDMI',
            weight: '3.3 kg'
        },
        tags: ['Sony', 'PS4', 'PlayStation', 'Gaming Console'],
        rating: 4.8,
        reviewCount: 35,
        soldCount: 95,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Nintendo Switch OLED Model (Neon Blue & Red)',
        brand: 'Nintendo',
        price: 7990000,
        compareAtPrice: 8990000,
        description: 'Màn hình OLED 7.0 inch rực rỡ độ tương phản cao, chân đế rộng điều chỉnh đa góc độ, bộ nhớ 64GB cùng dock tích hợp cổng LAN có dây.',
        category: 'Máy chơi game',
        stock: 30,
        image: '/assets/images/products/nintendo-switch-oled.jpg',
        images: ['/assets/images/products/nintendo-switch-oled.jpg'],
        specs: {
            cpu: 'NVIDIA Custom Tegra',
            ram: '4GB LPDDR4X',
            storage: '64GB (khe thẻ nhớ microSD)',
            screen: 'OLED 7.0 inch cảm ứng đa điểm 720p',
            battery: 'Pin 4.310 mAh (4.5 - 9 giờ chơi)',
            connectivity: 'Wi-Fi, Bluetooth 4.1, USB-C, LAN Dock',
            weight: '420g'
        },
        tags: ['Máy chơi game', 'Nintendo', 'Switch OLED', 'Handheld'],
        featured: true,
        rating: 4.9,
        reviewCount: 350,
        soldCount: 820,
        warranty: '12 tháng chính hãng Nintendo'
    },
    {
        name: 'Nintendo Switch Lite (Turquoise / Xanh ngọc)',
        brand: 'Nintendo',
        price: 4390000,
        compareAtPrice: 4990000,
        description: 'Chiếc máy chơi game di động thuần túy siêu nhẹ chỉ 275g, phím D-Pad chữ thập truyền thống chuẩn xác, chơi trọn vẹn thư viện game Switch mọi lúc mọi nơi.',
        category: 'Máy chơi game',
        stock: 24,
        image: '/assets/images/products/nintendo-switch-lite.jpg',
        images: ['/assets/images/products/nintendo-switch-lite.jpg'],
        specs: {
            cpu: 'NVIDIA Custom Tegra',
            ram: '4GB',
            storage: '32GB (khe thẻ nhớ mở rộng)',
            screen: '5.5 inch LCD cảm ứng 720p',
            battery: 'Pin chơi 3 - 7 giờ',
            weight: '275g'
        },
        tags: ['Máy chơi game', 'Nintendo', 'Switch Lite', 'Cầm tay', 'Tiện lợi'],
        rating: 4.7,
        reviewCount: 145,
        soldCount: 380,
        warranty: '12 tháng'
    },
    {
        name: 'Valve Steam Deck OLED 512GB Handheld Gaming PC',
        brand: 'Valve',
        price: 16490000,
        compareAtPrice: 18490000,
        description: 'Mang cả thư viện game Steam PC đồ sộ vào lòng bàn tay với màn hình HDR OLED 90Hz rực rỡ, pin trâu hơn 50% và Wi-Fi 6E siêu tốc.',
        category: 'Máy chơi game',
        stock: 12,
        image: '/assets/images/products/steam-deck-oled.png',
        images: ['/assets/images/products/steam-deck-oled.png'],
        specs: {
            cpu: 'AMD Zen 2 4 nhân 8 luồng (6nm)',
            ram: '16GB LPDDR5 6400 MT/s',
            storage: '512GB NVMe SSD siêu tốc',
            screen: 'OLED 7.4 inch 90Hz HDR 1000 nits (1280x800)',
            battery: 'Pin 50Wh (3 - 12 giờ chơi)',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, USB-C DisplayPort',
            weight: '640g'
        },
        tags: ['Máy chơi game', 'Valve', 'Steam Deck', 'Handheld PC'],
        featured: true,
        rating: 4.9,
        reviewCount: 185,
        soldCount: 420,
        warranty: '12 tháng'
    },
    {
        name: 'ASUS ROG Ally X 24GB RAM 1TB SSD Windows 11',
        brand: 'ASUS',
        price: 24490000,
        compareAtPrice: 26990000,
        description: 'Bản nâng cấp toàn diện với dung lượng pin gấp đôi (80Wh), 24GB RAM LPDDR5X cực khủng, 1TB SSD NVMe chuẩn 2280 và hai cổng USB-C hỗ trợ Thunderbolt 4.',
        category: 'Máy chơi game',
        stock: 10,
        image: '/assets/images/products/asus-rog-ally-x.jpg',
        images: ['/assets/images/products/asus-rog-ally-x.jpg'],
        specs: {
            cpu: 'AMD Ryzen Z1 Extreme (8 nhân 16 luồng Zen 4)',
            ram: '24GB LPDDR5X 7500MHz kênh đôi',
            storage: '1TB M.2 NVMe PCIe 4.0 SSD (chuẩn 2280)',
            screen: '7 inch Full HD 120Hz 100% sRGB FreeSync Premium',
            battery: 'Pin 80Wh khủng nhất dòng máy chơi game cầm tay',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.2, USB4 / Thunderbolt 4',
            weight: '678g'
        },
        tags: ['Máy chơi game', 'ASUS', 'ROG Ally X', 'Gaming Handheld', 'Windows 11'],
        featured: true,
        rating: 4.8,
        reviewCount: 95,
        soldCount: 190,
        warranty: '24 tháng chính hãng ASUS'
    },
    {
        name: 'Kính thực tế ảo Meta Quest 3 128GB All-In-One VR',
        brand: 'Meta',
        price: 13990000,
        compareAtPrice: 15490000,
        description: 'Trải nghiệm thực tế hỗn hợp (Mixed Reality) đột phá với camera Passthrough màu sắc trung thực 4K Infinite Display, chip Snapdragon XR2 Gen 2 đồ họa sắc nét gấp đôi thế hệ trước.',
        category: 'Máy chơi game',
        stock: 14,
        image: '/assets/images/products/meta-quest-3.jpg',
        images: ['/assets/images/products/meta-quest-3.jpg'],
        specs: {
            cpu: 'Snapdragon XR2 Gen 2',
            ram: '8GB',
            storage: '128GB',
            screen: 'Infinite Display 4K+ (2064x2208 mỗi mắt) 120Hz',
            weight: '515g'
        },
        tags: ['Máy chơi game', 'Meta', 'VR', 'Thực tế ảo', 'Meta Quest 3'],
        featured: true,
        rating: 4.8,
        reviewCount: 75,
        soldCount: 160,
        warranty: '12 tháng'
    },
    {
        name: 'Tay cầm Sony DualSense PS5 Không Dây - Trắng',
        brand: 'Sony',
        price: 1690000,
        compareAtPrice: 1990000,
        description: 'Trải nghiệm chơi game đắm chìm chân thực với công nghệ phản hồi xúc giác Haptic Feedback và cò bấm thích ứng Adaptive Triggers mô phỏng lực căng vũ khí.',
        category: 'Máy chơi game',
        stock: 45,
        image: '/assets/images/products/dualsense-white.jpg',
        images: ['/assets/images/products/dualsense-white.jpg'],
        specs: {
            connectivity: 'Bluetooth 5.1 / Cáp USB Type-C',
            weight: '280g'
        },
        tags: ['Máy chơi game', 'Phụ kiện', 'Tay cầm', 'DualSense', 'PS5'],
        rating: 4.9,
        reviewCount: 410,
        soldCount: 980,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Tay cầm Sony DualSense PS5 - Midnight Black',
        brand: 'Sony',
        price: 1750000,
        compareAtPrice: 1990000,
        description: 'Phiên bản đen huyền bí Midnight Black với hai tông màu đen thanh lịch, bề mặt tay cầm khắc hoa văn PlayStation micro siêu bám tay chống mồ hôi.',
        category: 'Máy chơi game',
        stock: 30,
        image: '/assets/images/products/dualsense-black.jpg',
        images: ['/assets/images/products/dualsense-black.jpg'],
        specs: {
            battery: '1.560 mAh',
            connectivity: 'Bluetooth 5.1 / USB-C',
            weight: '280g'
        },
        tags: ['Máy chơi game', 'Sony', 'DualSense', 'Midnight Black', 'Tay cầm'],
        rating: 4.9,
        reviewCount: 220,
        soldCount: 540,
        warranty: '12 tháng chính hãng Sony'
    },
    {
        name: 'Tay cầm Nintendo Switch Joy-Con (Đỏ/Xanh Neon)',
        brand: 'Nintendo',
        price: 1590000,
        compareAtPrice: 1890000,
        description: 'Cặp tay cầm Joy-Con chính hãng Nintendo hỗ trợ cảm biến chuyển động con quay hồi chuyển 6 trục, rung HD Rumble tinh tế, tích hợp cảm biến NFC quét tượng amiibo.',
        category: 'Máy chơi game',
        stock: 25,
        image: '/assets/images/products/joy-con-neon.jpg',
        images: ['/assets/images/products/joy-con-neon.jpg'],
        specs: {
            battery: 'Pin 525 mAh dùng tới 20 giờ',
            connectivity: 'Bluetooth 3.0, NFC',
            weight: '49g (Trái) / 52.1g (Phải)'
        },
        tags: ['Máy chơi game', 'Nintendo', 'Joy-Con', 'Phụ kiện'],
        rating: 4.7,
        reviewCount: 160,
        soldCount: 390,
        warranty: '6 tháng'
    },
    {
        name: 'Tay cầm Microsoft Xbox Wireless Controller Carbon Black',
        brand: 'Microsoft',
        price: 1490000,
        compareAtPrice: 1790000,
        description: 'Chuẩn mực tay cầm chơi game trên PC và máy Xbox Series X/S. Thiết kế công thái học hoàn hảo, cụm phím D-Pad lai 8 hướng cực nảy, hỗ trợ Bluetooth kết nối điện thoại và máy tính.',
        category: 'Máy chơi game',
        stock: 35,
        image: '/assets/images/products/xbox-controller.jpg',
        images: ['/assets/images/products/xbox-controller.jpg'],
        specs: {
            battery: '2 pin AA hoặc pin sạc (Pin tới 40 giờ)',
            connectivity: 'Xbox Wireless, Bluetooth, USB-C',
            weight: '287g'
        },
        tags: ['Máy chơi game', 'Microsoft', 'Xbox Controller', 'Tay cầm PC', 'bán chạy'],
        rating: 4.9,
        reviewCount: 380,
        soldCount: 890,
        warranty: '12 tháng'
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

if (require.main === module) {
    seedGaming()
        .catch(err => {
            console.error('Seed error:', err);
            process.exitCode = 1;
        })
        .finally(async () => {
            await mongoose.disconnect();
        });
}

module.exports = { seedGaming, gamingProducts };
