/**
 * consultationCoordinator.js
 * Bộ điều phối trung tâm quản lý bối cảnh hội thoại, theo dõi slot (slot-filling),
 * phân loại tình huống tư vấn, truy vấn catalog thực tế từ MongoDB và giải thích đánh đổi (trade-offs).
 */

const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const aiModelService = require('./aiModelService');

// -------------------------------------------------------------
// TIỆN ÍCH CHUẨN HÓA VĂN BẢN VÀ ĐỊNH DẠNG TIỀN TỆ
// -------------------------------------------------------------
function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordOrPhrase(text, phrase) {
    const normText = normalizeText(text);
    const normPhrase = normalizeText(phrase);
    const escaped = escapeRegex(normPhrase);
    const regex = new RegExp(`(^|\\s|[.,!?;:()"])${escaped}($|\\s|[.,!?;:()"])`, 'i');
    return regex.test(normText);
}

function money(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

// -------------------------------------------------------------
// TỪ ĐIỂN DANH MỤC, THƯƠNG HIỆU VÀ CÁC MẶT HÀNG NGOÀI HỆ THỐNG
// -------------------------------------------------------------
const CATALOG_BRANDS = [
    { key: 'apple', name: 'Apple', categories: ['Điện thoại (iPhone)', 'Laptop (MacBook)', 'Tablet (iPad)', 'Đồng hồ (Apple Watch)', 'Tai nghe (AirPods)'] },
    { key: 'samsung', name: 'Samsung', categories: ['Điện thoại (Galaxy S/Z)', 'Tablet (Galaxy Tab)', 'Đồng hồ (Galaxy Watch)', 'Tai nghe (Galaxy Buds)'] },
    { key: 'dell', name: 'Dell', categories: ['Laptop văn phòng & Gaming (Inspiron, Vostro, XPS, G15)'] },
    { key: 'asus', name: 'ASUS', categories: ['Laptop Gaming (ROG, TUF)', 'Laptop văn phòng (Zenbook, Vivobook)'] },
    { key: 'acer', name: 'Acer', categories: ['Laptop Gaming (Nitro V, Predator)', 'Laptop học tập (Aspire)'] },
    { key: 'hp', name: 'HP', categories: ['Laptop học tập & văn phòng (Pavilion, Envy)', 'Laptop Gaming (Victus)'] },
    { key: 'lenovo', name: 'Lenovo', categories: ['Laptop (IdeaPad Slim, ThinkPad, Legion)', 'Máy tính bảng (Tab M11)'] },
    { key: 'msi', name: 'MSI', categories: ['Laptop Gaming (Katana, Modern, Stealth, Cyborg)'] },
    { key: 'xiaomi', name: 'Xiaomi', categories: ['Điện thoại Xiaomi', 'Tablet (Xiaomi Pad)', 'Đồng hồ thông minh', 'Tai nghe', 'Pin sạc'] },
    { key: 'poco', name: 'POCO', categories: ['Điện thoại POCO', 'Tablet POCO Pad'] },
    { key: 'oppo', name: 'OPPO', categories: ['Điện thoại thông minh (Reno12, Find X8)'] },
    { key: 'honor', name: 'HONOR', categories: ['Điện thoại thông minh (HONOR 200, Magic6 Pro)'] },
    { key: 'huawei', name: 'Huawei', categories: ['Máy tính bảng (MatePad)', 'Đồng hồ thông minh (Watch GT4)'] },
    { key: 'sony', name: 'Sony', categories: ['Máy chơi game (PlayStation 5)', 'Tai nghe cao cấp (WH-1000XM5, WF-C700N)'] },
    { key: 'jbl', name: 'JBL', categories: ['Loa Bluetooth chống nước (Flip 6, Charge 5)', 'Tai nghe True Wireless (Tour Pro 2)'] },
    { key: 'marshall', name: 'Marshall', categories: ['Tai nghe & Loa thời trang (Emberton II, Major IV)'] },
    { key: 'logitech', name: 'Logitech', categories: ['Chuột máy tính (MX Master 3S, G502)', 'Bàn phím cơ & không dây (MX Keys, POP Keys)'] },
    { key: 'baseus', name: 'Baseus', categories: ['Củ sạc nhanh GaN', 'Pin sạc dự phòng dung lượng cao'] },
    { key: 'ugreen', name: 'UGREEN', categories: ['Hub chuyển đổi Type-C đa năng', 'Cáp sạc, phụ kiện'] },
    { key: 'anker', name: 'Anker', categories: ['Củ sạc nhanh 100W/65W', 'Pin sạc dự phòng Anker Prime'] },
    { key: 'garmin', name: 'Garmin', categories: ['Đồng hồ thể thao chuyên nghiệp GPS (Forerunner 265, Venu 3)'] },
    { key: 'nintendo', name: 'Nintendo', categories: ['Máy chơi game cầm tay (Switch OLED, Switch Lite)'] },
    { key: 'valve', name: 'Valve', categories: ['Máy chơi game cầm tay PC (Steam Deck OLED, Dock)'] },
    { key: 'meta', name: 'Meta', categories: ['Kính thực tế ảo VR (Meta Quest 3, Quest 3S, Elite Strap)'] },
    { key: 'microsoft', name: 'Microsoft', categories: ['Máy tính bảng & Laptop 2-in-1 (Surface Pro 11, Surface Laptop Go 3)'] },
    { key: 'dji', name: 'DJI', categories: ['Camera Gimbal 4K bỏ túi (Osmo Pocket 3)', 'Gimbal điện thoại chống rung (Osmo Mobile 6)'] }
];

// Loại sản phẩm thực tế trong catalog. Các loại cụ thể phải đứng trước danh mục rộng
// để "bàn phím", "loa", "tay cầm"... không bị hiểu thành một từ khóa lạ.
const PRODUCT_TYPE_INTENTS = [
    { key: 'keyboard', label: 'bàn phím', aliases: ['ban phim', 'keyboard'], category: 'Phụ kiện', name: /bàn phím|keyboard/i },
    { key: 'mouse', label: 'chuột máy tính', aliases: ['chuot may tinh', 'chuot khong day', 'chuot gaming', 'chuot', 'mouse'], category: 'Phụ kiện', name: /chuột|mouse/i },
    { key: 'power_bank', label: 'pin sạc dự phòng', aliases: ['pin sac du phong', 'pin du phong', 'sac du phong', 'power bank', 'powerbank'], category: 'Phụ kiện', name: /pin sạc dự phòng|sạc dự phòng|power ?bank/i },
    { key: 'charger', label: 'củ sạc', aliases: ['cu sac nhanh', 'cu sac', 'bo sac', 'sac gan'], category: 'Phụ kiện', name: /củ sạc|bộ sạc|sạc nhanh|gan/i },
    { key: 'hub', label: 'hub chuyển đổi', aliases: ['hub chuyen doi', 'hub usb', 'hub type c', 'hub'], category: 'Phụ kiện', name: /hub|chuyển đổi/i },
    { key: 'stylus', label: 'bút cảm ứng', aliases: ['but cam ung', 'apple pencil', 'but cho tablet'], category: 'Phụ kiện', name: /bút cảm ứng|pencil/i },
    { key: 'controller', label: 'tay cầm chơi game', aliases: ['tay cam choi game', 'tay cam ps5', 'dualsense', 'gamepad', 'tay cam'], category: 'Phụ kiện', name: /tay cầm|dualsense|gamepad/i },
    { key: 'microphone', label: 'micro thu âm', aliases: ['micro thu am', 'micro khong day', 'microphone', 'micro'], category: 'Phụ kiện', name: /(^|\s)micro(?:phone)?(\s|$)/i },
    { key: 'gimbal', label: 'gimbal chống rung', aliases: ['gimbal chong rung', 'gimbal dien thoai', 'gimbal'], category: 'Phụ kiện', name: /gimbal/i },
    { key: 'camera', label: 'camera bỏ túi', aliases: ['camera bo tui', 'osmo pocket', 'camera vlog'], category: 'Phụ kiện', name: /camera|osmo pocket/i },
    { key: 'speaker', label: 'loa Bluetooth', aliases: ['loa bluetooth', 'loa khong day', 'loa'], category: 'Tai nghe', name: /^loa\b/i },
    { key: 'headphones', label: 'tai nghe', aliases: ['tai nghe', 'airpods', 'headphone', 'earbuds', 'headset', 'galaxy buds'], category: 'Tai nghe', name: /^tai nghe\b/i },
    { key: 'smartwatch', label: 'đồng hồ thông minh', aliases: ['dong ho thong minh', 'smartwatch', 'apple watch', 'galaxy watch', 'garmin watch', 'vong deo tay thong minh', 'dong ho'], category: 'Đồng hồ thông minh' },
    { key: 'console', label: 'máy chơi game', aliases: ['may choi game', 'playstation', 'ps5', 'nintendo switch', 'steam deck', 'rog ally'], category: 'Máy chơi game' },
    { key: 'tablet', label: 'máy tính bảng', aliases: ['may tinh bang', 'tablet', 'ipad', 'galaxy tab', 'matepad'], category: 'Tablet' },
    { key: 'laptop', label: 'laptop', aliases: ['laptop', 'may tinh xach tay', 'macbook', 'notebook'], category: 'Laptop' },
    { key: 'phone', label: 'điện thoại', aliases: ['dien thoai', 'smartphone', 'iphone'], category: 'Điện thoại' },
    { key: 'accessory', label: 'phụ kiện', aliases: ['phu kien'], category: 'Phụ kiện' }
];

const UNCARRIED_WATCH_BRANDS = [
    { key: 'casio', name: 'Casio' },
    { key: 'g-shock', name: 'Casio G-Shock' },
    { key: 'g shock', name: 'Casio G-Shock' },
    { key: 'gshock', name: 'Casio G-Shock' },
    { key: 'baby-g', name: 'Casio Baby-G' },
    { key: 'baby g', name: 'Casio Baby-G' },
    { key: 'babyg', name: 'Casio Baby-G' },
    { key: 'edifice', name: 'Casio Edifice' },
    { key: 'sheen', name: 'Casio Sheen' },
    { key: 'seiko', name: 'Seiko' },
    { key: 'citizen', name: 'Citizen' },
    { key: 'orient', name: 'Orient' },
    { key: 'tissot', name: 'Tissot' },
    { key: 'longines', name: 'Longines' },
    { key: 'rolex', name: 'Rolex' },
    { key: 'omega', name: 'Omega' },
    { key: 'hublot', name: 'Hublot' },
    { key: 'patek philippe', name: 'Patek Philippe' },
    { key: 'patek', name: 'Patek Philippe' },
    { key: 'daniel wellington', name: 'Daniel Wellington (DW)' },
    { key: 'dw', name: 'Daniel Wellington (DW)' },
    { key: 'fossil', name: 'Fossil' },
    { key: 'carnival', name: 'Carnival' },
    { key: 'srwatch', name: 'SRWatch' },
    { key: 'bentley', name: 'Bentley' },
    { key: 'ogival', name: 'Ogival' },
    { key: 'olym pianus', name: 'Olym Pianus (OP)' },
    { key: 'op', name: 'Olym Pianus (OP)' },
    { key: 'skagen', name: 'Skagen' },
    { key: 'timex', name: 'Timex' }
];

const UNCARRIED_PHONE_BRANDS = [
    { key: 'vertu', name: 'Vertu' },
    { key: 'blackberry', name: 'BlackBerry' },
    { key: 'google pixel', name: 'Google Pixel' },
    { key: 'pixel', name: 'Google Pixel' },
    { key: 'oneplus', name: 'OnePlus' },
    { key: 'realme', name: 'Realme' },
    { key: 'vivo', name: 'Vivo' },
    { key: 'meizu', name: 'Meizu' },
    { key: 'motorola', name: 'Motorola' },
    { key: 'bphone', name: 'Bphone' },
    { key: 'vsmart', name: 'Vsmart' },
    { key: 'htc', name: 'HTC' },
    { key: 'sony xperia', name: 'Sony Xperia' },
    { key: 'xperia', name: 'Sony Xperia' },
    { key: 'rog phone', name: 'ASUS ROG Phone' },
    { key: 'nokia 1280', name: 'Nokia 1280' },
    { key: 'nokia phim bam', name: 'Nokia phím bấm' },
    { key: 'dien thoai phim bam', name: 'điện thoại phím bấm' },
    { key: 'dien thoai cuc gach', name: 'điện thoại cục gạch' }
];

const UNCARRIED_LAPTOP_BRANDS = [
    { key: 'alienware', name: 'Dell Alienware' },
    { key: 'razer blade', name: 'Razer Blade' },
    { key: 'razer', name: 'Razer' },
    { key: 'lg gram', name: 'LG Gram' },
    { key: 'gigabyte aorus', name: 'Gigabyte Aorus' },
    { key: 'gigabyte', name: 'Gigabyte' },
    { key: 'vaio', name: 'Sony Vaio' },
    { key: 'chuwi', name: 'Chuwi' }
];

const UNCARRIED_AUDIO_BRANDS = [
    { key: 'bose', name: 'Bose' },
    { key: 'sennheiser', name: 'Sennheiser' },
    { key: 'audio-technica', name: 'Audio-Technica' },
    { key: 'audio technica', name: 'Audio-Technica' },
    { key: 'bang & olufsen', name: 'B&O (Bang & Olufsen)' },
    { key: 'bang and olufsen', name: 'B&O (Bang & Olufsen)' },
    { key: 'b&o', name: 'B&O' },
    { key: 'beats', name: 'Beats' },
    { key: 'devialet', name: 'Devialet' },
    { key: 'shure', name: 'Shure' },
    { key: 'skullcandy', name: 'Skullcandy' },
    { key: 'akg', name: 'AKG' },
    { key: 'bowers & wilkins', name: 'Bowers & Wilkins' },
    { key: 'edifier', name: 'Edifier' },
    { key: 'soundpeats', name: 'SoundPEATS' }
];

const UNCARRIED_KEYBOARD_BRANDS = [
    { key: 'keychron', name: 'Keychron' },
    { key: 'filco', name: 'Filco' },
    { key: 'akko', name: 'Akko' },
    { key: 'corsair', name: 'Corsair' },
    { key: 'leopold', name: 'Leopold' },
    { key: 'royal kludge', name: 'Royal Kludge (RK)' },
    { key: 'rk', name: 'Royal Kludge (RK)' },
    { key: 'nuphy', name: 'NuPhy' },
    { key: 'varmilo', name: 'Varmilo' },
    { key: 'ducky', name: 'Ducky' },
    { key: 'steelseries', name: 'SteelSeries' }
];

const UNCARRIED_CAMERA_BRANDS = [
    { key: 'canon', name: 'Canon' },
    { key: 'nikon', name: 'Nikon' },
    { key: 'fujifilm', name: 'Fujifilm' },
    { key: 'leica', name: 'Leica' },
    { key: 'lumix', name: 'Panasonic Lumix' }
];

function extractBrandFromList(normText, brandList) {
    for (const b of brandList) {
        if (hasWordOrPhrase(normText, b.key)) {
            return b.name;
        }
    }
    return '';
}

const KNOWN_UNSUPPORTED_ITEMS = [
    // 1. Đồng hồ kim / đồng hồ cơ / thương hiệu đồng hồ thời trang truyền thống
    {
        id: 'traditional_watches',
        keywords: [
            'casio', 'g-shock', 'g shock', 'gshock', 'baby-g', 'baby g', 'babyg', 'edifice', 'sheen',
            'seiko', 'citizen', 'orient', 'tissot', 'longines', 'rolex', 'omega', 'hublot', 'patek philippe', 'patek',
            'daniel wellington', 'fossil', 'carnival', 'srwatch', 'bentley', 'ogival', 'olym pianus', 'skagen', 'timex',
            'dong ho co', 'dong ho automatic', 'dong ho quartz', 'dong ho kim', 'dong ho chay pin',
            'dong ho co nam', 'dong ho co nu', 'dong ho lo co', 'dong ho lo tim', 'dong ho co tu dong',
            'dong ho co thuy si', 'dong ho co nhat', 'dong ho day da truyen thong'
        ],
        name: 'đồng hồ cơ / đồng hồ kim truyền thống',
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_WATCH_BRANDS);
            const brandMention = brand ? ` của thương hiệu **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce chuyên phân phối các dòng **Đồng hồ thông minh (Smartwatch)** theo dõi sức khỏe và thể thao, nên bên mình **chưa có các mẫu đồng hồ kim hay đồng hồ cơ truyền thống**${brandMention} ạ. 🙏\n\n` +
                `Tuy nhiên, nếu bạn yêu thích một chiếc đồng hồ đeo tay bền bỉ, chống nước tốt, pin trâu và có thêm các tính năng công nghệ hiện đại (đo nhịp tim, giấc ngủ, định vị GPS, nhận cuộc gọi & thông báo):\n` +
                `• ⌚ **Garmin (Forerunner 265, Venu 3):** Độ bền chuẩn quân đội, pin trâu 7 - 14 ngày, GPS độc lập cực chuẩn cho thể thao ngoài trời — rất hợp với người thích phong cách bền bỉ như G-Shock.\n` +
                `• ⌚ **Apple Watch (Series 10, SE 2024):** Thiết kế thời thượng, nghe gọi trực tiếp, màn hình Retina sắc nét, đồng bộ tuyệt vời cùng iPhone.\n` +
                `• ⌚ **Samsung Galaxy Watch:** Mặt tròn cổ điển sang trọng, viền xoay tinh tế, theo dõi sức khỏe chuyên sâu cùng điện thoại Android.\n\n` +
                `👉 Bạn có muốn tham khảo các mẫu Smartwatch chính hãng này không, bạn chia sẻ mức ngân sách dự kiến để mình tư vấn chi tiết cho bạn nhé! 😊`;
        },
        suggestions: ['Đồng hồ thể thao Garmin', 'Apple Watch Series 10', 'Samsung Galaxy Watch', 'Đồng hồ dưới 5 triệu']
    },

    // 2. Điện thoại không kinh doanh (Vertu, BlackBerry, Pixel, Nokia 1280...)
    {
        id: 'uncarried_phones',
        keywords: [
            'vertu', 'blackberry', 'google pixel', 'pixel 7', 'pixel 8', 'pixel 9', 'pixel',
            'oneplus', 'realme', 'vivo', 'meizu', 'motorola', 'bphone', 'vsmart', 'htc',
            'sony xperia', 'xperia', 'rog phone', 'nokia 1280', 'nokia phim bam',
            'dien thoai phim bam', 'dien thoai cuc gach', 'dien thoai nguoi gia'
        ],
        name: 'dòng điện thoại này',
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_PHONE_BRANDS);
            const brandMention = brand ? ` của thương hiệu **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce **chưa phân phối dòng điện thoại**${brandMention} ạ. 🙏\n\n` +
                `Cửa hàng chúng mình tập trung phân phối chính hãng 100% các dòng smartphone thế hệ mới nhất kèm chính sách bảo hành 1 đổi 1 và ưu đãi trả góp 0%:\n` +
                `• 📱 **Apple iPhone:** iPhone 16 / 15 Series (Hiệu năng dẫn đầu, quay phim chụp ảnh chuẩn studio, giữ giá tốt).\n` +
                `• 📱 **Samsung Galaxy:** Galaxy S25 / S24 Ultra, Galaxy Z Fold / Z Flip (Màn hình Dynamic AMOLED đỉnh cao, camera zoom 100x AI, bút S-Pen).\n` +
                `• 📱 **Xiaomi & OPPO:** Xiaomi 14, Redmi Note, Reno (Cấu hình vượt trội trong tầm giá, sạc siêu nhanh 67W - 120W, camera chân dung sắc nét).\n\n` +
                `👉 Bạn dự kiến mức ngân sách khoảng bao nhiêu và ưu tiên tiêu chí nào nhất (chụp ảnh, pin trâu, hay chơi game mượt mà) để mình gợi ý mẫu máy tối ưu nhất cho bạn nhé! 😊`;
        },
        suggestions: ['iPhone 16 Series', 'Samsung Galaxy S25 Ultra', 'Xiaomi chính hãng', 'Điện thoại dưới 15 triệu']
    },

    // 3. Laptop không kinh doanh (Alienware, Razer, LG Gram...)
    {
        id: 'uncarried_laptops',
        keywords: [
            'alienware', 'razer blade', 'razer', 'lg gram', 'gigabyte aorus', 'gigabyte', 'vaio', 'chuwi'
        ],
        name: 'dòng laptop này',
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_LAPTOP_BRANDS);
            const brandMention = brand ? ` **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce **chưa phân phối dòng laptop**${brandMention} ạ. 🙏\n\n` +
                `Tuy nhiên, nếu bạn đang tìm kiếm laptop Gaming cấu hình khủng hoặc ultrabook mỏng nhẹ cao cấp, cửa hàng có sẵn các dòng chính hãng tương đương cực kỳ mạnh mẽ kèm bảo hành chính hãng tại Việt Nam:\n` +
                `• 💻 **Laptop Gaming / Đồ họa hiệu năng cao:** **ASUS ROG Strix / TUF Gaming**, **Acer Nitro V**, **Lenovo Legion**, **MSI Cyborg** (Card đồ họa RTX 40 Series, tản nhiệt buồng hơi mát rượi, màn hình 144Hz - 240Hz).\n` +
                `• 💻 **Laptop Mỏng nhẹ / Cao cấp / Văn phòng:** **MacBook Air / Pro M3**, **Dell XPS / Inspiron**, **HP Envy / Pavilion**, **Lenovo IdeaPad Slim** (Pin bền cả ngày, màn hình sắc nét, thiết kế sang trọng).\n\n` +
                `👉 Bạn có thể chia sẻ mức ngân sách dự kiến và nhu cầu dùng máy (học tập, lập trình, đồ họa hay chiến game gì) để mình chọn mẫu tối ưu nhất cho bạn nhé! 😊`;
        },
        suggestions: ['Laptop Gaming ROG / Nitro', 'MacBook Air M3', 'Laptop mỏng nhẹ văn phòng', 'Laptop sinh viên dưới 20 triệu']
    },

    // 4. Tai nghe / Thiết bị âm thanh không kinh doanh (Bose, Sennheiser, B&O...)
    {
        id: 'uncarried_audio',
        keywords: [
            'bose', 'sennheiser', 'audio-technica', 'audio technica', 'bang & olufsen', 'bang and olufsen',
            'b&o', 'beats', 'devialet', 'shure', 'skullcandy', 'akg', 'bowers & wilkins', 'edifier', 'soundpeats'
        ],
        name: 'tai nghe / loa của thương hiệu này',
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_AUDIO_BRANDS);
            const brandMention = brand ? ` **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce **chưa có các mẫu tai nghe/loa của thương hiệu**${brandMention} ạ. 🙏\n\n` +
                `Cửa hàng chúng mình hiện phân phối chính hãng các thương hiệu âm thanh hàng đầu với chất âm đỉnh cao và khả năng chống ồn chủ động xuất sắc:\n` +
                `• 🎧 **Sony:** **WH-1000XM5** (Chống ồn chủ động số 1 thế giới, chất âm Hi-Res chi tiết), WF-C700N.\n` +
                `• 🎧 **Apple & Samsung:** **AirPods Pro 2** (Âm thanh không gian Spatial Audio, khử ồn đỉnh cao), **Galaxy Buds**.\n` +
                `• 🔊 **Marshall & JBL:** **Marshall Major IV / Emberton II** (Thiết kế hoài cổ cá tính, âm thanh mộc mạc đặc trưng, pin 30h+), **JBL Charge 5 / Flip 6** (Bass uy lực, chống nước IP67 bền bỉ).\n\n` +
                `👉 Bạn đang tìm tai nghe chụp tai (Over-ear) chống ồn hay tai nghe nhét tai nhỏ gọn (In-ear), và tầm giá khoảng bao nhiêu để mình tư vấn cho bạn nhé! 😊`;
        },
        suggestions: ['Sony WH-1000XM5 chống ồn', 'AirPods Pro 2 chính hãng', 'Loa Marshall thời trang', 'Tai nghe dưới 3 triệu']
    },

    // 5. Bàn phím cơ không kinh doanh (Keychron, Akko, Filco...)
    {
        id: 'uncarried_keyboards',
        keywords: [
            'keychron', 'filco', 'akko', 'corsair', 'leopold', 'royal kludge', 'rk', 'nuphy', 'varmilo', 'ducky', 'steelseries'
        ],
        name: 'bàn phím cơ của thương hiệu này',
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_KEYBOARD_BRANDS);
            const brandMention = brand ? ` **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce **chưa phân phối dòng bàn phím cơ của thương hiệu**${brandMention} ạ. 🙏\n\n` +
                `Nếu bạn đang tìm kiếm bàn phím gõ êm ái, kết nối không dây ổn định cho công việc lập trình, văn phòng hoặc chơi game, bên mình có sẵn các mẫu chính hãng cực kỳ được ưa chuộng:\n` +
                `• ⌨️ **Logitech:** **Logitech MX Keys / MX Mechanical** (Chuẩn mực cao cấp cho dân văn phòng và lập trình, gõ siêu đầm tay, kết nối 3 thiết bị cùng lúc), **POP Keys** (Thiết kế cá tính, switch gõ ròn tan vui tai).\n` +
                `• ⌨️ **Dareu:** Bàn phím cơ Dareu gõ êm, đèn LED RGB rực rỡ, độ bền cao với mức giá học sinh sinh viên rất hợp lý.\n` +
                `• 🖱️ Kết hợp hoàn hảo cùng chuột công thái học **Logitech MX Master 3S** (Cuộn vô cực siêu nhanh, êm ái không tiếng ồn).\n\n` +
                `👉 Bạn thích phong cách bàn phím cơ gõ nảy hay bàn phím mỏng nhẹ văn phòng, bạn nhắn mình để mình gửi chi tiết nhé! 😊`;
        },
        suggestions: ['Logitech MX Mechanical', 'Logitech MX Keys', 'Bàn phím Dareu giá tốt', 'Chuột Logitech MX Master 3S']
    },

    // 6. Máy ảnh / Máy quay độc lập
    {
        id: 'standalone_cameras',
        keywords: [
            'may anh', 'may chup hinh', 'may chup anh', 'may quay phim', 'may quay',
            'dslr', 'mirrorless', 'ong kinh', 'lens may anh', 'camera du lich', 'may anh kts', 'may anh compact',
            'may anh canon', 'may anh sony', 'may anh nikon', 'may anh fujifilm', 'may anh leica', 'may anh lumix',
            'canon', 'nikon', 'fujifilm', 'leica', 'lumix', 'may film', 'may anh phim'
        ],
        name: 'máy ảnh / máy chụp hình độc lập',
        excludeIf: (normText) => normText.includes('osmo') || normText.includes('pocket') || normText.includes('gimbal'),
        customReply: (rawText, norm) => {
            const brand = extractBrandFromList(norm, UNCARRIED_CAMERA_BRANDS);
            const brandMention = brand ? ` của **${brand}**` : '';
            return `Dạ chào bạn! Hiện tại TechEcommerce **chưa kinh doanh dòng máy ảnh / máy chụp hình độc lập**${brandMention} (như máy ảnh Canon, Nikon, Fujifilm, DSLR hay Mirrorless) ạ. 🙏\n\n` +
                `Tuy nhiên, nếu bạn có nhu cầu quay phim, chụp ảnh du lịch và sáng tạo nội dung vlog di động chất lượng cao:\n` +
                `• 📹 **Camera Gimbal bỏ túi 4K:** **DJI Osmo Pocket 3 Creator Combo** (Cảm biến 1 inch đỉnh cao, quay 4K/120fps, chống rung 3 trục, micro không dây, bắt nét khuôn mặt siêu nhanh).\n` +
                `• 📱 **Smartphone chụp ảnh chuyên nghiệp:** **iPhone 16 Pro Max** (Quay phim 4K 120fps Dolby Vision, nút Camera Control), **Samsung Galaxy S25 Ultra** (Camera 200MP, zoom quang học AI 100x).\n\n` +
                `👉 Bạn có muốn tham khảo mẫu DJI Osmo Pocket 3 hay các dòng smartphone quay chụp chuyên nghiệp này không ạ? 😊`;
        },
        suggestions: ['DJI Osmo Pocket 3', 'iPhone 16 Pro Max', 'Samsung Galaxy S25 Ultra', 'Gimbal chống rung DJI']
    },

    // 7. Máy đọc sách màn hình E-Ink
    {
        id: 'ereaders',
        keywords: ['may doc sach', 'kindle', 'kobo', 'boox', 'sach dien tu', 'doc sach e-ink', 'man hinh e-ink'],
        name: 'máy đọc sách màn hình E-Ink',
        customReply: `Dạ chào bạn! Hiện tại TechEcommerce **chưa kinh doanh dòng máy đọc sách màn hình E-Ink (như Kindle, Kobo, Boox)** ạ. 🙏\n\n` +
            `Nếu bạn cần một thiết bị màn hình đẹp, gọn nhẹ để đọc tài liệu, học tập, ghi chú bút cảm ứng và đọc sách với chế độ bảo vệ mắt (Eye Comfort / Reading Mode):\n` +
            `• 📲 **iPad (iPad Gen 10, iPad Air M2):** Màn hình Retina sắc nét, hỗ trợ Apple Pencil ghi chú trực tiếp lên tài liệu, kho ứng dụng học tập và đọc sách phong phú.\n` +
            `• 📲 **Samsung Galaxy Tab & Huawei MatePad:** Màn hình sắc nét, có sẵn chế độ bảo vệ mắt đọc sách ban đêm không mỏi, pin trâu và giá rất mềm.\n\n` +
            `👉 Bạn có muốn tham khảo các mẫu máy tính bảng học tập và đọc sách này không, mình tư vấn cho bạn nhé! 😊`,
        suggestions: ['iPad học tập & ghi chép', 'Samsung Galaxy Tab giá tốt', 'Máy tính bảng dưới 10 triệu']
    },

    // 8. Máy chơi game đời cũ / ngoài hệ thống
    {
        id: 'legacy_consoles',
        keywords: ['xbox', 'xbox series', 'ps2', 'ps3', 'ps4', 'psp', 'ps vita', 'nintendo 3ds', 'game boy'],
        name: 'dòng máy chơi game này',
        customReply: `Dạ chào bạn! Hiện tại TechEcommerce tập trung phân phối các dòng máy chơi game thế hệ mới nguyên seal chính hãng, nên bên mình **chưa kinh doanh các dòng máy như Xbox hay máy game đời cũ** ạ. 🙏\n\n` +
            `Cửa hàng chúng mình hiện có sẵn các hệ máy chơi game thế hệ mới cực hot:\n` +
            `• 🎮 **Sony PlayStation 5 Slim (PS5):** Đồ họa 4K đỉnh cao, ổ cứng SSD siêu tốc, tay cầm DualSense phản hồi xúc giác chân thực.\n` +
            `• 🎮 **Nintendo Switch OLED:** Màn hình OLED rực rỡ, chơi di động linh hoạt hoặc cắm TV chơi cùng gia đình và bạn bè.\n` +
            `• 🎮 **Steam Deck OLED:** Cỗ máy chơi game PC cầm tay mạnh mẽ, chơi mượt mà thư viện game Steam mọi lúc mọi nơi.\n\n` +
            `👉 Bạn đang quan tâm đến dòng máy chơi game cầm tay hay cắm TV, bạn nhắn mình để mình hỗ trợ nhé! 😊`,
        suggestions: ['PlayStation 5 Slim', 'Nintendo Switch OLED', 'Steam Deck OLED', 'Tư vấn máy chơi game']
    },

    // 9. iPhone đời cũ
    {
        id: 'legacy_iphones',
        keywords: ['iphone 4', 'iphone 5', 'iphone 6', 'iphone 7', 'iphone 8', 'iphone x', 'iphone xs', 'iphone xr', 'iphone 11', 'iphone 12', 'iphone 13'],
        name: 'dòng iPhone đời cũ này',
        customReply: `Dạ chào bạn! Hiện tại TechEcommerce chuyên phân phối **100% máy mới nguyên seal chính hãng VN/A**, nên bên mình **đã ngừng kinh doanh các dòng iPhone đời cũ này** để đảm bảo trải nghiệm pin và linh kiện bền bỉ nhất cho khách hàng ạ. 🙏\n\n` +
            `Hiện tại cửa hàng có sẵn các dòng iPhone thế hệ mới với ưu đãi cực tốt và hỗ trợ trả góp 0%:\n` +
            `• 📱 **iPhone 16 Series:** iPhone 16, 16 Plus, 16 Pro, 16 Pro Max (Chip A18 mạnh mẽ, Camera Control, Apple Intelligence).\n` +
            `• 📱 **iPhone 15 Series:** iPhone 15, 15 Plus, 15 Pro, 15 Pro Max (Cổng sạc Type-C, Dynamic Island, camera 48MP sắc nét).\n\n` +
            `👉 Bạn có muốn tham khảo các mẫu iPhone chính hãng này trong tầm ngân sách khoảng bao nhiêu để mình tư vấn chi tiết cho bạn nhé! 😊`,
        suggestions: ['iPhone 16 Pro Max', 'iPhone 16 chính hãng', 'iPhone 15 giá tốt', 'Trả góp 0% iPhone']
    },

    // 10. Đồ gia dụng, thiết bị văn phòng, đồ dùng cá nhân, thời trang, xe cộ
    { keywords: ['tivi', 'ti vi', 'smart tv', 'television'], name: 'tivi / màn hình TV' },
    { keywords: ['tu lanh', 'refrigerator'], name: 'tủ lạnh' },
    { keywords: ['may giat', 'may say quan ao', 'may say'], name: 'máy giặt / máy sấy' },
    { keywords: ['dieu hoa', 'may lanh', 'may dieu hoa'], name: 'máy lạnh / máy điều hòa' },
    { keywords: ['may in', 'printer', 'muc in', 'may photo'], name: 'máy in / thiết bị in ấn' },
    { keywords: ['may chieu', 'projector'], name: 'máy chiếu' },
    { keywords: ['may scan', 'scanner'], name: 'máy scan' },
    { keywords: ['may loc khong khi', 'loc khong khi'], name: 'máy lọc không khí' },
    { keywords: ['may hut bui', 'robot hut bui'], name: 'máy hút bụi' },
    { keywords: ['noi chien', 'noi com', 'lo vi song', 'bep tu', 'bep hong ngoai', 'may xay'], name: 'thiết bị gia dụng nhà bếp' },
    { keywords: ['quat dien', 'quat khong canh', 'quat may', 'quat hoi nuoc'], name: 'quạt điện' },
    { keywords: ['ban gaming', 'ghe gaming', 'ghe cong thai hoc', 'ban nang ha'], name: 'bàn / ghế gaming' },
    { keywords: ['flycam', 'drone'], name: 'flycam / drone' },
    { keywords: ['xe dien', 'xe dap', 'xe may'], name: 'xe / phương tiện di chuyển' },
    { keywords: ['quan ao', 'giay dep', 'quan jean', 'ao thun', 'vi da', 'tui xach', 'my pham', 'son moi', 'nuoc hoa'], name: 'thời trang & mỹ phẩm' },
    { keywords: ['dong ho treo tuong', 'dong ho bao thuc', 'dong ho qua lac', 'dong ho de ban'], name: 'đồng hồ treo tường / để bàn' }
];

