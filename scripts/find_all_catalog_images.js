const fs = require('fs');

// We test candidate image URLs from CellphoneS CDN for all 7 categories
const candidateProducts = [
    // ===== ĐIỆN THOẠI =====
    {
        name: 'iPhone 16 Pro Max 256GB',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 34990000,
        originalPrice: 36990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-16-pro-max.png',
        description: 'Màn hình Super Retina XDR 6.9 inch, chip A18 Pro, khung viền Titan sa mạc đẳng cấp, Camera 48MP Fusion.',
        specs: { cpu: 'Apple A18 Pro', ram: '8GB', storage: '256GB', screen: 'OLED 6.9 inch 120Hz', battery: '4685 mAh', os: 'iOS 18' },
        featured: true, stock: 35
    },
    {
        name: 'iPhone 16 Pro 128GB',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 28490000,
        originalPrice: 28990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-16-pro.png',
        description: 'Kích thước nhỏ gọn 6.3 inch, chip A18 Pro, nút chụp ảnh Camera Control chuyên nghiệp.',
        specs: { cpu: 'Apple A18 Pro', ram: '8GB', storage: '128GB', screen: 'OLED 6.3 inch 120Hz', battery: '3582 mAh', os: 'iOS 18' },
        featured: false, stock: 25
    },
    {
        name: 'iPhone 15 Pro Max 256GB',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 29490000,
        originalPrice: 34990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-15-pro-max_3.png',
        description: 'Khung viền Titan tự nhiên, chip A17 Pro mạnh mẽ, camera tiềm vọng zoom quang 5x đỉnh cao.',
        specs: { cpu: 'Apple A17 Pro', ram: '8GB', storage: '256GB', screen: 'OLED 6.7 inch 120Hz', battery: '4422 mAh', os: 'iOS 17' },
        featured: true, stock: 40
    },
    {
        name: 'Samsung Galaxy S24 Ultra 256GB',
        brand: 'Samsung',
        category: 'Điện thoại',
        price: 27990000,
        originalPrice: 33990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/2/s24-ultra-xam_2.png',
        description: 'Quyền năng Galaxy AI đỉnh cao, khung viền Titan, camera 200MP zoom mắt thần bóng đêm, tích hợp bút S Pen.',
        specs: { cpu: 'Snapdragon 8 Gen 3 for Galaxy', ram: '12GB', storage: '256GB', screen: 'Dynamic AMOLED 2X 6.8 inch 120Hz', battery: '5000 mAh', os: 'Android 14' },
        featured: true, stock: 30
    },
    {
        name: 'Samsung Galaxy Z Fold6 256GB',
        brand: 'Samsung',
        category: 'Điện thoại',
        price: 41990000,
        originalPrice: 43990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-z-fold-6-xam-1.png',
        description: 'Thiết kế gập phẳng mỏng nhẹ hơn, kháng bụi nước IP48, tối ưu hóa đa nhiệm mạnh mẽ cùng Galaxy AI.',
        specs: { cpu: 'Snapdragon 8 Gen 3', ram: '12GB', storage: '256GB', screen: 'Chính 7.6 inch, Phụ 6.3 inch 120Hz', battery: '4400 mAh', os: 'Android 14' },
        featured: true, stock: 15
    },
    {
        name: 'Samsung Galaxy Z Flip6 256GB',
        brand: 'Samsung',
        category: 'Điện thoại',
        price: 26990000,
        originalPrice: 28990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-z-flip-6-xanh-1.png',
        description: 'Thiết kế gập vỏ sò thời thượng, màn hình ngoài Flex Window tiện dụng, camera 50MP nâng cấp vượt trội.',
        specs: { cpu: 'Snapdragon 8 Gen 3', ram: '12GB', storage: '256GB', screen: 'Dynamic AMOLED 2X 6.7 inch 120Hz', battery: '4000 mAh', os: 'Android 14' },
        featured: false, stock: 20
    },
    {
        name: 'Xiaomi 14 Ultra 512GB',
        brand: 'Xiaomi',
        category: 'Điện thoại',
        price: 29990000,
        originalPrice: 32990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/x/i/xiaomi-14-ultra_1.png',
        description: 'Kiệt tác nhiếp ảnh hợp tác cùng Leica, cảm biến 1 inch thế hệ mới, ống kính quang học Summilux đỉnh cao.',
        specs: { cpu: 'Snapdragon 8 Gen 3', ram: '16GB', storage: '512GB', screen: 'AMOLED 6.73 inch 2K 120Hz', battery: '5000 mAh', os: 'Xiaomi HyperOS' },
        featured: true, stock: 18
    },
    {
        name: 'OPPO Find X7 Ultra 256GB',
        brand: 'OPPO',
        category: 'Điện thoại',
        price: 23990000,
        originalPrice: 26990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/o/p/oppo-find-x7-ultra.png',
        description: 'Hệ thống 4 camera tiềm vọng kép độc nhất thế giới, tinh chỉnh bởi huyền thoại Hasselblad, sạc siêu nhanh 100W.',
        specs: { cpu: 'Snapdragon 8 Gen 3', ram: '16GB', storage: '256GB', screen: 'LTPO AMOLED 6.82 inch 2K 120Hz', battery: '5000 mAh', os: 'ColorOS 14' },
        featured: false, stock: 12
    },

    // ===== LAPTOP =====
    {
        name: 'MacBook Pro 14 M3 512GB',
        brand: 'Apple',
        category: 'Laptop',
        price: 38990000,
        originalPrice: 39990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/a/macbook_pro_14_m3.png',
        description: 'Hiệu năng đột phá với chip Apple M3, màn hình Liquid Retina XDR 120Hz rực rỡ, thời lượng pin ấn tượng lên đến 22 giờ.',
        specs: { cpu: 'Apple M3 8-core', ram: '8GB Unified', storage: '512GB SSD', screen: '14.2 inch Liquid Retina XDR', battery: '70Wh', os: 'macOS' },
        featured: true, stock: 20
    },
    {
        name: 'MacBook Air 13 M3 256GB',
        brand: 'Apple',
        category: 'Laptop',
        price: 26990000,
        originalPrice: 27990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/a/macbook-air-m3-13-inch-midnight.png',
        description: 'Thiết kế siêu mỏng nhẹ chỉ 1.24kg, hỗ trợ xuất cùng lúc 2 màn hình ngoài, vận hành hoàn toàn êm ái không quạt tản nhiệt.',
        specs: { cpu: 'Apple M3 8-core', ram: '8GB Unified', storage: '256GB SSD', screen: '13.6 inch Liquid Retina', battery: '52.6Wh', os: 'macOS' },
        featured: true, stock: 35
    },
    {
        name: 'ASUS ROG Zephyrus G16 GU605',
        brand: 'ASUS',
        category: 'Laptop',
        price: 49990000,
        originalPrice: 54990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/l/a/laptop-asus-rog-zephyrus-g16-gu605mv-qr080w-thumb.png',
        description: 'Laptop gaming cao cấp siêu mỏng, màn hình OLED 2.5K 240Hz Nebula Display, card đồ họa rời RTX 4070 mạnh mẽ.',
        specs: { cpu: 'Intel Core Ultra 9 185H', ram: '32GB LPDDR5X', storage: '1TB NVMe SSD', screen: '16 inch OLED 2.5K 240Hz', battery: '90Wh', os: 'Windows 11 Home' },
        featured: true, stock: 10
    },
    {
        name: 'Dell XPS 13 Plus 9320',
        brand: 'Dell',
        category: 'Laptop',
        price: 39990000,
        originalPrice: 44990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/d/e/dell-xps-13-plus-9320.png',
        description: 'Thiết kế tương lai với hàng phím cảm ứng điện dung, touchpad kính vô hình liền mạch, vỏ nhôm nguyên khối tinh xảo.',
        specs: { cpu: 'Intel Core i7-1360P', ram: '16GB LPDDR5', storage: '512GB PCIe SSD', screen: '13.4 inch FHD+ InfinityEdge', battery: '55Wh', os: 'Windows 11 Pro' },
        featured: false, stock: 14
    },
    {
        name: 'Lenovo ThinkPad X1 Carbon Gen 11',
        brand: 'Lenovo',
        category: 'Laptop',
        price: 35990000,
        originalPrice: 39990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/h/thinkpad-x1-carbon-gen-11.png',
        description: 'Chuẩn mực laptop doanh nhân cao cấp, bàn phím gõ êm nhất thế giới, trọng lượng chỉ 1.12kg cùng độ bền quân đội MIL-STD.',
        specs: { cpu: 'Intel Core i7-1355U', ram: '16GB LPDDR5', storage: '512GB SSD', screen: '14 inch WUXGA IPS chống chói', battery: '57Wh', os: 'Windows 11 Pro' },
        featured: false, stock: 18
    },
    {
        name: 'ASUS TUF Gaming A15 FA507',
        brand: 'ASUS',
        category: 'Laptop',
        price: 21990000,
        originalPrice: 24990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/l/a/laptop-asus-tuf-gaming-a15-fa507nv-lp061w.png',
        description: 'Chiến binh gaming bền bỉ đạt chuẩn quân sự, trang bị RTX 4060 cân mọi tựa game AAA mượt mà.',
        specs: { cpu: 'AMD Ryzen 7 7735HS', ram: '16GB DDR5', storage: '512GB NVMe SSD', screen: '15.6 inch FHD 144Hz', battery: '90Wh', os: 'Windows 11 Home' },
        featured: false, stock: 22
    },

    // ===== TABLET =====
    {
        name: 'iPad Pro 11 inch M4 Wi-Fi 256GB',
        brand: 'Apple',
        category: 'Tablet',
        price: 27990000,
        originalPrice: 28990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/ipad-pro-11-inch-m4.png',
        description: 'Thiết kế siêu mỏng chỉ 5.3mm, chip Apple M4 thế hệ mới nhất, màn hình Ultra Retina XDR Tandem OLED đột phá.',
        specs: { cpu: 'Apple M4 9-core', ram: '8GB', storage: '256GB', screen: 'Tandem OLED 11 inch 120Hz', battery: '31.29Wh', os: 'iPadOS 17' },
        featured: true, stock: 20
    },
    {
        name: 'iPad Air 11 inch M2 Wi-Fi 128GB',
        brand: 'Apple',
        category: 'Tablet',
        price: 16490000,
        originalPrice: 16990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/ipad-air-6-11-inch.png',
        description: 'Chip M2 mạnh mẽ, hỗ trợ Apple Pencil Pro và Magic Keyboard mới, camera trước góc rộng đặt nằm ngang tối ưu gọi video.',
        specs: { cpu: 'Apple M2 8-core', ram: '8GB', storage: '128GB', screen: 'Liquid Retina 11 inch', battery: '28.93Wh', os: 'iPadOS 17' },
        featured: true, stock: 28
    },
    {
        name: 'iPad Gen 10 10.9 inch Wi-Fi 64GB',
        brand: 'Apple',
        category: 'Tablet',
        price: 8990000,
        originalPrice: 9990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/ipad-10-9-inch-2022.png',
        description: 'Thiết kế viền mỏng hiện đại, cổng sạc USB-C tiện lợi, 4 màu sắc trẻ trung nổi bật, phục vụ học tập và giải trí tuyệt vời.',
        specs: { cpu: 'Apple A14 Bionic', ram: '4GB', storage: '64GB', screen: 'Liquid Retina 10.9 inch', battery: '28.6Wh', os: 'iPadOS 17' },
        featured: false, stock: 45
    },
    {
        name: 'Samsung Galaxy Tab S9 Ultra 256GB',
        brand: 'Samsung',
        category: 'Tablet',
        price: 25990000,
        originalPrice: 32990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-tab-s9-ultra.png',
        description: 'Màn hình khổng lồ Dynamic AMOLED 2X 14.6 inch sắc nét, kháng nước IP68 đầu tiên trên tablet, tặng kèm bút S Pen thế hệ mới.',
        specs: { cpu: 'Snapdragon 8 Gen 2 for Galaxy', ram: '12GB', storage: '256GB', screen: 'Dynamic AMOLED 2X 14.6 inch 120Hz', battery: '11200 mAh', os: 'Android 14' },
        featured: true, stock: 15
    },
    {
        name: 'Xiaomi Pad 6 128GB',
        brand: 'Xiaomi',
        category: 'Tablet',
        price: 6990000,
        originalPrice: 7990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/x/i/xiaomi-pad-6.png',
        description: 'Màn hình 2.8K 144Hz siêu mượt mà, 4 loa Dolby Atmos âm thanh vòm sống động, thân máy kim loại nguyên khối cao cấp.',
        specs: { cpu: 'Snapdragon 870', ram: '6GB', storage: '128GB', screen: 'IPS LCD 11 inch 2.8K 144Hz', battery: '8840 mAh', os: 'MIUI Pad' },
        featured: false, stock: 30
    },

    // ===== TAI NGHE =====
    {
        name: 'Tai nghe Apple EarPods Lightning MWTY3ZA/A',
        brand: 'Apple',
        category: 'Tai nghe',
        price: 4990000, // wait: in user screenshot it is 499.000d
        price: 499000,
        originalPrice: 790000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/p/apple-earpods-lightning.png',
        description: 'Tai nghe có dây chính hãng Apple đầu cắm Lightning, tích hợp phím điều hướng và micro thoại đàm thoại rõ nét.',
        specs: { connectivity: 'Cổng Lightning', mic: 'Có micro đàm thoại', audio: 'Âm thanh stereo trong trẻo', compatibility: 'iPhone, iPad' },
        featured: true, stock: 50
    },
    {
        name: 'Tai nghe không dây Apple AirPods Pro 2 USB-C',
        brand: 'Apple',
        category: 'Tai nghe',
        price: 5490000,
        originalPrice: 6190000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/p/apple-airpods-pro-2-usb-c.png',
        description: 'Chống ồn chủ động ANC gấp 2 lần, chip Apple H2, cổng sạc USB-C hiện đại, chống bụi và nước đạt chuẩn IP54.',
        specs: { connectivity: 'Bluetooth 5.3', battery: 'Lên đến 30 giờ (kèm hộp)', anc: 'Chống ồn chủ động ANC & Xuyên âm', charging: 'USB-C & MagSafe' },
        featured: true, stock: 40
    },
    {
        name: 'Tai nghe chụp tai Sony WH-1000XM5',
        brand: 'Sony',
        category: 'Tai nghe',
        price: 6990000,
        originalPrice: 8490000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/o/sony-wh-1000xm5.png',
        description: 'Vua chống ồn không dây với 2 bộ vi xử lý và 8 micro, chất âm Hi-Res Audio đỉnh cao, đệm tai da êm ái thoáng khí suốt ngày dài.',
        specs: { connectivity: 'Bluetooth 5.2, Jack 3.5mm', battery: '30 giờ (bật ANC)', anc: 'Chống ồn tự động Auto NC Optimizer', weight: '250g' },
        featured: true, stock: 25
    },
    {
        name: 'Tai nghe chụp tai Marshall Major IV',
        brand: 'Marshall',
        category: 'Tai nghe',
        price: 2990000,
        originalPrice: 3890000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/a/tai-nghe-marshall-major-4.png',
        description: 'Chất âm rock đặc trưng huyền thoại của Marshall, thời lượng pin siêu khủng hơn 80 giờ chơi nhạc không dây, hỗ trợ sạc nhanh không dây.',
        specs: { connectivity: 'Bluetooth 5.0, Jack 3.5mm', battery: 'Hơn 80 giờ liên tục', audio: 'Driver 40mm đặc trưng Marshall', weight: '165g' },
        featured: false, stock: 20
    },
    {
        name: 'Tai nghe không dây Samsung Galaxy Buds3 Pro',
        brand: 'Samsung',
        category: 'Tai nghe',
        price: 4490000,
        originalPrice: 5490000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-buds-3-pro.png',
        description: 'Thiết kế blade thanh lịch có dải đèn LED độc đáo, loa 2 chiều cùng bộ khuếch đại kép, tích hợp tính năng Galaxy AI thông minh.',
        specs: { connectivity: 'Bluetooth 5.4', battery: 'Lên đến 30 giờ (kèm hộp)', anc: 'Khử ồn thích ứng AI thông minh', charging: 'Type-C & Không dây' },
        featured: false, stock: 30
    },

    // ===== ĐỒNG HỒ THÔNG MINH =====
    {
        name: 'Đồng hồ thông minh Apple Watch Series 10 42mm',
        brand: 'Apple',
        category: 'Đồng hồ thông minh',
        price: 10490000,
        originalPrice: 10990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/p/apple-watch-series-10-nhom-42mm.png',
        description: 'Màn hình OLED góc nhìn rộng sáng hơn 40%, thân máy mỏng nhất từ trước tới nay, sạc nhanh đạt 80% chỉ trong 30 phút.',
        specs: { screen: 'OLED Always-On rộng hơn', battery: 'Lên đến 18 giờ (36 giờ chế độ tiết kiệm)', features: 'ECG, Đo nồng độ Oxy, Phát hiện té ngã, Cảm biến độ sâu', os: 'watchOS 11' },
        featured: true, stock: 25
    },
    {
        name: 'Đồng hồ thông minh Apple Watch Ultra 2 49mm',
        brand: 'Apple',
        category: 'Đồng hồ thông minh',
        price: 20990000,
        originalPrice: 21990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/p/apple-watch-ultra-2.png',
        description: 'Khung viền Titan chuẩn quân sự siêu bền, màn hình siêu sáng 3000 nits, GPS tần số kép chính xác cao dành cho thể thao chuyên nghiệp.',
        specs: { screen: 'Sapphire Crystal 49mm 3000 nits', battery: '36 giờ (72 giờ chế độ tiết kiệm)', resistance: 'Chống nước 100m, lặn EN13319', os: 'watchOS 11' },
        featured: true, stock: 15
    },
    {
        name: 'Đồng hồ thông minh Samsung Galaxy Watch 7 40mm',
        brand: 'Samsung',
        category: 'Đồng hồ thông minh',
        price: 6490000,
        originalPrice: 6990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-watch-7.png',
        description: 'Cảm biến BioActive thế hệ mới theo dõi chỉ số sức khỏe chính xác cùng Galaxy AI, vi xử lý 3nm đầu tiên mượt mà vượt trội.',
        specs: { screen: 'Super AMOLED 1.3 inch Sapphire', cpu: 'Exynos W1000 3nm 5 nhân', features: 'Chỉ số AGEs, ECG, Huyết áp, GPS kép L1+L5', os: 'Wear OS Powered by Samsung' },
        featured: false, stock: 22
    },
    {
        name: 'Đồng hồ thể thao Garmin Forerunner 265',
        brand: 'Garmin',
        category: 'Đồng hồ thông minh',
        price: 11490000,
        originalPrice: 11990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/g/a/garmin-forerunner-265.png',
        description: 'Màn hình cảm ứng AMOLED rực rỡ, tính năng đánh giá mức độ sẵn sàng luyện tập, đo động lực học chạy bộ chi tiết trên cổ tay.',
        specs: { screen: 'AMOLED 1.3 inch cảm ứng', battery: 'Lên đến 13 ngày ở chế độ smartwatch', features: 'Báo cáo buổi sáng, VO2 Max, GPS đa băng tần', os: 'Garmin OS' },
        featured: true, stock: 12
    },

    // ===== PHỤ KIỆN =====
    {
        name: 'Chuột Gaming Logitech G502 Hero',
        brand: 'Logitech',
        category: 'Phụ kiện',
        price: 880000,
        originalPrice: 1390000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/c/h/chuot-choi-game-co-day-logitech-g502-hero.png',
        description: 'Cảm biến HERO 25.600 DPI đem lại hiệu suất ổn định và chính xác vượt trội, tốc độ phản hồi 1ms cùng 11 nút bấm có thể lập trình.',
        specs: { dpi: '25.600 DPI', buttons: '11 nút lập trình', connectivity: 'Dây cáp USB 2.1m', rgb: 'LIGHTSYNC LED RGB 16.8 triệu màu' },
        featured: true, stock: 50
    },
    {
        name: 'Hub chuyển đổi Ugreen USB-C 5 IN 1 CM478 15495',
        brand: 'UGREEN',
        category: 'Phụ kiện',
        price: 280000,
        originalPrice: 416000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/h/u/hub-chuyen-doi-ugreen-usb-c-5-in-1-cm478-15495.png',
        description: 'Bộ mở rộng cổng kết nối 5 trong 1 cao cấp: hỗ trợ xuất màn hình HDMI 4K@30Hz sắc nét và 4 cổng USB dữ liệu siêu tốc.',
        specs: { ports: '1x HDMI 4K, 4x USB 3.0 / USB 2.0', material: 'Hợp kim nhôm tản nhiệt tốt', compatibility: 'MacBook, Laptop Windows, iPad, Điện thoại Type-C' },
        featured: true, stock: 60
    },
    {
        name: 'Pin sạc dự phòng Anker A1695 25.000mAh 165W',
        brand: 'Anker',
        category: 'Phụ kiện',
        price: 1500000,
        originalPrice: 2850000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/p/i/pin-sac-du-phong-anker-prime-20000mah-200w-a1336.png',
        description: 'Dung lượng khủng 25.000mAh, công suất ra cực đại 165W sạc nhanh cùng lúc cho cả laptop và điện thoại, màn hình màu báo trạng thái pin thông minh.',
        specs: { capacity: '25.000mAh', output: 'Tối đa 165W Power Delivery', ports: '1x Type-C, 1x USB-A', display: 'Màn hình kỹ thuật số hiển thị công suất' },
        featured: true, stock: 35
    },
    {
        name: 'DJI Osmo Pocket 3 Creator Combo',
        brand: 'DJI',
        category: 'Phụ kiện',
        price: 11281000,
        originalPrice: 17995000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/d/j/dji-osmo-pocket-3-creator-combo.png',
        description: 'Camera quay vlog gimbal 3 trục bỏ túi cảm biến 1 inch mạnh mẽ, quay video 4K/120fps, lấy nét nhanh toàn điểm và theo dõi chủ thể ActiveTrack 6.0.',
        specs: { sensor: 'CMOS 1 inch', resolution: '4K@120fps, D-Log M 10-bit', tracking: 'ActiveTrack 6.0 thông minh', battery: 'Sạc nhanh 80% trong 16 phút' },
        featured: true, stock: 15
    },
    {
        name: 'Bút cảm ứng Apple Pencil Pro',
        brand: 'Apple',
        category: 'Phụ kiện',
        price: 3290000,
        originalPrice: 3490000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/b/u/but-cam-ung-apple-pencil-pro.png',
        description: 'Tính năng bóp nhẹ mở bảng công cụ, xoay tròn thân bút thay đổi đầu cọ mượt mà, phản hồi rung haptic chân thực và hỗ trợ mạng Tìm (Find My).',
        specs: { features: 'Bóp (Squeeze), Xoay thân bút (Barrel roll), Haptic feedback', connectivity: 'Hít nam châm & Sạc không dây trên iPad', compatibility: 'iPad Pro M4, iPad Air M2' },
        featured: false, stock: 40
    },
    {
        name: 'Củ sạc nhanh Anker GaNPrime 65W 3 cổng A2668',
        brand: 'Anker',
        category: 'Phụ kiện',
        price: 890000,
        originalPrice: 1300000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/c/u/cu-sac-nhanh-anker-ganprime-65w.png',
        description: 'Công nghệ bán dẫn GaNPrime siêu nhỏ gọn, phân bổ công suất thông minh PowerIQ 4.0, sạc nhanh cùng lúc cho 3 thiết bị an toàn.',
        specs: { power: '65W Power Delivery', ports: '2x USB-C, 1x USB-A', tech: 'GaNPrime & ActiveShield 2.0 kiểm soát nhiệt độ' },
        featured: false, stock: 45
    },

    // ===== MÁY CHƠI GAME =====
    {
        name: 'Máy chơi game Nintendo Switch OLED Model White',
        brand: 'Nintendo',
        category: 'Máy chơi game',
        price: 7990000,
        originalPrice: 8990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/a/may-choi-game-nintendo-switch-oled.png',
        description: 'Màn hình OLED 7 inch rực rỡ, chân dựng bản rộng linh hoạt đa góc độ, đế dock tích hợp cổng LAN có dây, bộ nhớ trong 64GB.',
        specs: { cpu: 'NVIDIA Custom Tegra', storage: '64GB (hỗ trợ thẻ MicroSD)', screen: 'OLED 7 inch', mode: 'TV mode, Tabletop mode, Handheld mode' },
        featured: true, stock: 20
    },
    {
        name: 'Máy chơi game Sony PlayStation 5 (PS5) Slim Standard',
        brand: 'Sony',
        category: 'Máy chơi game',
        price: 13490000,
        originalPrice: 14990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/p/s/ps5-slim.png',
        description: 'Phiên bản Slim nhỏ gọn hơn 30%, tích hợp ổ đĩa quang Ultra HD Blu-ray, ổ cứng siêu tốc SSD 1TB nạp game tức thì, đồ họa Ray-Tracing 4K 120fps.',
        specs: { cpu: 'AMD Zen 2 8 nhân 16 luồng', gpu: 'AMD RDNA 2 10.3 TFLOPS', storage: '1TB Custom High-Speed SSD', video: 'Hỗ trợ 4K 120Hz, 8K, HDR' },
        featured: true, stock: 15
    },
    {
        name: 'Tay cầm không dây Sony DualSense PS5 White',
        brand: 'Sony',
        category: 'Máy chơi game',
        price: 1890000,
        originalPrice: 2190000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/a/tay-cam-choi-game-khong-day-sony-dualsense-ps5-trang.png',
        description: 'Trải nghiệm chơi game đắm chìm với phản hồi rung cảm ứng xúc giác Haptic Feedback, nút bấm cò thích ứng Adaptive Triggers và micro tích hợp.',
        specs: { connectivity: 'Bluetooth 5.1 & Type-C', features: 'Haptic Feedback, Adaptive Triggers, Loa và Mic tích hợp', battery: 'Pin sạc 1560mAh' },
        featured: true, stock: 35
    },
    {
        name: 'Máy chơi game Nintendo Switch Lite Coral',
        brand: 'Nintendo',
        category: 'Máy chơi game',
        price: 4490000,
        originalPrice: 4990000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/n/i/nintendo-switch-lite.png',
        description: 'Thiết kế nguyên khối nhỏ gọn tối ưu cho việc mang đi bất cứ đâu, hệ thống phím bấm D-pad tích hợp chuẩn xác, thời lượng pin bền bỉ.',
        specs: { screen: 'LCD 5.5 inch', storage: '32GB', battery: 'Lên đến 7 giờ chơi game', weight: '275g siêu nhẹ' },
        featured: false, stock: 25
    },
    {
        name: 'Tay cầm không dây Xbox Wireless Controller Robot White',
        brand: 'Microsoft',
        category: 'Máy chơi game',
        price: 1590000,
        originalPrice: 1890000,
        image: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/t/a/tay-cam-xbox-series-x.png',
        description: 'Thiết kế công thái học hiện đại với lớp vân nhám bám tay ở nút bấm và tay cầm, cụm D-pad lai thế hệ mới, tương thích mượt mà Xbox và PC Windows.',
        specs: { connectivity: 'Xbox Wireless, Bluetooth, USB-C', compatibility: 'Xbox Series X|S, Xbox One, Windows 10/11, Android, iOS' },
        featured: false, stock: 30
    }
];

async function testAll() {
    console.log(`Testing ${candidateProducts.length} candidate URLs...`);
    const results = [];
    for (const p of candidateProducts) {
        try {
            const res = await fetch(p.image);
            results.push({ name: p.name, category: p.category, status: res.status, url: p.image });
            console.log(`[${res.status}] ${p.category} - ${p.name}`);
        } catch (e) {
            results.push({ name: p.name, category: p.category, status: 'ERROR', error: e.message, url: p.image });
            console.log(`[ERR] ${p.category} - ${p.name}: ${e.message}`);
        }
    }
    const failed = results.filter(r => r.status !== 200);
    console.log(`\nResults: ${results.length - failed.length} passed, ${failed.length} failed.`);
    fs.writeFileSync('scripts/candidate_check_results.json', JSON.stringify(results, null, 2));
}

testAll();
