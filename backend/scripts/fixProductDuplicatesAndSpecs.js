const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../src/models/Product');

const updates = [
    {
        sku: 'TECH-00045',
        name: 'Pin sạc dự phòng Baseus Bipow Digital Display 20.000mAh 20W',
        brand: 'Baseus',
        category: 'Phụ kiện',
        image: 'assets/images/products/baseus-bipow-20000mah.jpg',
        images: ['assets/images/products/baseus-bipow-20000mah.jpg'],
        description: 'Dung lượng thực 20.000mAh, hỗ trợ sạc nhanh 20W chuẩn PD và QC, màn hình LED kỹ thuật số hiển thị chính xác % pin còn lại.',
        specs: {
            screen: 'Màn hình LED hiển thị % pin kỹ thuật số',
            battery: '20.000 mAh (74Wh)',
            connectivity: '2x USB-A (18W QC), 1x Type-C (20W PD), 1x Micro-USB',
            weight: '452g'
        }
    },
    {
        sku: 'TECH-00047',
        name: 'Pin sạc dự phòng Ugreen Nexode 130W 20.000mAh PB721',
        brand: 'UGREEN',
        category: 'Phụ kiện',
        image: 'assets/images/products/ugreen-nexode-130w-pb721.jpg',
        images: ['assets/images/products/ugreen-nexode-130w-pb721.jpg'],
        description: 'Công suất đỉnh cao 130W hỗ trợ sạc nhanh cho MacBook Pro, Dell XPS, iPhone và iPad. Màn hình TFT thông minh hiển thị dòng điện thời gian thực.',
        specs: {
            screen: 'Màn hình TFT hiển thị công suất thời gian thực',
            battery: '20.000 mAh (72Wh)',
            connectivity: '2x USB-C (Max 100W PD), 1x USB-A (22.5W SCP)',
            weight: '480g'
        }
    },
    {
        sku: 'TECH-00022',
        name: 'iPad Pro 11 inch M4 Wi-Fi 256GB',
        brand: 'Apple',
        category: 'Tablet',
        image: 'assets/images/products/ipad-pro-11-m4-wifi-256gb.jpg',
        images: ['assets/images/products/ipad-pro-11-m4-wifi-256gb.jpg'],
        description: 'Màn hình Ultra Retina XDR Tandem OLED đỉnh cao nhất, chip Apple M4 thế hệ mới siêu mạnh mẽ và độ mỏng chỉ 5.3mm.',
        specs: {
            cpu: 'Apple M4 9-core CPU 10-core GPU',
            ram: '8GB',
            storage: '256GB',
            screen: 'Ultra Retina XDR Tandem OLED 11 inch 120Hz ProMotion',
            battery: '31.29 Wh (Khoảng 10 giờ lướt web)',
            os: 'iPadOS 18',
            camera: '12MP Sau, 12MP TrueDepth Trước, Cảm biến LiDAR',
            gpu: 'Apple 10-core GPU',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, Thunderbolt / USB 4',
            weight: '444g'
        }
    },
    {
        sku: 'TECH-00023',
        name: 'iPad Air 11 inch M2 Wi-Fi 128GB',
        brand: 'Apple',
        category: 'Tablet',
        image: 'assets/images/products/ipad-air-11-m2-wifi-128gb.jpg',
        images: ['assets/images/products/ipad-air-11-m2-wifi-128gb.jpg'],
        description: 'Chip Apple M2 mạnh mẽ đáp ứng đồ họa chuyên sâu, hỗ trợ Apple Pencil Pro và Magic Keyboard tiện lợi.',
        specs: {
            cpu: 'Apple M2 8-core CPU 9-core GPU',
            ram: '8GB',
            storage: '128GB',
            screen: 'Liquid Retina 11 inch True Tone P3 (2360 x 1640)',
            battery: '28.93 Wh (Khoảng 10 giờ lướt web)',
            os: 'iPadOS 18',
            camera: '12MP Sau, 12MP Góc Siêu Rộng Trước',
            gpu: 'Apple 9-core GPU',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, USB-C',
            weight: '462g'
        }
    },
    {
        sku: 'TECH-00027',
        name: 'Huawei MatePad 11.5 S Kèm Bàn Phím',
        brand: 'Huawei',
        category: 'Tablet',
        image: 'assets/images/products/huawei-matepad-11-5s.jpg',
        images: ['assets/images/products/huawei-matepad-11-5s.jpg'],
        description: 'Màn hình PaperMatte chống chói chống lóa như trang sách thật, trải nghiệm viết vẽ tự nhiên cùng bàn phím thông minh Huawei Smart Magnetic.',
        specs: {
            cpu: 'Kirin 9000WL',
            ram: '8GB',
            storage: '256GB',
            screen: 'PaperMatte 11.5 inch 2.8K 144Hz chống chói',
            battery: '8.800 mAh, sạc nhanh 22.5W',
            os: 'HarmonyOS 4.2',
            camera: '13MP Sau, 8MP Trước',
            gpu: 'Maleoon 910',
            connectivity: 'Wi-Fi 6, Bluetooth 5.2, USB Type-C',
            weight: '510g'
        }
    },
    {
        sku: 'TECH-00014',
        name: 'MacBook Air 13 inch M3 512GB',
        brand: 'Apple',
        category: 'Laptop',
        image: 'assets/images/products/macbook-air-13-m3-512gb.jpg',
        images: ['assets/images/products/macbook-air-13-m3-512gb.jpg'],
        description: 'Đỉnh cao laptop mỏng nhẹ với sức mạnh của chip Apple Silicon M3, thời lượng pin 18 giờ cùng màn hình Liquid Retina sắc nét.',
        specs: {
            cpu: 'Apple M3 8-core CPU 10-core GPU',
            ram: '16GB Unified Memory',
            storage: '512GB SSD',
            screen: '13.6 inch Liquid Retina (2560 x 1664)',
            battery: '52.6Wh Li-Po (Pin 18 giờ, sạc MagSafe 3)',
            os: 'macOS Sonoma',
            camera: '1080p FaceTime HD',
            gpu: 'Apple 10-core GPU',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, 2x Thunderbolt / USB 4',
            weight: '1.24 kg'
        }
    },
    {
        sku: 'TECH-00016',
        name: 'Laptop ASUS ROG Strix G16 G614',
        brand: 'ASUS',
        category: 'Laptop',
        image: 'assets/images/products/asus-rog-strix-g16-g614.jpg',
        images: ['assets/images/products/asus-rog-strix-g16-g614.jpg'],
        description: 'Cỗ máy chiến game đỉnh cao với màn hình ROG Nebula 240Hz, card đồ họa RTX 4070 và tản nhiệt 3 quạt Tri-Fan cực mát.',
        specs: {
            cpu: 'Intel Core i9-14900HX (24 nhân, 32 luồng, Turbo 5.8GHz)',
            ram: '32GB DDR5 5600MHz',
            storage: '1TB PCIe 4.0 NVMe SSD',
            screen: '16 inch ROG Nebula QHD+ (2560x1600) 240Hz 3ms',
            battery: '90Wh, sạc nhanh 330W',
            os: 'Windows 11 Home',
            camera: '720p HD',
            gpu: 'NVIDIA GeForce RTX 4070 8GB GDDR6',
            connectivity: 'Wi-Fi 6E, Bluetooth 5.3, Thunderbolt 4, HDMI 2.1',
            weight: '2.50 kg'
        }
    },
    {
        sku: 'TECH-00020',
        name: 'Laptop Lenovo IdeaPad Slim 3 14 inch',
        brand: 'Lenovo',
        category: 'Laptop',
        image: 'assets/images/products/lenovo-ideapad-slim-3-14.jpg',
        images: ['assets/images/products/lenovo-ideapad-slim-3-14.jpg'],
        description: 'Lựa chọn lý tưởng cho học sinh, sinh viên và nhân viên văn phòng: thiết kế mỏng nhẹ 1.37kg, bền bỉ chuẩn quân đội Mỹ MIL-STD-810H.',
        specs: {
            cpu: 'Intel Core i5-1335U (10 nhân, 12 luồng, Turbo 4.6GHz)',
            ram: '16GB LPDDR5 4800MHz',
            storage: '512GB SSD M.2 PCIe NVMe',
            screen: '14 inch Full HD (1920x1080) IPS 300 nits chống chói',
            battery: '47Wh, sạc nhanh Rapid Charge Boost',
            os: 'Windows 11 Home',
            camera: 'FHD 1080p có khóa bảo mật',
            gpu: 'Intel Iris Xe Graphics',
            connectivity: 'Wi-Fi 6, Bluetooth 5.2, USB-C, HDMI 1.4b',
            weight: '1.37 kg'
        }
    },
    {
        sku: 'TECH-00021',
        name: 'Laptop Dell Inspiron 15 3520 Intel Core i5',
        brand: 'Dell',
        category: 'Laptop',
        image: 'assets/images/products/dell-inspiron-15-3520.jpg',
        images: ['assets/images/products/dell-inspiron-15-3520.jpg'],
        description: 'Thương hiệu Dell bền bỉ tin cậy, bàn phím số tiện lợi nhập liệu, màn hình 120Hz mượt mà cho mọi tác vụ công việc văn phòng.',
        specs: {
            cpu: 'Intel Core i5-1235U (10 nhân, 12 luồng, Turbo 4.4GHz)',
            ram: '16GB DDR4 3200MHz',
            storage: '512GB SSD M.2 PCIe NVMe',
            screen: '15.6 inch Full HD (1920x1080) 120Hz WVA chống chói',
            battery: '41Wh, sạc nhanh ExpressCharge',
            os: 'Windows 11 Home',
            camera: '720p HD Webcam',
            gpu: 'Intel Iris Xe Graphics',
            connectivity: 'Wi-Fi 6, Bluetooth 5.2, USB 3.2, HDMI 1.4',
            weight: '1.65 kg'
        }
    },
    {
        sku: 'TECH-00019',
        name: 'Laptop Acer Gaming Nitro V 15 ANV15',
        brand: 'Acer',
        category: 'Laptop',
        image: 'assets/images/products/acer-nitro-v15-anv15.jpg',
        images: ['assets/images/products/acer-nitro-v15-anv15.jpg'],
        description: 'Dòng máy quốc dân Acer Nitro V 15 với logo N neon độc đáo, 2 quạt tản nhiệt hiệu năng cao và màn hình IPS 144Hz mượt mà.',
        specs: {
            cpu: 'Intel Core i5-13420H (8 nhân, 12 luồng, Turbo 4.6GHz)',
            ram: '16GB DDR5 5200MHz',
            storage: '512GB SSD M.2 PCIe Gen 4',
            screen: '15.6 inch Full HD IPS 144Hz SlimBezel',
            battery: '57Wh Li-ion',
            os: 'Windows 11 Home',
            camera: '720p HD Webcam',
            gpu: 'NVIDIA GeForce RTX 3050 6GB GDDR6',
            connectivity: 'Wi-Fi 6, Bluetooth 5.1, Thunderbolt 4, HDMI 2.1',
            weight: '2.10 kg'
        }
    }
];