function checkUnsupportedProduct(text) {
    const norm = normalizeText(text);
    for (const item of KNOWN_UNSUPPORTED_ITEMS) {
        if (typeof item.excludeIf === 'function' && item.excludeIf(norm)) {
            continue;
        }
        if (item.keywords.some(k => hasWordOrPhrase(norm, k))) {
            return item;
        }
    }
    return null;
}

function buildOutOfCatalogResponse(unsupportedInfo, rawText = '') {
    const isObject = typeof unsupportedInfo === 'object' && unsupportedInfo !== null;
    const productName = isObject ? unsupportedInfo.name : unsupportedInfo;
    let customReply = null;
    if (isObject) {
        if (typeof unsupportedInfo.customReply === 'function') {
            customReply = unsupportedInfo.customReply(rawText, normalizeText(rawText));
        } else {
            customReply = unsupportedInfo.customReply;
        }
    }
    const customSuggestions = isObject ? unsupportedInfo.suggestions : null;

    const itemLabel = productName ? `mặt hàng **${productName}**` : '**sản phẩm này**';
    const reply = customReply || (
        `Dạ chào bạn! Hiện tại TechEcommerce là hệ thống chuyên về **thiết bị công nghệ thông minh cá nhân**, nên bên mình chưa kinh doanh ${itemLabel} ạ. 🙏\n\n` +
        `Cửa hàng chúng mình hiện phân phối chính hãng 100% các dòng sản phẩm công nghệ cao cấp:\n` +
        `• 📱 **Điện thoại:** iPhone 16 / 15 Series, Samsung Galaxy S25 / S24, Xiaomi, OPPO...\n` +
        `• 💻 **Laptop:** MacBook Air / Pro M3, ASUS ROG, Acer Nitro, Lenovo IdeaPad, Dell Inspiron...\n` +
        `• 📲 **Tablet:** iPad Pro M4, iPad Air M2, Samsung Galaxy Tab, HONOR Pad...\n` +
        `• ⌚ **Đồng hồ thông minh:** Apple Watch Series 10, Galaxy Watch, Garmin GPS...\n` +
        `• 🎮 **Máy chơi game:** PlayStation 5 Slim, Nintendo Switch OLED, Steam Deck OLED...\n` +
        `• 🎧 **Tai nghe & Phụ kiện:** AirPods Pro 2, chuột Logitech MX Master 3S, củ sạc Anker 100W...\n\n` +
        `👉 Nếu bạn có nhu cầu tìm hiểu bất kỳ sản phẩm công nghệ nào ở trên, bạn nhắn mình để mình tư vấn chi tiết cho bạn nhé! 😊`
    );

    return {
        reply,
        products: [],
        suggestions: customSuggestions || ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Xem iPad & Tablet', 'Đồng hồ thông minh', 'Săn mã giảm giá'],
        context: { stage: 'out_of_catalog', notFound: true },
        notFound: true
    };
}

// -------------------------------------------------------------
// TRÍCH XUẤT SLOT TỪ TIN NHẮN (SLOT EXTRACTORS)
// -------------------------------------------------------------

function extractBudget(text) {
    const norm = normalizeText(text);

    // 1. Dạng 1tr5, 2tr5, 15tr5
    const trMatch = norm.match(/(\d+)\s*(?:tr|trieu)\s*(\d+)\b/i);
    if (trMatch) {
        const millions = Number(trMatch[1]) * 1000000;
        const sub = Number(trMatch[2]);
        const fraction = sub < 10 ? sub * 100000 : sub * 10000;
        return millions + fraction;
    }

    // 2. Dạng 500k, 800k, 500 nghìn, 500 ngàn
    const kMatch = norm.match(/(?:duoi|tam|khoang|ngan sach|budget|tam gia)?\s*(\d{2,4})\s*(?:k|ngan|nghin)\b/i);
    if (kMatch) {
        return Number(kMatch[1]) * 1000;
    }

    // 3. Dạng triệu / tr / m
    const patterns = [
        /(?:duoi|toi da|tam|khoang|ngan sach|budget|tam gia|chi co|khoang chung)?\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|m|cu)\b/i,
        /(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|m|cu)\s*(?:thoi|do lai|tro xuong|tro lai)?\b/i
    ];

    for (const pattern of patterns) {
        const match = norm.match(pattern);
        if (match) return Math.round(Number(match[1].replace(',', '.')) * 1000000);
    }

    const rawNumber = norm.match(/(?:duoi|toi da|tam|khoang|ngan sach|budget)\s*(\d{6,})/i);
    if (rawNumber) return Number(rawNumber[1]);

    return null;
}

