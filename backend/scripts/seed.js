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
    },

    // ===== MÁY CHƠI GAME =====
    {
        name: 'Sony PlayStation 5 (PS5) Slim Standard Edition 1TB',
        brand: 'Sony',
        price: 13990000,
        compareAtPrice: 15490000,
        description: 'Máy chơi game thế hệ mới hỗ trợ đồ họa 4K 120Hz, ray-tracing, ổ cứng SSD siêu tốc 1TB và tay cầm DualSense phản hồi xúc giác chân thực.',
        category: 'Máy chơi game',
        stock: 25,
        image: '/assets/images/products/ps5-slim-standard.jpg',
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
        specs: {
            battery: 'Lên tới 120 giờ sử dụng liên tục',
            os: 'Tương thích PS5, PS4, Nintendo Switch, PC, Mobile',
            connectivity: 'Không dây 2.4GHz không trễ / Cáp USB-C',
            weight: '330g'
        },
        tags: ['HyperX', 'Tai nghe gaming', 'Phụ kiện game', 'Wireless'],
        rating: 4.9,
        reviewCount: 39,
        soldCount: 88,
        warranty: '24 tháng chính hãng'
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