async function run() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_mini';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    for (const item of updates) {
        const query = { sku: item.sku };
        const existing = await Product.findOne(query);
        if (!existing) {
            console.warn('Product not found by SKU:', item.sku);
            continue;
        }
        existing.name = item.name;
        existing.brand = item.brand;
        existing.category = item.category;
        existing.image = item.image;
        existing.images = item.images;
        existing.description = item.description;
        if (item.specs) {
            existing.specs = { ...(existing.specs ? existing.specs.toObject() : {}), ...item.specs };
        }
        await existing.save();
        console.log(`Updated [${item.sku}]: ${item.name} -> image: ${item.image}`);
    }

    console.log('All 10 products successfully updated in MongoDB with verified local image assets!');

    // Also update uniformCatalog.js
    const catalogPath = path.resolve(__dirname, '../src/data/uniformCatalog.js');
    if (fs.existsSync(catalogPath)) {
        let content = fs.readFileSync(catalogPath, 'utf8');
        for (const item of updates) {
            // Replace image for each SKU / product name in catalog
            const namePattern = new RegExp(`("${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"image":\\s*")[^"]+(")`, 'g');
            content = content.replace(namePattern, `$1${item.image}$2`);
        }
        fs.writeFileSync(catalogPath, content, 'utf8');
        console.log('uniformCatalog.js also updated!');
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Update failed:', err);
    process.exit(1);
});