function isHardBudgetLimit(text) {
    const norm = normalizeText(text);
    return ['thoi', 'toi da', 'duoi', 'tro xuong', 'tro lai', 'do xuong', 'do ve', 'khong qua', 'het co', 'chi co', 'chi duoc', 'dung'].some(k => norm.includes(k));
}

function inferCategory(text) {
    const norm = normalizeText(text);

    // Bỏ qua đồng hồ truyền thống / đồng hồ kim / đồng hồ cơ / thương hiệu đồng hồ thời trang
    const traditionalWatchKeywords = [
        'dong ho co', 'dong ho automatic', 'dong ho quartz', 'dong ho kim', 'dong ho chay pin',
        'dong ho treo tuong', 'dong ho bao thuc', 'dong ho qua lac', 'dong ho de ban',
        'casio', 'seiko', 'citizen', 'orient', 'tissot', 'longines', 'rolex', 'omega',
        'hublot', 'patek', 'daniel wellington', 'dw', 'fossil', 'carnival', 'srwatch',
        'g-shock', 'g shock', 'gshock', 'baby-g', 'baby g', 'babyg', 'edifice', 'sheen',
        'bentley', 'ogival', 'olym pianus', 'skagen', 'timex'
    ];
    if (traditionalWatchKeywords.some(k => hasWordOrPhrase(norm, k))) {
        return '';
    }

    const categories = [
        ['Đồng hồ thông minh', [
            'dong ho thong minh', 'smartwatch', 'apple watch', 'galaxy watch', 'garmin',
            'huawei watch', 'fitbit', 'dong ho di dong', 'dong ho the thao', 'dong ho'
        ]],
        ['Máy chơi game', [
            'may choi game', 'ps5', 'ps4', 'playstation', 'nintendo',
            'switch oled', 'nintendo switch', 'steam deck', 'xbox', 'meta quest', 'kinh thuc te ao'
        ]],
        ['Laptop', [
            'laptop', 'may tinh xach tay', 'macbook', 'notebook', 'ultrabook',
            'vivobook', 'thinkpad', 'rog strix', 'acer nitro', 'katana', 'ideapad', 'inspiron',
            'may hoc lap trinh', 'may lap trinh', 'lap trinh', 'hoc code', 'hoc it', 'cntt',
            'laptop di hoc', 'laptop sinh vien', 'laptop hoc tap', 'laptop van phong', 'laptop choi game',
            'mua laptop', 'can laptop', 'laptop mong nhe', 'laptop gaming'
        ]],
        ['Điện thoại', [
            'dien thoai', 'smartphone', 'iphone', 'galaxy s', 'galaxy z', 'galaxy fold', 'galaxy flip',
            'xiaomi', 'oppo', 'poco', 'dtdd', 'di dong'
        ]],
        ['Tai nghe', [
            'tai nghe', 'airpods', 'headphone', 'earbuds', 'headset', 'galaxy buds'
        ]],
        ['Tablet', [
            'tablet', 'may tinh bang', 'ipad', 'galaxy tab', 'matepad', 'honor pad', 'xiaomi pad'
        ]],
        ['Phụ kiện', [
            'phu kien', 'chuot may tinh', 'chuot khong day', 'chuot gaming',
            'ban phim', 'ban phim may tinh', 'ban phim co', 'ban phim khong day', 'keyboard',
            'cu sac', 'bo sac', 'day sac', 'sac nhanh', 'pin du phong', 'sac du phong',
            'cap sac', 'hub chuyen doi', 'hub usb', 'but cam ung', 'apple pencil'
        ]]
    ];

    const found = categories.find(([, keywords]) => keywords.some(keyword => hasWordOrPhrase(norm, keyword)));
    return found ? found[0] : '';
}

function extractBrandMention(text) {
    const norm = normalizeText(text);
    return CATALOG_BRANDS.find(b => hasWordOrPhrase(norm, b.key)) || null;
}

function extractEliminatedBrand(text) {
    const norm = normalizeText(text);
    const eliminationPatterns = [
        /(?:ngoai|khac|tru)\s+(?:hang|thuong hieu)?\s*([a-z0-9]+)/i,
        /(?:khong thich|khong muon|loai|bo qua|tru|dung lay|khong lay|ghet)\s+([a-z0-9\s]+)/i,
        /([a-z0-9]+)\s+(?:dung lay|bo qua|loai ra|khong thich|xau qua|nong qua)/i
    ];

    for (const pat of eliminationPatterns) {
        const match = norm.match(pat);
        if (match) {
            const candidate = normalizeText(match[1]);
            const matchedBrand = CATALOG_BRANDS.find(b => candidate.includes(b.key));
            if (matchedBrand) return matchedBrand.name;
        }
    }
    return null;
}

function extractUseCase(text) {
    const norm = normalizeText(text);
    const cases = [
        ['lập trình & công nghệ', ['lap trinh', 'code', 'hoc it', 'cong nghe thong tin', 'cntt', 'developer', 'python', 'docker', 'backend', 'frontend']],
        ['học tập sinh viên / văn phòng', ['sinh vien', 'hoc sinh', 'kinh te', 'marketing', 'ke toan', 'quan tri', 'hoc tap', 'di hoc', 'van phong', 'word', 'excel', 'powerpoint', 'hoc online']],
        ['thiết kế đồ họa & video', ['do hoa', 'thiet ke', 'photoshop', 'illustrator', 'premiere', 'edit video', 'dung phim', 'render', 'autocad', '2d', '3d']],
        ['chơi game giải trí', ['choi game', 'gaming', 'game nang', 'fps', 'lien minh', 'genshin', 'valorant', 'steam']],
        ['di chuyển nhiều & mỏng nhẹ', ['di chuyen', 'mang di hoc', 'mang di lam', 'nhe', 'mong nhe', 'pin trau', 'pin ca ngay']],
        ['chụp ảnh & quay video', ['chup anh', 'quay video', 'camera', 'vlog', 'tiktok', 'selfie', 'chup hinh', 'song ao']]
    ];

    const found = cases.find(([, keywords]) => keywords.some(k => norm.includes(k)));
    return found ? found[0] : '';
}

function extractMajorOrField(text) {
    const norm = normalizeText(text);
    if (['cntt', 'cong nghe thong tin', 'khoa hoc may tinh', 'it', 'phan mem', 'ky thuat phan mem'].some(k => norm.includes(k))) {
        return 'Công nghệ thông tin / Lập trình';
    }
    if (['kinh te', 'marketing', 'quan tri kinh doanh', 'tai chinh', 'ke toan', 'ngan hang', 'thuong mai dien tu', 'luat', 'ngoai thuong', 'ngon ngu'].some(k => norm.includes(k))) {
        return 'Khối ngành Kinh tế / Xã hội / Văn phòng';
    }
    if (['do hoa', 'thiet ke do hoa', 'kien truc', 'my thuat', 'da phuong tien', 'multimedia', 'noi that'].some(k => norm.includes(k))) {
        return 'Thiết kế Đồ họa / Kiến trúc';
    }
    return '';
}

function extractTechProficiency(text) {
    const norm = normalizeText(text);
    if (['khong ranh', 'khong biet', 'mu cong nghe', 'chua ranh', 'khong hieu cau hinh', 'tu van de hieu', 'don gian thoi'].some(k => norm.includes(k))) {
        return 'beginner';
    }
    if (['i5', 'i7', 'ryzen', 'rtx', 'ram', 'nvme', 'oled', 'tflops', 'benchmark'].some(k => norm.includes(k))) {
        return 'advanced';
    }
    return 'intermediate';
}

function extractOrdinalReference(text) {
    const norm = normalizeText(text);
    if (['may thu nhat', 'mau thu nhat', 'con thu nhat', 'cai dau tien', 'may dau tien', 'so 1', 'thu 1'].some(k => norm.includes(k))) {
        return 1;
    }
    if (['may thu hai', 'may thu 2', 'mau thu hai', 'mau thu 2', 'con thu hai', 'con thu 2', 'cai thu hai', 'cai thu 2', 'so 2', 'con thu nhi'].some(k => norm.includes(k))) {
        return 2;
    }
    if (['may thu ba', 'may thu 3', 'mau thu ba', 'mau thu 3', 'con thu ba', 'con thu 3', 'cai thu ba', 'cai thu 3', 'so 3'].some(k => norm.includes(k))) {
        return 3;
    }
    return null;
}

function isPriceObjection(text) {
    const norm = normalizeText(text);
    return ['dat qua', 'hoi dat', 'gia cao qua', 'hoi cao', 'vuot ngan sach', 'nhieu tien qua', 'co loai re hon khong', 're hon duoc khong'].some(k => norm.includes(k));
}

function isOldDeviceDiagnosis(text) {
    const norm = normalizeText(text);
    return [
        'may cu', 'laptop cu', 'core i5 the he 8', 'core i5 gen 8', 'doi 8', 'doi 7', 'doi 6', 'doi 9', 'doi 10',
        'chay cham', 'bi lag', 'bi do', 'nang cap hay mua moi', 'co nen mua may moi', 'co nen doi may', 'nang ram hay', 'thay ssd'
    ].some(k => norm.includes(k));
}

// -------------------------------------------------------------
// TRUY VẤN VÀ TÌM KIẾM SẢN PHẨM TRỰC TIẾP TỪ MONGODB
// -------------------------------------------------------------

function isBrandOnlyQuery(text) {
    const norm = normalizeText(text);
    const brand = CATALOG_BRANDS.find(b => hasWordOrPhrase(norm, b.key));
    if (!brand) return false;

    // Bỏ qua các từ phụ trợ, danh mục, câu hỏi, thái độ
    const stripped = norm
        .replace(new RegExp(`\\b${brand.key}\\b`, 'gi'), '')
        .replace(/\b(dien thoai|smartphone|laptop|macbook|tablet|ipad|smartwatch|dong ho|tai nghe|headphone|earbuds|ban phim|chuot|phu kien|may choi game)\b/gi, '')
        .replace(/\b(toi|minh|em|anh|chi|ban|shop|ad|tech|techecommerce)\b/gi, '')
        .replace(/\b(muon|can|tim|hoi|xem|mua|ban|tu van|co|khong|gi|nao|chua|nhung|mau|dong|san pham|chiec|cai|may|gia|loai|cac|ben ban|o day|cua hang|hang|thuong hieu|thich|me|chuong|chon|lay|dung|nha|nhe|oi|di|a|da|vang)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Nếu sau khi bỏ brand và các từ phụ trợ mà không còn từ khóa model cụ thể nào (độ dài < 2)
    return stripped.length < 2;
}

const PRODUCT_EXACT_ALIASES = [
    // --- Samsung Phones ---
    { terms: ['s26 ultra', 's26ultra', 'galaxy s26 ultra', 'samsung s26 ultra', 'samsung galaxy s26 ultra'], match: /s26 ultra/i },
    { terms: ['s25 ultra', 's25ultra', 'galaxy s25 ultra', 'samsung s25 ultra', 'samsung galaxy s25 ultra'], match: /s25 ultra/i },
    { terms: ['s25 plus', 's25plus', 's25+', 'galaxy s25 plus', 'samsung s25 plus', 'samsung galaxy s25 plus'], match: /s25 plus|s25\+/i },
    { terms: ['s25', 'galaxy s25', 'samsung s25'], match: /s25 ultra/i },
    { terms: ['galaxy a55', 'samsung a55', 'a55 5g', 'a55'], match: /a55/i },
    { terms: ['galaxy a05s', 'samsung a05s', 'a05s', 'a05'], match: /a05s|a05/i },

    // --- Apple Phones ---
    { terms: ['iphone 16 pro max', '16 pro max', '16promax', 'ip 16 pro max', 'ip 16promax', 'ip16 pro max'], match: /iphone 16 pro max/i },
    { terms: ['iphone 16 pro', '16 pro', '16pro', 'ip 16 pro', 'ip16 pro'], match: /^((?!max).)*iphone 16 pro/i },
    { terms: ['iphone 15 pro max', '15 pro max', '15promax', 'ip 15 pro max', 'ip 15promax', 'ip15 pro max'], match: /iphone 15 pro max/i },

    // --- Xiaomi Phones ---
    { terms: ['xiaomi 14 ultra', 'mi 14 ultra', '14 ultra'], match: /xiaomi 14 ultra/i },
    { terms: ['poco x8 pro max', 'poco x8', 'x8 pro max', 'poco x8 pro'], match: /poco x8/i },
    { terms: ['redmi note 13 pro', 'note 13 pro', 'redmi note 13'], match: /redmi note 13 pro/i },

    // --- OPPO Phones ---
    { terms: ['reno12 f', 'reno 12 f', 'reno12f', 'oppo reno 12 f'], match: /reno12 f/i },
    { terms: ['reno12', 'reno 12', 'oppo reno12', 'oppo reno 12'], match: /^((?!reno12 f).)*reno12/i },
    { terms: ['find x8', 'oppo find x8', 'findx8'], match: /find x8/i },
    { terms: ['oppo a79', 'a79 5g', 'a79'], match: /a79/i },

    // --- HONOR Phones ---
    { terms: ['honor 200', 'honor 200 5g'], match: /honor 200/i },
    { terms: ['honor x8b', 'x8b'], match: /honor x8b/i },

    // --- MacBooks & Laptops ---
    { terms: ['macbook air m3', 'air m3', 'macbook m3'], match: /macbook air.*m3/i },
    { terms: ['macbook air m2', 'air m2', 'macbook m2'], match: /macbook air.*m2/i },
    { terms: ['rog strix g16', 'rog strix', 'strix g16'], match: /rog strix/i },
    { terms: ['tuf gaming a16', 'tuf gaming', 'asus tuf'], match: /tuf gaming/i },
    { terms: ['zenbook 14', 'zenbook oled', 'asus zenbook'], match: /zenbook/i },
    { terms: ['helios neo 16', 'helios neo', 'predator helios'], match: /helios neo/i },
    { terms: ['nitro v 15', 'nitro v', 'nitro 5', 'acer nitro'], match: /nitro v/i },
    { terms: ['aspire 3', 'acer aspire'], match: /aspire 3/i },
    { terms: ['swift go 14', 'swift go'], match: /swift go/i },
    { terms: ['vivobook go 14', 'vivobook go'], match: /vivobook go/i },
    { terms: ['vivobook 15', 'asus vivobook 15'], match: /vivobook 15/i },
    { terms: ['katana 15', 'msi katana'], match: /katana 15/i },
    { terms: ['cyborg 15', 'msi cyborg'], match: /cyborg 15/i },
    { terms: ['modern 14', 'msi modern 14'], match: /modern 14/i },
    { terms: ['modern 15', 'msi modern 15'], match: /modern 15/i },
    { terms: ['ideapad slim 3', 'ideapad slim'], match: /ideapad slim 3/i },
    { terms: ['legion 5', 'lenovo legion'], match: /legion 5/i },
    { terms: ['loq 15', 'lenovo loq'], match: /loq 15/i },
    { terms: ['thinkpad e14', 'thinkpad'], match: /thinkpad/i },
    { terms: ['inspiron 15', 'inspiron 3520'], match: /inspiron 15/i },
    { terms: ['inspiron 16', 'inspiron 5630'], match: /inspiron 16/i },
    { terms: ['vostro 14', 'dell vostro'], match: /vostro/i },
    { terms: ['dell xps 13', 'dell xps', 'xps 13'], match: /xps 13/i },
    { terms: ['envy 16', 'hp envy'], match: /envy 16/i },
    { terms: ['victus 15', 'hp victus'], match: /victus 15/i },
    { terms: ['hp pavilion 14', 'hp pavilion'], match: /pavilion/i },
    { terms: ['surface laptop go 3', 'surface laptop'], match: /surface laptop go 3/i },

    // --- Tablets ---
    { terms: ['ipad pro m4', 'ipad pro 11', 'ipad pro'], match: /ipad pro 11/i },
    { terms: ['ipad air m2', 'ipad air 11', 'ipad air'], match: /ipad air/i },
    { terms: ['ipad gen 10', 'ipad 10'], match: /ipad gen 10/i },
    { terms: ['tab s9 ultra', 'galaxy tab s9'], match: /tab s9 ultra/i },
    { terms: ['matepad 11.5', 'matepad'], match: /matepad/i },
    { terms: ['xiaomi pad 8', 'pad 8 pro'], match: /pad 8 pro/i },
    { terms: ['poco pad', 'xiaomi poco pad'], match: /poco pad/i },
    { terms: ['honor pad 10', 'honor pad'], match: /honor pad 10/i },
    { terms: ['lenovo tab m11', 'tab m11'], match: /tab m11/i },
    { terms: ['surface pro 9', 'surface pro'], match: /surface pro 9/i },

    // --- Gaming Consoles & Handhelds ---
    { terms: ['switch oled', 'nintendo switch oled', 'nintendo switch'], match: /switch oled/i },
    { terms: ['switch lite'], match: /switch lite/i },
    { terms: ['ps5 slim', 'playstation 5 slim', 'playstation 5', 'ps5'], match: /playstation 5/i },
    { terms: ['playstation portal', 'ps portal'], match: /playstation portal/i },
    { terms: ['rog ally x'], match: /rog ally x/i },
    { terms: ['rog ally'], match: /^((?!rog ally x).)*rog ally/i },
    { terms: ['legion go', 'lenovo legion go'], match: /legion go/i },
    { terms: ['claw 8', 'msi claw'], match: /claw 8/i },

    // --- Smartwatches ---
    { terms: ['apple watch series 10', 'watch series 10', 'series 10'], match: /watch series 10/i },
    { terms: ['apple watch se', 'watch se'], match: /watch se/i },
    { terms: ['galaxy watch 7', 'watch 7', 'samsung watch 7'], match: /watch 7/i },
    { terms: ['galaxy watch 6', 'watch 6', 'samsung watch 6'], match: /watch 6/i },
    { terms: ['forerunner 165'], match: /forerunner 165/i },
    { terms: ['forerunner 55'], match: /forerunner 55/i },
    { terms: ['watch fit 3', 'huawei watch fit 3'], match: /watch fit 3/i },
    { terms: ['smart band 9', 'mi band 9'], match: /smart band 9/i },

    // --- Audio ---
    { terms: ['airpods pro 2', 'airpods pro'], match: /airpods pro 2/i },
    { terms: ['earpods'], match: /earpods/i },
    { terms: ['wh-1000xm5', 'wh 1000xm5', '1000xm5', 'sony xm5'], match: /wh-1000xm5/i },
    { terms: ['wf-1000xm5', 'wf 1000xm5'], match: /wf-1000xm5/i },
    { terms: ['galaxy buds 3 pro', 'buds 3 pro', 'buds 3'], match: /buds 3 pro/i },
    { terms: ['major 5', 'major v', 'marshall major'], match: /major 5/i },
    { terms: ['minor 4', 'minor iv', 'marshall minor'], match: /minor iv/i },
    { terms: ['ult wear', 'wh-ult900n'], match: /ult wear/i },
    { terms: ['flip 6', 'jbl flip 6'], match: /flip 6/i },
    { terms: ['charge 5', 'jbl charge 5'], match: /charge 5/i },
    { terms: ['tour pro 2', 'jbl tour pro 2'], match: /tour pro 2/i },
    { terms: ['wave beam', 'jbl wave beam'], match: /wave beam/i },

    // --- Accessories ---
    { terms: ['osmo pocket 3', 'pocket 3'], match: /osmo pocket 3/i },
    { terms: ['osmo mobile 6'], match: /osmo mobile 6/i },
    { terms: ['dji mic 2'], match: /dji mic 2/i },
    { terms: ['mx master 3s', 'mx master'], match: /mx master 3s/i },
    { terms: ['g502 hero', 'g502'], match: /g502/i },
    { terms: ['mx keys s', 'mx keys'], match: /mx keys s/i },
    { terms: ['g413 se', 'g413'], match: /g413/i },
    { terms: ['apple pencil pro', 'pencil pro'], match: /pencil pro/i }
];

function getCoreProductModel(name) {
    return normalizeText(name)
        .replace(/^(?:laptop|dien thoai|tai nghe|may tinh bang|may choi game|dong ho thong minh|dong ho)\s+/gi, '')
        .replace(/\s+(?:\d{1,2}\s*inch|\d{3,4}gb|\d{1,2}tb|intel\s+core\s+i\d|[a-z]\d{3,4}[a-z0-9]*).*$/gi, '')
        .trim();
}

async function findAllMatchingProductsInCatalog(message) {
    if (isBrandOnlyQuery(message)) {
        return [];
    }

    const norm = normalizeText(message);
    const allActive = await Product.find({ active: { $ne: false } });

    // Ưu tiên tuyệt đối tên đầy đủ trong catalog trước bảng alias rút gọn.
    // Ví dụ "iPhone 16 Pro 128GB" không được alias "16 Pro" kéo sang bản Pro Max.
    const directNameMatch = [...allActive]
        .sort((a, b) => (b.name || '').length - (a.name || '').length)
        .find(product => norm.includes(normalizeText(product.name)));
    if (directNameMatch) return [directNameMatch];

    // Kiểm tra bảng alias ánh xạ trực tiếp các model phổ biến
    for (const alias of PRODUCT_EXACT_ALIASES) {
        if (alias.terms.some(term => {
            const escaped = escapeRegex(term);
            const regex = new RegExp(`(^|\\s|[.,!?;:()"])${escaped}($|\\s|[.,!?;:()"])`, 'i');
            return regex.test(norm);
        })) {
            const p = await Product.findOne({ active: { $ne: false }, name: alias.match });
            if (p) {
                return [p];
            }
        }
    }

    const matched = [];

    // Sắp xếp tên dài trước để ưu tiên model cụ thể
    const sorted = [...allActive].sort((a, b) => (b.name || '').length - (a.name || '').length);

    for (const p of sorted) {
        const pNorm = normalizeText(p.name);
        const coreModel = getCoreProductModel(p.name);

        let isMatch = false;
        // 1. Khớp nguyên tên
        if (norm.includes(pNorm)) {
            isMatch = true;
        }
        // 2. Khớp core model
        else if (coreModel.length >= 5 && norm.includes(coreModel)) {
            isMatch = true;
        }
        // 3. Khớp chuỗi đặc trưng ngắn
        else {
            const shortKeywords = [
                'rog strix', 'nitro v', 'katana', 'tuf gaming', 'ideapad slim', 'inspiron 15',
                'helios neo', 'zenbook 14', 'swift go', 'modern 14', 'modern 15', 'cyborg 15',
                'thinkpad e14', 'victus 15', 'legion 5', 'loq 15', 'surface laptop', 'surface pro',
                'xiaomi 14 ultra', 'poco x8', 'redmi note 13', 'reno12', 'find x8', 'honor 200',
                'ps5', 'switch oled', 'steam deck', 'airpods pro', 'wh-1000xm5', 'wf-1000xm5',
                'buds 3 pro', 'watch 7', 'watch 6', 'series 10', 'forerunner 165', 'pocket 3'
            ];
            const matchedShort = shortKeywords.find(k => pNorm.includes(k) && norm.includes(k));
            if (matchedShort) {
                isMatch = true;
            }
        }

        if (isMatch) {
            if (!matched.some(m => String(m._id) === String(p._id))) {
                matched.push(p);
            }
        }
    }
    return matched;
}

async function findExactProductInCatalog(message) {
    const list = await findAllMatchingProductsInCatalog(message);
    return list.length > 0 ? list[0] : null;
}

// -------------------------------------------------------------
// XỬ LÝ TỪNG DIALOGUE ACT CHI TIẾT
// -------------------------------------------------------------

/**
 * 1. Khách chỉ nêu thương hiệu (Brand Only)
 */
async function handleBrandOnly(brandObj, context = {}) {
    const brandName = brandObj.name;
    const catListText = brandObj.categories.map(c => `• **${c}**`).join('\n');

    const reply = `Chào bạn! TechEcommerce là đại lý ủy quyền chính hãng của **${brandName}** tại Việt Nam. 🌟\n\n` +
        `Hiện tại cửa hàng chúng mình có sẵn các dòng sản phẩm **${brandName}** nguyên seal sau đây:\n` +
        `${catListText}\n\n` +
        `👉 Bạn đang quan tâm đến dòng thiết bị nào của ${brandName} (ví dụ: Điện thoại, Laptop hay Phụ kiện) để mình tư vấn cấu hình và mức giá tốt nhất cho bạn nhé!`;

    const suggestions = brandObj.categories.map(c => c.split('(')[0].trim()).slice(0, 4);

    return {
        reply,
        products: [],
        suggestions,
        context: {
            ...context,
            brand: brandName,
            budget: 0,
            currentIntent: 'brand_only',
            missingSlots: ['category', 'budget', 'useCase']
        }
    };
}

/**
 * 1b. Khách chọn thương hiệu trong danh mục cụ thể (Brand with Category)
 * Ví dụ: Đang ở mục Điện thoại mà nói "Samsung", hoặc nói "Điện thoại Samsung", "Laptop Asus"
 */
async function handleBrandWithCategory(brandName, category, context = {}) {
    const products = await Product.find({
        category,
        brand: new RegExp(escapeRegex(brandName), 'i'),
        active: { $ne: false },
        stock: { $gt: 0 }
    }).sort({ price: -1 });

    if (!products || products.length === 0) {
        return {
            reply: `Dạ chào bạn! Hiện tại TechEcommerce chưa phân phối dòng **${category}** của thương hiệu **${brandName}** ạ. 🙏\n\n` +
                `Cửa hàng chúng mình hiện có sẵn các thương hiệu hàng đầu trong danh mục **${category}** với chính sách bảo hành chính hãng và hỗ trợ trả góp 0%.\n\n` +
                `👉 Bạn có muốn tham khảo các mẫu ${category} bán chạy nhất hiện nay không ạ?`,
            products: [],
            suggestions: [`Tư vấn ${category} bán chạy`, 'Săn mã giảm giá', 'Tư vấn danh mục khác'],
            context: { ...context, category, brand: brandName, budget: 0 }
        };
    }

    // Phân loại theo phân khúc giá (Flagship, Tầm trung, Phổ thông)
    const flagship = products.filter(p => p.price >= 20000000);
    const mid = products.filter(p => p.price >= 7000000 && p.price < 20000000);
    const entry = products.filter(p => p.price < 7000000);

    let breakdownText = '';
    if (flagship.length > 0) {
        const names = flagship.map(p => `**${p.name}** (${money(p.price)})`).join(', ');
        breakdownText += `• 🌟 **Phân khúc Flagship cao cấp:** ${names}\n  *Đặc điểm: Cấu hình đỉnh cao, camera siêu zoom sắc nét, thiết kế sang trọng bậc nhất.*\n\n`;
    }
    if (mid.length > 0) {
        const names = mid.map(p => `**${p.name}** (${money(p.price)})`).join(', ');
        breakdownText += `• 💫 **Phân khúc Tầm trung nổi bật:** ${names}\n  *Đặc điểm: Cân bằng hoàn hảo giữa hiệu năng, thời lượng pin và mức giá rất hợp lý.*\n\n`;
    }
    if (entry.length > 0) {
        const names = entry.map(p => `**${p.name}** (${money(p.price)})`).join(', ');
        breakdownText += `• 📱 **Phân khúc Phổ thông kinh tế:** ${names}\n  *Đặc điểm: Tối ưu chi phí, màn hình lớn, pin trâu đáp ứng mượt mà nhu cầu hàng ngày.*\n\n`;
    }

    if (!breakdownText) {
        breakdownText = products.slice(0, 3).map(p => `• **${p.name}** - Giá: **${money(p.price)}**`).join('\n') + '\n\n';
    }

    const reply = `Dạ tuyệt vời ạ! Với dòng **${category} ${brandName} chính hãng** tại TechEcommerce, hiện cửa hàng đang sẵn hàng đầy đủ từ các dòng phổ thông đến flagship cao cấp nhất (100% nguyên seal, bảo hành 12 - 24 tháng, hỗ trợ trả góp 0%):\n\n` +
        `${breakdownText}` +
        `👉 Bạn đang quan tâm dòng **cao cấp** hay **tầm trung / phổ thông**, hoặc bạn có khoảng ngân sách dự kiến bao nhiêu để mình tư vấn cấu hình vừa vặn nhất cho bạn nhé! 😊`;

    // Chọn tối đa 3 sản phẩm đại diện các phân khúc
    const representative = [];
    if (flagship[0]) representative.push(flagship[0]);
    if (mid[0]) representative.push(mid[0]);
    if (entry[0]) representative.push(entry[0]);
    const finalProducts = representative.length > 0 ? representative : products.slice(0, 3);

    const suggestions = [
        flagship[0] ? `Xem ${flagship[0].name.replace(/(Điện thoại|Samsung|Apple|Laptop)\s*/gi, '').slice(0, 20)}` : null,
        mid[0] ? `Xem ${mid[0].name.replace(/(Điện thoại|Samsung|Apple|Laptop)\s*/gi, '').slice(0, 20)}` : null,
        entry[0] ? `Xem ${entry[0].name.replace(/(Điện thoại|Samsung|Apple|Laptop)\s*/gi, '').slice(0, 20)}` : null,
        'Tầm giá dưới 10 triệu',
        'Tính trả góp 0%'
    ].filter(Boolean).slice(0, 4);

    return {
        reply,
        products: [], // Không trả về thẻ sản phẩm khi chỉ mới hỏi thương hiệu chung; chỉ giới thiệu bằng văn bản và gợi ý các dòng máy
        suggestions,
        context: {
            ...context,
            category,
            brand: brandName,
            budget: 0, // Reset budget cũ để không bị gán nhầm!
            lastProducts: finalProducts,
            currentIntent: 'brand_showcase'
        }
    };
}


/**
 * 2. Khách tra cứu chính xác model / biến thể (Exact Lookup)
 */
async function handleExactProductLookup(product, context = {}) {
    const s = product.specs || {};
    const stockStatus = product.stock > 0
        ? `✅ **Tình trạng:** Sẵn hàng tại kho (**còn ${product.stock} máy** nguyên seal)`
        : `⚠️ **Tình trạng:** Tạm hết hàng (Hỗ trợ đặt trước nhận ưu đãi 500.000 đ)`;

    const keySpecs = [
        s.cpu ? `• Vi xử lý (CPU): **${s.cpu}**` : null,
        s.ram ? `• Bộ nhớ RAM: **${s.ram}**` : null,
        s.storage ? `• Ổ cứng: **${s.storage}**` : null,
        s.screen ? `• Màn hình: **${s.screen}**` : null,
        s.battery ? `• Pin: **${s.battery}**` : null,
        s.camera ? `• Camera: **${s.camera}**` : null,
        s.gpu ? `• Đồ họa (GPU): **${s.gpu}**` : null,
        s.weight ? `• Trọng lượng: **${s.weight}**` : null
    ].filter(Boolean).slice(0, 5).join('\n');

    const warrantyInfo = (!product.warranty || product.warranty === 'Không bảo hành')
        ? 'Bảo hành chính hãng 12 - 24 tháng, lỗi 1 đổi 1 trong 30 ngày đầu'
        : product.warranty;

    const installmentEstimate = Math.round((product.price * 0.7) / 12);

    const reply = `Dạ có sẵn thông tin chính xác về **${product.name}** tại TechEcommerce đây ạ! 🎯\n\n` +
        `• 💰 **Giá bán chính hãng:** **${money(product.price)}** ${product.compareAtPrice > product.price ? `(Giá gốc: ~~${money(product.compareAtPrice)}~~, tiết kiệm ${money(product.compareAtPrice - product.price)})` : ''}\n` +
        `${stockStatus}\n` +
        `• 🛡️ **Bảo hành:** ${warrantyInfo}\n` +
        `• 💳 **Trả góp 0%:** Chỉ từ **${money(installmentEstimate)}/tháng** (duyệt hồ sơ CCCD 15 phút)\n\n` +
        `📋 **Cấu hình nổi bật:**\n${keySpecs}\n\n` +
        `👉 Bạn có muốn mình hỗ trợ **thêm sản phẩm này vào giỏ hàng**, tính chi tiết bảng trả góp 0%, hay so sánh với mẫu máy tương đương không ạ?`;

    return {
        reply,
        products: [product],
        suggestions: [
            `Thêm ${product.name} vào giỏ`,
            'Tính trả góp 0%',
            'So sánh với máy khác',
            'Săn mã giảm giá'
        ],
        context: {
            ...context,
            stage: 'exact_lookup',
            category: product.category,
            brand: product.brand,
            missingSlots: [],
            lastProducts: [product],
            currentIntent: 'exact_lookup'
        }
    };
}

function detectProductType(text) {
    return PRODUCT_TYPE_INTENTS.find(type => type.aliases.some(alias => hasWordOrPhrase(text, alias))) || null;
}

function extractQualificationUseCase(text) {
    const detected = extractUseCase(text);
    if (detected) return detected;
    const norm = normalizeText(text);
    const cases = [
        ['nghe nhạc & giải trí', ['nghe nhac', 'xem phim', 'giai tri']],
        ['đàm thoại & họp trực tuyến', ['dam thoai', 'goi dien', 'hop online', 'micro tot']],
        ['làm việc văn phòng', ['lam viec', 'van phong', 'go van ban', 'excel']],
        ['chăm sóc sức khỏe & thể thao', ['suc khoe', 'the thao', 'chay bo', 'gym', 'gps']],
        ['sử dụng hằng ngày', ['hang ngay', 'co ban', 'pho thong', 'deu duoc']]
    ];
    return cases.find(([, keywords]) => keywords.some(keyword => norm.includes(keyword)))?.[0] || '';
}

function extractQualificationPreference(text) {
    const norm = normalizeText(text);
    const preferences = [
        ['camera đẹp', ['camera', 'chup anh', 'quay phim', 'selfie']],
        ['hiệu năng mạnh', ['hieu nang', 'cau hinh', 'manh', 'muot', 'gaming', 'choi game']],
        ['pin lâu', ['pin trau', 'pin lau', 'dung lau', 'thoi luong pin', 'uu tien pin']],
        ['mỏng nhẹ, dễ mang theo', ['mong nhe', 'nhe', 'de mang', 'di chuyen']],
        ['không dây', ['khong day', 'bluetooth', 'wireless']],
        ['chống ồn', ['chong on', 'anc', 'cach am']],
        ['màn hình đẹp', ['man hinh', 'oled', '120hz', 'hien thi']],
        ['giá tiết kiệm', ['gia re', 'tiet kiem', 'kinh te', 're nhat']],
        ['cân bằng, dễ sử dụng', ['can bang', 'de dung', 'khong quan trong', 'tu van giup', 'deu duoc']]
    ];
    return preferences.find(([, keywords]) => keywords.some(keyword => norm.includes(keyword)))?.[0] || '';
}

function qualificationSuggestions(productType, missingSlots) {
    if (missingSlots.includes('budget')) {
        return ['Dưới 5 triệu', '5 đến 10 triệu', '10 đến 20 triệu', 'Trên 20 triệu'];
    }
    if (missingSlots.includes('useCase')) {
        const byType = {
            laptop: ['Học tập, văn phòng', 'Lập trình CNTT', 'Đồ họa, dựng video', 'Chơi game'],
            phone: ['Dùng hằng ngày', 'Chụp ảnh, quay video', 'Chơi game', 'Công việc'],
            headphones: ['Nghe nhạc', 'Đàm thoại, học online', 'Chơi game', 'Thể thao'],
            smartwatch: ['Theo dõi sức khỏe', 'Chạy bộ GPS', 'Nghe gọi', 'Dùng hằng ngày']
        };
        return byType[productType.key] || ['Học tập, văn phòng', 'Chơi game', 'Giải trí', 'Dùng hằng ngày'];
    }
    return ['Ưu tiên pin lâu', 'Ưu tiên hiệu năng', 'Ưu tiên mỏng nhẹ', 'Cân bằng, dễ dùng'];
}

/**
 * Trả thẳng sản phẩm thật khi khách nêu một loại hàng cụ thể. Luồng này không
 * phụ thuộc danh mục đang lưu từ lượt trước nên tránh lỗi đổi trang/ngữ cảnh cũ.
 */
async function handleCatalogProductTypeQuery(message, context = {}, forcedProductType = null) {
    const productType = forcedProductType || detectProductType(message);
    if (!productType) return null;

    const normalizedMessage = normalizeText(message);
    const isAvailabilityQuestion = (
        /\b(co|con)\b.*\b(khong|ko|khong a|khong vay)\b/i.test(normalizedMessage)
        || /\b(?:ben ban|cua hang|shop)\b.*\b(?:co|con)\b/i.test(normalizedMessage)
    );

    const previousQualification = context.qualification || {};
    const extractedBudget = extractBudget(message);
    const budget = extractedBudget || previousQualification.budget || context.budget || 0;
    const brandMention = extractBrandMention(message);
    const brand = brandMention?.name || previousQualification.brand || context.brand || '';
    const useCase = extractQualificationUseCase(message) || previousQualification.useCase || context.useCase || '';
    const preference = extractQualificationPreference(message) || previousQualification.preference || '';
    const qualification = { budget, brand, useCase, preference };
    const missingSlots = [
        !budget ? 'budget' : '',
        !useCase ? 'useCase' : '',
        !preference ? 'preference' : ''
    ].filter(Boolean);

    if (missingSlots.length) {
        let availabilityIntro = '';
        if (isAvailabilityQuestion && !context.availabilityConfirmed) {
            const availabilityQuery = {
                category: productType.category,
                active: { $ne: false },
                stock: { $gt: 0 }
            };
            if (productType.name) availabilityQuery.name = productType.name;
            const hasAvailableProduct = await Product.exists(availabilityQuery);
            if (hasAvailableProduct) {
                availabilityIntro = `Dạ có ạ! Cửa hàng tụi mình hiện có sẵn **${productType.label}** chính hãng. `;
            }
        }

        const questions = [];
        if (missingSlots.includes('budget')) questions.push('Mức giá tối đa bạn muốn chi khoảng bao nhiêu?');
        if (missingSlots.includes('useCase')) questions.push(`Bạn dùng ${productType.label} chủ yếu cho việc gì và thường dùng trong hoàn cảnh nào?`);
        if (missingSlots.includes('preference')) questions.push('Tiêu chí quan trọng nhất với bạn là hiệu năng/tính năng, pin, thiết kế, độ bền hay giá tiết kiệm?');
        if (!brand) questions.push('Bạn có ưu tiên hoặc không thích thương hiệu nào không?');

        const confirmedDetails = [
            budget ? `ngân sách tối đa **${money(budget)}**` : '',
            useCase ? `mục đích **${useCase}**` : '',
            preference ? `ưu tiên **${preference}**` : '',
            brand ? `thương hiệu **${brand}**` : ''
        ].filter(Boolean);
        const acknowledgement = confirmedDetails.length
            ? `mình đã ghi nhận ${confirmedDetails.join(', ')}. `
            : '';
        const qualificationIntro = availabilityIntro
            ? `Để chọn đúng **${productType.label}** hợp nhất, mình xin hỏi thêm:`
            : acknowledgement
            ? `Dạ, ${acknowledgement}Để chọn đúng **${productType.label}** hợp nhất, mình chỉ cần hỏi thêm:`
            : `Dạ được ạ! Để chọn đúng **${productType.label}** hợp nhất, mình xin hỏi thêm:`;

        return {
            reply: `${availabilityIntro}${qualificationIntro}\n\n` +
                questions.map((question, index) => `${index + 1}. ${question}`).join('\n') +
                `\n\nBạn trả lời từng ý hoặc gộp trong một tin nhắn đều được nhé. Mình sẽ giữ nguyên các thông tin đã ghi nhận và không hỏi lại. 😊`,
            products: [],
            suggestions: qualificationSuggestions(productType, missingSlots),
            context: {
                ...context,
                stage: 'qualifying_needs',
                category: productType.category,
                productType: productType.key,
                brand,
                budget,
                budgetType: extractedBudget
                    ? (isHardBudgetLimit(message) ? 'hard' : 'soft')
                    : (context.budgetType || 'unspecified'),
                useCase,
                qualification,
                availabilityConfirmed: context.availabilityConfirmed || Boolean(availabilityIntro),
                missingSlots,
                currentIntent: 'qualifying_needs'
            }
        };
    }

    const query = {
        category: productType.category,
        active: { $ne: false },
        stock: { $gt: 0 }
    };
    if (productType.name) query.name = productType.name;
    if (brand) query.brand = new RegExp(escapeRegex(brand), 'i');
    else if (context.excludedBrand) query.brand = { $not: new RegExp(escapeRegex(context.excludedBrand), 'i') };
    if (budget > 0) query.price = { $lte: budget };

    const candidates = await Product.find(query)
        .sort({ rating: -1, soldCount: -1, price: 1 })
        .limit(4);

    if (!candidates.length) {
        const nearestQuery = {
            category: productType.category,
            active: { $ne: false },
            stock: { $gt: 0 }
        };
        if (productType.name) nearestQuery.name = productType.name;
        if (brand) nearestQuery.brand = new RegExp(escapeRegex(brand), 'i');
        else if (context.excludedBrand) nearestQuery.brand = { $not: new RegExp(escapeRegex(context.excludedBrand), 'i') };
        const nearest = await Product.findOne(nearestQuery).sort({ price: 1 });

        const scope = brand ? ` ${brand}` : '';
        const priceText = budget ? ` dưới **${money(budget)}**` : '';
        const nearestText = nearest
            ? ` Mẫu có giá gần nhất hiện là **${nearest.name}** — **${money(nearest.price)}**.`
            : '';
        return {
            reply: `Dạ hiện tại cửa hàng tụi mình chưa có **${productType.label}${scope}**${priceText} còn hàng.${nearestText}\n\nBạn muốn mình đổi sang thương hiệu khác hoặc điều chỉnh khoảng giá để tìm thêm lựa chọn không ạ?`,
            products: nearest ? [nearest] : [],
            suggestions: ['Đổi thương hiệu khác', 'Tăng khoảng ngân sách', 'Xem sản phẩm bán chạy'],
            context: {
                ...context,
                category: productType.category,
                productType: productType.key,
                brand,
                budget,
                useCase,
                qualification,
                missingSlots: [],
                currentIntent: 'product_type_no_match',
                lastProducts: nearest ? [nearest] : []
            }
        };
    }

    const scope = brand ? ` của **${brand}**` : '';
    const priceText = budget ? ` trong mức giá không quá **${money(budget)}**` : '';
    const productLines = candidates.map(product =>
        `• **${product.name}** — **${money(product.price)}** (còn ${product.stock} sản phẩm)`
    ).join('\n');

    return {
        reply: `Dựa trên nhu cầu **${useCase}**, ưu tiên **${preference}**${scope}${priceText}, mình đã lọc được **${candidates.length} mẫu ${productType.label}** phù hợp nhất:\n\n${productLines}\n\nBạn muốn mình so sánh kỹ hai mẫu nổi bật nhất hay xem chi tiết một mẫu cụ thể ạ? 😊`,
        products: candidates,
        suggestions: candidates.slice(0, 3).map(product => `Xem ${product.name.slice(0, 24)}`).concat('So sánh các mẫu vừa xem'),
        context: {
            ...context,
            category: productType.category,
            productType: productType.key,
            stage: 'recommended',
            brand,
            budget,
            useCase,
            qualification,
            missingSlots: [],
            budgetType: budget ? (isHardBudgetLimit(message) ? 'hard' : 'soft') : 'unspecified',
            currentIntent: 'product_type_showcase',
            lastProducts: candidates
        }
    };
}

/**
 * 3. Khách hỏi nhu cầu chung nhưng thiếu thông tin (Clarify Needs)
 */
async function handleClarifyNeeds(category, existingSlots = {}, userProficiency = 'intermediate') {
    let question = '';
    let suggestions = [];

    switch (category) {
        case 'Laptop': {
            if (!existingSlots.budget && !existingSlots.useCase) {
                question = userProficiency === 'beginner'
                    ? `Dạ chào bạn! Để mình giúp bạn chọn được chiếc laptop vừa vặn nhất, chạy mượt mà không lo bị đơ giật mà cũng không lãng phí tiền, bạn có thể chia sẻ thêm giúp mình:\n` +
                      `1. Mức ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                      `2. Bạn dùng máy cho ngành học hay công việc chính nào (văn phòng, lập trình hay đồ họa gaming) ạ? 😊`
                    : `Dạ chào bạn! Để mình lọc cấu hình laptop chuẩn nhất cho nhu cầu của bạn, bạn dự kiến khoảng **ngân sách bao nhiêu** (ví dụ: dưới 15 triệu, 15 - 20 triệu hay trên 20 triệu) và phục vụ **công việc / ngành học nào** (học tập văn phòng, lập trình CNTT hay đồ họa 3D gaming) ạ? 😊`;
                suggestions = [
                    'Laptop sinh viên dưới 15 triệu',
                    'Laptop lập trình 15 - 20 triệu',
                    'Laptop đồ họa / gaming',
                    'Mỏng nhẹ, pin trâu'
                ];
            } else if (!existingSlots.budget) {
                question = `Dạ rất rõ ràng về nhu cầu **${existingSlots.useCase || 'học tập & làm việc'}** ạ! 🎯\n` +
                    `Bạn dự kiến mức **ngân sách tối đa khoảng bao nhiêu triệu** để mình lọc ra các máy có cấu hình tối ưu nhất trong tầm giá cho bạn nhé? 😊`;
                suggestions = [
                    'Dưới 15 triệu',
                    '15 đến 20 triệu',
                    '20 đến 25 triệu',
                    'Trên 25 triệu'
                ];
            } else {
                question = `Dạ với tầm ngân sách **${money(existingSlots.budget)}**, bạn dự định dùng máy cho **ngành học nào** (ví dụ: Kinh tế, CNTT, Đồ họa) và có cần thường xuyên mang máy di chuyển đi học không ạ? 😊`;
                suggestions = [
                    'Học kinh tế, văn phòng',
                    'Học CNTT, lập trình',
                    'Đồ họa 2D, chỉnh ảnh',
                    'Mỏng nhẹ, pin cả ngày'
                ];
            }
            break;
        }

        case 'Điện thoại': {
            question = `Dạ chào bạn! Để mình tư vấn mẫu **điện thoại** chuẩn nhất với nhu cầu của bạn, bạn có thể chia sẻ thêm giúp mình:\n` +
                `1. Mức ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                `2. Bạn ưu tiên tiêu chí nào nhất (chụp ảnh quay phim sắc nét, cấu hình mạnh chiến game mượt, hay pin trâu bền bỉ cả ngày) ạ? 😊`;
            suggestions = [
                'Chụp ảnh quay phim sắc nét',
                'Cấu hình mạnh chiến game',
                'Pin trâu, lướt web mượt',
                'Tầm giá dưới 15 triệu'
            ];
            break;
        }

        case 'Đồng hồ thông minh': {
            question = `Dạ chào bạn! Để mình chọn giúp bạn mẫu **đồng hồ thông minh (Smartwatch)** vừa vặn và ưng ý nhất, bạn có thể chia sẻ thêm:\n` +
                `1. Tầm ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                `2. Bạn ưu tiên tính năng nào nhất (đo sức khỏe & GPS thể thao chuyên sâu, nghe gọi trực tiếp và nhận thông báo, hay pin trâu dùng cả tuần) ạ? 😊`;
            suggestions = [
                'Theo dõi sức khỏe & GPS',
                'Nghe gọi trực tiếp, pin trâu',
                'Tầm giá dưới 5 triệu',
                'Apple Watch / Galaxy Watch'
            ];
            break;
        }

        case 'Máy chơi game': {
            question = `Dạ chào bạn! Để mình tư vấn hệ **máy chơi game** phù hợp nhất cho nhu cầu của bạn:\n` +
                `1. Bạn đang tìm dòng **máy cầm tay di động** (như Nintendo Switch OLED, Steam Deck OLED) để chơi mọi lúc mọi nơi, hay **máy console cắm TV** đồ họa 4K đỉnh cao như PlayStation 5 Slim?\n` +
                `2. Mức ngân sách dự kiến của bạn khoảng bao nhiêu triệu ạ? 😊`;
            suggestions = [
                'PlayStation 5 Slim 4K',
                'Nintendo Switch OLED',
                'Steam Deck OLED',
                'Tư vấn tầm giá'
            ];
            break;
        }

        case 'Tai nghe': {
            question = `Dạ chào bạn! Để mình gợi ý mẫu **tai nghe** có chất âm và tính năng phù hợp nhất, bạn có thể chia sẻ giúp mình:\n` +
                `1. Bạn thích kiểu dáng **tai nghe chụp tai (Over-ear) chống ồn cao cấp** hay **tai nghe nhét tai (In-ear / True Wireless) nhỏ gọn** tiện lợi?\n` +
                `2. Tầm ngân sách mong muốn của bạn khoảng bao nhiêu triệu ạ? 😊`;
            suggestions = [
                'Tai nghe chụp tai chống ồn',
                'Tai nghe True Wireless nhỏ gọn',
                'Chất âm bass mạnh mẽ',
                'Tầm giá dưới 3 triệu'
            ];
            break;
        }

        case 'Tablet': {
            question = `Dạ chào bạn! Để mình chọn chiếc **máy tính bảng (Tablet)** phù hợp nhất cho bạn, bạn có thể chia sẻ thêm:\n` +
                `1. Tầm ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                `2. Bạn dùng máy cho mục đích chính nào (học tập ghi chép bút cảm ứng, vẽ đồ họa, xem phim giải trí hay công việc văn phòng) ạ? 😊`;
            suggestions = [
                'Học tập & ghi chép bút cảm ứng',
                'Vẽ đồ họa, màn hình đẹp',
                'iPad chính hãng',
                'Tầm giá dưới 10 triệu'
            ];
            break;
        }

        case 'Phụ kiện': {
            question = `Dạ chào bạn! Bạn đang cần tìm **phụ kiện công nghệ** nào cho thiết bị của mình ạ (chuột không dây, bàn phím cơ, củ sạc nhanh GaN, pin sạc dự phòng hay hub chuyển đổi đa năng)? Bạn nhắn mình tên thiết bị bạn đang dùng để mình chọn loại tương thích tốt nhất nhé! 😊`;
            suggestions = [
                'Chuột công thái học Logitech',
                'Bàn phím cơ gõ êm',
                'Củ sạc nhanh GaN Anker',
                'Pin sạc dự phòng dung lượng cao'
            ];
            break;
        }

        default: {
            question = `Dạ chào bạn! Để mình tư vấn và chọn được sản phẩm vừa vặn nhất với nhu cầu của bạn, bạn có thể chia sẻ mức ngân sách dự kiến khoảng bao nhiêu và những tính năng bạn ưu tiên nhất nhé! 😊`;
            suggestions = [
                'Tầm giá tiết kiệm',
                'Cao cấp, chính hãng',
                'Săn mã giảm giá'
            ];
            break;
        }
    }

    return {
        reply: question,
        products: [],
        suggestions,
        context: {
            ...existingSlots,
            category,
            currentIntent: 'clarify_needs',
            missingSlots: !existingSlots.budget ? ['budget'] : ['useCase']
        }
    };
}

/**
 * 4. Chẩn đoán máy cũ (Upgrade vs Buy-New)
 */
async function handleOldDeviceDiagnosis(message, context = {}) {
    const norm = normalizeText(message);

    const isCoreI5Gen8 = norm.includes('the he 8') || norm.includes('gen 8') || norm.includes('doi 8') || norm.includes('8250') || norm.includes('8350');

    let reply = `Dạ mình hiểu vấn đề bạn đang gặp phải ạ! Trước khi quyết định chi một khoản tiền lớn để mua máy mới, chúng mình hãy cùng kiểm tra nhanh tình trạng máy hiện tại nhé: 🔍\n\n`;

    if (isCoreI5Gen8) {
        reply += `💡 **Đánh giá kỹ thuật thực tế:**\n` +
            `Chip **Intel Core i5 thế hệ thứ 8** (như i5-8250U, i5-8350U) đã được Intel nâng cấp lên **4 nhân 8 luồng** và có hỗ trợ tập lệnh cao cấp (bao gồm AVX2). Về mặt xử lý thuần túy, con chip này vẫn hoàn toàn gánh tốt các tác vụ văn phòng, học online, Word, Excel nặng và lướt web hàng chục tab.\n\n` +
            `Nguyên nhân máy chạy chậm thường do 2 "nút thắt cổ chai" phần cứng sau:\n` +
            `1. **Ổ cứng còn dùng HDD cơ truyền thống:** Tốc độ chỉ ~100MB/s, gây hiện tượng 100% Disk làm máy bị đơ giật. Nâng cấp lên **ổ SSD 256GB - 512GB** (chi phí chỉ khoảng 400.000 - 700.000 đ) sẽ giúp máy khởi động trong 10 giây và mở app tức thì.\n` +
            `2. **Dung lượng RAM chỉ 4GB - 8GB:** Các trình duyệt hiện đại ngốn khá nhiều RAM. Nâng lên **16GB RAM** (khoảng 400.000 đ) sẽ giải quyết triệt để tình trạng tràn bộ nhớ.\n\n` +
            `👉 **Lời khuyên chân thành từ TechEcommerce:**\n` +
            `• **Nên NÂNG CẤP (chỉ tốn khoảng 800k - 1.2tr):** Nếu nhu cầu của bạn chỉ là học tập, làm việc văn phòng, xem phim, làm kế toán.\n` +
            `• **Nên MUA MÁY MỚI:** Nếu bạn cần làm đồ họa 3D, dựng video 4K, lập trình chạy máy ảo Docker nặng, hoặc máy cũ đã chai pin hoàn toàn và màn hình xuống cấp.\n\n` +
            `Bạn có thể cho mình biết máy của bạn hiện đang dùng ổ cứng loại nào và RAM bao nhiêu GB không ạ?`;
    } else {
        reply += `Để biết máy cũ nên nâng cấp hay đổi máy mới, bạn cho mình hỏi 3 thông tin nhanh nhé:\n` +
            `1. Máy bạn hiện đang chạy ổ SSD hay HDD, và dung lượng RAM là bao nhiêu GB?\n` +
            `2. Tình trạng chậm thường xảy ra khi bạn mở máy hay khi làm tác vụ cụ thể nào?\n` +
            `3. Nhu cầu công việc sắp tới của bạn có đòi hỏi xử lý đồ họa, lập trình nặng hay chơi game không?\n\n` +
            `Nếu máy chỉ cần nâng cấp thêm RAM/SSD thì chi phí rất tiết kiệm (chỉ dưới 1 triệu). Nếu bạn muốn tham khảo các mẫu máy mới mỏng nhẹ thế hệ mới, mình cũng sẵn sàng tư vấn chi tiết nhé!`;
    }

    return {
        reply,
        products: [],
        suggestions: [
            'Máy đang dùng HDD, RAM 8GB',
            'Máy dùng SSD nhưng vẫn chậm',
            'Tư vấn laptop mới dưới 15 triệu',
            'Tư vấn laptop văn phòng mỏng nhẹ'
        ],
        context: {
            ...context,
            category: 'Laptop',
            currentIntent: 'diagnose_upgrade'
        }
    };
}

/**
 * 5. Đề xuất sản phẩm chuẩn xác có căn cứ và giải thích đánh đổi (Grounded Recommendation with Trade-offs)
 */
async function handleRecommendWithTradeOffs({
    category = 'Laptop',
    brand = '',
    budget = 0,
    isHardBudget = false,
    useCase = '',
    major = '',
    eliminatedBrands = [],
    userProficiency = 'intermediate',
    context = {}
}) {
    // Xây dựng điều kiện lọc sản phẩm
    const query = {
        category,
        active: { $ne: false },
        stock: { $gt: 0 }
    };

    // Một số dữ liệu âm thanh cũ có loa Bluetooth chung danh mục; câu hỏi tai nghe
    // chỉ được phép trả về sản phẩm đeo tai thực sự.
    if (category === 'Tai nghe') {
        query.name = { $not: /\bloa\b|speaker/i };
    }

    if (brand) {
        query.brand = new RegExp(escapeRegex(brand), 'i');
    }

    if (eliminatedBrands && eliminatedBrands.length > 0) {
        query.brand = { $nin: eliminatedBrands };
    }

    if (budget > 0) {
        if (isHardBudget) {
            query.price = { $lte: budget };
        } else {
            // Soft budget: cho phép cận trên 10%
            query.price = { $lte: Math.round(budget * 1.1) };
        }
    }

    // Tìm kiếm trong database
    let candidates = await Product.find(query).sort({ rating: -1, soldCount: -1 });

    // Nếu lọc ngân sách không có máy nào trong kho
    if (!candidates.length && budget > 0) {
        let lowestInCat = null;
        if (brand) {
            lowestInCat = await Product.findOne({
                category,
                brand: new RegExp(escapeRegex(brand), 'i'),
                active: { $ne: false },
                stock: { $gt: 0 },
                ...(eliminatedBrands.length ? { brand: { $nin: eliminatedBrands } } : {})
            }).sort({ price: 1 });
        }
        if (!lowestInCat) {
            lowestInCat = await Product.findOne({
                category,
                active: { $ne: false },
                stock: { $gt: 0 },
                ...(eliminatedBrands.length ? { brand: { $nin: eliminatedBrands } } : {})
            }).sort({ price: 1 });
        }

        if (lowestInCat) {
            const downPay = Math.round(lowestInCat.price * 0.3);
            const monthlyInst = Math.round((lowestInCat.price * 0.7) / 12);
            const diff = lowestInCat.price - budget;

            let alternativeAdvice = '';
            if (category === 'Laptop') {
                alternativeAdvice = `3. 📱 **Cân nhắc giải pháp thay thế:** Nếu bạn đang cần thiết bị để học tập, tra cứu tài liệu và soạn thảo văn bản nhẹ nhàng, bạn có thể tham khảo dòng **Máy tính bảng (Tablet)** kèm bút/phím trong tầm giá từ 4 - 8 triệu (như Lenovo Tab M11 giá 4.290.000 đ hay Xiaomi Poco Pad giá 6.490.000 đ).\n`;
            } else {
                alternativeAdvice = `3. 💡 **Cân nhắc dòng sản phẩm khác:** Bạn có thể tham khảo các dòng sản phẩm có mức giá kinh tế hơn hoặc săn các deal giảm giá sâu tại cửa hàng.\n`;
            }

            const categoryItemNoun = {
                'Laptop': 'mẫu laptop',
                'Điện thoại': 'mẫu điện thoại',
                'Tablet': 'mẫu máy tính bảng',
                'Tai nghe': 'mẫu tai nghe',
                'Đồng hồ thông minh': 'mẫu đồng hồ thông minh',
                'Máy chơi game': 'hệ máy chơi game',
                'Phụ kiện': 'sản phẩm phụ kiện'
            }[category] || 'mẫu sản phẩm';
            const categoryItemNounCap = categoryItemNoun.charAt(0).toUpperCase() + categoryItemNoun.slice(1);

            const brandScope = brand ? ` của thương hiệu **${brand}**` : '';
            const reply = `Dạ hiện tại TechEcommerce chuyên phân phối **100% sản phẩm mới chính hãng nguyên seal** kèm bảo hành 12 - 24 tháng. 🙏\n\n` +
                `Trong danh mục **${category}**${brandScope}, mức ngân sách dự kiến **${money(budget)}** của bạn hiện thấp hơn mức giá của ${categoryItemNoun} có giá tốt nhất tại kho.\n` +
                `${categoryItemNounCap} chính hãng có mức giá kinh tế nhất hiện nay là:\n` +
                `⭐ **${lowestInCat.name}** - Giá: **${money(lowestInCat.price)}** (chênh lệch khoảng +${money(diff)} so với dự kiến của bạn).\n\n` +
                `Để hỗ trợ bạn sở hữu thiết bị tốt nhất mà không bị áp lực tài chính, cửa hàng có 3 giải pháp:\n` +
                `1. 💳 **Trả góp 0% lãi suất:** Bạn chỉ cần trả trước 30% (${money(downPay)}), số tiền còn lại chia góp chỉ khoảng **${money(monthlyInst)}/tháng** (duyệt hồ sơ online 15 phút chỉ cần CCCD).\n` +
                `2. 🎟️ **Áp voucher giảm giá:** Kiểm tra mã giảm giá đang kích hoạt hôm nay để trừ trực tiếp vào đơn hàng.\n` +
                `${alternativeAdvice}\n` +
                `👉 Bạn có muốn xem chi tiết mẫu **${lowestInCat.name}** này hay để mình tính bảng trả góp 0% cho bạn nhé?`;

            return {
                reply,
                products: [lowestInCat],
                suggestions: [
                    `Xem ${lowestInCat.name.replace(/(Điện thoại|Laptop|Tablet|Tai nghe)\s*/gi, '').slice(0, 18)}`,
                    'Tính trả góp 0%',
                    'Săn mã giảm giá',
                    category === 'Laptop' ? 'Tư vấn Tablet học tập' : 'Tư vấn danh mục khác'
                ],
                context: {
                    ...context,
                    category,
                    budget,
                    lastProducts: [lowestInCat],
                    currentIntent: 'out_of_budget_scope'
                }
            };
        }

        return {
            reply: `Dạ hiện tại TechEcommerce chưa có sản phẩm nào trong danh mục **${category}** ở mức ngân sách **${money(budget)}** ạ. Mức giá các dòng sản phẩm chính hãng tại kho hiện bắt đầu từ phân khúc cao hơn. Bạn có thể cân nhắc chuyển sang hình thức **Trả góp 0%** hoặc tham khảo các danh mục sản phẩm khác nhé! 😊`,
            products: [],
            suggestions: ['Tính trả góp 0%', 'Săn mã giảm giá', 'Tư vấn danh mục khác'],
            context: { ...context, category, budget }
        };
    }

    // Ưu tiên chọn 2 - 3 sản phẩm đại diện các phương án đánh đổi khác nhau
    let selected = [];
    if (category === 'Laptop') {
        const isGamingOrDev = useCase.includes('game') || useCase.includes('lập trình') || major.includes('CNTT') || useCase.includes('đồ họa');

        if (isGamingOrDev) {
            // Lấy 1 máy hiệu năng cao (card rời/tản nhiệt) + 1 máy mỏng nhẹ/cân bằng
            const perfMachine = candidates.find(p => /Nitro|Katana|TUF|ROG/i.test(p.name)) || candidates[0];
            const thinMachine = candidates.find(p => /MacBook|Slim|Inspiron/i.test(p.name) && String(p._id) !== String(perfMachine?._id)) || candidates[1];
            selected = [perfMachine, thinMachine].filter(Boolean);
        } else {
            // Nhu cầu học tập / văn phòng / kinh tế: Lấy 1 máy mỏng nhẹ pin trâu + 1 máy hiệu năng giá tiết kiệm
            const lightMachine = candidates.find(p => /Slim|MacBook|Inspiron/i.test(p.name)) || candidates[0];
            const valueMachine = candidates.find(p => String(p._id) !== String(lightMachine?._id)) || candidates[1];
            selected = [lightMachine, valueMachine].filter(Boolean);
        }
    }

    if (!selected.length) {
        selected = candidates.slice(0, 3);
    }

    if (!selected.length) {
        return {
            reply: `Dạ hiện tại TechEcommerce chưa có sản phẩm nào phù hợp với bộ lọc này ạ. Bạn có thể mở rộng khoảng ngân sách hoặc chuyển sang dòng sản phẩm khác nhé! 😊`,
            products: [],
            suggestions: ['Tính trả góp 0%', 'Săn mã giảm giá', 'Tư vấn danh mục khác'],
            context: { ...context, category, budget }
        };
    }

    // Nếu chỉ có đúng 1 sản phẩm thỏa mãn
    if (selected.length === 1) {
        const single = selected[0];
        const s = single.specs || {};
        const reply = `Dạ trong tầm ngân sách và tiêu chí của bạn, hiện tại TechEcommerce có **duy nhất 1 lựa chọn chính hãng xuất sắc nhất** đáp ứng trọn vẹn là:\n\n` +
            `⭐ **${single.name}** - Giá: **${money(single.price)}** (Kho còn ${single.stock} máy)\n` +
            `• Cấu hình: CPU ${s.cpu || ''} | RAM ${s.ram || ''} | Ổ cứng ${s.storage || ''} | Màn hình ${s.screen || ''}\n` +
            `• Điểm mạnh: Cấu hình ổn định, thời lượng pin tốt, bảo hành chính hãng ${single.warranty || '12 tháng'}.\n\n` +
            `Do kho chỉ còn mẫu này phù hợp nhất với tầm giá, bạn có muốn mình gửi bảng tính trả góp hoặc thêm vào giỏ hàng ngay không ạ?`;

        return {
            reply,
            products: selected,
            suggestions: [`Thêm ${single.name} vào giỏ`, 'Tính trả góp 0%', 'Xem chính sách bảo hành'],
            context: {
                ...context,
                category,
                budget,
                lastProducts: selected,
                currentIntent: 'recommend_single'
            }
        };
    }

    // Xây dựng phần phân tích điểm mạnh và ĐIỂM ĐÁNH ĐỔI cho 2-3 sản phẩm
    const p1 = selected[0];
    const p2 = selected[1] || selected[0];
    const s1 = p1?.specs || {};
    const s2 = p2?.specs || {};

    let tradeOffAnalysis = '';
    let conditionalConclusion = '';

    if (category === 'Laptop') {
        const isP1Gaming = /Nitro|Katana|TUF|ROG/i.test(p1.name);
        const isP2Gaming = /Nitro|Katana|TUF|ROG/i.test(p2.name);

        if (isP1Gaming && !isP2Gaming) {
            tradeOffAnalysis =
                `1. 🚀 **Phương án 1 - Ưu tiên Hiệu năng mạnh mẽ:** **${p1.name}** (${money(p1.price)})\n` +
                `   • **Ưu điểm:** Vi xử lý đa nhân, có card đồ họa rời (${s1.gpu || 'RTX Series'}) giúp render đồ họa, dựng video và chơi game mượt mà.\n` +
                `   • **Điểm đánh đổi:** Trọng lượng máy nặng hơn (${s1.weight || 'khoảng 2.1kg'}), cục sạc to và thời lượng pin ở mức trung bình (3 - 5 giờ).\n\n` +
                `2. 💼 **Phương án 2 - Ưu tiên Mỏng nhẹ & Tiện di chuyển:** **${p2.name}** (${money(p2.price)})\n` +
                `   • **Ưu điểm:** Thiết kế thanh lịch, siêu nhẹ (${s2.weight || 'khoảng 1.4kg'}), pin dùng cả ngày (8 - 14 giờ), tiện bỏ vừa balo mang đi học/đi làm.\n` +
                `   • **Điểm đánh đổi:** Chỉ sử dụng card đồ họa tích hợp, phù hợp đồ họa 2D nhẹ hoặc code web, không tối ưu cho render 3D nặng.`;

            conditionalConclusion =
                `📌 **GỢI Ý QUYẾT ĐỊNH CHO BẠN:**\n` +
                `• Nếu bạn cần **chơi game, làm đồ họa 3D hoặc render video** -> Nên chọn **${p1.name}**.\n` +
                `• Nếu bạn ưu tiên **máy nhẹ, pin trâu mang đi học cả ngày không cần mang sạc** -> Nên chọn **${p2.name}**.`;
        } else {
            tradeOffAnalysis =
                `1. 🌟 **Phương án 1:** **${p1.name}** (${money(p1.price)})\n` +
                `   • **Ưu điểm:** ${s1.cpu ? `CPU ${s1.cpu}, ` : ''}${s1.ram ? `RAM ${s1.ram}, ` : ''}hiệu năng mượt mà, độ hoàn thiện cao cấp.\n` +
                `   • **Điểm đánh đổi:** ${p1.price > p2.price ? `Mức giá cao hơn ${money(p1.price - p2.price)} nhưng đổi lại cấu hình cao hơn.` : 'Dung lượng RAM hoặc kích thước màn hình ở mức tiêu chuẩn.'}\n\n` +
                `2. 🌟 **Phương án 2:** **${p2.name}** (${money(p2.price)})\n` +
                `   • **Ưu điểm:** ${p2.price < p1.price ? `Tiết kiệm chi phí đầu tư ban đầu (${money(p1.price - p2.price)}), ` : ''}đáp ứng trọn vẹn nhu cầu học tập và làm việc.\n` +
                `   • **Điểm đánh đổi:** ${p2.price < p1.price ? 'Chất liệu vỏ máy và thông số màn hình cơ bản hơn.' : 'Trọng lượng máy có thể nhỉnh hơn một chút.'}`;

            conditionalConclusion =
                `📌 **GỢI Ý QUYẾT ĐỊNH:**\n` +
                `• Nếu bạn muốn **tối đa hóa cấu hình để dùng bền bỉ 4-5 năm tới** -> Chọn **${p1.price >= p2.price ? p1.name : p2.name}**.\n` +
                `• Nếu bạn muốn **tiết kiệm chi phí mà vẫn mượt mà các tác vụ hàng ngày** -> Chọn **${p1.price < p2.price ? p1.name : p2.name}**.`;
        }
    } else {
        tradeOffAnalysis = selected.map((p, idx) => {
            const ps = p.specs || {};
            const keyHighlight = ps.cpu ? `Chip ${ps.cpu}` : (ps.connectivity || ps.screen || '');
            const displayPrice = money(p.price);
            return `${idx + 1}. 🌟 **Phương án ${idx + 1}:** **${p.name}** (${displayPrice})\n` +
                `   • **Ưu điểm:** ${keyHighlight ? `${keyHighlight}, ` : ''}${ps.camera ? `Camera ${ps.camera}, ` : ''}${ps.battery ? `Pin ${ps.battery}, ` : ''}bảo hành chính hãng ${p.warranty || '12 tháng'}.\n` +
                `   • **Tình trạng:** Sẵn hàng kho (${p.stock} máy), hỗ trợ trả góp 0% chỉ từ ${money(Math.round(p.price * 0.7 / 12))}/tháng.`;
        }).join('\n\n');
        conditionalConclusion = `💡 **Gợi ý lựa chọn:** Bạn có thể bấm vào thẻ sản phẩm bên dưới để xem hình ảnh thực tế và cấu hình chi tiết của từng máy nhé!`;
    }

    let budgetText = budget > 0 ? `ngân sách tối đa **${money(budget)}**` : '';
    let brandText = brand ? `thương hiệu **${brand}**` : '';
    let criteriaText = [brandText, budgetText].filter(Boolean).join(' ');

    const defaultReply = `Dạ dựa trên nhu cầu **${useCase || 'sử dụng'}** ${criteriaText ? `với ${criteriaText}, ` : ''}mình xin đề xuất **${selected.length} phương án tối ưu nhất** tại kho TechEcommerce kèm phân tích điểm được và điểm đánh đổi để bạn dễ dàng quyết định:\n\n` +
        `${tradeOffAnalysis}\n\n` +
        `${conditionalConclusion}\n\n` +
        `👉 Bạn đang nghiêng về phương án nào hơn, hoặc bạn còn băn khoăn điều gì giữa các mẫu máy này không ạ?`;

    const grounded = await aiModelService.generateGroundedConsultation({
        userMessage: context.currentMessage || '',
        dialogueAct: 'recommend',
        verifiedProducts: selected,
        context,
        fallbackText: defaultReply
    });

    return {
        reply: grounded.reply,
        products: selected,
        suggestions: [
            `So sánh 2 máy vừa rồi`,
            `Xem chi tiết ${selected[0].name}`,
            selected[1] ? `Xem chi tiết ${selected[1].name}` : null,
            'Tính trả góp 0%',
            'Mã giảm giá hôm nay'
        ].filter(Boolean),
        context: {
            ...context,
            category,
            budget,
            lastProducts: selected,
            currentIntent: 'recommended'
        },
        meta: {
            provider: grounded.provider,
            model: grounded.model,
            isFallback: grounded.isFallback
        }
    };
}

/**
 * 6. Xử lý câu phản hồi ngắn theo ngữ cảnh (Contextual Follow-ups)
 */
async function handleContextualFollowUp(message, context = {}) {
    const norm = normalizeText(message);
    const lastProducts = context.lastProducts || [];

    // A. Người dùng yêu cầu xem chi tiết máy thứ N ("máy thứ hai", "mẫu số 1")
    const ordinal = extractOrdinalReference(message);
    if (ordinal && lastProducts.length >= ordinal) {
        const targetProduct = await Product.findById(lastProducts[ordinal - 1]._id || lastProducts[ordinal - 1]);
        if (targetProduct) {
            return await handleExactProductLookup(targetProduct, context);
        }
    }

    // B. Người dùng phản hồi về ngân sách theo ngữ cảnh ("20 triệu thôi", "dưới 20tr thôi", "10tr")
    const newBudget = extractBudget(message);
    const catInMsg = inferCategory(message);
    const brandInMsg = extractBrandMention(message);

    // Nếu tin nhắn có nhắc đến danh mục mới hoặc thương hiệu mới -> Để luồng chính (Step 4 & 5) xử lý chuẩn xác!
    if (newBudget && !catInMsg && !brandInMsg) {
        const isHard = isHardBudgetLimit(message) || norm.includes('thoi');
        const category = context.category || 'Điện thoại';
        const brand = context.brand || '';
        const useCase = context.useCase || '';
        const major = context.major || '';

        return await handleRecommendWithTradeOffs({
            category,
            brand,
            budget: newBudget,
            isHardBudget: isHard,
            useCase,
            major,
            eliminatedBrands: context.eliminatedBrands || [],
            context: {
                ...context,
                category,
                brand,
                budget: newBudget,
                budgetType: isHard ? 'hard' : 'soft'
            }
        });
    }

    // C. Người dùng kêu đắt ("đắt quá", "vượt ngân sách")
    if (isPriceObjection(message)) {
        const category = context.category || 'Laptop';
        const brand = context.brand || '';
        const queryAffordable = {
            category,
            active: { $ne: false },
            stock: { $gt: 0 }
        };
        if (brand) {
            queryAffordable.brand = new RegExp(escapeRegex(brand), 'i');
        }

        // Tìm máy có giá rẻ nhất trong kho của category (và brand nếu có)
        const affordableProducts = await Product.find(queryAffordable).sort({ price: 1 }).limit(2);

        if (affordableProducts.length > 0) {
            const lowest = affordableProducts[0];
            const downPay = Math.round(lowest.price * 0.3);
            const installmentMonth = Math.round((lowest.price - downPay) / 12);

            const reply = `Dạ mình hoàn toàn thấu hiểu băn khoăn về ngân sách của bạn! Không sao cả, để tối ưu tài chính cho bạn, cửa hàng có các giải pháp sau:\n\n` +
                `1. 💡 **Lựa chọn giá kinh tế nhất:** Mẫu **${lowest.name}** hiện có giá kịch sàn chỉ **${money(lowest.price)}** (vẫn đảm bảo chính hãng 100% nguyên seal, bảo hành 12 - 24 tháng).\n` +
                `2. 💳 **Trả góp 0% lãi suất:** Bạn chỉ cần trả trước khoảng **${money(downPay)}**, số tiền còn lại chia góp chỉ khoảng **${money(installmentMonth)}/tháng** mà không phải trả thêm lãi suất.\n` +
                `3. 🎟️ **Mã giảm giá độc quyền:** Hệ thống đang có voucher giảm trực tiếp đến 500.000 đ cho khách đặt hàng hôm nay.\n\n` +
                `👉 Bạn có muốn tham khảo mẫu **${lowest.name}** này hay để mình tính bảng trả góp 0% chi tiết cho bạn nhé?`;

            return {
                reply,
                products: affordableProducts,
                suggestions: [
                    `Xem chi tiết ${lowest.name}`,
                    'Tính trả góp 0%',
                    'Săn mã giảm giá',
                    'Tư vấn thêm mẫu khác'
                ],
                context: {
                    ...context,
                    lastProducts: affordableProducts,
                    currentIntent: 'handled_price_objection'
                }
            };
        }
    }

    // D. Người dùng loại bỏ thương hiệu ("tôi không thích ASUS", "loại Dell ra")
    const brandToEliminate = extractEliminatedBrand(message);
    if (brandToEliminate) {
        const requestedBudget = extractBudget(message) || context.budget || 0;
        const isHardBudget = extractBudget(message)
            ? isHardBudgetLimit(message)
            : context.budgetType === 'hard';
        const eliminated = [...(context.eliminatedBrands || [])];
        if (!eliminated.includes(brandToEliminate)) {
            eliminated.push(brandToEliminate);
        }

        const reply = `Dạ mình đã ghi nhận và loại bỏ thương hiệu **${brandToEliminate}** ra khỏi danh sách tư vấn cho bạn rồi ạ! 🤝\n\n` +
            `Dưới đây là các lựa chọn thay thế hàng đầu từ các thương hiệu uy tín khác đáp ứng đúng yêu cầu của bạn:`;

        const newRec = await handleRecommendWithTradeOffs({
            category: context.category || 'Laptop',
            brand: '',
            budget: requestedBudget,
            isHardBudget,
            useCase: context.useCase || '',
            major: context.major || '',
            eliminatedBrands: eliminated,
            context: {
                ...context,
                brand: '',
                budget: requestedBudget,
                budgetType: isHardBudget ? 'hard' : 'soft',
                eliminatedBrands: eliminated
            }
        });

        newRec.reply = reply + '\n\n' + newRec.reply;
        return newRec;
    }

    // E. Người dùng muốn so sánh ("so sánh hai máy vừa rồi", "so sánh 2 con trên", hoặc so sánh đích danh 2 máy)
    if (['so sanh', 'so voi', 'khac nhau gi', 'khac nhau', 'khac gi', '2 may nay', 'hai may nay', 'phan van', 'nen chon may nao'].some(k => norm.includes(k))) {
        // 1. Nếu chỉ rõ "hai máy vừa rồi", "2 máy trên", hoặc đã có lastProducts
        if (lastProducts.length >= 2 && ['hai may', '2 may', 'vua roi', 'tren', 'do', 'nay', 'vua goi y'].some(k => norm.includes(k))) {
            const p1 = await Product.findById(lastProducts[0]._id || lastProducts[0]);
            const p2 = await Product.findById(lastProducts[1]._id || lastProducts[1]);
            if (p1 && p2) {
                return await buildComparisonResponse(p1, p2, context);
            }
        }

        // 2. Nếu người dùng nêu tên 2 sản phẩm cụ thể ("So sánh MacBook Air M2 và ASUS ROG Strix")
        const cleanMsg = norm.replace(/so sanh|so voi|khac nhau gi|khac nhau|khac gi|nen mua|hay|giua/g, ' ').trim();
        const parts = cleanMsg.split(/\s+(?:va|vs|hay|voi)\s+/i).filter(Boolean);
        if (parts.length >= 2) {
            const p1 = await findExactProductInCatalog(parts[0].trim());
            const p2 = await findExactProductInCatalog(parts[1].trim());
            if (p1 && p2 && String(p1._id) !== String(p2._id)) {
                return await buildComparisonResponse(p1, p2, context);
            }
        }

        // 3. Nếu đang trong ngữ cảnh đã có >= 2 sản phẩm đề xuất gần nhất
        if (lastProducts.length >= 2) {
            const p1 = await Product.findById(lastProducts[0]._id || lastProducts[0]);
            const p2 = await Product.findById(lastProducts[1]._id || lastProducts[1]);
            if (p1 && p2) {
                return await buildComparisonResponse(p1, p2, context);
            }
        }
    }

    return null;
}

/**
 * 7. Lập bảng so sánh 2 sản phẩm chi tiết có điểm đánh đổi
 */
async function buildComparisonResponse(p1, p2, context = {}) {
    const s1 = p1.specs || {};
    const s2 = p2.specs || {};

    const tableMarkdown = `⚖️ **BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT THỰC TẾ HỆ THỐNG**

| Tiêu chí so sánh | **${p1.name}** | **${p2.name}** |
| :--- | :--- | :--- |
| **Giá niêm yết** | **${money(p1.price)}** | **${money(p2.price)}** |
| **Tình trạng kho** | ${p1.stock > 0 ? `Còn ${p1.stock} máy` : 'Tạm hết'} | ${p2.stock > 0 ? `Còn ${p2.stock} máy` : 'Tạm hết'} |
| **Vi xử lý (CPU)** | ${s1.cpu || 'Tiêu chuẩn'} | ${s2.cpu || 'Tiêu chuẩn'} |
| **Bộ nhớ RAM** | ${s1.ram || 'Tiêu chuẩn'} | ${s2.ram || 'Tiêu chuẩn'} |
| **Ổ cứng lưu trữ** | ${s1.storage || 'Tiêu chuẩn'} | ${s2.storage || 'Tiêu chuẩn'} |
| **Màn hình** | ${s1.screen || 'Tiêu chuẩn'} | ${s2.screen || 'Tiêu chuẩn'} |
| **Thời lượng pin** | ${s1.battery || 'Tiêu chuẩn nhà sản xuất'} | ${s2.battery || 'Tiêu chuẩn nhà sản xuất'} |
| **Trọng lượng** | ${s1.weight || 'Tiêu chuẩn'} | ${s2.weight || 'Tiêu chuẩn'} |
| **Chính sách bảo hành** | ${p1.warranty || 'Chính hãng 12 - 24 tháng'} | ${p2.warranty || 'Chính hãng 12 - 24 tháng'} |`;

    const diffPrice = Math.abs(p1.price - p2.price);
    const cheaper = p1.price < p2.price ? p1 : p2;
    const higher = p1.price >= p2.price ? p1 : p2;

    const analysis =
        `🔍 **PHÂN TÍCH ĐÁNH ĐỔI:**\n` +
        `• **${cheaper.name}** có ưu thế lớn về tài chính, giúp bạn tiết kiệm ngay **${money(diffPrice)}**, đáp ứng tốt nhu cầu cơ bản hàng ngày.\n` +
        `• **${higher.name}** vượt trội hơn về cấu hình phần cứng (${(higher.specs || {}).cpu || ''}), tản nhiệt và độ bền bỉ khi xử lý đa nhiệm lâu dài.\n\n` +
        `🎯 **KẾT LUẬN CÓ ĐIỀU KIỆN:**\n` +
        `• Chọn **${cheaper.name}** nếu bạn ưu tiên chi phí tiết kiệm và tác vụ vừa phải.\n` +
        `• Chọn **${higher.name}** nếu bạn cần hiệu năng cao hơn và dùng máy bền vững 4-5 năm không lo lỗi thời.\n\n` +
        `👉 Bạn thấy mẫu máy nào phù hợp với thói quen sử dụng của mình hơn?`;

    const defaultReply = `${tableMarkdown}\n\n${analysis}`;
    const grounded = await aiModelService.generateGroundedConsultation({
        userMessage: context.currentMessage || 'so sánh hai máy vừa rồi',
        dialogueAct: 'compare',
        verifiedProducts: [p1, p2],
        context,
        fallbackText: defaultReply
    });

    return {
        reply: grounded.reply,
        products: [p1, p2],
        suggestions: [
            `Chọn ${p1.name}`,
            `Chọn ${p2.name}`,
            'Tính trả góp 0%',
            'Săn mã giảm giá'
        ],
        context: {
            ...context,
            lastProducts: [p1, p2],
            comparedProducts: [p1, p2],
            currentIntent: 'compared'
        },
        meta: {
            provider: grounded.provider,
            model: grounded.model,
            isFallback: grounded.isFallback
        }
    };
}

const CATEGORY_AUTHORIZED_BRANDS = {
    'Điện thoại': ['Apple (iPhone)', 'Samsung Galaxy', 'Xiaomi', 'POCO', 'OPPO', 'HONOR'],
    'Laptop': ['Apple MacBook', 'Dell', 'ASUS (ROG / Zenbook)', 'Acer (Nitro / Predator)', 'HP', 'Lenovo (ThinkPad / Legion)', 'MSI'],
    'Tablet': ['Apple iPad', 'Samsung Galaxy Tab', 'Huawei MatePad', 'Lenovo Tab', 'Xiaomi Pad'],
    'Đồng hồ thông minh': ['Apple Watch', 'Samsung Galaxy Watch', 'Garmin GPS', 'Huawei Watch', 'Xiaomi Watch'],
    'Máy chơi game': ['Sony PlayStation 5', 'Nintendo Switch OLED', 'Steam Deck OLED', 'Meta Quest VR'],
    'Tai nghe': ['Sony', 'Apple AirPods', 'Samsung Galaxy Buds', 'Marshall', 'JBL'],
    'Phụ kiện': ['Logitech', 'Anker', 'UGREEN', 'Baseus', 'Dareu']
};

/**
 * Xử lý tư vấn theo tính năng / kiểu dáng / form-factor sản phẩm
 * Ví dụ: "không dây", "có dây", "chống ồn", "chụp tai", "nhét tai", "bàn phím cơ", "chuột không dây"
 */
async function handleFeatureOrFormFactorQuery(message, category, prev = {}) {
    const norm = normalizeText(message);
    const cat = category || prev.category || '';

    // Nhận diện các tính năng âm thanh / tai nghe
    const isWirelessQuery = /\b(khong day|bluetooth|true wireless|truewireless|tws|khong co day|khong day nhe|khong day a|wireless)\b/i.test(norm);
    const isWiredQuery = /\b(co day|day cam|jack 3 5|lightning|type c co day|co day nhe|co day a)\b/i.test(norm);
    const isAncQuery = /\b(chong on|anc|khu on|cach am)\b/i.test(norm);
    const isOverEarQuery = /\b(chup tai|over ear|on ear|headphone|tai nghe chup)\b/i.test(norm);
    const isInEarQuery = /\b(nhet tai|in ear|earbuds|tai nghe nhet)\b/i.test(norm);

    if (cat === 'Tai nghe' || (!cat && (isWirelessQuery || isWiredQuery || isAncQuery || isOverEarQuery || isInEarQuery))) {
        const targetCat = 'Tai nghe';
        const brandScope = prev.brand || '';

        // A. TAI NGHE KHÔNG DÂY (Bluetooth / True Wireless)
        if (isWirelessQuery && !isWiredQuery) {
            const candidates = await Product.find({
                category: 'Tai nghe',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /không dây|bluetooth|true wireless|tws|airpods|buds|wf-|wh-|major|minor|wave|tour/i },
                    { 'specs.connectivity': /bluetooth|wireless|không dây/i }
                ]
            }).sort({ rating: -1, soldCount: -1 }).limit(6);

            // Nếu người dùng trước đó đã chọn một thương hiệu cụ thể (ví dụ: Apple)
            let brandIntro = '';
            if (brandScope) {
                const brandProduct = candidates.find(p => p.brand.toLowerCase() === brandScope.toLowerCase());
                if (brandProduct) {
                    brandIntro = `Dạ với thương hiệu **${brandScope}** trong dòng **Tai nghe không dây**, TechEcommerce có sẵn mẫu tai nghe cao cấp hàng đầu:\n` +
                        `⭐ **${brandProduct.name}** - Giá: **${money(brandProduct.price)}** (chống ồn chủ động đỉnh cao, pin bền bỉ, kết nối siêu tốc).\n\n` +
                        `Bên cạnh đó, để bạn có thêm sự lựa chọn so sánh khách quan, cửa hàng cũng có sẵn các mẫu tai nghe không dây xuất sắc từ các thương hiệu âm thanh khác:\n`;
                }
            }

            const generalBreakdown = [
                `• 🌟 **Phân khúc kinh tế / thể thao:** **Tai nghe không dây JBL Wave Beam TWS** - **1.290.000 đ** (Pin 32h, kháng nước IP54, âm bass JBL Deep Bass mạnh mẽ).`,
                `• 🌟 **Phân khúc phong cách / chụp tai:** **Marshall Major 5** - **3.690.000 đ** hoặc **Marshall Minor IV** - **2.890.000 đ** (Thiết kế da vintage, pin khủng tới 100 giờ).`,
                `• 🌟 **Phân khúc cao cấp chống ồn hàng đầu:**\n` +
                `  - **Samsung Galaxy Buds 3 Pro** - **4.490.000 đ** (Chống ồn thích ứng, âm thanh Hi-Fi 24-bit).\n` +
                `  - **Apple AirPods Pro 2 USB-C** - **5.490.000 đ** (Chống ồn chủ động 2X, Spatial Audio theo dõi đầu).\n` +
                `  - **Sony WF-1000XM5** - **5.490.000 đ** / **Sony WH-1000XM5** (chụp tai) - **6.990.000 đ** (Chống ồn số 1 thế giới, chuẩn Hi-Res LDAC).`
            ].join('\n');

            const reply = brandIntro
                ? `${brandIntro}${generalBreakdown}\n\n👉 Bạn muốn tìm mẫu **nhét tai nhỏ gọn (In-ear/TWS)** hay **chụp tai (Over-ear)**, và dự kiến ngân sách khoảng bao nhiêu để mình tư vấn mẫu vừa vặn nhất cho bạn nhé! 😊`
                : `Dạ chào bạn! Với dòng **Tai nghe không dây (Bluetooth / True Wireless)**, TechEcommerce hiện phân phối chính hãng 100% các mẫu hàng đầu từ **Apple, Sony, Samsung, Marshall và JBL** (nguyên seal, bảo hành 12 tháng, hỗ trợ trả góp 0%):\n\n` +
                `${generalBreakdown}\n\n` +
                `👉 Bạn đang tìm mẫu **nhét tai nhỏ gọn (In-ear/TWS)** hay **chụp tai thoải mái (Over-ear)**, và dự kiến tầm ngân sách khoảng bao nhiêu để mình tư vấn mẫu ưng ý nhất cho bạn nhé! 😊`;

            return {
                reply,
                products: candidates,
                suggestions: [
                    'Tai nghe True Wireless',
                    'Tai nghe chụp tai',
                    'Dưới 2 triệu',
                    'Tầm 3 - 5 triệu'
                ],
                context: {
                    ...prev,
                    category: targetCat,
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'không dây',
                    featureType: 'wireless',
                    lastProducts: candidates
                }
            };
        }

        // B. TAI NGHE CÓ DÂY
        if (isWiredQuery) {
            const candidates = await Product.find({
                category: 'Tai nghe',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /EarPods|Inzone H3|có dây/i },
                    { description: /có dây|jack|lightning/i }
                ]
            }).sort({ price: 1 }).limit(4);

            const displayList = candidates.map(p =>
                `• 🎧 **${p.name}** - Giá: **${money(p.price)}** (${p.brand})`
            ).join('\n');

            const reply = `Dạ chào bạn! Nếu bạn thích sự ổn định tuyệt đối, không có độ trễ và không phải lo sạc pin của dòng **Tai nghe có dây**, TechEcommerce có sẵn các mẫu chính hãng nổi bật:\n\n` +
                `${displayList}\n\n` +
                `1. **Apple EarPods Lightning MWTY3ZA/A (499.000 đ):** Lựa chọn kinh tế nhất, đàm thoại to rõ, cổng Lightning chuẩn cho iPhone/iPad.\n` +
                `2. **Sony Inzone H3 (2.490.000 đ):** Dòng chụp tai Gaming chuyên nghiệp với âm thanh không gian 360 Spatial Sound và mic đàm thoại khử tạp âm.\n\n` +
                `👉 Bạn đang dùng thiết bị cổng cắm nào (Lightning, Type-C hay Jack 3.5mm) để mình chọn mẫu chuẩn xác nhất cho bạn nhé! 😊`;

            return {
                reply,
                products: candidates,
                suggestions: [
                    'Xem Apple EarPods',
                    'Xem Sony Inzone H3',
                    'Tai nghe không dây',
                    'Săn mã giảm giá'
                ],
                context: {
                    ...prev,
                    category: targetCat,
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'có dây',
                    featureType: 'wired',
                    lastProducts: candidates
                }
            };
        }

        // C. TAI NGHE CHỐNG ỒN (ANC)
        if (isAncQuery) {
            const candidates = await Product.find({
                category: 'Tai nghe',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /WH-1000XM5|WF-1000XM5|AirPods Pro|Buds 3 Pro|Tour Pro 2|chống ồn/i },
                    { description: /chống ồn|ANC/i }
                ]
            }).sort({ rating: -1, soldCount: -1 }).limit(5);

            const reply = `Dạ chào bạn! Về khả năng **Chống ồn chủ động (ANC)** đỉnh cao để làm việc, học tập tập trung hoặc di chuyển trên máy bay/xe cộ, TechEcommerce có những đại diện xuất sắc nhất:\n\n` +
                `• 👑 **Sony WH-1000XM5 (6.990.000 đ):** Chống ồn chụp tai top 1 thế giới với bộ xử lý kép V1 + QN1, đệm tai da êm ái.\n` +
                `• 🌟 **Sony WF-1000XM5 (5.490.000 đ):** Mẫu nhét tai True Wireless chống ồn xuất sắc nhất phân khúc nhỏ gọn.\n` +
                `• 🍏 **Apple AirPods Pro 2 USB-C (5.490.000 đ):** Chống ồn chủ động 2X, tích hợp Spatial Audio theo dõi đầu.\n` +
                `• 🔊 **JBL Tour Pro 2 (5.490.000 đ):** Chống ồn thích ứng True Adaptive NC kèm hộp sạc có màn hình cảm ứng LCD độc đáo.\n\n` +
                `👉 Bạn ưu tiên dòng **chụp tai (Over-ear)** hay **nhét tai (In-ear)** để mình tư vấn chi tiết nhé!`;

            return {
                reply,
                products: candidates,
                suggestions: [
                    'Xem Sony WH-1000XM5',
                    'Xem AirPods Pro 2',
                    'Tầm 3 - 5 triệu',
                    'Tính trả góp 0%'
                ],
                context: {
                    ...prev,
                    category: targetCat,
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'chống ồn',
                    featureType: 'anc',
                    lastProducts: candidates
                }
            };
        }

        // D. TAI NGHE CHỤP TAI (Over-ear)
        if (isOverEarQuery) {
            const candidates = await Product.find({
                category: 'Tai nghe',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /chụp tai|WH-|Major|Inzone/i },
                    { description: /chụp tai|over-ear/i }
                ]
            }).sort({ rating: -1, soldCount: -1 }).limit(4);

            const reply = `Dạ chào bạn! Nếu bạn thích kiểu dáng **Tai nghe chụp tai (Over-ear)** êm ái, cách âm tự nhiên và âm trường rộng mở, TechEcommerce có những lựa chọn hàng đầu:\n\n` +
                `• 🎸 **Marshall Major 5 (3.690.000 đ):** Thiết kế da vintage cổ điển, pin vượt trội lên tới 100 giờ, chất âm rock sống động.\n` +
                `• 🎧 **Sony WH-1000XM5 (6.990.000 đ):** Đỉnh cao âm thanh Hi-Res LDAC, chống ồn thông minh tự động tinh chỉnh theo môi trường.\n` +
                `• 🔊 **Sony WH-ULT900N ULT WEAR (3.990.000 đ):** Âm bass siêu trầm uy lực ULT POWER SOUND, chống ồn chủ động.\n` +
                `• 🎮 **Sony Inzone H3 (2.490.000 đ):** Chụp tai có dây tối ưu cho Gaming với âm thanh không gian 360 Spatial Sound.\n\n` +
                `👉 Bạn dự định sử dụng chủ yếu để nghe nhạc, xem phim hay chơi game để mình gợi ý mẫu phù hợp nhất nhé! 😊`;

            return {
                reply,
                products: candidates,
                suggestions: [
                    'Xem Marshall Major 5',
                    'Xem Sony WH-1000XM5',
                    'Tầm 3 - 5 triệu',
                    'Tai nghe nhét tai'
                ],
                context: {
                    ...prev,
                    category: targetCat,
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'chụp tai',
                    featureType: 'over_ear',
                    lastProducts: candidates
                }
            };
        }
    }

    // 2. Phân loại PHỤ KIỆN: Chuột / Bàn phím / Không dây
    if (cat === 'Phụ kiện' || (!cat && /\b(ban phim|chuot|cu sac|day sac|pin du phong)\b/i.test(norm))) {
        const accessoryTypes = [
            { test: /\b(ban phim|keyboard)\b/i, label: 'bàn phím', match: /bàn phím|keyboard/i },
            { test: /\b(chuot|mouse)\b/i, label: 'chuột', match: /chuột|mouse/i },
            { test: /\b(cu sac|bo sac|sac nhanh|gan)\b/i, label: 'củ sạc', match: /củ sạc|bộ sạc|sạc nhanh|gan/i },
            { test: /\b(pin du phong|sac du phong|power bank|powerbank)\b/i, label: 'pin sạc dự phòng', match: /pin sạc dự phòng|sạc dự phòng|power ?bank/i },
            { test: /\b(hub|chuyen doi)\b/i, label: 'hub chuyển đổi', match: /hub|chuyển đổi/i }
        ];
        const requestedAccessory = accessoryTypes.find(type => type.test.test(norm));

        if (requestedAccessory) {
            const candidates = await Product.find({
                category: 'Phụ kiện',
                active: { $ne: false },
                stock: { $gt: 0 },
                name: requestedAccessory.match
            }).sort({ rating: -1, soldCount: -1, price: 1 }).limit(4);

            if (candidates.length) {
                const productLines = candidates.map(product =>
                    `• **${product.name}** — **${money(product.price)}** (còn ${product.stock} sản phẩm)`
                ).join('\n');
                const reply = `Dạ có ạ! Cửa hàng tụi mình đang có **${candidates.length} mẫu ${requestedAccessory.label}** phù hợp để bạn tham khảo:\n\n` +
                    `${productLines}\n\n` +
                    `Bạn đang dùng máy tính hoặc thiết bị nào, và ưu tiên **giá tiết kiệm**, **gõ/điều khiển êm** hay **chơi game** để mình chọn đúng một mẫu cho bạn nhé? 😊`;

                return {
                    reply,
                    products: candidates,
                    suggestions: [
                        `${requestedAccessory.label} giá tiết kiệm`,
                        `${requestedAccessory.label} không dây`,
                        `${requestedAccessory.label} chơi game`,
                        'So sánh các mẫu vừa xem'
                    ],
                    context: {
                        ...prev,
                        category: 'Phụ kiện',
                        accessoryType: requestedAccessory.label,
                        currentIntent: 'accessory_showcase',
                        lastProducts: candidates
                    }
                };
            }
        }

        if (/\b(khong day|bluetooth|wireless)\b/i.test(norm)) {
            const candidates = await Product.find({
                category: 'Phụ kiện',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /không dây|bluetooth|wireless|mx master|mx keys/i },
                    { description: /không dây|bluetooth/i }
                ]
            }).sort({ rating: -1 }).limit(5);

            if (candidates.length) {
                const reply = `Dạ chào bạn! Với dòng **Phụ kiện không dây**, TechEcommerce có sẵn các thiết bị cao cấp phục vụ làm việc và giải trí:\n\n` +
                    candidates.map(p => `• 🖱️ **${p.name}** - Giá: **${money(p.price)}** (${p.brand})`).join('\n') + `\n\n` +
                    `👉 Bạn đang tìm **Chuột không dây**, **Bàn phím không dây** hay phụ kiện nào khác để mình hỗ trợ nhé! 😊`;

                return {
                    reply,
                    products: candidates,
                    suggestions: ['Chuột không dây', 'Bàn phím không dây', 'Săn mã giảm giá'],
                    context: {
                        ...prev,
                        category: 'Phụ kiện',
                        currentIntent: 'feature_showcase',
                        featureKeyword: 'không dây',
                        lastProducts: candidates
                    }
                };
            }
        }
    }

    return null;
}

async function checkUncarriedItemForCategory(message, category) {
    if (!category) return null;

    // Nếu người dùng đang nêu nhu cầu sử dụng hoặc ngành học -> Không phải hỏi thương hiệu lạ
    if (extractUseCase(message) || extractMajorOrField(message)) {
        return null;
    }

    const norm = normalizeText(message);

    // Bỏ qua nếu tin nhắn chứa các từ khóa tính năng, kiểu dáng, kỹ thuật phổ biến
    const FEATURE_REGEX = /\b(khong day|co day|bluetooth|chong on|truewireless|true wireless|tws|chup tai|nhet tai|in ear|over ear|on ear|gaming|van phong|ban phim co|phim co|chuot khong day|chuot co day|sac nhanh|pin trau|mong nhe|do hoa|lap trinh|hoc tap|sinh vien|gia re|cao cap|chinh hang|chong nuoc|the thao|dam thoai)\b/i;
    if (FEATURE_REGEX.test(norm)) {
        return null;
    }

    // Bỏ qua các cụm từ danh mục nhiều chữ trước, sau đó đến từ đơn, đại từ, nhu cầu chung, liên từ hội thoại và ngân sách
    const stripped = norm
        .replace(/\b(dong ho thong minh|may tinh xach tay|may tinh bang|may choi game|ban phim khong day|ban phim co|chuot khong day|chuot gaming|tai nghe khong day|dien thoai thong minh|dong ho the thao|dong ho deo tay|may choi game cam tay|tai nghe chong on|tai nghe bluetooth|tai nghe chup tai|tai nghe nhet tai|ban phim may tinh|chuot may tinh|true wireless|truewireless)\b/gi, ' ')
        .replace(/\b(tu van cho|tu van giup|tu van gium|gioi thieu cho|gioi thieu giup|goi y cho|goi y giup|tim giup|tim gium|tim cho|cho xem|xem thu|xem giup|muon mua|muon tim|muon xem|can mua|can tim|can xem)\b/gi, ' ')
        .replace(/\b(chuyen sang|doi sang|chuyen qua|doi qua|xem sang|xem qua|co cai khac|co mau khac|co dong khac|co gi khac)\b/gi, ' ')
        .replace(/\b(vay thi|the thi|vay con|the con|neu vay|neu the|vay ta|vay ha|the a|the ha|vay sao|the sao|co khong|duoc khong|khong a|co phai|co ban|co mau|co loai|co con|co chiec|co hang|ben ban|o day|cua hang|cho minh|cho em|cho toi|cho anh|cho chi|minh muon|em muon|toi muon)\b/gi, ' ')
        .replace(/\b(tam gia|ngan sach|muc gia|gia re|cao cap|chinh hang|re nhat|tot nhat|mong nhe|pin trau|sac nhanh|chong nuoc|the thao|dam thoai|chong on|khong day|co day|chup tai|nhet tai|in ear|over ear|on ear)\b/gi, ' ')
        .replace(/\b(chup anh|quay phim|chup hinh|camera|choi game|gaming|hoc tap|sinh vien|van phong|do hoa|lap trinh)\b/gi, ' ')
        .replace(/\b(dien thoai|smartphone|laptop|macbook|tablet|ipad|smartwatch|dong ho|tai nghe|headphone|earbuds|ban phim|chuot|phu kien)\b/gi, ' ')
        .replace(/\b(toi|minh|em|anh|chi|ban|shop|ad|tech|techecommerce|da|vang|chao|alo|xin chao|hello|hi)\b/gi, ' ')
        .replace(/\b(tu van|gioi thieu|goi y|de xuat|muon|can|tim|hoi|xem|mua|ban|lay|chon|chuyen|doi)\b/gi, ' ')
        .replace(/\b(co|khong|gi|nao|chua|sao|dau|may|the nao|ra sao|a|nhe|nha|gium|giup|di|thoi|nhi|ukm|ok|roi|thi|ma|la|hay|hoac|neu|vay|the|con|khac)\b/gi, ' ')
        .replace(/\b(nhung|mau|dong|san pham|chiec|cai|may|con|loai|cac|mat hang|hang hoa|thiet bi|do)\b/gi, ' ')
        .replace(/\b(khoang|tam|duoi|tren|tu|den|gia|re|mac|dat|tot|dep|on|ngon|vip|moi|cu|thong minh|smart|bluetooth|wireless|tws)\b/gi, ' ')
        .replace(/\b\d+([.,]\d+)?\s*(trieu|tr|k|ngan|nghin|cu|m|dong|vnd|d|b|c)?\b/gi, ' ')
        .replace(/\b(trieu|tr|k|ngan|nghin|cu|m|dong|vnd|d)\b/gi, ' ')
        .replace(/\b\d+\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!stripped || stripped.length < 3) return null;

    const PROTECTED_TERMS = new Set([
        'day', 'co', 'khong', 'on', 'tai', 'mic', 'hop', 'vo', 'pin', 'sac', 'bluetooth', 'wireless',
        'tws', 'inear', 'overear', 'onear', 'chup', 'nhet', 'gaming', 'office', 'pro', 'max', 'plus',
        'ultra', 'mini', 'lite', 'se', 'air', 'fe', 'doc', 'sach', 'tivi', 'tv', 're', 'tot', 'dep',
        'on', 'khac', 'thoi', 'sao', 'nhi', 'nha', 'nhe', 'gium', 'giup', 'ngon', 'vip', 'zin',
        'chinh', 'hang', 'loai', 'mau', 'dong', 'chiec', 'cai', 'may', 'con', 'ben', 'cua', 'shop', 'tech'
    ]);
    const words = stripped.toLowerCase().split(/\s+/);
    if (words.every(w => PROTECTED_TERMS.has(w))) return null;

    // Kiểm tra xem token này có khớp với bất kỳ sản phẩm nào trong kho không
    const count = await Product.countDocuments({
        active: { $ne: false },
        $or: [
            { name: new RegExp(escapeRegex(stripped), 'i') },
            { brand: new RegExp(escapeRegex(stripped), 'i') }
        ]
    });

    if (count === 0) {
        // Tên hiển thị viết hoa chữ cái đầu
        const display = stripped.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const brandsList = (CATEGORY_AUTHORIZED_BRANDS[category] || []).map(b => `• **${b}**`).join('\n');

        return {
            reply: `Dạ chào bạn! Hiện tại TechEcommerce **chưa phân phối dòng sản phẩm ${display}** trong danh mục **${category}** ạ. 🙏\n\n` +
                `Cửa hàng chúng mình hiện phân phối chính hãng 100% các thương hiệu hàng đầu với đầy đủ bảo hành chính hãng và hỗ trợ trả góp 0%:\n` +
                `${brandsList}\n\n` +
                `👉 Bạn có muốn tham khảo các mẫu ${category} chính hãng từ những thương hiệu này trong khoảng ngân sách bao nhiêu để mình tư vấn chi tiết cho bạn nhé! 😊`,
            products: [],
            suggestions: (CATEGORY_AUTHORIZED_BRANDS[category] || []).map(b => b.split('(')[0].trim()).slice(0, 4),
            context: { stage: 'out_of_catalog', notFound: true, uncarriedBrand: display },
            notFound: true
        };
    }
    return null;
}

// -------------------------------------------------------------
// HÀM ĐIỀU PHỐI CHÍNH (MAIN DISPATCHER)
// -------------------------------------------------------------

async function coordinateConsultation({ message, user = null, context = {} }) {
    const text = normalizeText(message);
    const prev = { ...(context || {}) };

    // Tự động xóa cờ notFound và out_of_catalog từ lượt hỏi trước để không làm tắc lượt hỏi mới
    delete prev.notFound;
    if (prev.stage === 'out_of_catalog') {
        delete prev.stage;
        delete prev.uncarriedBrand;
    }

    // 0. Kiểm tra mặt hàng ngoài phạm vi kinh doanh (máy đọc sách, tivi, máy ảnh độc lập...)
    const unsupportedItem = checkUnsupportedProduct(message);
    if (unsupportedItem) {
        return buildOutOfCatalogResponse(unsupportedItem, message);
    }

    // 1. Kiểm tra câu hỏi chẩn đoán máy cũ (Core i5 Gen 8, nâng cấp SSD/RAM vs Mua mới)
    if (isOldDeviceDiagnosis(message)) {
        return await handleOldDeviceDiagnosis(message, prev);
    }

    // 2a. Kiểm tra nếu câu hỏi nhắc đến 2 sản phẩm cụ thể để so sánh ("So sánh MacBook Air M2 và Asus ROG Strix")
    const matchedProducts = await findAllMatchingProductsInCatalog(message);
    const isComparingIntent = ['so sanh', 'so voi', 'khac nhau gi', 'khac nhau', 'khac gi', 'hay nen mua', 'phan van', 'nen chon may nao', 'giua'].some(k => text.includes(k));

    if (matchedProducts.length >= 2 && isComparingIntent) {
        return await buildComparisonResponse(matchedProducts[0], matchedProducts[1], prev);
    }

    // 2b. Kiểm tra câu tra cứu chính xác 1 model / biến thể (Exact Lookup)
    // Nếu khách đã chỉ rõ model máy -> trả lời đúng sản phẩm, giá, tồn kho ngay lập tức!
    if (matchedProducts.length >= 1 && !isComparingIntent) {
        return await handleExactProductLookup(matchedProducts[0], prev);
    }

    // Khách đang được hỏi về một loại sản phẩm nhưng chuyển hẳn sang loại khác
    // (ví dụ: đang hỏi tai nghe rồi nói "điện thoại") thì phải reset bộ slot cũ.
    const requestedProductType = detectProductType(message);
    if (requestedProductType && requestedProductType.key !== prev.productType) {
        const switchedContext = {
            pageCategory: prev.pageCategory,
            category: requestedProductType.category,
            productType: requestedProductType.key,
            stage: 'qualifying_needs',
            currentIntent: 'qualifying_needs',
            brand: '',
            budget: 0,
            budgetType: 'unspecified',
            useCase: '',
            qualification: {},
            missingSlots: [],
            lastProducts: []
        };
        return await handleCatalogProductTypeQuery(message, switchedContext, requestedProductType);
    }

    // Các nút xử lý sau khi không có kết quả phải thật sự nới điều kiện cũ,
    // thay vì gửi lại nguyên brand/ngân sách khiến AI lặp cùng một câu trả lời.
    const activeProductType = PRODUCT_TYPE_INTENTS.find(type => type.key === prev.productType);
    if (activeProductType && text.includes('doi thuong hieu')) {
        const previousBrand = prev.brand || prev.qualification?.brand || '';
        const relaxedContext = {
            ...prev,
            stage: 'qualifying_needs',
            currentIntent: 'qualifying_needs',
            brand: '',
            excludedBrand: previousBrand,
            qualification: { ...(prev.qualification || {}), brand: '' },
            lastProducts: []
        };
        return await handleCatalogProductTypeQuery(message, relaxedContext, activeProductType);
    }
    if (activeProductType && text.includes('tang khoang ngan sach') && !extractBudget(message)) {
        const relaxedContext = {
            ...prev,
            stage: 'qualifying_needs',
            currentIntent: 'qualifying_needs',
            budget: 0,
            budgetType: 'unspecified',
            qualification: { ...(prev.qualification || {}), budget: 0 },
            lastProducts: []
        };
        return await handleCatalogProductTypeQuery(message, relaxedContext, activeProductType);
    }

    // Tiếp tục thu thập nhu cầu qua nhiều lượt. Nếu khách gọi đúng tên model ở
    // trên, nhánh exact lookup đã ưu tiên trả sản phẩm ngay lập tức.
    if (prev.stage === 'qualifying_needs' && prev.productType) {
        const qualifyingProductType = PRODUCT_TYPE_INTENTS.find(type => type.key === prev.productType);
        if (qualifyingProductType) {
            return await handleCatalogProductTypeQuery(message, prev, qualifyingProductType);
        }
    }

    // 2c. Khách đã nêu rõ loại hàng thì truy vấn trực tiếp catalog thật.
    // Ưu tiên bước này trước ngữ cảnh cũ để đổi trang/danh mục không làm trả lời sai.
    const productTypeResponse = await handleCatalogProductTypeQuery(message, prev);
    if (productTypeResponse) {
        return productTypeResponse;
    }

    // 3. Xử lý các câu phản hồi ngắn theo ngữ cảnh (Anaphora / Contextual Follow-ups)
    // Ví dụ: "máy thứ hai", "20 triệu thôi", "đắt quá", "tôi không thích ASUS", "so sánh hai máy vừa rồi"
    const contextualResponse = await handleContextualFollowUp(message, prev);
    if (contextualResponse) {
        return contextualResponse;
    }

    // 4. PHÂN TÍCH THƯƠNG HIỆU & DANH MỤC
    const brandMention = extractBrandMention(message);
    const categoryInMessage = inferCategory(message);
    const explicitBudgetInMsg = extractBudget(message);

    // Kiểm tra xem khách có chuyển sang danh mục mới hay đang hỏi sản phẩm mới sau câu hỏi không có (not found / out of catalog)
    const isCategorySwitch = Boolean(categoryInMessage && prev.category && categoryInMessage !== prev.category);
    const isNewInquiryAfterNotFound = Boolean(prev.notFound || prev.stage === 'out_of_catalog');

    if (isCategorySwitch || isNewInquiryAfterNotFound) {
        delete prev.notFound;
        delete prev.stage;
        delete prev.uncarriedBrand;
        delete prev.lastProducts;
        delete prev.currentIntent;

        // Cho dù chuyển danh mục hay hỏi tiếp sau câu hỏi không có sản phẩm:
        // Nếu tin nhắn mới không đề cập thương hiệu thì PHẢI XÓA SẠCH thương hiệu cũ!
        if (!brandMention) prev.brand = '';
        if (!explicitBudgetInMsg) prev.budget = 0;

        if (isCategorySwitch) {
            prev.category = categoryInMessage;
            prev.useCase = '';
            prev.major = '';
            prev.eliminatedBrands = [];
        }
    }

    const currentCategory = categoryInMessage || prev.category || '';

    // 4a. YÊU CẦU CỐT LÕI: Khách chỉ nói thương hiệu mà không nêu ngân sách ("samsung", "mình thích samsung", "laptop asus")
    // "sau đó khách có nói samsung mà AI vẫn cứ hỏi vấn đề ngân sách nên bạn fix lại luồng này cho tôi"
    // -> Tuyệt đối không lặp lại câu hỏi ngân sách máy móc! Giới thiệu các dòng sản phẩm của thương hiệu đó!
    if (brandMention && !explicitBudgetInMsg) {
        if (currentCategory) {
            return await handleBrandWithCategory(brandMention.name, currentCategory, prev);
        } else {
            return await handleBrandOnly(brandMention, prev);
        }
    }

    // 4b. Kiểm tra câu hỏi theo tính năng / kiểu dáng / form-factor ("không dây", "chống ồn", "có dây", "chụp tai"...)
    const featureConsultation = await handleFeatureOrFormFactorQuery(message, currentCategory, prev);
    if (featureConsultation) {
        return featureConsultation;
    }

    // 4c. Kiểm tra trường hợp khách hỏi sản phẩm / thương hiệu không có trong catalog cho danh mục này
    if (matchedProducts.length === 0 && currentCategory) {
        const uncarriedCheck = await checkUncarriedItemForCategory(message, currentCategory);
        if (uncarriedCheck) {
            return uncarriedCheck;
        }
    }

    // 5. Cập nhật các slot từ tin nhắn hiện tại
    // CHÚ Ý QUAN TRỌNG: Chỉ dùng lại prev.budget nếu tin nhắn hiện tại có liên quan đến ngân sách / giá tiền
    // Không bao giờ tự ý áp đặt ngân sách cũ khi người dùng không hỏi về ngân sách!
    const isBudgetQuery = Boolean(explicitBudgetInMsg || ['tam gia', 'ngan sach', 'khoang', 'duoi', 'trieu', 'trieu dong', 'muc gia', 'tam tien'].some(k => text.includes(k)));
    const newBudget = explicitBudgetInMsg || (isBudgetQuery ? (prev.budget || 0) : 0);
    const isHard = isHardBudgetLimit(message) || prev.budgetType === 'hard';
    const category = currentCategory;
    const brand = brandMention?.name || (isCategorySwitch || isNewInquiryAfterNotFound ? '' : (prev.brand || ''));
    const useCase = extractUseCase(message) || prev.useCase || '';
    const major = extractMajorOrField(message) || prev.major || '';
    const userProficiency = extractTechProficiency(message) || prev.techProficiency || 'intermediate';
    const eliminated = extractEliminatedBrand(message) ? [...(prev.eliminatedBrands || []), extractEliminatedBrand(message)] : (prev.eliminatedBrands || []);

    const updatedContext = {
        ...prev,
        category,
        brand: brand || '',
        budget: newBudget,
        budgetType: isHard ? 'hard' : (prev.budgetType || 'unspecified'),
        useCase,
        major,
        techProficiency: userProficiency,
        eliminatedBrands: eliminated
    };

    // 6. YÊU CẦU CỐT LÕI: KHI KHÁCH HÀNG MUỐN NGÂN SÁCH TRONG TẦM GIÁ -> MỚI NHẢY RA ĐỂ TƯ VẤN KHÁCH HÀNG
    // "còn khi khách hàng muốn ngân sách trong tầm giá thì mới nhảy ra để tư vấn khách hàng"
    if (newBudget > 0) {
        return await handleRecommendWithTradeOffs({
            category: category || 'Điện thoại',
            brand,
            budget: newBudget,
            isHardBudget: isHard,
            useCase,
            major,
            eliminatedBrands: eliminated,
            userProficiency,
            context: updatedContext
        });
    }

    // 7. Nếu có category mà chưa có ngân sách
    if (category) {
        return await handleClarifyNeeds(category, updatedContext, userProficiency);
    }

    // Nếu không xác định được danh mục hay thương hiệu
    return {
        reply: `Dạ chào bạn! Mình là Trợ lý Mua sắm của TechEcommerce. Cửa hàng chuyên phân phối chính hãng các sản phẩm: **Laptop**, **Điện thoại**, **Tablet**, **Đồng hồ thông minh**, **Tai nghe** và **Máy chơi game**.\n\n` +
            `👉 Bạn đang tìm kiếm sản phẩm nào hoặc có mức ngân sách khoảng bao nhiêu để mình tư vấn vừa vặn nhất cho bạn nhé! 😊`,
        products: [],
        suggestions: [
            'Tư vấn laptop sinh viên',
            'Tư vấn điện thoại chụp ảnh',
            'Xem máy tính bảng học tập',
            'Săn mã giảm giá hôm nay'
        ],
        context: updatedContext
    };
}

module.exports = {
    coordinateConsultation,
    handleExactProductLookup,
    handleCatalogProductTypeQuery,
    detectProductType,
    handleBrandOnly,
    handleOldDeviceDiagnosis,
    handleRecommendWithTradeOffs,
    handleContextualFollowUp,
    buildComparisonResponse,
    handleFeatureOrFormFactorQuery,
    checkUncarriedItemForCategory,
    checkUnsupportedProduct,
    buildOutOfCatalogResponse,
    extractBudget,
    inferCategory,
    extractBrandMention,
    extractEliminatedBrand,
    extractUseCase,
    extractMajorOrField,
    extractOrdinalReference,
    isPriceObjection,
    isOldDeviceDiagnosis,
    money,
    normalizeText
};
