/**
 * consultationCoordinator.js
 * Bộ điều phối trung tâm quản lý bối cảnh hội thoại, theo dõi slot (slot-filling),
 * phân loại tình huống tư vấn, truy vấn catalog thực tế từ MongoDB và giải thích đánh đổi (trade-offs).
 */

const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const aiModelService = require('./aiModelService');
const { matchSmartAnswer } = require('./storeKnowledgeAndChitChat');
const nlu = require('./nlu');
const config = nlu.config || require('./nlu/config');

// -------------------------------------------------------------
// TIỆN ÍCH CHUẨN HÓA VĂN BẢN VÀ ĐỊNH DẠNG TIỀN TỆ
// -------------------------------------------------------------
function repairMojibake(value) {
    const source = String(value || '');
    // Some legacy fixtures and persisted messages were decoded as Latin-1
    // instead of UTF-8 (for example "MĂ¬nh", "Ä‘"). Repair those strings
    // before accent folding so intent/entity matching remains deterministic.
    if (!/[ÃÂÄÐá»ÆĂ]/.test(source) || typeof Buffer === 'undefined') return source;
    try {
        const repaired = Buffer.from(source, 'latin1').toString('utf8');
        return repaired.includes('\uFFFD') ? source : repaired;
    } catch (_) {
        return source;
    }
}

function normalizeText(value) {
    return repairMojibake(value)
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
    {
        key: 'apple',
        name: 'Apple',
        aliases: ['apple', 'tao khuyet', 'tao', 'iphone', 'ip', 'macbook', 'ipad', 'airpods', 'apple watch', 'applewatch'],
        categories: ['Điện thoại (iPhone)', 'Laptop (MacBook)', 'Tablet (iPad)', 'Đồng hồ (Apple Watch)', 'Tai nghe (AirPods)']
    },
    {
        key: 'samsung',
        name: 'Samsung',
        aliases: ['samsung', 'galaxy', 'galaxy s', 'galaxy z', 'galaxy a', 'galaxy tab', 'galaxy buds', 'galaxy watch'],
        categories: ['Điện thoại (Galaxy S/Z)', 'Tablet (Galaxy Tab)', 'Đồng hồ (Galaxy Watch)', 'Tai nghe (Galaxy Buds)']
    },
    {
        key: 'asus',
        name: 'ASUS',
        aliases: ['asus', 'rog', 'rog strix', 'tuf', 'zenbook', 'vivobook', 'rog ally'],
        categories: ['Laptop Gaming (ROG, TUF)', 'Laptop văn phòng (Zenbook, Vivobook)']
    },
    {
        key: 'acer',
        name: 'Acer',
        aliases: ['acer', 'nitro', 'predator', 'aspire'],
        categories: ['Laptop Gaming (Nitro V, Predator)', 'Laptop học tập (Aspire)']
    },
    {
        key: 'dell',
        name: 'Dell',
        aliases: ['dell', 'xps', 'inspiron', 'vostro', 'alienware'],
        categories: ['Laptop văn phòng & Gaming (Inspiron, Vostro, XPS, G15)']
    },
    {
        key: 'hp',
        name: 'HP',
        aliases: ['hp', 'pavilion', 'envy', 'victus', 'omen'],
        categories: ['Laptop học tập & văn phòng (Pavilion, Envy)', 'Laptop Gaming (Victus)']
    },
    {
        key: 'lenovo',
        name: 'Lenovo',
        aliases: ['lenovo', 'thinkpad', 'legion', 'ideapad', 'loq'],
        categories: ['Laptop (IdeaPad Slim, ThinkPad, Legion)', 'Máy tính bảng (Tab M11)']
    },
    {
        key: 'msi',
        name: 'MSI',
        aliases: ['msi', 'katana', 'modern', 'stealth', 'cyborg', 'claw'],
        categories: ['Laptop Gaming (Katana, Modern, Stealth, Cyborg)']
    },
    {
        key: 'xiaomi',
        name: 'Xiaomi',
        aliases: ['xiaomi', 'redmi', 'mi', 'poco'],
        categories: ['Điện thoại Xiaomi', 'Tablet (Xiaomi Pad)', 'Đồng hồ thông minh', 'Tai nghe', 'Pin sạc']
    },
    {
        key: 'poco',
        name: 'POCO',
        aliases: ['poco'],
        categories: ['Điện thoại POCO', 'Tablet POCO Pad']
    },
    {
        key: 'oppo',
        name: 'OPPO',
        aliases: ['oppo', 'reno', 'find x'],
        categories: ['Điện thoại thông minh (Reno12, Find X8)']
    },
    {
        key: 'honor',
        name: 'HONOR',
        aliases: ['honor', 'magic'],
        categories: ['Điện thoại thông minh (HONOR 200, Magic6 Pro)']
    },
    {
        key: 'huawei',
        name: 'Huawei',
        aliases: ['huawei', 'matepad'],
        categories: ['Máy tính bảng (MatePad)', 'Đồng hồ thông minh (Watch GT4)']
    },
    {
        key: 'sony',
        name: 'Sony',
        aliases: ['sony', 'playstation', 'ps5', 'dualsense'],
        categories: ['Máy chơi game (PlayStation 5)', 'Tai nghe cao cấp (WH-1000XM5, WF-C700N)']
    },
    {
        key: 'jbl',
        name: 'JBL',
        aliases: ['jbl'],
        categories: ['Loa Bluetooth chống nước (Flip 6, Charge 5)', 'Tai nghe True Wireless (Tour Pro 2)']
    },
    {
        key: 'marshall',
        name: 'Marshall',
        aliases: ['marshall'],
        categories: ['Tai nghe & Loa thời trang (Emberton II, Major IV)']
    },
    {
        key: 'logitech',
        name: 'Logitech',
        aliases: ['logitech', 'logi'],
        categories: ['Chuột máy tính (MX Master 3S, G502)', 'Bàn phím cơ & không dây (MX Keys, POP Keys)']
    },
    {
        key: 'baseus',
        name: 'Baseus',
        aliases: ['baseus'],
        categories: ['Củ sạc nhanh GaN', 'Pin sạc dự phòng dung lượng cao']
    },
    {
        key: 'ugreen',
        name: 'UGREEN',
        aliases: ['ugreen'],
        categories: ['Hub chuyển đổi Type-C đa năng', 'Cáp sạc, phụ kiện']
    },
    {
        key: 'anker',
        name: 'Anker',
        aliases: ['anker'],
        categories: ['Củ sạc nhanh 100W/65W', 'Pin sạc dự phòng Anker Prime']
    },
    {
        key: 'garmin',
        name: 'Garmin',
        aliases: ['garmin'],
        categories: ['Đồng hồ thể thao chuyên nghiệp GPS (Forerunner 265, Venu 3)']
    },
    {
        key: 'nintendo',
        name: 'Nintendo',
        aliases: ['nintendo', 'switch'],
        categories: ['Máy chơi game cầm tay (Switch OLED, Switch Lite)']
    },
    {
        key: 'valve',
        name: 'Valve',
        aliases: ['valve', 'steam deck'],
        categories: ['Máy chơi game cầm tay PC (Steam Deck OLED, Dock)']
    },
    {
        key: 'meta',
        name: 'Meta',
        aliases: ['meta', 'oculus', 'quest'],
        categories: ['Kính thực tế ảo VR (Meta Quest 3, Quest 3S, Elite Strap)']
    },
    {
        key: 'microsoft',
        name: 'Microsoft',
        aliases: ['microsoft', 'surface'],
        categories: ['Máy tính bảng & Laptop 2-in-1 (Surface Pro 11, Surface Laptop Go 3)']
    },
    {
        key: 'dji',
        name: 'DJI',
        aliases: ['dji', 'osmo'],
        categories: ['Camera Gimbal 4K bỏ túi (Osmo Pocket 3)', 'Gimbal điện thoại chống rung (Osmo Mobile 6)']
    }
];

// Loại sản phẩm thực tế trong catalog. Các loại cụ thể phải đứng trước danh mục rộng
// để "bàn phím", "loa", "tay cầm"... không bị hiểu thành một từ khóa lạ.
const PRODUCT_TYPE_INTENTS = [
    { key: 'iphone', label: 'iPhone', aliases: ['iphone', 'ip', 'dt iphone', 'dien thoai iphone', 'tao khuyet'], category: 'Điện thoại', brand: 'Apple', name: /iphone/i },
    { key: 'galaxy', label: 'Samsung Galaxy', aliases: ['samsung galaxy', 'galaxy z', 'galaxy s', 'galaxy a', 'galaxy'], category: 'Điện thoại', brand: 'Samsung', name: /galaxy/i },
    { key: 'macbook', label: 'MacBook', aliases: ['macbook', 'mac book'], category: 'Laptop', brand: 'Apple', name: /macbook/i },
    { key: 'rog', label: 'ASUS ROG', aliases: ['asus rog', 'rog strix', 'laptop rog', 'rog'], category: 'Laptop', brand: 'ASUS', name: /rog/i },
    { key: 'ipad', label: 'iPad', aliases: ['ipad', 'ipads', 'may tinh bang ipad'], category: 'Tablet', brand: 'Apple', name: /ipad/i },
    { key: 'airpods', label: 'AirPods', aliases: ['airpods', 'airpod', 'air pods'], category: 'Tai nghe', brand: 'Apple', name: /airpods/i },
    { key: 'apple_watch', label: 'Apple Watch', aliases: ['apple watch', 'applewatch'], category: 'Đồng hồ thông minh', brand: 'Apple', name: /apple watch/i },
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
    { key: 'headphones', label: 'tai nghe', aliases: ['tai nghe', 'headphone', 'earbuds', 'headset', 'galaxy buds'], category: 'Tai nghe', name: /^tai nghe\b/i },
    { key: 'hearing_aid', label: 'máy trợ thính', aliases: ['may tro thinh', 'may nghe tro thinh', 'thiet bi tro thinh', 'tro thinh', 'hearing aid', 'hearing aids', 'nghe kem', 'kho nghe', 'nghenh ngang'], category: 'Máy trợ thính' },
    { key: 'smartwatch', label: 'đồng hồ thông minh', aliases: ['dong ho thong minh', 'smartwatch', 'galaxy watch', 'garmin watch', 'vong deo tay thong minh', 'dong ho'], category: 'Đồng hồ thông minh' },
    { key: 'console', label: 'máy chơi game', aliases: ['may choi game', 'playstation', 'ps5', 'nintendo switch', 'steam deck', 'rog ally'], category: 'Máy chơi game' },
    { key: 'tablet', label: 'máy tính bảng', aliases: ['may tinh bang', 'tablet', 'galaxy tab', 'matepad'], category: 'Tablet' },
    { key: 'laptop', label: 'laptop', aliases: ['laptop', 'may tinh xach tay', 'notebook'], category: 'Laptop' },
    { key: 'phone', label: 'điện thoại', aliases: ['dien thoai', 'smartphone'], category: 'Điện thoại' },
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
    // 0. Chuột hamster / thú cưng (Phân biệt với chuột máy tính)
    {
        id: 'pet_hamster',
        keywords: [
            'hamster', 'chuot hamster', 'chuột hamster', 'chuot bach', 'chuột bạch',
            'chuot lang', 'chuột lang', 'bo u', 'bọ ú', 'long hamster', 'lồng hamster',
            'chuong hamster', 'chuồng hamster', 'thuc an hamster', 'thức ăn hamster'
        ],
        name: 'chuột hamster / thú cưng',
        customReply: `Dạ bên em là cửa hàng chuyên về thiết bị công nghệ chính hãng nên em chưa có chuột hamster hay thú cưng đâu ạ! 🐹\n\nTuy nhiên, nếu bạn đang cần tìm **chuột máy tính** (chuột gaming, chuột không dây văn phòng) để phục vụ học tập và làm việc thì em luôn có sẵn những mẫu rất xịn nhé!`,
        suggestions: ['Chuột gaming Logitech', 'Chuột văn phòng không dây', 'Xem tất cả phụ kiện', 'Mã giảm giá hôm nay']
    },
    {
        id: 'pets_general',
        keywords: [
            'thu cung', 'thú cưng', 'cho canh', 'chó cảnh', 'meo canh', 'mèo cảnh',
            'pate meo', 'pate mèo', 'cat ve sinh', 'cát vệ sinh', 'long nuoi', 'lồng nuôi'
        ],
        name: 'thú cưng / phụ kiện thú cưng',
        customReply: `Dạ bên em chỉ chuyên kinh doanh các thiết bị công nghệ chính hãng (Điện thoại, Laptop, Tablet, Phụ kiện, Máy chơi game...) nên em chưa có mặt hàng này đâu ạ! 🙏 Nếu bạn cần tìm thiết bị công nghệ nào thì cứ bảo em nhé.`,
        suggestions: ['Tư vấn Laptop', 'Tư vấn Điện thoại', 'Xem Phụ kiện công nghệ', 'Mã giảm giá hôm nay']
    },
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
            return `Dạ chào bạn! Hiện tại cửa hàng chuyên phân phối các dòng **Đồng hồ thông minh (Smartwatch)** theo dõi sức khỏe và thể thao, nên cửa hàng **chưa có các mẫu đồng hồ kim hay đồng hồ cơ truyền thống**${brandMention} ạ. 🙏\n\n` +
                `Tuy nhiên, nếu bạn yêu thích một chiếc đồng hồ đeo tay bền bỉ, chống nước tốt, pin trâu và có thêm các tính năng công nghệ hiện đại (đo nhịp tim, giấc ngủ, định vị GPS, nhận cuộc gọi & thông báo):\n` +
                `• ⌚ **Garmin (Forerunner 265, Venu 3):** Độ bền chuẩn quân đội, pin trâu 7 - 14 ngày, GPS độc lập cực chuẩn cho thể thao ngoài trời — rất hợp với người thích phong cách bền bỉ như G-Shock.\n` +
                `• ⌚ **Apple Watch (Series 10, SE 2024):** Thiết kế thời thượng, nghe gọi trực tiếp, màn hình Retina sắc nét, đồng bộ tuyệt vời cùng iPhone.\n` +
                `• ⌚ **Samsung Galaxy Watch:** Mặt tròn cổ điển sang trọng, viền xoay tinh tế, theo dõi sức khỏe chuyên sâu cùng điện thoại Android.\n\n` +
                `👉 Bạn có muốn tham khảo các mẫu Smartwatch chính hãng này không, bạn chia sẻ mức ngân sách dự kiến để em tư vấn chi tiết cho bạn nhé! 😊`;
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
            return `Dạ chào bạn! Hiện tại cửa hàng **chưa phân phối dòng điện thoại**${brandMention} ạ. 🙏\n\n` +
                `Cửa hàng tập trung phân phối chính hãng 100% các dòng smartphone thế hệ mới nhất kèm chính sách bảo hành 1 đổi 1 và ưu đãi trả góp 0%:\n` +
                `• 📱 **Apple iPhone:** iPhone 16 / 15 Series (Hiệu năng dẫn đầu, quay phim chụp ảnh chuẩn studio, giữ giá tốt).\n` +
                `• 📱 **Samsung Galaxy:** Galaxy S25 / S24 Ultra, Galaxy Z Fold / Z Flip (Màn hình Dynamic AMOLED đỉnh cao, camera zoom 100x AI, bút S-Pen).\n` +
                `• 📱 **Xiaomi & OPPO:** Xiaomi 14, Redmi Note, Reno (Cấu hình vượt trội trong tầm giá, sạc siêu nhanh 67W - 120W, camera chân dung sắc nét).\n\n` +
                `👉 Bạn dự kiến mức ngân sách khoảng bao nhiêu và ưu tiên tiêu chí nào nhất (chụp ảnh, pin trâu, hay chơi game mượt mà) để em gợi ý mẫu máy tối ưu nhất cho bạn nhé! 😊`;
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
            return `Dạ chào bạn! Hiện tại cửa hàng **chưa phân phối dòng laptop**${brandMention} ạ. 🙏\n\n` +
                `Tuy nhiên, nếu bạn đang tìm kiếm laptop Gaming cấu hình khủng hoặc ultrabook mỏng nhẹ cao cấp, cửa hàng có sẵn các dòng chính hãng tương đương cực kỳ mạnh mẽ kèm bảo hành chính hãng tại Việt Nam:\n` +
                `• 💻 **Laptop Gaming / Đồ họa hiệu năng cao:** **ASUS ROG Strix / TUF Gaming**, **Acer Nitro V**, **Lenovo Legion**, **MSI Cyborg** (Card đồ họa RTX 40 Series, tản nhiệt buồng hơi mát rượi, màn hình 144Hz - 240Hz).\n` +
                `• 💻 **Laptop Mỏng nhẹ / Cao cấp / Văn phòng:** **MacBook Air / Pro M3**, **Dell XPS / Inspiron**, **HP Envy / Pavilion**, **Lenovo IdeaPad Slim** (Pin bền cả ngày, màn hình sắc nét, thiết kế sang trọng).\n\n` +
                `👉 Bạn có thể chia sẻ mức ngân sách dự kiến và nhu cầu dùng máy (học tập, lập trình, đồ họa hay chiến game gì) để em chọn mẫu tối ưu nhất cho bạn nhé! 😊`;
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
            return `Dạ chào bạn! Hiện tại cửa hàng **chưa có các mẫu tai nghe/loa của thương hiệu**${brandMention} ạ. 🙏\n\n` +
                `Cửa hàng hiện phân phối chính hãng các thương hiệu âm thanh hàng đầu với chất âm đỉnh cao và khả năng chống ồn chủ động xuất sắc:\n` +
                `• 🎧 **Sony:** **WH-1000XM5** (Chống ồn chủ động số 1 thế giới, chất âm Hi-Res chi tiết), WF-C700N.\n` +
                `• 🎧 **Apple & Samsung:** **AirPods Pro 2** (Âm thanh không gian Spatial Audio, khử ồn đỉnh cao), **Galaxy Buds**.\n` +
                `• 🔊 **Marshall & JBL:** **Marshall Major IV / Emberton II** (Thiết kế hoài cổ cá tính, âm thanh mộc mạc đặc trưng, pin 30h+), **JBL Charge 5 / Flip 6** (Bass uy lực, chống nước IP67 bền bỉ).\n\n` +
                `👉 Bạn đang tìm tai nghe chụp tai (Over-ear) chống ồn hay tai nghe nhét tai nhỏ gọn (In-ear), và tầm giá khoảng bao nhiêu để em tư vấn cho bạn nhé! 😊`;
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
            return `Dạ chào bạn! Hiện tại cửa hàng **chưa phân phối dòng bàn phím cơ của thương hiệu**${brandMention} ạ. 🙏\n\n` +
                `Nếu bạn đang tìm kiếm bàn phím gõ êm ái, kết nối không dây ổn định cho công việc lập trình, văn phòng hoặc chơi game, Cửa hàng có sẵn các mẫu chính hãng cực kỳ được ưa chuộng:\n` +
                `• ⌨️ **Logitech:** **Logitech MX Keys / MX Mechanical** (Chuẩn mực cao cấp cho dân văn phòng và lập trình, gõ siêu đầm tay, kết nối 3 thiết bị cùng lúc), **POP Keys** (Thiết kế cá tính, switch gõ ròn tan vui tai).\n` +
                `• ⌨️ **Dareu:** Bàn phím cơ Dareu gõ êm, đèn LED RGB rực rỡ, độ bền cao với mức giá học sinh sinh viên rất hợp lý.\n` +
                `• 🖱️ Kết hợp hoàn hảo cùng chuột công thái học **Logitech MX Master 3S** (Cuộn vô cực siêu nhanh, êm ái không tiếng ồn).\n\n` +
                `👉 Bạn thích phong cách bàn phím cơ gõ nảy hay bàn phím mỏng nhẹ văn phòng, bạn nhắn em để em gửi chi tiết nhé! 😊`;
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
            return `Dạ chào bạn! Hiện tại cửa hàng **chưa kinh doanh dòng máy ảnh / máy chụp hình độc lập**${brandMention} (như máy ảnh Canon, Nikon, Fujifilm, DSLR hay Mirrorless) ạ. 🙏\n\n` +
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
        customReply: `Dạ chào bạn! Hiện tại cửa hàng **chưa kinh doanh dòng máy đọc sách màn hình E-Ink (như Kindle, Kobo, Boox)** ạ. 🙏\n\n` +
            `Nếu bạn cần một thiết bị màn hình đẹp, gọn nhẹ để đọc tài liệu, học tập, ghi chú bút cảm ứng và đọc sách với chế độ bảo vệ mắt (Eye Comfort / Reading Mode):\n` +
            `• 📲 **iPad (iPad Gen 10, iPad Air M2):** Màn hình Retina sắc nét, hỗ trợ Apple Pencil ghi chú trực tiếp lên tài liệu, kho ứng dụng học tập và đọc sách phong phú.\n` +
            `• 📲 **Samsung Galaxy Tab & Huawei MatePad:** Màn hình sắc nét, có sẵn chế độ bảo vệ mắt đọc sách ban đêm không mỏi, pin trâu và giá rất mềm.\n\n` +
            `👉 Bạn có muốn tham khảo các mẫu máy tính bảng học tập và đọc sách này không, em tư vấn cho bạn nhé! 😊`,
        suggestions: ['iPad học tập & ghi chép', 'Samsung Galaxy Tab giá tốt', 'Máy tính bảng dưới 10 triệu']
    },

    // 8. Máy chơi game đời cũ / ngoài hệ thống
    {
        id: 'legacy_consoles',
        keywords: ['xbox', 'xbox series', 'ps2', 'ps3', 'ps4', 'psp', 'ps vita', 'nintendo 3ds', 'game boy'],
        name: 'dòng máy chơi game này',
        customReply: `Dạ chào bạn! Hiện tại shop tập trung phân phối các dòng máy chơi game thế hệ mới chính hãng, nên em **chưa kinh doanh các dòng máy như Xbox hay máy game đời cũ** ạ. 🙏\n\n` +
            `Shop hiện có sẵn các hệ máy chơi game thế hệ mới cực hot:\n` +
            `• 🎮 **Sony PlayStation 5 Slim (PS5):** Đồ họa 4K đỉnh cao, ổ cứng SSD siêu tốc, tay cầm DualSense phản hồi xúc giác chân thực.\n` +
            `• 🎮 **Nintendo Switch OLED:** Màn hình OLED rực rỡ, chơi di động linh hoạt hoặc cắm TV chơi cùng gia đình và bạn bè.\n` +
            `• 🎮 **Steam Deck OLED:** Cỗ máy chơi game PC cầm tay mạnh mẽ, chơi mượt mà thư viện game Steam mọi lúc mọi nơi.\n\n` +
            `👉 Bạn đang quan tâm đến dòng máy chơi game cầm tay hay cắm TV, bạn nhắn em để em hỗ trợ nhé! 😊`,
        suggestions: ['PlayStation 5 Slim', 'Nintendo Switch OLED', 'Steam Deck OLED', 'Tư vấn máy chơi game']
    },

    // 9. iPhone đời cũ
    {
        id: 'legacy_iphones',
        keywords: ['iphone 4', 'iphone 5', 'iphone 6', 'iphone 7', 'iphone 8', 'iphone x', 'iphone xs', 'iphone xr', 'iphone 11', 'iphone 12', 'iphone 13'],
        name: 'dòng iPhone đời cũ này',
        customReply: `Dạ chào bạn! Hiện tại cửa hàng chuyên phân phối **100% máy mới chính hãng VN/A**, nên em **đã ngừng kinh doanh các dòng iPhone đời cũ này** để đảm bảo trải nghiệm pin và linh kiện bền bỉ nhất cho khách hàng ạ. 🙏\n\n` +
            `Hiện tại cửa hàng có sẵn các dòng iPhone thế hệ mới với ưu đãi cực tốt và hỗ trợ trả góp 0%:\n` +
            `• 📱 **iPhone 16 Series:** iPhone 16, 16 Plus, 16 Pro, 16 Pro Max (Chip A18 mạnh mẽ, Camera Control, Apple Intelligence).\n` +
            `• 📱 **iPhone 15 Series:** iPhone 15, 15 Plus, 15 Pro, 15 Pro Max (Cổng sạc Type-C, Dynamic Island, camera 48MP sắc nét).\n\n` +
            `👉 Bạn có muốn tham khảo các mẫu iPhone chính hãng này trong tầm ngân sách khoảng bao nhiêu để em tư vấn chi tiết cho bạn nhé! 😊`,
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

    // Bắt trường hợp chuột thú cưng / hamster
    if (/chuột|chuot/i.test(norm) && /hamster|thu cung|nuoi|long|chuong|bach|lang|bo u/i.test(norm)) {
        return KNOWN_UNSUPPORTED_ITEMS.find(it => it.id === 'pet_hamster') || null;
    }

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
        `Dạ chào bạn! Hiện tại cửa hàng bên em chuyên về **thiết bị công nghệ thông minh cá nhân**, nên cửa hàng chưa kinh doanh ${itemLabel} ạ. 🙏\n\n` +
        `Cửa hàng hiện phân phối chính hãng các dòng sản phẩm công nghệ cao cấp:\n` +
        `• 📱 **Điện thoại:** iPhone 16 / 15 Series, Samsung Galaxy S25 / S24, Xiaomi, OPPO...\n` +
        `• 💻 **Laptop:** MacBook Air / Pro M3, ASUS ROG, Acer Nitro, Lenovo IdeaPad, Dell Inspiron...\n` +
        `• 📲 **Tablet:** iPad Pro M4, iPad Air M2, Samsung Galaxy Tab, HONOR Pad...\n` +
        `• ⌚ **Đồng hồ thông minh:** Apple Watch Series 10, Galaxy Watch, Garmin GPS...\n` +
        `• 🎮 **Máy chơi game:** PlayStation 5 Slim, Nintendo Switch OLED, Steam Deck OLED...\n` +
        `• 🎧 **Tai nghe & Phụ kiện:** AirPods Pro 2, chuột Logitech MX Master 3S, củ sạc Anker 100W...\n\n` +
        `👉 Nếu bạn có nhu cầu tìm hiểu bất kỳ sản phẩm công nghệ nào ở trên, bạn nhắn em để em tư vấn chi tiết cho bạn nhé! 😊`
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

const NUMBER_WORDS_MAP = {
    'nua': 0.5,
    'mot': 1,
    'hai': 2,
    'ba': 3,
    'bon': 4,
    'tu': 4,
    'nam': 5,
    'lam': 5,
    'sau': 6,
    'bay': 7,
    'tam': 8,
    'chin': 9,
    'muoi': 10,
    'muoi mot': 11,
    'muoi hai': 12,
    'muoi ba': 13,
    'muoi bon': 14,
    'muoi tu': 14,
    'muoi lam': 15,
    'muoi nam': 15,
    'muoi sau': 16,
    'muoi bay': 17,
    'muoi tam': 18,
    'muoi chin': 19,
    'hai muoi': 20,
    'hai chuc': 20,
    'hai lam': 25,
    'hai muoi lam': 25,
    'hai muoi nam': 25,
    'ba muoi': 30,
    'ba chuc': 30,
    'ba lam': 35,
    'ba muoi lam': 35,
    'ba muoi nam': 35,
    'bon muoi': 40,
    'bon chuc': 40,
    'nam muoi': 50,
    'nam chuc': 50
};

const NUMBER_WORDS_REGEX_PART = Object.keys(NUMBER_WORDS_MAP)
    .sort((a, b) => b.length - a.length)
    .join('|');

function parseNumberToken(token) {
    if (!token) return null;
    const clean = String(token).trim();
    if (NUMBER_WORDS_MAP[clean] !== undefined) return NUMBER_WORDS_MAP[clean];
    if (/^\d+(?:[.,]\d+)?$/.test(clean)) return parseFloat(clean.replace(',', '.'));
    return null;
}

function extractBudget(text) {
    const norm = normalizeText(text);

    // 0. 'nửa triệu', 'nửa củ'
    if (/\bnua\s+(?:trieu|cu|tr)\b/i.test(norm)) return 500000;

    // 'triệu rưỡi', 'củ rưỡi' độc lập (không có số phía trước)
    const ruoiStandaloneRegex = new RegExp(`(?:${NUMBER_WORDS_REGEX_PART}|\\d+)\\s*(?:trieu|cu|tr)\\s+ruoi`, 'i');
    if (/\b(?:trieu|cu|tr)\s+ruoi\b/i.test(norm) && !ruoiStandaloneRegex.test(norm)) {
        return 1500000;
    }

    // 1. [X] triệu rưỡi / củ rưỡi (X là số hoặc từ: 'một triệu rưỡi', '1 triệu rưỡi', '2 củ rưỡi')
    const ruoiRegex = new RegExp(`\\b(${NUMBER_WORDS_REGEX_PART}|\\d+(?:[.,]\\d+)?)\\s*(?:trieu|tr|cu|m)\\s+ruoi\\b`, 'i');
    const ruoiMatch = norm.match(ruoiRegex);
    if (ruoiMatch) {
        const val = parseNumberToken(ruoiMatch[1]);
        if (val !== null && val > 0 && val < 1000) return Math.round((val + 0.5) * 1000000);
    }

    // 2. Dạng 1tr5, 2tr5, 15tr5
    const trMatch = norm.match(/(\d+)\s*(?:tr|trieu|cu)\s*(\d+)\b/i);
    if (trMatch) {
        const millions = Number(trMatch[1]) * 1000000;
        const sub = Number(trMatch[2]);
        const fraction = sub < 10 ? sub * 100000 : (sub < 100 ? sub * 10000 : sub);
        return millions + fraction;
    }

    // 3. [X] triệu / tr / m / củ (X là số hoặc từ: 'một triệu', 'hai triệu', '10 triệu', '1.5 triệu', '2 củ')
    const trieuRegex = new RegExp(`\\b(${NUMBER_WORDS_REGEX_PART}|\\d+(?:[.,]\\d+)?)\\s*(?:trieu|tr|cu|m)\\b`, 'i');
    const trieuMatch = norm.match(trieuRegex);
    if (trieuMatch) {
        const val = parseNumberToken(trieuMatch[1]);
        if (val !== null && val > 0 && val < 1000) return Math.round(val * 1000000);
    }

    // 4. [X] trăm nghìn / trăm ngàn / trăm k
    const tramRegex = new RegExp(`\\b(${NUMBER_WORDS_REGEX_PART}|\\d+)\\s*tram\\s*(?:nghin|ngan|k)?\\b`, 'i');
    const tramMatch = norm.match(tramRegex);
    if (tramMatch) {
        const val = parseNumberToken(tramMatch[1]);
        if (val !== null && val > 0 && val < 100) return Math.round(val * 100000);
    }

    // 5. Dạng 500k, 800k, 1500k, 500 nghìn, 500 ngàn
    const kMatch = norm.match(/(?:duoi|tam|khoang|ngan sach|budget|tam gia|gia|chi co)?\s*(\d{2,5})\s*(?:k|ngan|nghin)\b/i);
    if (kMatch) {
        return Number(kMatch[1]) * 1000;
    }

    // 6. Dạng số tiền VND viết đầy đủ: '500.000', '1.500.000', '500,000', '500000', '500000d', '500.000 vnd'
    const rawNumber = norm.match(/(?:duoi|toi da|tam|khoang|ngan sach|budget|tam gia|chi co|khong qua|gia)?\s*(\d[\d.,\s]{4,})\s*(?:d|dong|vnd)?\b/i);
    if (rawNumber) {
        const digits = rawNumber[1].replace(/[^\d]/g, '');
        if (digits.length >= 5 && digits.length <= 9) return Number(digits);
    }

    return null;
}

function extractBudgetInfo(text) {
    if (!text) return null;
    try {
        const parsed = nlu.parseBudget(text);
        if (parsed) {
            return {
                amount: parsed.target || parsed.max || parsed.min,
                min: parsed.min,
                max: parsed.max,
                target: parsed.target,
                type: parsed.type || (parsed.min && !parsed.max ? 'min' : (parsed.max ? 'max' : 'exact')),
                confidence: parsed.confidence
            };
        }
    } catch (_) {}

    const amount = extractBudget(text);
    if (!amount) return null;
    const norm = normalizeText(text);
    if (/\b(tren|hon|toi thieu|tu|>=|>)\b/i.test(norm) && !/den|toi|-/.test(norm)) {
        return { amount, min: amount, max: null, target: amount, type: 'min', confidence: 0.85 };
    }
    if (/\b(duoi|toi da|quay dau|do lai|tro xuong|<=|<)\b/i.test(norm)) {
        return { amount, min: null, max: amount, target: amount, type: 'max', confidence: 0.85 };
    }
    return { amount, min: null, max: amount, target: amount, type: 'exact', confidence: 0.8 };
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
            'may tinh van phong', 'may tinh xach tay', 'may tinh ca nhan', 'may van phong', 'may hoc tap',
            'mua laptop', 'can laptop', 'laptop mong nhe', 'laptop gaming'
        ]],
        ['Điện thoại', [
            'dien thoai', 'smartphone', 'iphone', 'galaxy s', 'galaxy z', 'galaxy fold', 'galaxy flip',
            'xiaomi', 'oppo', 'poco', 'dtdd', 'di dong'
        ]],
        ['Tai nghe', [
            'tai nghe', 'airpods', 'headphone', 'earbuds', 'headset', 'galaxy buds'
        ]],
        ['Máy trợ thính', [
            'may tro thinh', 'may nghe tro thinh', 'thiet bi tro thinh', 'tro thinh', 'hearing aid', 'hearing aids',
            'nghe kem', 'kho nghe', 'nghenh ngang'
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
    return CATALOG_BRANDS.find(b => {
        if (hasWordOrPhrase(norm, b.key)) return true;
        if (Array.isArray(b.aliases) && b.aliases.some(a => hasWordOrPhrase(norm, a))) return true;
        return false;
    }) || null;
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
            const matchedBrand = CATALOG_BRANDS.find(b => {
                if (candidate.includes(b.key)) return true;
                if (Array.isArray(b.aliases) && b.aliases.some(a => candidate.includes(a))) return true;
                return false;
            });
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
        ['chơi game giải trí', ['choi game', 'chien game', 'game', 'gaming', 'game nang', 'game muot', 'cau hinh manh', 'hieu nang manh', 'chip manh', 'fps', 'lien minh', 'genshin', 'valorant', 'steam']],
        ['di chuyển nhiều & mỏng nhẹ', ['di chuyen', 'mang di hoc', 'mang di lam', 'nhe', 'mong nhe', 'pin trau', 'pin ca ngay', 'pin lau', 'dung lau']],
        ['chụp ảnh & quay video', ['chup anh', 'quay phim', 'sac net', 'quay video', 'camera', 'vlog', 'tiktok', 'selfie', 'chup hinh', 'song ao', 'chup dep']]
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

function isCheaperRequest(text) {
    const norm = normalizeText(text);
    return /\b(re hon|re hon nua|re nua|re nhat|thap hon|tiet kiem hon|bot tien|gia mem hon|gia re hon|co con nao re|co mau nao re|co cai nao re|con nao re|mau nao re|cai nao re|co re hon|co dong nao re|dong nao re)\b/i.test(norm)
        || /\b(dat qua|hoi dat|gia cao qua|hoi cao|vuot ngan sach|nhieu tien qua|it tien|khong du tien|khong du kinh phi)\b/i.test(norm);
}

function isPriceObjection(text) {
    return isCheaperRequest(text);
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
    // Don't treat specific product lines (iphone, macbook, etc.) as brand-only query
    if (/\b(iphone|macbook|ipad|airpods|apple watch|galaxy|rog)\b/i.test(norm)) return false;
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
    { terms: ['z fold7', 'z fold 7', 'galaxy z fold7', 'galaxy z fold 7', 'samsung z fold7', 'samsung z fold 7', 'fold7', 'fold 7'], match: /z fold7/i },
    { terms: ['s26 ultra', 's26ultra', 'galaxy s26 ultra', 'samsung s26 ultra', 'samsung galaxy s26 ultra'], match: /s26 ultra/i },
    { terms: ['s25 ultra', 's25ultra', 'galaxy s25 ultra', 'samsung s25 ultra', 'samsung galaxy s25 ultra'], match: /s25 ultra/i },
    { terms: ['s25 plus', 's25plus', 's25+', 'galaxy s25 plus', 'samsung s25 plus', 'samsung galaxy s25 plus'], match: /s25 plus|s25\+/i },
    { terms: ['s25', 'galaxy s25', 'samsung s25'], match: /s25 ultra/i },
    { terms: ['galaxy a55', 'samsung a55', 'a55 5g', 'a55'], match: /a55/i },
    { terms: ['galaxy a05s', 'samsung a05s', 'a05s', 'a05'], match: /a05s|a05/i },

    // --- Apple Phones ---
    { terms: ['iphone 17 pro max', '17 pro max', '17promax', 'ip 17 pro max', 'ip 17promax', 'ip17 pro max'], match: /iphone 17 pro max/i },
    { terms: ['iphone 17 pro', '17 pro', '17pro', 'ip 17 pro', 'ip17 pro', 'iphone 17'], match: /^((?!max).)*iphone 17 pro/i },
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
    { terms: ['find x8 pro', 'oppo find x8 pro', 'findx8 pro'], match: /find x8 pro/i },
    { terms: ['find x8', 'oppo find x8', 'findx8'], match: /^((?!pro).)*find x8/i },
    { terms: ['oppo a79', 'a79 5g', 'a79'], match: /a79/i },

    // --- HONOR Phones ---
    { terms: ['magic7 pro', 'magic 7 pro', 'honor magic7 pro', 'honor magic 7 pro', 'magic7'], match: /magic7 pro/i },
    { terms: ['honor 200', 'honor 200 5g'], match: /honor 200/i },
    { terms: ['honor x8b', 'x8b'], match: /honor x8b/i },

    // --- MacBooks & Laptops ---
    { terms: ['macbook air m3', 'mac air m3', 'macbook m3'], match: /macbook air.*m3/i },
    { terms: ['macbook air m2', 'mac air m2', 'macbook air', 'mac air', 'macbook m2'], match: /macbook air.*m2/i },
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
    { terms: ['ipad pro m4', 'ipad pro 11', 'ipad pro 11inch', 'ipad pro 11 inch', 'ipad pro', 'pro m4', 'pro 11', 'pro 11inch'], match: /ipad pro 11/i },
    { terms: ['ipad air m2', 'ipad air 11', 'ipad air 11inch', 'ipad air 11 inch', 'ipad air', 'air m2', 'air 11', 'air 11inch', 'air 11 inch'], match: /ipad air/i },
    { terms: ['ipad gen 10', 'ipad 10', 'gen 10', 'gen10', 'ipad gen10', 'ipad 10.9', 'ipad 10th'], match: /ipad gen 10/i },
    { terms: ['tab s9 ultra', 'galaxy tab s9'], match: /tab s9 ultra/i },
    { terms: ['matepad 11.5', 'matepad'], match: /matepad/i },
    { terms: ['xiaomi pad 8', 'pad 8 pro', 'pad 8'], match: /xiaomi pad 8 pro/i },
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
    const directNameMatches = [...allActive]
        .filter(product => product.name && norm.includes(normalizeText(product.name)))
        .sort((a, b) => (b.name || '').length - (a.name || '').length);

    // Kiểm tra bảng alias ánh xạ trực tiếp các model phổ biến
    const aliasMatches = [];
    for (const alias of PRODUCT_EXACT_ALIASES) {
        if (alias.terms.some(term => {
            const escaped = escapeRegex(term);
            const regex = new RegExp(`(^|\\s|[.,!?;:()"])${escaped}($|\\s|[.,!?;:()"])`, 'i');
            return regex.test(norm);
        })) {
            const p = await Product.findOne({ active: { $ne: false }, name: alias.match });
            if (p) {
                if (!aliasMatches.some(item => String(item._id) === String(p._id))) aliasMatches.push(p);
            }
        }
    }

    if (directNameMatches.length >= 2) return directNameMatches;
    if (aliasMatches.length >= 2) return aliasMatches;

    // Kết hợp directNameMatches và aliasMatches nếu mỗi bên tìm được 1 sản phẩm
    const combinedMatches = [...directNameMatches];
    for (const p of aliasMatches) {
        if (!combinedMatches.some(item => String(item._id) === String(p._id))) {
            combinedMatches.push(p);
        }
    }
    if (combinedMatches.length >= 2) return combinedMatches;
    if (aliasMatches.length) return aliasMatches;
    if (directNameMatches.length) return directNameMatches;

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

    const reply = `Chào bạn! Cửa hàng bên em là đại lý ủy quyền chính hãng của **${brandName}** tại Việt Nam. 🌟\n\n` +
        `Hiện tại cửa hàng có sẵn các dòng sản phẩm **${brandName}** chính hãng sau đây:\n` +
        `${catListText}\n\n` +
        `👉 Bạn đang quan tâm đến dòng thiết bị nào của ${brandName} (ví dụ: Điện thoại, Laptop hay Phụ kiện) để em tư vấn cấu hình và mức giá tốt nhất cho bạn nhé!`;

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
            reply: `Dạ chào bạn! Hiện tại cửa hàng chưa phân phối dòng **${category}** của thương hiệu **${brandName}** ạ. 🙏\n\n` +
                `Cửa hàng hiện có sẵn các thương hiệu hàng đầu trong danh mục **${category}** với chính sách bảo hành chính hãng và hỗ trợ trả góp 0%.\n\n` +
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

    const reply = `Dạ tuyệt vời ạ! Với dòng **${category} ${brandName} chính hãng** tại cửa hàng, hiện cửa hàng có sẵn các dòng từ phổ thông đến flagship cao cấp (bảo hành 12 - 24 tháng, hỗ trợ trả góp 0%):\n\n` +
        `${breakdownText}` +
        `👉 Bạn đang quan tâm dòng **cao cấp** hay **tầm trung / phổ thông**, hoặc bạn có khoảng ngân sách dự kiến bao nhiêu để em tư vấn cấu hình phù hợp nhất cho bạn nhé! 😊`;

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
        products: finalProducts,
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
async function handleExactProductLookup(product, context = {}, userMessage = '') {
    const s = product.specs || {};
    const stockStatus = product.stock > 0
        ? `✅ **Tình trạng:** Sẵn hàng tại kho (**còn ${product.stock} sản phẩm** chính hãng)`
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

    const warrantyInfo = (!product.warranty || product.warranty === 'Không bảo hành' || product.warranty === 'Chưa có thông tin')
        ? 'Bảo hành chính hãng 12 - 24 tháng, lỗi 1 đổi 1 trong 30 ngày đầu'
        : (product.warranty.toLowerCase().startsWith('bảo hành') || product.warranty.toLowerCase().startsWith('chính hãng')
            ? product.warranty
            : `Bảo hành chính hãng ${product.warranty}`);

    const installmentEstimate = Math.round((product.price * 0.7) / 12);

    const defaultReply = `Dạ có sẵn thông tin chính xác về **${product.name}** tại cửa hàng đây ạ! 🎯\n\n` +
        `• 💰 **Giá bán chính hãng:** **${money(product.price)}** ${product.compareAtPrice > product.price ? `(Giá gốc: ~~${money(product.compareAtPrice)}~~, tiết kiệm ${money(product.compareAtPrice - product.price)})` : ''}\n` +
        `${stockStatus}\n` +
        `• 🛡️ **Bảo hành:** ${warrantyInfo}\n` +
        `• 💳 **Trả góp 0%:** Chỉ từ **${money(installmentEstimate)}/tháng** (duyệt hồ sơ CCCD 15 phút)\n\n` +
        `📋 **Cấu hình nổi bật:**\n${keySpecs}\n\n` +
        `👉 Bạn có muốn em hỗ trợ **thêm sản phẩm này vào giỏ hàng**, tính chi tiết bảng trả góp 0%, hay so sánh với mẫu máy tương đương không ạ?`;

    const queryText = userMessage || context.currentMessage || `Tư vấn chi tiết về sản phẩm ${product.name}`;
    const grounded = await aiModelService.generateGroundedConsultation({
        userMessage: queryText,
        dialogueAct: 'exact_lookup',
        verifiedProducts: [product],
        context: {
            ...context,
            category: product.category,
            brand: product.brand
        },
        fallbackText: defaultReply
    });

    return {
        reply: grounded.reply,
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
        },
        meta: {
            provider: grounded.provider,
            model: grounded.model,
            isFallback: grounded.isFallback
        }
    };
}

function detectProductType(text) {
    const norm = normalizeText(text);
    const isPetMouse = /hamster|bach|lang|thu cung|nuoi|long|chuong|bo u/i.test(norm);
    return PRODUCT_TYPE_INTENTS.find(type => {
        if (type.key === 'mouse' && isPetMouse) return false;
        return type.aliases.some(alias => hasWordOrPhrase(text, alias));
    }) || null;
}

function buildDynamicCategoryChips(productType, category = '') {
    const pKey = productType?.key || '';
    const cat = productType?.category || category || '';

    if (pKey === 'mouse' || (cat === 'Phụ kiện' && /chuột|mouse/i.test(productType?.label || ''))) {
        return ['Chuột dưới 1 triệu', 'Chuột 1 - 2 triệu', 'Chuột gaming Logitech', 'Chuột không dây văn phòng'];
    }
    if (pKey === 'keyboard' || (cat === 'Phụ kiện' && /bàn phím|keyboard/i.test(productType?.label || ''))) {
        return ['Bàn phím cơ Gaming', 'Bàn phím không dây văn phòng', 'Bàn phím dưới 2 triệu', 'Bàn phím Logitech MX'];
    }
    if (pKey === 'power_bank') {
        return ['Pin sạc dưới 500k', 'Pin sạc 500k - 1.5 triệu', 'Pin sạc 20.000mAh', 'Sạc nhanh 65W - 100W'];
    }
    if (pKey === 'charger') {
        return ['Củ sạc dưới 500k', 'Củ sạc nhanh Anker 100W', 'Củ sạc GaN nhiều cổng', 'Săn mã giảm giá'];
    }
    if (pKey === 'headphones' || pKey === 'airpods' || cat === 'Tai nghe') {
        return ['Tai nghe dưới 1 triệu', 'Tai nghe 1 - 3 triệu', 'Tai nghe chống ồn ANC', 'AirPods chính hãng'];
    }
    if (pKey === 'smartwatch' || pKey === 'apple_watch' || cat === 'Đồng hồ thông minh') {
        return ['Đồng hồ dưới 5 triệu', 'Đồng hồ 5 - 10 triệu', 'Apple Watch chính hãng', 'Đồng hồ thể thao Garmin'];
    }
    if (pKey === 'console' || cat === 'Máy chơi game') {
        return ['PlayStation 5 Slim', 'Nintendo Switch OLED', 'Steam Deck OLED', 'Tay cầm chơi game'];
    }
    if (pKey === 'macbook' || pKey === 'rog' || cat === 'Laptop') {
        return ['Laptop dưới 15 triệu', 'Laptop 15 - 25 triệu', 'Laptop trên 25 triệu', 'Laptop Gaming đồ họa'];
    }
    if (pKey === 'iphone' || pKey === 'galaxy' || cat === 'Điện thoại') {
        return ['Điện thoại dưới 10 triệu', 'Điện thoại 10 - 20 triệu', 'Điện thoại trên 20 triệu', 'iPhone 16 chính hãng'];
    }
    if (cat === 'Phụ kiện') {
        return ['Phụ kiện dưới 500k', 'Phụ kiện 500k - 1.5 triệu', 'Chuột & Bàn phím', 'Pin sạc dự phòng'];
    }
    return ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Phụ kiện chính hãng', 'Săn mã giảm giá'];
}

function extractBrandPreference(message) {
    const mention = extractBrandMention(message);
    if (mention?.name) return mention.name;

    const norm = normalizeText(message);
    const NO_PREF_PATTERNS = [
        /\b(hang nao cung duoc|thuong hieu nao cung duoc|khong quan trong thuong hieu|khong quan trong hang|khong co|sao cung duoc|tuy ban|tuy shop|nao cung duoc|deu duoc|hang nao cung oke|khong ken hang|khong quan tam hang|hang gi cung duoc|khong uu tien hang|khong|tat ca)\b/i
    ];
    if (NO_PREF_PATTERNS.some(p => p.test(norm))) {
        return 'Tất cả thương hiệu';
    }
    return '';
}

function isAvailabilityQuery(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    const norm = normalizeText(text);

    if (/\b(?:có|còn)\s+bán\b/i.test(t)) return true;
    if (/\b(?:cơ|căn)\s+bản\b/i.test(t)) return false;

    if (/\b(?:nhu\s+cau|dung|tac\s+vu|muc\s+dich|chi\s+can|may|hoc)\s+co\s+ban\b/i.test(norm)) {
        return false;
    }

    return (
        /\b(?:co|con)\s+ban\b.*\b(?:khong|ko|khong\s+a|khong\s+vay|chua|a|ha)\b/i.test(norm) ||
        /\b(?:ban|shop|cua\s+hang|ben\s+ban|ben\s+em|o\s+day)\s+(?:co|con)\s+ban\b/i.test(norm) ||
        /\b(?:co|con)\s+(?:san\s+pham|hang|hang\s+khong|may|laptop|dien\s+thoai|ban\s+phim|chuot|tai\s+nghe|dong\s+ho|sac)\b/i.test(norm) ||
        /\b(?:ban|shop|cua\s+hang|ben\s+ban|ben\s+em|o\s+day)\s+(?:co|con)\b.*\b(?:khong|ko|khong\s+a|chua|a|ha)\b/i.test(norm)
    );
}

function extractQualificationUseCase(text) {
    if (isAvailabilityQuery(text)) return '';
    const detected = extractUseCase(text);
    if (detected) return detected;
    const norm = normalizeText(text);
    if (/\b(?:cơ\s+bản|căn\s+bản)\b/i.test(text) || /\b(?:nhu\s+cau|dung|tac\s+vu|muc\s+dich|chi\s+can|may)\s+co\s+ban\b/i.test(norm)) {
        return 'sử dụng hằng ngày & cơ bản';
    }
    const cases = [
        ['nghe nhạc & giải trí', ['nghe nhac', 'xem phim', 'giai tri', 'tiktok', 'youtube']],
        ['đàm thoại & họp trực tuyến', ['dam thoai', 'goi dien', 'hop online', 'micro tot', 'nghe goi']],
        ['làm việc văn phòng', ['lam viec', 'van phong', 'go van ban', 'excel', 'word', 'cong viec', 'ke toan', 'marketing']],
        ['học tập sinh viên / văn phòng', ['sinh vien', 'hoc sinh', 'hoc tap', 'di hoc', 'hoc online']],
        ['chăm sóc sức khỏe & thể thao', ['suc khoe', 'the thao', 'chay bo', 'gym', 'gps']],
        ['chơi game giải trí', ['choi game', 'game', 'gaming', 'fps', 'lien quan', 'pubg', 'genshin', 'game nang']],
        ['chụp ảnh & quay video', ['chup anh', 'quay video', 'camera', 'vlog', 'selfie', 'chup hinh', 'song ao']],
        ['sử dụng hằng ngày & cơ bản', ['hang ngay', 'pho thong', 'deu duoc', 'binh thuong', 'luot web', 'xem tin tuc', 'sao cung duoc', 'khong co gi dac biet', 'can ban', 'nhu cau co ban']]
    ];
    return cases.find(([, keywords]) => keywords.some(keyword => norm.includes(keyword)))?.[0] || '';
}

function extractQualificationPreference(text) {
    const norm = normalizeText(text);
    const preferences = [
        ['camera đẹp', ['camera', 'chup anh', 'quay phim', 'sac net', 'selfie', 'chup dep', 'chup hinh', 'quay phim sac net', 'chup anh quay phim']],
        ['hiệu năng mạnh', ['hieu nang', 'cau hinh', 'cau hinh manh', 'chien game', 'manh', 'muot', 'gaming', 'choi game', 'chip manh', 'ram lon', 'toc do', 'game muot']],
        ['pin lâu & bền bỉ', ['pin trau', 'pin lau', 'dung lau', 'thoi luong pin', 'uu tien pin', 'sac nhanh', 'pin']],
        ['mỏng nhẹ, dễ mang theo', ['mong nhe', 'nhe', 'de mang', 'di chuyen', 'gon nhe', 'thiet ke dep', 'sang trong', 'thiet ke']],
        ['không dây', ['khong day', 'bluetooth', 'wireless']],
        ['chống ồn', ['chong on', 'anc', 'cach am']],
        ['màn hình đẹp', ['man hinh', 'oled', '120hz', '144hz', 'super amoled', 'hien thi', 'sac net']],
        ['giá tiết kiệm', ['gia re', 'tiet kiem', 'kinh te', 're nhat', 'gia tot']],
        ['cân bằng & bền bỉ', ['can bang', 'de dung', 'khong quan trong', 'tu van giup', 'deu duoc', 'sao cung duoc', 'on dinh', 'do ben', 'ben']]
    ];
    return preferences.find(([, keywords]) => keywords.some(keyword => norm.includes(keyword)))?.[0] || '';
}

function qualificationSuggestions(productType, missingSlots) {
    if (missingSlots.includes('budget')) {
        if (productType?.category === 'Phụ kiện') {
            return ['Dưới 500k', '500k đến 1.5 triệu', '1.5 đến 3 triệu', 'Trên 3 triệu'];
        }
        if (productType?.category === 'Laptop') {
            return ['Dưới 15 triệu', '15 đến 20 triệu', '20 đến 30 triệu', 'Trên 30 triệu'];
        }
        return ['Dưới 5 triệu', 'Dưới 10 triệu', '10 đến 20 triệu', 'Trên 20 triệu'];
    }
    if (missingSlots.includes('useCase')) {
        const byType = {
            laptop: ['Học tập, văn phòng', 'Lập trình CNTT', 'Đồ họa, dựng video', 'Chơi game'],
            phone: ['Chơi game giải trí', 'Chụp ảnh & quay video', 'Học tập & công việc', 'Dùng cơ bản hằng ngày'],
            headphones: ['Nghe nhạc', 'Đàm thoại, học online', 'Chơi game', 'Thể thao'],
            smartwatch: ['Theo dõi sức khỏe', 'Chạy bộ GPS', 'Nghe gọi', 'Dùng hằng ngày'],
            keyboard: ['Gõ phím văn phòng', 'Chơi game', 'Lập trình code', 'Gọn nhẹ di động'],
            mouse: ['Văn phòng không dây', 'Chơi game FPS', 'Công thái học', 'Đồ họa thiết kế'],
            power_bank: ['Bỏ túi đi chơi', 'Sạc laptop công suất cao', 'Dung lượng lớn 20000mAh', 'Sạc nhanh siêu tốc']
        };
        return byType[productType?.key] || ['Học tập, văn phòng', 'Chơi game', 'Giải trí', 'Dùng hằng ngày'];
    }
    if (missingSlots.includes('preference')) {
        return ['Ưu tiên hiệu năng mạnh', 'Ưu tiên pin lâu & bền bỉ', 'Ưu tiên mỏng nhẹ, thiết kế', 'Cân bằng & tiết kiệm'];
    }
    if (missingSlots.includes('brand')) {
        const brands = CATEGORY_AUTHORIZED_BRANDS[productType?.category] || ['POCO', 'Samsung', 'Xiaomi', 'OPPO', 'Apple'];
        const cleanBrands = brands.map(b => b.split('(')[0].trim()).slice(0, 3);
        return [...cleanBrands.map(b => `Thích ${b}`), 'Hãng nào cũng được'];
    }
    return ['Xem chi tiết', 'Tư vấn trả góp 0%', 'Săn mã giảm giá'];
}

function calculateMatchScore(product, { useCase = '', preference = '', brand = '' }) {
    let score = (product.rating || 4.5) * 2;
    const normName = normalizeText(product.name || '');
    const normDesc = normalizeText(product.description || '');
    const normTags = Array.isArray(product.tags) ? normalizeText(product.tags.join(' ')) : '';
    const normSpecs = normalizeText(JSON.stringify(product.specs || {}));
    const fullText = `${normName} ${normDesc} ${normTags} ${normSpecs}`;

    if (brand && brand !== 'Tất cả thương hiệu') {
        if (product.brand && normalizeText(product.brand) === normalizeText(brand)) {
            score += 35;
        }
    }

    if (useCase.includes('game') || useCase.includes('gaming')) {
        if (fullText.includes('gaming') || fullText.includes('game') || fullText.includes('dimensity') || fullText.includes('rtx') || fullText.includes('144hz') || fullText.includes('120hz')) score += 25;
    }
    if (useCase.includes('hoc tap') || useCase.includes('van phong')) {
        if (fullText.includes('van phong') || fullText.includes('hoc tap') || fullText.includes('nhe') || fullText.includes('mong nhe')) score += 20;
    }
    if (useCase.includes('chup anh') || useCase.includes('camera')) {
        if (fullText.includes('camera') || fullText.includes('50mp') || fullText.includes('200mp') || fullText.includes('ois') || fullText.includes('hasselblad')) score += 25;
    }

    if (preference.includes('pin')) {
        if (fullText.includes('5.000') || fullText.includes('5000') || fullText.includes('5.500') || fullText.includes('5500') || fullText.includes('pin trau') || fullText.includes('sac nhanh') || fullText.includes('90w') || fullText.includes('67w')) score += 20;
    }
    if (preference.includes('hieu nang')) {
        if (fullText.includes('dimensity') || fullText.includes('snapdragon') || fullText.includes('12gb') || fullText.includes('16gb') || fullText.includes('ultra')) score += 20;
    }
    if (preference.includes('mong nhe')) {
        if (fullText.includes('mong') || fullText.includes('nhe') || fullText.includes('slim') || fullText.includes('air')) score += 20;
    }
    if (preference.includes('tiet kiem')) {
        score += 10;
    }

    return score;
}

function generateProductHighlights(product, { useCase = '', preference = '' }) {
    const s = product.specs || {};
    const lines = [];

    if (s.cpu || s.ram) {
        lines.push(`• **Hiệu năng & Xử lý:** Vi xử lý ${s.cpu || 'mạnh mẽ'}${s.ram ? ` kết hợp RAM ${s.ram}` : ''}${s.storage ? ` và bộ nhớ trong ${s.storage}` : ''}, vận hành cực mượt mà các tác vụ.`);
    } else {
        lines.push(`• **Hiệu năng mạnh mẽ:** Cấu hình tối ưu xử lý trơn tru mọi nhu cầu làm việc và giải trí hàng ngày.`);
    }

    if (s.battery || s.screen) {
        lines.push(`• **Màn hình & Thời lượng pin:** Màn hình ${s.screen || 'sắc nét'} cùng viên pin ${s.battery || 'dung lượng lớn'}, bền bỉ đồng hành cả ngày dài.`);
    } else if (s.camera) {
        lines.push(`• **Camera & Trải nghiệm:** Cụm camera ${s.camera} cho chất lượng ảnh chụp sắc nét, chân thực.`);
    } else {
        lines.push(`• **Trải nghiệm tối ưu:** Hoàn thiện tỉ mỉ, độ bền cao và trải nghiệm sử dụng ổn định lâu dài.`);
    }

    const installmentEstimate = Math.round((product.price * 0.7) / 12);
    lines.push(`• **Chính hãng & Trả góp 0%:** Hàng mới chính hãng 100%, bảo hành ${product.warranty || 'chính hãng 12 - 24 tháng'}, 1 đổi 1 trong 30 ngày, trả góp 0% chỉ từ ~${money(installmentEstimate)}/tháng.`);

    return lines.join('\n');
}

/**
 * Trả thẳng sản phẩm thật khi khách nêu một loại hàng cụ thể. Luồng này không
 * phụ thuộc danh mục đang lưu từ lượt trước nên tránh lỗi đổi trang/ngữ cảnh cũ.
 */
async function handleCatalogProductTypeQuery(message, context = {}, forcedProductType = null) {
    const productType = forcedProductType || detectProductType(message);
    if (!productType) return null;

    const normalizedMessage = normalizeText(message);
    // Preserve the customer's self-described technical proficiency through
    // the catalog qualification path (beginner/basic users should not lose
    // that signal when the first message contains a product type).
    context = {
        ...context,
        techProficiency: extractTechProficiency(message) || context.techProficiency || 'intermediate'
    };
    const isAvailabilityQuestion = isAvailabilityQuery(message) || isAvailabilityQuery(normalizedMessage);

    const isRestartingConsultation = /\b(tu van|gioi thieu|goi y|chon giup|muon mua|can mua|tim mua)\b/i.test(normalizedMessage);
    const isExplicitReset = isRestartingConsultation &&
        !extractBudget(message) &&
        !extractQualificationUseCase(message) &&
        !extractUseCase(message) &&
        !extractBrandPreference(message);

    const previousQualification = isExplicitReset ? {} : (context.qualification || {});

    const budgetInfo = extractBudgetInfo(message);
    const extractedBudget = budgetInfo?.amount || extractBudget(message);
    const budget = extractedBudget || (isExplicitReset ? 0 : (previousQualification.budget || context.budget || 0));
    const budgetType = budgetInfo?.type || context.budgetType || 'unspecified';

    const brand = productType.brand || extractBrandPreference(message) || (isExplicitReset ? '' : (previousQualification.brand || context.brand || ''));
    const directUseCase = /van phong|luot web|word|excel|hoc tap|sinh vien|văn phòng|lướt web|học tập|sinh viên/i.test(normalizedMessage + ' ' + message)
        ? 'làm việc văn phòng / học tập'
        : /lap trinh|code|docker|cntt|cong nghe thong tin|ide/.test(normalizedMessage)
            ? 'lập trình & công nghệ'
            : /gaming|choi game|chien game|fps|genshin|valorant|cau hinh manh|hieu nang/.test(normalizedMessage)
                ? 'chơi game giải trí'
                : /chup anh|quay phim|sac net|camera/.test(normalizedMessage)
                    ? 'chụp ảnh & quay video'
                    : /pin trau|luot web|pin lau/.test(normalizedMessage)
                        ? 'sử dụng hằng ngày & cơ bản'
                        : '';
    const useCase = extractUseCase(message) || extractQualificationUseCase(message) || directUseCase || (isExplicitReset ? '' : (previousQualification.useCase || context.useCase || ''));
    const preference = extractQualificationPreference(message) || (isExplicitReset ? '' : (previousQualification.preference || ''));

    const qualification = { budget, brand, useCase, preference, budgetType };

    // Tính toán các slot còn thiếu trong 4 câu hỏi tư vấn
    const missingSlots = [];
    if (!budget || budget <= 0) missingSlots.push('budget');
    if (!useCase) missingSlots.push('useCase');
    if (!preference) missingSlots.push('preference');
    if (!brand) missingSlots.push('brand');

    const QUESTION_MAP = {
        budget: 'Mức giá tối đa bạn muốn chi khoảng bao nhiêu?',
        useCase: `Bạn dùng ${productType.label} chủ yếu cho việc gì và thường dùng trong hoàn cảnh nào?`,
        preference: 'Tiêu chí quan trọng nhất với bạn là hiệu năng/tính năng, pin, thiết kế, độ bền hay giá tiết kiệm?',
        brand: 'Bạn có ưu tiên hoặc không thích thương hiệu nào không (hay thương hiệu nào cũng được)?'
    };

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: Khách CHƯA trả lời câu nào trong 4 câu hỏi tư vấn (missingSlots.length === 4)
    // -------------------------------------------------------------
    if (missingSlots.length === 4) {
        // Nếu khách hỏi tình trạng hàng có bán không (ví dụ: 'bạn có bán bàn phím không')
        // -> LẬP TỨC xác nhận 'Dạ có ạ!' và gửi luôn 2-3 mẫu nổi bật đang có sẵn tại shop kèm hỏi nhu cầu & ngân sách
        if (isAvailabilityQuestion) {
            const availabilityQuery = {
                category: productType.category,
                active: { $ne: false },
                stock: { $gt: 0 }
            };
            if (productType.name) availabilityQuery.name = productType.name;
            let sampleProducts = await Product.find(availabilityQuery).sort({ featured: -1, rating: -1, soldCount: -1 }).limit(3).lean();
            if (!sampleProducts.length) {
                sampleProducts = await Product.find({ category: productType.category, active: { $ne: false } }).limit(3).lean();
            }

            const intro = `Dạ có ạ! Cửa hàng hiện có sẵn nhiều mẫu **${productType.label}** chính hãng đang được ưa chuộng nhất. Em xin gửi bạn tham khảo các mẫu nổi bật đang có sẵn tại shop:\n\n`;

            const productDetails = sampleProducts.map((p, idx) => {
                const s = p.specs || {};
                const highlights = [];
                if (s.camera) {
                    const cam = String(s.camera).trim();
                    highlights.push(/^camera\b/i.test(cam) ? cam : `Camera ${cam}`);
                }
                if (s.cpu) {
                    const c = String(s.cpu).trim();
                    highlights.push(/^chip\b|^cpu\b/i.test(c) ? c : `Chip ${c}`);
                }
                if (s.ram) {
                    const r = String(s.ram).trim();
                    highlights.push(/^ram\b/i.test(r) ? r : `RAM ${r}`);
                }
                if (s.battery) {
                    const batt = String(s.battery).trim();
                    highlights.push(/^pin\b/i.test(batt) ? batt : `Pin ${batt}`);
                }
                if (s.screen) {
                    const sc = String(s.screen).trim();
                    highlights.push(/^màn hình\b|^man hinh\b/i.test(sc) ? sc : `Màn hình ${sc}`);
                }
                const highlightText = highlights.slice(0, 3).join(' • ') || 'Cấu hình ổn định, độ hoàn thiện cao';
                const monthlyInst = Math.round((p.price * 0.7) / 12);
                const rawWarranty = p.warranty;
                const warrantyDisplay = (!rawWarranty || rawWarranty === 'Chưa có thông tin' || rawWarranty === 'Không bảo hành')
                    ? 'chính hãng 12 - 24 tháng'
                    : (rawWarranty.toLowerCase().startsWith('chính hãng') || rawWarranty.toLowerCase().startsWith('bảo hành')
                        ? rawWarranty
                        : `chính hãng ${rawWarranty}`);

                return `${idx + 1}. 🌟 **${p.name}** — Giá: **${money(p.price)}** (Kho còn ${p.stock} sản phẩm)\n` +
                    `   • **Điểm nổi bật:** ${highlightText}.\n` +
                    `   • **Chính sách:** Bảo hành ${warrantyDisplay}, lỗi 1 đổi 1 trong 30 ngày, trả góp 0% chỉ từ ~${money(monthlyInst)}/tháng.`;
            }).join('\n\n');

            const categoryPrompts = {
                'Laptop': '👉 Bạn đang cần tìm laptop cho nhu cầu cụ thể nào (như học tập văn phòng, lập trình hay đồ họa gaming) và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊',
                'Điện thoại': '👉 Bạn đang quan tâm dòng máy cụ thể nào hoặc dự kiến tầm ngân sách khoảng bao nhiêu để em tư vấn cấu hình và ưu đãi tốt nhất cho bạn nhé! 😊',
                'Tai nghe': '👉 Bạn thích kiểu tai nghe chụp tai chống ồn hay nhét tai nhỏ gọn, và tầm giá mong muốn khoảng bao nhiêu để em gợi ý chuẩn nhất ạ! 😊',
                'Đồng hồ thông minh': '👉 Bạn ưu tiên tính năng theo dõi sức khỏe & thể thao chuyên sâu, nghe gọi hay pin trâu cả tuần, và ngân sách khoảng bao nhiêu ạ! 😊',
                'Máy chơi game': '👉 Bạn đang tìm máy cầm tay di động (như Switch, Steam Deck) hay console cắm TV (như PS5 Slim), và tầm giá khoảng bao nhiêu ạ! 😊',
                'Phụ kiện': `👉 Bạn đang cần tìm ${productType.label} cho nhu cầu cụ thể nào (như văn phòng hay gaming) và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊`
            };
            const outro = `\n\n${categoryPrompts[productType.category] || `👉 Bạn đang cần tìm **${productType.label}** cho nhu cầu cụ thể nào và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊`}`;

            return {
                reply: `${intro}${productDetails}${outro}`,
                products: sampleProducts,
                suggestions: buildDynamicCategoryChips(productType, productType.category),
                context: {
                    ...context,
                    stage: 'qualifying_needs',
                    category: productType.category,
                    productType: productType.key,
                    brand: '',
                    budget: 0,
                    budgetType: 'unspecified',
                    useCase: '',
                    preference: '',
                    qualification,
                    availabilityConfirmed: true,
                    missingSlots: ['budget', 'useCase', 'preference', 'brand'],
                    lastProducts: sampleProducts,
                    topProduct: sampleProducts[0] || null,
                    currentIntent: 'recommended'
                }
            };
        }

        const questionKey = 'qualifying_' + productType.key;
        const alreadyAsked = (context.lastQuestionKey === questionKey) ||
                             (Array.isArray(context.askedSlots) && context.askedSlots.includes(questionKey)) ||
                             Boolean(context.repeatCount && context.repeatCount >= 1);

        // Chống lặp câu hỏi: Nếu đã hỏi câu này ở lượt trước mà khách trả lời chưa rõ/lạc đề
        // -> KHÔNG lặp lại câu hỏi y hệt! Thay vào đó nói chưa hiểu ý và gửi 2-3 sản phẩm thật để khách chọn.
        if (alreadyAsked) {
            const sampleQuery = {
                category: productType.category,
                active: { $ne: false },
                stock: { $gt: 0 }
            };
            if (productType.name) sampleQuery.name = productType.name;
            let sampleProducts = await Product.find(sampleQuery).sort({ featured: -1, price: 1 }).limit(3).lean();
            if (!sampleProducts.length) {
                sampleProducts = await Product.find({ category: productType.category, active: { $ne: false } }).limit(3).lean();
            }

            const dynamicSuggestions = buildDynamicCategoryChips(productType, productType.category);
            const reply = `Dạ em chưa nắm rõ nhu cầu cụ thể của bạn lắm ạ! 😊 Để bạn dễ tham khảo, em gửi trước ${sampleProducts.length ? `${sampleProducts.length} mẫu` : 'các mẫu'} **${productType.label}** chính hãng đang được quan tâm nhiều nhất tại cửa hàng nhé. Bạn xem thử có ưng mẫu nào dưới đây không ạ:`;

            return {
                reply,
                products: sampleProducts,
                suggestions: dynamicSuggestions,
                context: {
                    ...context,
                    stage: 'recommended',
                    category: productType.category,
                    productType: productType.key,
                    lastProducts: sampleProducts,
                    lastQuestionKey: 'sample_recommended_' + productType.key,
                    askedSlots: [...(context.askedSlots || []), questionKey],
                    repeatCount: (context.repeatCount || 0) + 1,
                    currentIntent: 'recommended'
                }
            };
        }

        // Lần đầu hỏi câu này (chưa hỏi ở lượt trước):
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
                availabilityIntro = `Dạ có ạ! Cửa hàng hiện có sẵn **${productType.label}** chính hãng. `;
            }
        }

        const categoryQuestions = {
            'Laptop': '👉 Để em hỗ trợ bạn chọn được mẫu laptop phù hợp nhất, bạn dự kiến **ngân sách khoảng bao nhiêu** và dùng cho **ngành học hay công việc chính nào** (như học tập văn phòng, lập trình hay đồ họa gaming) ạ? 😊',
            'Điện thoại': '👉 Để em hỗ trợ bạn chọn được mẫu điện thoại phù hợp nhất, bạn dự kiến **ngân sách khoảng bao nhiêu** và ưu tiên tiêu chí nào (như chụp ảnh đẹp, cấu hình chiến game mượt hay pin trâu bền bỉ) ạ? 😊',
            'Đồng hồ thông minh': '👉 Để em chọn giúp bạn mẫu đồng hồ thông minh ưng ý nhất, bạn dự kiến **tầm giá khoảng bao nhiêu** và ưu tiên tính năng nào (như đo sức khỏe & thể thao GPS chuyên sâu, nghe gọi trực tiếp hay pin trâu cả tuần) ạ? 😊',
            'Máy chơi game': '👉 Để em tư vấn hệ máy chơi game phù hợp, bạn đang tìm **máy cầm tay di động** (như Nintendo Switch OLED, Steam Deck) hay **console cắm TV 4K** (như PS5 Slim), và tầm ngân sách khoảng bao nhiêu triệu ạ? 😊',
            'Tai nghe': '👉 Để em gợi ý mẫu tai nghe phù hợp nhất, bạn thích kiểu **tai nghe chụp tai chống ồn** hay **nhét tai nhỏ gọn**, và tầm giá mong muốn khoảng bao nhiêu ạ? 😊',
            'Tablet': '👉 Để em chọn chiếc máy tính bảng phù hợp nhất, bạn dự kiến **tầm ngân sách bao nhiêu** và dùng cho mục đích nào (học tập ghi chép, vẽ đồ họa hay giải trí) ạ? 😊',
            'Phụ kiện': '👉 Để em tìm mẫu phụ kiện phù hợp nhất cho bạn, bạn đang tìm dòng phụ kiện nào (chuột, bàn phím cơ, củ sạc nhanh hay hub chuyển đổi) và tầm giá khoảng bao nhiêu ạ? 😊'
        };
        const questionPrompt = categoryQuestions[productType.category] ||
            `👉 Để em tìm sản phẩm ${productType.label} phù hợp nhất cho bạn, bạn dự kiến **tầm giá khoảng bao nhiêu** và dùng cho **nhu cầu nào** ạ? 😊`;

        const introText = availabilityIntro || `Dạ hiện tại cửa hàng có các mẫu **${productType.label}** chính hãng sẵn hàng tại kho. `;
        const reply = `${introText}\n\n${questionPrompt}`;

        return {
            reply,
            products: [],
            suggestions: buildDynamicCategoryChips(productType, productType.category),
            context: {
                ...context,
                stage: 'qualifying_needs',
                category: productType.category,
                productType: productType.key,
                brand: '',
                budget: 0,
                budgetType: 'unspecified',
                useCase: '',
                preference: '',
                qualification,
                availabilityConfirmed: context.availabilityConfirmed || Boolean(availabilityIntro),
                missingSlots: ['budget', 'useCase', 'preference', 'brand'],
                lastProducts: [],
                topProduct: null,
                currentIntent: 'qualifying_needs',
                lastQuestionKey: questionKey,
                askedSlots: [...(context.askedSlots || []), questionKey],
                repeatCount: 0
            }
        };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: Khách ĐÃ TRẢ LỜI MỘT SỐ CÂU
    // FAST-TRACK: Nếu khách đã có Ngân sách HOẶC Nhu cầu sử dụng,
    // LẬP TỨC đề xuất 2-3 sản phẩm MongoDB phù hợp nhất kèm phân tích,
    // tuyệt đối KHÔNG ép trả lời nốt các câu hỏi khảo sát!
    // -------------------------------------------------------------
    if (missingSlots.length > 0) {
        const candidateQuery = {
            category: productType.category,
            active: { $ne: false },
            stock: { $gt: 0 }
        };
        if (productType.name) candidateQuery.name = productType.name;
        if (budget > 0) {
            if (budgetType === 'min') {
                candidateQuery.price = { $gte: budget };
            } else if (budgetInfo?.type === 'range' && budgetInfo.min && budgetInfo.max) {
                candidateQuery.price = { $gte: budgetInfo.min, $lte: budgetInfo.max };
            } else {
                candidateQuery.price = { $lte: budget };
            }
        }
        if (brand && brand !== 'Tất cả thương hiệu') {
            candidateQuery.brand = new RegExp(escapeRegex(brand), 'i');
        }

        let matchingProducts = await Product.find(candidateQuery).sort(budgetType === 'min' ? { rating: -1, soldCount: -1, price: 1 } : { rating: -1, price: -1 });
        if (!matchingProducts.length && brand && brand !== 'Tất cả thương hiệu') {
            delete candidateQuery.brand;
            matchingProducts = await Product.find(candidateQuery).sort(budgetType === 'min' ? { rating: -1, soldCount: -1, price: 1 } : { rating: -1, price: -1 });
        }
        // A hard budget can legitimately be below the catalog floor. Keep the
        // conversation useful by showing the closest real in-stock item from
        // MongoDB instead of returning an empty list (never invent a product).
        let nearestBudgetProduct = null;
        if (!matchingProducts.length && budget > 0) {
            const nearestQuery = {
                category: productType.category,
                active: { $ne: false },
                stock: { $gt: 0 },
                ...(productType.name ? { name: productType.name } : {})
            };
            const nearestCandidates = await Product.find(nearestQuery);
            nearestCandidates.sort((a, b) => Math.abs(a.price - budget) - Math.abs(b.price - budget));
            nearestBudgetProduct = nearestCandidates[0] || null;
            if (nearestBudgetProduct) matchingProducts = [nearestBudgetProduct];
        }

        // Nếu khách đã cung cấp cả ngân sách lẫn nhu cầu sử dụng, chuyển thẳng sang phân tích đánh đổi chuyên sâu
        if (budget > 0 && useCase) {
            return await handleRecommendWithTradeOffs({
                category: productType.category,
                brand,
                budget,
                budgetMin: budgetInfo?.min || (budgetType === 'min' ? budget : null),
                budgetMax: budgetInfo?.max || (budgetType === 'max' ? budget : null),
                budgetType,
                isHardBudget: isHardBudgetLimit(message),
                useCase,
                preference,
                userProficiency: context.techProficiency || 'intermediate',
                context: {
                    ...context,
                    category: productType.category,
                    productType: productType.key,
                    brand,
                    budget,
                    budgetMin: budgetInfo?.min || (budgetType === 'min' ? budget : null),
                    budgetMax: budgetInfo?.max || (budgetType === 'max' ? budget : null),
                    budgetType,
                    useCase,
                    preference
                }
            });
        }

        // FAST-TRACK: Nếu khách đã nêu ít nhất 2 tiêu chí (Category + Ngân sách HOẶC Category + Nhu cầu sử dụng)
        // hoặc đã chỉ định thương hiệu / dòng máy cụ thể (ví dụ: iPhone, Samsung, MacBook...),
        // Lập tức đề xuất ngay 2-3 sản phẩm MongoDB phù hợp nhất kèm phân tích & lý do, không bắt trả lời nốt khảo sát!
        const hasEnoughSignals = Boolean(budget > 0 || useCase || (brand && brand !== 'Tất cả thương hiệu') || Boolean(productType.brand || productType.name));

        if (hasEnoughSignals && matchingProducts.length > 0) {
            matchingProducts.sort((a, b) => {
                const scoreA = calculateMatchScore(a, { useCase, preference, brand });
                const scoreB = calculateMatchScore(b, { useCase, preference, brand });
                if (scoreB !== scoreA) return scoreB - scoreA;
                if (budget > 0) {
                    if (budgetType === 'min') {
                        return (b.rating || 0) - (a.rating || 0);
                    }
                    const diffA = Math.abs(a.price - budget);
                    const diffB = Math.abs(b.price - budget);
                    if (diffA !== diffB) return diffA - diffB;
                }
                return (b.rating || 0) - (a.rating || 0);
            });

            const selected = matchingProducts.slice(0, 3);
            const top = selected[0];

            let intro = '';
            const isForMomOrElderly = /tang me|cho me|phu huynh|nguoi lon tuoi|ong ba|bo me/i.test(normalizedMessage + ' ' + (useCase || '') + ' ' + (preference || ''));
            const isForStudent = /sinh vien|hoc sinh|di hoc|hoc tap/i.test(normalizedMessage + ' ' + (useCase || ''));
            const isForDev = /lap trinh|code|cntt|it|developer|docker/i.test(normalizedMessage + ' ' + (useCase || ''));

            if (isAvailabilityQuestion) {
                intro = `Dạ có ạ! Cửa hàng hiện có sẵn nhiều mẫu **${productType.label}** chính hãng đang được ưa chuộng nhất. Em xin gửi bạn tham khảo các mẫu nổi bật đang có sẵn tại shop:\n\n`;
            } else if (nearestBudgetProduct) {
                intro = `Dạ với mức ngân sách **${budgetType === 'min' ? 'từ ' : (budgetType === 'max' ? 'dưới ' : 'khoảng ')}${money(budget)}** mà bạn đang tìm kiếm, hiện tại hệ thống chưa có mẫu **${productType.label}** mới chính hãng trong tầm giá này. Tuy nhiên, để bạn dễ quan sát và cân nhắc, em xin phép **hiển thị ngay trên trang mẫu ${productType.label} có giá gần nhất và tốt nhất** hiện có sẵn tại cửa hàng là **${nearestBudgetProduct.name}** (${money(nearestBudgetProduct.price)}) nhé:\n\n`;
            } else if (isForMomOrElderly) {
                intro = `Dạ chọn ${productType.label} tặng mẹ là một món quà rất ý nghĩa và chu đáo ạ! ❤️ Với phụ huynh, tiêu chí quan trọng nhất là màn hình to rõ dễ nhìn, pin bền dùng cả ngày, camera chụp gia đình sắc nét và máy hoạt động ổn định, dễ dùng.\n\n` +
                    `Trong tầm giá ${budget > 0 ? (budgetType === 'min' ? `từ **${money(budget)} trở lên**` : `khoảng **${money(budget)}**`) : ''}, em xin gợi ý ngay **${selected.length} mẫu tối ưu nhất** tại kho của shop:\n\n`;
            } else if (isForStudent) {
                intro = `Dạ với ngân sách ${budget > 0 ? (budgetType === 'min' ? `từ **${money(budget)} trở lên**` : `khoảng **${money(budget)}**`) : ''} phục vụ việc học tập sinh viên, em đề xuất ngay **${selected.length} mẫu ${productType.label}** có cấu hình bền bỉ, tối ưu chi phí:\n\n`;
            } else if (isForDev) {
                intro = `Dạ với nhu cầu lập trình & công nghệ trong ngân sách ${budget > 0 ? (budgetType === 'min' ? `từ **${money(budget)} trở lên**` : `khoảng **${money(budget)}**`) : ''}, em ưu tiên chọn các mẫu có CPU đa nhân mạnh mẽ và khả năng nâng cấp RAM tốt:\n\n`;
            } else if (budget > 0 && useCase) {
                intro = budgetType === 'min'
                    ? `Dạ với mức ngân sách **từ ${money(budget)} trở lên** phục vụ nhu cầu **${useCase}**, em xin đề xuất ngay **${selected.length} phương án đỉnh cao nhất** tại kho của shop:\n\n`
                    : `Dạ với mức ngân sách **dưới ${money(budget)}** phục vụ nhu cầu **${useCase}**, em xin đề xuất ngay **${selected.length} phương án tối ưu nhất** tại kho của shop:\n\n`;
            } else if (budget > 0) {
                intro = budgetType === 'min'
                    ? `Dạ với mức ngân sách **từ ${money(budget)} trở lên** (phân khúc cao cấp & flagship), em đã chọn lọc ngay **${selected.length} mẫu ${productType.label}** chính hãng xuất sắc và đáng giá nhất:\n\n`
                    : `Dạ với mức ngân sách **dưới ${money(budget)}**, em đã chọn lọc ngay **${selected.length} mẫu ${productType.label}** chính hãng có cấu hình và độ bền xuất sắc nhất:\n\n`;
            } else if (useCase) {
                intro = `Dạ với nhu cầu **${useCase}**, em xin đề xuất **${selected.length} mẫu ${productType.label}** phù hợp nhất để bạn cân nhắc:\n\n`;
            } else if (productType.name || (brand && brand !== 'Tất cả thương hiệu')) {
                const targetBrandOrLabel = productType.label || brand;
                intro = `Dạ tuyệt vời ạ! Với dòng **${targetBrandOrLabel} chính hãng**, cửa hàng hiện có các mẫu sẵn hàng tại kho, bảo hành chính hãng và hỗ trợ trả góp 0%:\n\n`;
            } else {
                intro = `Dạ tại cửa hàng bên em, em xin đề xuất ngay **${selected.length} mẫu ${productType.label}** nổi bật và bán chạy nhất hiện nay để bạn tham khảo:\n\n`;
            }

            const productDetails = selected.map((p, idx) => {
                const s = p.specs || {};
                const highlights = [];
                if (s.camera) {
                    const cam = String(s.camera).trim();
                    highlights.push(/^camera\b/i.test(cam) ? cam : `Camera ${cam}`);
                }
                if (s.cpu) {
                    const c = String(s.cpu).trim();
                    highlights.push(/^chip\b|^cpu\b/i.test(c) ? c : `Chip ${c}`);
                }
                if (s.ram) {
                    const r = String(s.ram).trim();
                    highlights.push(/^ram\b/i.test(r) ? r : `RAM ${r}`);
                }
                if (s.battery) {
                    const batt = String(s.battery).trim();
                    highlights.push(/^pin\b/i.test(batt) ? batt : `Pin ${batt}`);
                }
                if (s.screen) {
                    const sc = String(s.screen).trim();
                    highlights.push(/^màn hình\b|^man hinh\b/i.test(sc) ? sc : `Màn hình ${sc}`);
                }
                const highlightText = highlights.slice(0, 3).join(' • ') || 'Cấu hình ổn định, độ hoàn thiện cao';
                const monthlyInst = Math.round((p.price * 0.7) / 12);
                const rawWarranty = p.warranty;
                const warrantyDisplay = (!rawWarranty || rawWarranty === 'Chưa có thông tin' || rawWarranty === 'Không bảo hành')
                    ? 'chính hãng 12 - 24 tháng'
                    : (rawWarranty.toLowerCase().startsWith('chính hãng') || rawWarranty.toLowerCase().startsWith('bảo hành')
                        ? rawWarranty
                        : `chính hãng ${rawWarranty}`);

                return `${idx + 1}. 🌟 **${p.name}** — Giá: **${money(p.price)}** (Kho còn ${p.stock} sản phẩm)\n` +
                    `   • **Điểm nổi bật:** ${highlightText}.\n` +
                    `   • **Chính sách:** Bảo hành ${warrantyDisplay}, lỗi 1 đổi 1 trong 30 ngày, trả góp 0% chỉ từ ~${money(monthlyInst)}/tháng.`;
            }).join('\n\n');

            let outro = `\n\n👉 Bạn đang ưng ý mẫu nào trong các lựa chọn trên, hoặc bạn cần em so sánh chi tiết hơn để dễ cân nhắc không ạ? 😊`;
            if (isAvailabilityQuestion) {
                const categoryPrompts = {
                    'Laptop': '👉 Bạn đang cần tìm laptop cho nhu cầu cụ thể nào (như học tập văn phòng, lập trình hay đồ họa gaming) và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊',
                    'Điện thoại': '👉 Bạn đang quan tâm dòng máy cụ thể nào hoặc dự kiến tầm ngân sách khoảng bao nhiêu để em tư vấn cấu hình và ưu đãi tốt nhất cho bạn nhé! 😊',
                    'Tai nghe': '👉 Bạn thích kiểu tai nghe chụp tai chống ồn hay nhét tai nhỏ gọn, và tầm giá mong muốn khoảng bao nhiêu để em gợi ý chuẩn nhất ạ! 😊',
                    'Đồng hồ thông minh': '👉 Bạn ưu tiên tính năng theo dõi sức khỏe & thể thao chuyên sâu, nghe gọi hay pin trâu cả tuần, và ngân sách khoảng bao nhiêu ạ! 😊',
                    'Máy chơi game': '👉 Bạn đang tìm máy cầm tay di động (như Switch, Steam Deck) hay console cắm TV (như PS5 Slim), và tầm giá khoảng bao nhiêu ạ! 😊',
                    'Phụ kiện': `👉 Bạn đang cần tìm ${productType.label} cho nhu cầu cụ thể nào (như văn phòng hay gaming) và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊`
                };
                outro = `\n\n${categoryPrompts[productType.category] || `👉 Bạn đang cần tìm **${productType.label}** cho nhu cầu cụ thể nào và tầm ngân sách dự kiến khoảng bao nhiêu để em tư vấn mẫu chuẩn nhất cho bạn nhé! 😊`}`;
            } else if (nearestBudgetProduct) {
                const downPay = Math.round(nearestBudgetProduct.price * 0.3);
                const monthlyInst = Math.round((nearestBudgetProduct.price * 0.7) / 12);
                outro = `\n\n💡 **Gợi ý hỗ trợ tài chính:** Để sở hữu thiết bị mà không bị áp lực ngân sách, bạn có thể tham gia chương trình **Trả góp 0% lãi suất** (trả trước 30% khoảng ~${money(downPay)}, góp chỉ ~${money(monthlyInst)}/tháng) hoặc áp mã giảm giá hôm nay nhé!\n👉 Bạn có muốn xem thêm chi tiết hoặc để em tính bảng trả góp 0% cho mẫu này không ạ? 😊`;
            } else if (!budget) {
                outro = `\n\n👉 Bạn đang ưu tiên phiên bản cao cấp hay tối ưu chi phí, và tầm giá dự kiến của bạn khoảng bao nhiêu để em tư vấn cấu hình và ưu đãi phù hợp nhất nhé! 😊`;
            }

            const defaultReply = `${intro}${productDetails}${outro}`;
            const grounded = await aiModelService.generateGroundedConsultation({
                userMessage: message,
                dialogueAct: nearestBudgetProduct ? 'nearest_budget_recommend' : 'recommend',
                verifiedProducts: selected,
                context: {
                    ...context,
                    category: productType.category,
                    brand,
                    budget,
                    isNearestMatch: Boolean(nearestBudgetProduct),
                    nearestProduct: nearestBudgetProduct ? nearestBudgetProduct.name : null,
                    useCase,
                    preference
                },
                fallbackText: defaultReply
            });

            const dynamicSuggestions = [
                selected[0] ? `Xem ${selected[0].name.replace(/(Điện thoại|Laptop|Máy tính bảng)\s*/gi, '').slice(0, 22)}` : null,
                selected[1] ? `Xem ${selected[1].name.replace(/(Điện thoại|Laptop|Máy tính bảng)\s*/gi, '').slice(0, 22)}` : null,
                selected.length >= 2 ? `So sánh 2 máy trên` : null,
                'Tính trả góp 0%',
                'Săn mã giảm giá'
            ].filter(Boolean).slice(0, 5);

            return {
                reply: grounded.reply,
                products: selected,
                suggestions: dynamicSuggestions,
                context: {
                    ...context,
                    stage: 'recommended',
                    category: productType.category,
                    productType: productType.key,
                    brand,
                    budget,
                    budgetType: budget ? (isHardBudgetLimit(message) ? 'hard' : 'soft') : 'unspecified',
                    useCase,
                    preference,
                    qualification,
                    lastProducts: selected,
                    topProduct: top,
                    isNearestMatch: Boolean(nearestBudgetProduct),
                    currentIntent: nearestBudgetProduct ? 'nearest_price_match' : 'recommended'
                },
                meta: {
                    provider: grounded.provider,
                    model: grounded.model,
                    isFallback: grounded.isFallback
                }
            };
        }

        // Nếu khách chưa nêu ngân sách / nhu cầu:
        const isHardware = ['Laptop', 'Điện thoại', 'Tablet', 'Máy chơi game'].includes(productType.category);
        const naturalQuestion = isHardware
            ? `Dạ để em hỗ trợ chọn mẫu **${productType.label}** phù hợp nhất, bạn dự kiến mức ngân sách khoảng bao nhiêu và ưu tiên nhu cầu nào nhất (như học tập văn phòng, đồ họa hay chơi game) ạ? 😊`
            : `Dạ để em chọn mẫu **${productType.label}** phù hợp nhất cho bạn, bạn dự kiến tầm giá khoảng bao nhiêu và dùng cho nhu cầu nào ạ? 😊`;

        return {
            reply: naturalQuestion,
            products: matchingProducts.slice(0, 3),
            suggestions: qualificationSuggestions(productType, missingSlots),
            context: {
                ...context,
                stage: 'qualifying_needs',
                category: productType.category,
                productType: productType.key,
                brand,
                budget,
                budgetType: budget ? (isHardBudgetLimit(message) ? 'hard' : 'soft') : 'unspecified',
                useCase,
                preference,
                qualification,
                missingSlots,
                lastProducts: matchingProducts.slice(0, 4),
                topProduct: null,
                currentIntent: budget > 0 ? 'budget_qualified_needs' : 'qualifying_needs'
            }
        };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 3: KHÁCH ĐÃ TRẢ LỜI HẾT CẢ 4 CÂU TƯ VẤN (missingSlots.length === 0)
    // -> BÂY GIỜ MỚI CHỐT VÀ SỔ SANG TRANG SẢN PHẨM ĐÓ!
    // -------------------------------------------------------------
    const baseQuery = {
        category: productType.category,
        active: { $ne: false },
        stock: { $gt: 0 }
    };
    if (productType.name) baseQuery.name = productType.name;
    if (brand && brand !== 'Tất cả thương hiệu') {
        baseQuery.brand = new RegExp(escapeRegex(brand), 'i');
    }

    let allAvailable = await Product.find(baseQuery);
    let fallbackBrand = false;
    if (!allAvailable.length && brand && brand !== 'Tất cả thương hiệu') {
        const relaxedQuery = {
            category: productType.category,
            active: { $ne: false },
            stock: { $gt: 0 }
        };
        if (productType.name) relaxedQuery.name = productType.name;
        allAvailable = await Product.find(relaxedQuery);
        if (allAvailable.length) fallbackBrand = true;
    }

    if (!allAvailable.length) {
        allAvailable = await Product.find({ category: productType.category, active: { $ne: false } });
    }

    const withinBudget = budget > 0 ? allAvailable.filter(p => p.price <= budget) : allAvailable;

    if (withinBudget.length > 0) {
        withinBudget.sort((a, b) => {
            const scoreA = calculateMatchScore(a, { useCase, preference, brand });
            const scoreB = calculateMatchScore(b, { useCase, preference, brand });
            if (scoreB !== scoreA) return scoreB - scoreA;
            if (budget > 0) {
                const diffA = Math.abs(a.price - budget);
                const diffB = Math.abs(b.price - budget);
                if (diffA !== diffB) return diffA - diffB;
            }
            return (b.rating || 0) - (a.rating || 0);
        });

        const topProduct = withinBudget[0];
        const candidates = withinBudget.slice(0, 4);
        const otherCandidates = candidates.slice(1);
        const brandSummary = brand && brand !== 'Tất cả thương hiệu' ? `Thương hiệu ${brand}` : 'Thương hiệu bất kỳ';

        let reply = `Dạ dựa trên các tiêu chí bạn đã chia sẻ, em xin tổng hợp nhanh nhu cầu của bạn:\n` +
            `• **Ngân sách:** ${budget > 0 ? `Dưới ${money(budget)}` : 'Linh hoạt'}\n` +
            `• **Mục đích:** ${useCase || 'Làm việc & Giải trí'}\n` +
            `• **Tiêu chí ưu tiên:** ${preference || 'Bền bỉ, mượt mà'}\n` +
            `• **Thương hiệu:** ${brandSummary}\n\n` +
            `🏆 Mẫu máy **tối ưu số 1 và chuẩn xác nhất** dành cho bạn chính là:\n` +
            `🌟 **${topProduct.name}** — **${money(topProduct.price)}** (chính hãng 100%, còn ${topProduct.stock} sản phẩm)\n\n` +
            `💡 **Tại sao đây là lựa chọn xuất sắc nhất cho bạn:**\n` +
            generateProductHighlights(topProduct, { useCase, preference }) + `\n`;

        if (otherCandidates.length > 0) {
            reply += `\nNgoài ra, bạn cũng có thể tham khảo thêm các lựa chọn cùng phân khúc:\n` +
                otherCandidates.map(p => `• **${p.name}** — **${money(p.price)}**`).join('\n') + `\n`;
        }

        reply += `\n👉 Cửa hàng đã hiển thị ngay mẫu **${topProduct.name}** trên màn hình để bạn xem chi tiết và dễ dàng đặt mua. Bạn có muốn thêm vào giỏ hàng ngay hay cần em hỗ trợ thêm thông tin gì không ạ? 😊`;

        const grounded = await aiModelService.generateGroundedConsultation({
            userMessage: message,
            dialogueAct: 'recommend',
            verifiedProducts: candidates.slice(0, 3),
            context: {
                ...context,
                category: productType.category,
                brand: fallbackBrand ? '' : brand,
                budget,
                useCase,
                preference
            },
            fallbackText: reply
        });

        return {
            reply: grounded.reply,
            products: candidates,
            suggestions: [
                `Xem chi tiết ${topProduct.name.slice(0, 24)}`,
                'Thêm vào giỏ hàng',
                'Tư vấn trả góp 0%',
                'Săn mã giảm giá'
            ],
            context: {
                ...context,
                category: productType.category,
                productType: productType.key,
                stage: 'recommended',
                brand: fallbackBrand ? '' : brand,
                budget,
                useCase,
                preference,
                qualification,
                missingSlots: [],
                budgetType: budget ? (isHardBudgetLimit(message) ? 'hard' : 'soft') : 'unspecified',
                currentIntent: 'consultation_completed',
                lastProducts: candidates,
                topProduct
            },
            meta: {
                provider: grounded.provider,
                model: grounded.model,
                isFallback: grounded.isFallback
            }
        };
    }

    allAvailable.sort((a, b) => Math.abs(a.price - budget) - Math.abs(b.price - budget));
    const nearest = allAvailable[0];
    const downPayment = Math.round(nearest.price * 0.3);
    const monthlyInstallment = Math.round((nearest.price * 0.7) / 6);

    const reply = `Dạ cảm ơn bạn đã trả lời đầy đủ 4 câu hỏi tư vấn! Trong danh mục **${productType.category}**, hiện tại mức giá khởi điểm của các mẫu chính hãng là từ **${money(nearest.price)}** (chưa có mẫu dưới ${money(budget)}).\n\n` +
        `Tuy nhiên, mẫu chính hãng có **mức giá gần nhất và tối ưu nhất** cho nhu cầu của bạn là:\n` +
        `🌟 **${nearest.name}** — **${money(nearest.price)}** (chính hãng ${nearest.brand || '100%'}, bảo hành chính hãng, còn ${nearest.stock} sản phẩm)\n\n` +
        `💡 **Giải pháp tài chính tiết kiệm cho bạn:**\n` +
        `• **Trả góp 0% cực nhẹ nhàng:** Bạn chỉ cần trả trước khoảng 30% (~${money(downPayment)}), số tiền còn lại chia góp chỉ khoảng **${money(monthlyInstallment)}/tháng** duyệt CCCD 15 phút.\n` +
        `• **Chính sách ưu đãi:** 1 đổi 1 trong 30 ngày, bảo hành chính hãng và voucher giảm giá trực tiếp hôm nay.\n\n` +
        `👉 Cửa hàng đã hiển thị ngay mẫu **${nearest.name}** trên màn hình để bạn tham khảo chi tiết. Bạn có muốn em hỗ trợ hướng dẫn đặt mua hoặc tính bảng trả góp chi tiết không ạ? 😊`;

    return {
        reply,
        products: [nearest],
        suggestions: [
            `Xem chi tiết ${nearest.name.slice(0, 24)}`,
            'Tư vấn trả góp 0%',
            'Săn mã giảm giá',
            'Đổi sang mẫu khác'
        ],
        context: {
            ...context,
            category: productType.category,
            productType: productType.key,
            stage: 'recommended',
            brand: fallbackBrand ? '' : brand,
            budget,
            useCase,
            preference,
            qualification,
            missingSlots: [],
            currentIntent: 'consultation_completed',
            lastProducts: [nearest],
            topProduct: nearest
        }
    };
}

/**
 * 3. Khách hỏi nhu cầu chung nhưng thiếu thông tin (Clarify Needs)
 */
async function handleClarifyNeeds(category, existingSlots = {}, userProficiency = 'intermediate') {
    const questionKey = `clarify_needs_${category || 'all'}`;
    const categoryConfig = (config.CATEGORY_CONFIG && config.CATEGORY_CONFIG[category]) || { term: 'sản phẩm', label: (category || '').toLowerCase() };

    // 1. CHỐNG LẶP CÂU HỎI: Nếu bot vừa hỏi câu hỏi slot này ở lượt trước, hoặc đã lặp lại:
    // Tuyệt đối không hỏi lại cùng một slot/câu quá một lần liên tiếp.
    // Lần kế tiếp: nói rõ chưa hiểu ý khách và đưa lựa chọn nhanh kèm 2-3 sản phẩm thật của danh mục gần nhất.
    const isRepeated = existingSlots.lastQuestionKey === questionKey ||
        (Array.isArray(existingSlots.askedSlots) && existingSlots.askedSlots.includes(questionKey) && (existingSlots.repeatCount || 0) >= 1);

    if (isRepeated) {
        let fallbackProducts = [];
        try {
            fallbackProducts = await Product.find({
                category: category || 'Điện thoại',
                active: { $ne: false }
            }).sort({ featured: -1, soldCount: -1, rating: -1 }).limit(3);
        } catch (_) {}

        const productCards = fallbackProducts.map((p, idx) => `${idx + 1}. **${p.name}** — Giá: **${money(p.price)}**`).join('\n');

        return {
            reply: `Dạ em chưa hiểu rõ ý cụ thể của bạn lắm. Cửa hàng xin gợi ý nhanh một số mẫu **${categoryConfig.label || category}** chính hãng đang bán chạy và được ưa chuộng nhất dưới đây để bạn tham khảo:\n\n` +
                (productCards ? `${productCards}\n\n` : '') +
                `👉 Bạn có ưng mẫu nào trong các lựa chọn trên không, hoặc bạn có thể chia sẻ mức ngân sách dự kiến khoảng bao nhiêu để em lọc ngay sản phẩm phù hợp nhất cho bạn nhé! 😊`,
            products: fallbackProducts,
            suggestions: buildDynamicCategoryChips(null, category),
            context: {
                ...existingSlots,
                category,
                stage: 'recommended_fallback',
                currentIntent: 'clarify_needs_fallback',
                lastQuestionKey: `clarify_fallback_${category}`,
                askedSlots: Array.from(new Set([...(existingSlots.askedSlots || []), questionKey])),
                repeatCount: (existingSlots.repeatCount || 0) + 1,
                lastProducts: fallbackProducts
            }
        };
    }

    let question = '';
    let suggestions = [];

    switch (category) {
        case 'Laptop': {
            if (!existingSlots.budget && !existingSlots.useCase) {
                question = userProficiency === 'beginner'
                    ? `Dạ chào bạn! Để em giúp bạn chọn được chiếc laptop phù hợp nhất, chạy mượt mà không lo bị đơ giật mà cũng không lãng phí tiền, bạn có thể chia sẻ thêm giúp em:\n` +
                    `1. Mức ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                    `2. Bạn dùng máy cho ngành học hay công việc chính nào (văn phòng, lập trình hay đồ họa gaming) ạ? 😊`
                    : `Dạ chào bạn! Để em lọc cấu hình laptop chuẩn nhất cho nhu cầu của bạn, bạn dự kiến khoảng **ngân sách bao nhiêu** (ví dụ: dưới 15 triệu, 15 - 20 triệu hay trên 20 triệu) và phục vụ **công việc / ngành học nào** (học tập văn phòng, lập trình CNTT hay đồ họa 3D gaming) ạ? 😊`;
                suggestions = [
                    'Laptop sinh viên dưới 15 triệu',
                    'Laptop lập trình 15 - 20 triệu',
                    'Laptop đồ họa / gaming',
                    'Mỏng nhẹ, pin trâu'
                ];
            } else if (!existingSlots.budget) {
                question = `Dạ rất rõ ràng về nhu cầu **${existingSlots.useCase || 'học tập & làm việc'}** ạ! 🎯\n` +
                    `Bạn dự kiến mức **ngân sách tối đa khoảng bao nhiêu triệu** để em lọc ra các máy có cấu hình tối ưu nhất trong tầm giá cho bạn nhé? 😊`;
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
            if (existingSlots.useCase || existingSlots.preference) {
                const intentName = existingSlots.useCase || existingSlots.preference;
                question = `Dạ tuyệt vời! Với tiêu chí **${intentName}** cho dòng **Điện thoại**, cửa hàng đang có sẵn các mẫu đầu bảng như **iPhone 16 Pro Max**, **Samsung Galaxy S25 Ultra** hay **OPPO Find X8 Pro**.\n` +
                    `Bạn dự kiến mức **ngân sách khoảng bao nhiêu triệu** để em lọc ra các phiên bản máy phù hợp và tối ưu nhất cho bạn nhé! 😊`;
                suggestions = [
                    'Dưới 10 triệu',
                    '10 - 20 triệu',
                    'Trên 20 triệu',
                    'Xem các mẫu cao cấp nhất'
                ];
            } else if (!existingSlots.budget) {
                question = `Dạ chào bạn! Để em tư vấn mẫu **điện thoại** chuẩn nhất với nhu cầu của bạn, bạn có thể chia sẻ thêm giúp em:\n` +
                    `1. Mức ngân sách dự kiến của bạn khoảng bao nhiêu triệu?\n` +
                    `2. Bạn ưu tiên tiêu chí nào nhất (chụp ảnh quay phim sắc nét, cấu hình mạnh chiến game mượt, hay pin trâu bền bỉ cả ngày) ạ? 😊`;
                suggestions = [
                    'Chụp ảnh quay phim sắc nét',
                    'Cấu hình mạnh chiến game',
                    'Pin trâu, lướt web mượt',
                    'Tầm giá dưới 15 triệu'
                ];
            } else {
                question = `Dạ với tầm ngân sách **${money(existingSlots.budget)}**, bạn ưu tiên tiêu chí nào nhất (chụp ảnh đẹp, cấu hình chiến game hay pin trâu bền bỉ) để em chọn máy ưng ý nhất cho bạn nhé! 😊`;
                suggestions = [
                    'Chụp ảnh quay phim sắc nét',
                    'Cấu hình mạnh chiến game',
                    'Pin trâu bền bỉ',
                    'Xem mẫu bán chạy nhất'
                ];
            }
            break;
        }

        case 'Đồng hồ thông minh': {
            question = `Dạ chào bạn! Để em chọn giúp bạn mẫu **đồng hồ thông minh (Smartwatch)** phù hợp và ưng ý nhất, bạn có thể chia sẻ thêm:\n` +
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
            question = `Dạ chào bạn! Để em tư vấn hệ **máy chơi game** phù hợp nhất cho nhu cầu của bạn:\n` +
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
            question = `Dạ chào bạn! Để em gợi ý mẫu **tai nghe** có chất âm và tính năng phù hợp nhất, bạn có thể chia sẻ giúp em:\n` +
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
            question = `Dạ chào bạn! Để em chọn chiếc **máy tính bảng (Tablet)** phù hợp nhất cho bạn, bạn có thể chia sẻ thêm:\n` +
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
            question = `Dạ chào bạn! Bạn đang cần tìm **phụ kiện công nghệ** nào cho thiết bị của bạn ạ (chuột máy tính, bàn phím cơ, củ sạc nhanh GaN, pin sạc dự phòng hay hub chuyển đổi đa năng)? Bạn nhắn em tên thiết bị bạn đang dùng để em chọn loại tương thích tốt nhất nhé! 😊`;
            suggestions = [
                'Chuột công thái học Logitech',
                'Bàn phím cơ gõ êm',
                'Củ sạc nhanh GaN Anker',
                'Pin sạc dự phòng dung lượng cao'
            ];
            break;
        }

        default: {
            question = `Dạ chào bạn! Để em tư vấn và chọn được sản phẩm phù hợp nhất với nhu cầu của bạn, bạn có thể chia sẻ mức ngân sách dự kiến khoảng bao nhiêu và những tính năng bạn ưu tiên nhất nhé! 😊`;
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
            missingSlots: !existingSlots.budget ? ['budget'] : ['useCase'],
            lastQuestionKey: questionKey,
            askedSlots: Array.from(new Set([...(existingSlots.askedSlots || []), questionKey])),
            repeatCount: 0
        }
    };
}

/**
 * 4. Chẩn đoán máy cũ (Upgrade vs Buy-New)
 */
async function handleOldDeviceDiagnosis(message, context = {}) {
    const norm = normalizeText(message);

    const isCoreI5Gen8 = norm.includes('the he 8') || norm.includes('gen 8') || norm.includes('doi 8') || norm.includes('8250') || norm.includes('8350');

    let reply = `Dạ em hiểu vấn đề bạn đang gặp phải ạ! Trước khi quyết định chi một khoản tiền lớn để mua máy mới, em và bạn hãy cùng kiểm tra nhanh tình trạng máy hiện tại nhé: 🔍\n\n`;

    if (isCoreI5Gen8) {
        reply += `💡 **Đánh giá kỹ thuật thực tế:**\n` +
            `Chip **Intel Core i5 thế hệ thứ 8** (như i5-8250U, i5-8350U) đã được Intel nâng cấp lên **4 nhân 8 luồng** và có hỗ trợ tập lệnh cao cấp (bao gồm AVX2). Về mặt xử lý thuần túy, con chip này vẫn hoàn toàn gánh tốt các tác vụ văn phòng, học online, Word, Excel nặng và lướt web hàng chục tab.\n\n` +
            `Nguyên nhân máy chạy chậm thường do 2 "nút thắt cổ chai" phần cứng sau:\n` +
            `1. **Ổ cứng còn dùng HDD cơ truyền thống:** Tốc độ chỉ ~100MB/s, gây hiện tượng 100% Disk làm máy bị đơ giật. Nâng cấp lên **ổ SSD 256GB - 512GB** (chi phí chỉ khoảng 400.000 - 700.000 đ) sẽ giúp máy khởi động trong 10 giây và mở app tức thì.\n` +
            `2. **Dung lượng RAM chỉ 4GB - 8GB:** Các trình duyệt hiện đại ngốn khá nhiều RAM. Nâng lên **16GB RAM** (khoảng 400.000 đ) sẽ giải quyết triệt để tình trạng tràn bộ nhớ.\n\n` +
            `👉 **Lời khuyên chân thành từ cửa hàng:**\n` +
            `• **Nên NÂNG CẤP (chỉ tốn khoảng 800k - 1.2tr):** Nếu nhu cầu của bạn chỉ là học tập, làm việc văn phòng, xem phim, làm kế toán.\n` +
            `• **Nên MUA MÁY MỚI:** Nếu bạn cần làm đồ họa 3D, dựng video 4K, lập trình chạy máy ảo Docker nặng, hoặc máy cũ đã chai pin hoàn toàn và màn hình xuống cấp.\n\n` +
            `Bạn có thể cho em biết máy của bạn hiện đang dùng ổ cứng loại nào và RAM bao nhiêu GB không ạ?`;
    } else {
        reply += `Để biết máy cũ nên nâng cấp hay đổi máy mới, bạn cho em hỏi 3 thông tin nhanh nhé:\n` +
            `1. Máy bạn hiện đang chạy ổ SSD hay HDD, và dung lượng RAM là bao nhiêu GB?\n` +
            `2. Tình trạng chậm thường xảy ra khi bạn mở máy hay khi làm tác vụ cụ thể nào?\n` +
            `3. Nhu cầu công việc sắp tới của bạn có đòi hỏi xử lý đồ họa, lập trình nặng hay chơi game không?\n\n` +
            `Nếu máy chỉ cần nâng cấp thêm RAM/SSD thì chi phí rất tiết kiệm (chỉ dưới 1 triệu). Nếu bạn muốn tham khảo các mẫu máy mới mỏng nhẹ thế hệ mới, em cũng sẵn sàng tư vấn chi tiết nhé!`;
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
    budgetMin = null,
    budgetMax = null,
    budgetType = 'unspecified',
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

    const effectiveBudget = budgetMin || budgetMax || budget || 0;
    const effectiveType = budgetType !== 'unspecified' ? budgetType : (budgetMin && !budgetMax ? 'min' : (budgetMax ? 'max' : 'exact'));

    if (effectiveType === 'min' || (budgetMin > 0 && !budgetMax)) {
        const minVal = budgetMin || budget;
        query.price = { $gte: minVal };
    } else if (budgetMin && budgetMax) {
        query.price = { $gte: budgetMin, $lte: budgetMax };
    } else if (effectiveBudget > 0) {
        if (isHardBudget) {
            query.price = { $lte: effectiveBudget };
        } else {
            // Soft budget: cho phép cận trên 10%
            query.price = { $lte: Math.round(effectiveBudget * 1.1) };
        }
    }

    // Tìm kiếm trong database
    let candidates = await Product.find(query).sort(effectiveType === 'min' ? { rating: -1, soldCount: -1, price: 1 } : { rating: -1, soldCount: -1 });

    // Nếu lọc ngân sách không có máy nào trong kho
    if (!candidates.length && effectiveBudget > 0) {
        let lowestInCat = null;
        const queryPool = {
            category,
            active: { $ne: false },
            stock: { $gt: 0 },
            ...(eliminatedBrands.length ? { brand: { $nin: eliminatedBrands } } : {})
        };
        if (brand) {
            const brandPool = await Product.find({ ...queryPool, brand: new RegExp(escapeRegex(brand), 'i') });
            if (brandPool.length) {
                brandPool.sort((a, b) => Math.abs(a.price - effectiveBudget) - Math.abs(b.price - effectiveBudget));
                lowestInCat = brandPool[0];
            }
        }
        if (!lowestInCat) {
            const allInCat = await Product.find(queryPool);
            if (allInCat.length) {
                allInCat.sort((a, b) => Math.abs(a.price - effectiveBudget) - Math.abs(b.price - effectiveBudget));
                lowestInCat = allInCat[0];
            }
        }

        if (lowestInCat) {
            const downPay = Math.round(lowestInCat.price * 0.3);
            const monthlyInst = Math.round((lowestInCat.price * 0.7) / 12);
            const diff = lowestInCat.price - effectiveBudget;

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
            const reply = `Dạ hiện tại cửa hàng chuyên phân phối **100% sản phẩm mới chính hãng** kèm bảo hành 12 - 24 tháng. 🙏\n\n` +
                `Trong danh mục **${category}**${brandScope}, mức ngân sách dự kiến **${money(effectiveBudget)}** của bạn hiện thấp hơn mức giá của ${categoryItemNoun} có giá tốt nhất tại kho.\n` +
                `Em xin phép **hiển thị ngay trên trang ${categoryItemNoun} có giá gần nhất và tiết kiệm nhất** để bạn dễ quan sát nhé:\n` +
                `⭐ **${lowestInCat.name}** - Giá: **${money(lowestInCat.price)}** (chênh lệch khoảng +${money(diff)} so với dự kiến của bạn).\n\n` +
                `Để hỗ trợ bạn sở hữu thiết bị tốt nhất mà không bị áp lực tài chính, cửa hàng có 3 giải pháp:\n` +
                `1. 💳 **Trả góp 0% lãi suất:** Bạn chỉ cần trả trước 30% (${money(downPay)}), số tiền còn lại chia góp chỉ khoảng **${money(monthlyInst)}/tháng** (duyệt hồ sơ online 15 phút chỉ cần CCCD).\n` +
                `2. 🎟️ **Áp voucher giảm giá:** Kiểm tra mã giảm giá đang kích hoạt hôm nay để trừ trực tiếp vào đơn hàng.\n` +
                `${alternativeAdvice}\n` +
                `👉 Bạn có muốn xem chi tiết mẫu **${lowestInCat.name}** này hay để em tính bảng trả góp 0% cho bạn nhé?`;

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
                    budget: effectiveBudget,
                    budgetMin,
                    budgetMax,
                    budgetType: effectiveType,
                    lastProducts: [lowestInCat],
                    topProduct: lowestInCat,
                    isNearestMatch: true,
                    currentIntent: 'out_of_budget_scope'
                }
            };
        }

        return {
            reply: `Dạ hiện tại cửa hàng chưa có sản phẩm nào trong danh mục **${category}** ở mức ngân sách **${money(effectiveBudget)}** ạ. Mức giá các dòng sản phẩm chính hãng tại kho hiện bắt đầu từ phân khúc cao hơn. Bạn có thể cân nhắc chuyển sang hình thức **Trả góp 0%** hoặc tham khảo các danh mục sản phẩm khác nhé! 😊`,
            products: [],
            suggestions: ['Tính trả góp 0%', 'Săn mã giảm giá', 'Tư vấn danh mục khác'],
            context: { ...context, category, budget: effectiveBudget, budgetMin, budgetMax, budgetType: effectiveType }
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
            reply: `Dạ hiện tại cửa hàng chưa có sản phẩm nào phù hợp với bộ lọc này ạ. Bạn có thể mở rộng khoảng ngân sách hoặc chuyển sang dòng sản phẩm khác nhé! 😊`,
            products: [],
            suggestions: ['Tính trả góp 0%', 'Săn mã giảm giá', 'Tư vấn danh mục khác'],
            context: { ...context, category, budget }
        };
    }

    // Nếu chỉ có đúng 1 sản phẩm thỏa mãn
    if (selected.length === 1) {
        const single = selected[0];
        const s = single.specs || {};
        const defaultSingleReply = `Dạ trong tầm ngân sách và tiêu chí của bạn, hiện tại cửa hàng có **duy nhất 1 lựa chọn chính hãng xuất sắc nhất** đáp ứng trọn vẹn là:\n\n` +
            `⭐ **${single.name}** - Giá: **${money(single.price)}** (Kho còn ${single.stock} máy)\n` +
            `• Cấu hình: CPU ${s.cpu || ''} | RAM ${s.ram || ''} | Ổ cứng ${s.storage || ''} | Màn hình ${s.screen || ''}\n` +
            `• Điểm mạnh: Cấu hình ổn định, thời lượng pin tốt, bảo hành chính hãng ${single.warranty || '12 tháng'}.\n\n` +
            `Do kho chỉ còn mẫu này phù hợp nhất với tầm giá, bạn có muốn em gửi bảng tính trả góp hoặc thêm vào giỏ hàng ngay không ạ?`;

        const groundedSingle = await aiModelService.generateGroundedConsultation({
            userMessage: context.currentMessage || `Tư vấn sản phẩm ${single.name}`,
            dialogueAct: 'recommend',
            verifiedProducts: selected,
            context,
            fallbackText: defaultSingleReply
        });

        return {
            reply: groundedSingle.reply,
            products: selected,
            suggestions: [`Thêm ${single.name} vào giỏ`, 'Tính trả góp 0%', 'Xem chính sách bảo hành'],
            context: {
                ...context,
                category,
                budget,
                lastProducts: selected,
                currentIntent: 'recommend_single'
            },
            meta: {
                provider: groundedSingle.provider,
                model: groundedSingle.model,
                isFallback: groundedSingle.isFallback
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
    } else if (category === 'Điện thoại' && selected.length >= 2) {
        const s1 = p1?.specs || {};
        const s2 = p2?.specs || {};
        tradeOffAnalysis =
            `1. 🌟 **Phương án 1:** **${p1.name}** (${money(p1.price)})\n` +
            `   • **Ưu điểm nổi bật:** ${s1.camera ? `Camera ${s1.camera}, ` : ''}${s1.cpu ? `Chip ${s1.cpu}, ` : ''}${s1.screen ? `Màn hình ${s1.screen}, ` : ''}pin ${s1.battery || 'bền bỉ'}.\n` +
            `   • **Điểm đánh đổi:** ${p1.price > p2.price ? `Mức giá cao hơn ${money(p1.price - p2.price)} nhưng đổi lại cấu hình và camera vượt trội.` : 'Bộ nhớ hoặc tốc độ sạc ở mức tiêu chuẩn.'}\n\n` +
            `2. 🌟 **Phương án 2:** **${p2.name}** (${money(p2.price)})\n` +
            `   • **Ưu điểm nổi bật:** ${p2.price < p1.price ? `Giá tiết kiệm hơn (${money(p1.price - p2.price)}), ` : ''}${s2.battery ? `Pin ${s2.battery}, ` : ''}${s2.camera ? `Camera ${s2.camera}, ` : ''}giao diện mượt mà dễ sử dụng.\n` +
            `   • **Điểm đánh đổi:** ${p2.price < p1.price ? 'Thông số camera và hiệu năng chip thấp hơn phương án 1 một chút.' : 'Kích thước hoặc trọng lượng có thể lớn hơn.'}`;

        conditionalConclusion =
            `📌 **GỢI Ý QUYẾT ĐỊNH CHO BẠN:**\n` +
            `• Nếu bạn ưu tiên **chụp ảnh sắc nét, màn hình đẹp và cấu hình mạnh mẽ lâu dài** -> Nên chọn **${p1.price >= p2.price ? p1.name : p2.name}**.\n` +
            `• Nếu bạn ưu tiên **tối ưu chi phí, pin bền bỉ cả ngày và giao diện thân thiện** -> Nên chọn **${p1.price < p2.price ? p1.name : p2.name}**.`;
    } else {
        tradeOffAnalysis = selected.map((p, idx) => {
            const ps = p.specs || {};
            const keyHighlight = ps.cpu ? `Chip ${ps.cpu}` : (ps.connectivity || ps.screen || '');
            const displayPrice = money(p.price);
            return `${idx + 1}. 🌟 **Phương án ${idx + 1}:** **${p.name}** (${displayPrice})\n` +
                `   • **Ưu điểm nổi bật:** ${keyHighlight ? `${keyHighlight}, ` : ''}${ps.camera ? `Camera ${ps.camera}, ` : ''}${ps.battery ? `Pin ${ps.battery}, ` : ''}bảo hành chính hãng ${p.warranty || '12 tháng'}.\n` +
                `   • **Tình trạng:** Sẵn hàng kho (${p.stock} máy), hỗ trợ trả góp 0% chỉ từ ~${money(Math.round(p.price * 0.7 / 12))}/tháng.`;
        }).join('\n\n');
        conditionalConclusion = `💡 **Gợi ý lựa chọn:** Cả hai sản phẩm đều là hàng mới chính hãng 100%. Bạn có thể bấm vào thẻ sản phẩm bên dưới để xem hình ảnh thực tế và cấu hình chi tiết nhé!`;
    }

    let budgetText = '';
    if (effectiveType === 'min') {
        budgetText = `ngân sách từ **${money(budgetMin || budget)} trở lên** (phân khúc cao cấp & flagship)`;
    } else if (budgetMin && budgetMax) {
        budgetText = `khoảng ngân sách **từ ${money(budgetMin)} đến ${money(budgetMax)}**`;
    } else if (effectiveBudget > 0) {
        budgetText = `ngân sách **dưới ${money(budgetMax || effectiveBudget)}**`;
    }
    let brandText = brand ? `thương hiệu **${brand}**` : '';
    let criteriaText = [brandText, budgetText].filter(Boolean).join(' ');

    const defaultReply = `Dạ dựa trên nhu cầu **${useCase || 'sử dụng'}** ${criteriaText ? `với ${criteriaText}, ` : ''}em xin đề xuất **${selected.length} phương án tối ưu nhất** tại kho của shop kèm phân tích điểm được và điểm đánh đổi để bạn dễ dàng lựa chọn:\n\n` +
        `${tradeOffAnalysis}\n\n` +
        `${conditionalConclusion}\n\n` +
        `👉 Bạn đang nghiêng về phương án nào hơn, hoặc bạn muốn em so sánh chi tiết hơn về điểm nào giữa các mẫu máy này không ạ? 😊`;

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

    // A0-gaming: Người dùng hỏi về tư thế chơi game (hay nằm chơi game, nằm trên giường, nằm sofa, cầm tay chơi...)
    const isLyingDownOrBedGaming = /\b(nam\s+(?:de\s+)?choi|nam\s+choi|nam\s+tren\s+giuong|nam\s+sofa|hay\s+nam|nam\s+nghi|nam\s+luoi)\b/i.test(norm)
        || (/\bnam\b/i.test(norm) && /\bchoi\s+game\b/i.test(norm));

    if (isLyingDownOrBedGaming) {
        const switchProduct = await Product.findOne({ name: /Nintendo Switch/i, active: { $ne: false } }).lean();
        const rogAllyProduct = await Product.findOne({ name: /ROG Ally/i, active: { $ne: false } }).lean();

        const recProducts = [switchProduct, rogAllyProduct].filter(Boolean);

        const reply = `Dạ nếu bạn **thường xuyên nằm trên giường hoặc ghế sofa để chơi game**, thì các dòng **Máy chơi game cầm tay (Handheld)** như **Nintendo Switch OLED** hoặc **ASUS ROG Ally** là sự lựa chọn chân ái nhất ạ! 😊\n\n` +
            `⚠️ **Lưu ý quan trọng về PS5:** Mẫu **Sony PS5 Slim** là hệ console cắm TV cố định (cần màn hình TV và dây nguồn trực tiếp), nên bạn **không thể nằm cầm tay chơi độc lập** trên giường được.\n\n` +
            `Để bạn dễ dàng chọn được chiếc máy phù hợp nhất khi nằm chơi, em xin phân tích ưu nhược điểm thực tế của 2 mẫu máy cầm tay đỉnh nhất tại shop:\n\n` +
            `1. 🌟 **Nintendo Switch OLED Model** — Giá: **${switchProduct ? money(switchProduct.price) : '7.990.000 ₫'}** *(Top 1 lý tưởng khi nằm chơi)*\n` +
            `   • **Ưu điểm khi nằm chơi:** Máy rất nhẹ (chỉ ~420g) nên cầm nằm lâu trên không trung **không hề bị mỏi cổ tay**. Đặc biệt, bạn có thể **tháo rời 2 tay cầm Joy-Con** ra hai bên để buông thõng hai tay tự do dưới chăn, dựng màn hình máy trên nệm/bàn bằng chân chống kickstand để chơi cực kỳ thư giãn và sướng tay!\n` +
            `   • **Màn hình & Pin:** Màn OLED 7 inch rực rỡ, pin trâu từ 4.5 – 9 tiếng và vận hành êm ru, không bị nóng phả vào tay.\n` +
            `   • **Điểm đánh đổi:** Phù hợp nhất cho các tựa game độc quyền của Nintendo (Mario, Zelda, Pokemon, Animal Crossing...) và game gia đình, không chơi được các game đồ họa nặng của PC.\n\n` +
            `2. 🌟 **ASUS ROG Ally Z1 Extreme** — Giá: **${rogAllyProduct ? money(rogAllyProduct.price) : '14.990.000 ₫'}** *(Cỗ máy cày game PC cầm tay)*\n` +
            `   • **Ưu điểm:** Chạy Windows 11 với chip AMD Ryzen Z1 Extreme cực mạnh, chiến mượt mà mọi tựa game PC khủng trên Steam, Epic, Game Pass (như Black Myth: Wukong, Cyberpunk 2077, GTA V, FC 24) với màn hình 120Hz siêu mượt.\n` +
            `   • **Điểm đánh đổi khi nằm chơi:** Trọng lượng máy nặng hơn (~608g) nên giơ tay nằm chơi lâu sẽ dễ mỏi tay, máy tải nặng sẽ ấm hơn và pin chơi game AAA khoảng 1.5 – 2 tiếng nên thường cần cắm sạc khi nằm chơi lâu.\n\n` +
            `🎯 **GỢI Ý QUYẾT ĐỊNH:**\n` +
            `👉 Nếu bạn thích **nhẹ nhàng, nằm chơi lâu không mỏi tay, tháo tay cầm nằm lười thư giãn** -> Bạn chọn ngay **Nintendo Switch OLED** nhé!\n` +
            `👉 Nếu bạn muốn **nằm trên giường nhưng phải cày được game nặng của PC / Steam** -> Hãy chọn **ASUS ROG Ally Z1 Extreme** nhé!\n\n` +
            `Bạn đang nghiêng về trải nghiệm thư giãn nhẹ nhàng của Switch hay muốn cày game PC khủng của ROG Ally ạ? 😊`;

        return {
            reply,
            products: recProducts.length > 0 ? recProducts : (lastProducts || []),
            suggestions: [
                'Xem Nintendo Switch OLED',
                'Xem ASUS ROG Ally',
                'Tư vấn trả góp 0%',
                'Săn mã giảm giá'
            ],
            context: {
                ...context,
                category: 'Máy chơi game',
                productType: 'máy chơi game',
                lastProducts: recProducts.length > 0 ? recProducts : (lastProducts || []),
                currentIntent: 'recommended_handheld_gaming'
            }
        };
    }

    // A0. Khách đính chính / phàn nàn bot hiểu ngược hướng ngân sách ("Trên 20tr mà", "Cái này là dưới 20tr", "Tôi tìm trên 20tr mà bạn cứ gợi ý dưới 20tr là sao")
    const isBudgetDirectionCorrection = /\b(tren\s+\d+|tren\s+\d+tr|tren\s+\d+\s+trieu|tim\s+tren|bao\s+la\s+tren|noi\s+la\s+tren|goi\s+y\s+duoi|cai\s+nay\s+la\s+duoi)\b/i.test(norm)
        || (norm.includes('tren') && norm.includes('20') && (norm.includes('ma') || norm.includes('sao') || norm.includes('duoi')));

    if (isBudgetDirectionCorrection) {
        const budgetInfo = extractBudgetInfo(message);
        const correctedBudget = budgetInfo?.amount || extractBudget(message) || context.budget || 20000000;
        const category = context.category || 'Điện thoại';
        const brand = context.brand || '';

        const queryFlagship = {
            category,
            active: { $ne: false },
            stock: { $gt: 0 },
            price: { $gte: correctedBudget }
        };
        if (brand) {
            queryFlagship.brand = new RegExp(escapeRegex(brand), 'i');
        }

        let flagships = await Product.find(queryFlagship).sort({ rating: -1, soldCount: -1, price: 1 }).limit(3);
        if (!flagships.length && brand) {
            delete queryFlagship.brand;
            flagships = await Product.find(queryFlagship).sort({ rating: -1, soldCount: -1, price: 1 }).limit(3);
        }

        if (flagships.length > 0) {
            const listText = flagships.map((p, idx) => {
                const s = p.specs || {};
                const high = [s.cpu && `Chip ${s.cpu}`, s.camera && `Camera ${s.camera}`, s.screen && `Màn hình ${s.screen}`].filter(Boolean).slice(0, 2).join(' • ');
                return `${idx + 1}. 👑 **${p.name}** — Giá: **${money(p.price)}**\n` +
                    `   • **Đẳng cấp Flagship:** ${high || 'Cấu hình đỉnh cao, hoàn thiện sang trọng'}.\n` +
                    `   • **Quyền lợi:** Hàng mới nguyên seal 100%, bảo hành chính hãng ${p.warranty || '12 - 24 tháng'}, hỗ trợ trả góp 0% chỉ từ ~${money(Math.round(p.price * 0.7 / 12))}/tháng.`;
            }).join('\n\n');

            const reply = `Dạ em thành thật xin lỗi bạn vì đã hiểu nhầm hướng ngân sách ở lượt trước ạ! 🙏 Em xin đính chính ngay: cửa hàng hiện có đầy đủ các siêu phẩm **${category} đỉnh cao phân khúc từ ${money(correctedBudget)} trở lên** tại kho để bạn lựa chọn:\n\n` +
                `${listText}\n\n` +
                `👉 Bạn đang quan tâm đến mẫu máy nào trong các siêu phẩm trên để em tư vấn chi tiết các phiên bản màu và ưu đãi độc quyền hôm nay nhé! 😊`;

            return {
                reply,
                products: flagships,
                suggestions: flagships.map(p => `Xem ${p.name.replace(/(Điện thoại|Laptop)\s*/gi, '').slice(0, 20)}`).concat(['Tính trả góp 0%', 'Săn mã giảm giá']).slice(0, 5),
                context: {
                    ...context,
                    category,
                    budget: correctedBudget,
                    budgetMin: correctedBudget,
                    budgetMax: null,
                    budgetType: 'min',
                    lastProducts: flagships,
                    currentIntent: 'recommended_flagship'
                }
            };
        }
    }

    // A. Người dùng yêu cầu xem chi tiết máy thứ N ("máy thứ hai", "mẫu số 1")
    const ordinal = extractOrdinalReference(message);
    if (ordinal && lastProducts.length >= ordinal) {
        const targetProduct = await Product.findById(lastProducts[ordinal - 1]._id || lastProducts[ordinal - 1]);
        if (targetProduct) {
            return await handleExactProductLookup(targetProduct, context, message);
        }
    }

    // B. Người dùng phản hồi về ngân sách theo ngữ cảnh ("20 triệu thôi", "dưới 20tr thôi", "10tr", "trên 20tr")
    const budgetInfo = extractBudgetInfo(message);
    const newBudget = budgetInfo?.amount || extractBudget(message);
    const catInMsg = inferCategory(message);
    const brandInMsg = extractBrandMention(message);

    // Nếu tin nhắn có nhắc đến danh mục mới hoặc thương hiệu mới -> Để luồng chính (Step 4 & 5) xử lý chuẩn xác!
    if (newBudget && !catInMsg && !brandInMsg) {
        const isHard = isHardBudgetLimit(message) || norm.includes('thoi');
        const category = context.category || 'Điện thoại';
        const brand = context.brand || '';
        const useCase = context.useCase || '';
        const major = context.major || '';
        const budgetType = budgetInfo?.type || (norm.includes('tren') ? 'min' : (isHard ? 'hard' : 'soft'));
        const budgetMin = budgetInfo?.min || (budgetType === 'min' ? newBudget : null);
        const budgetMax = budgetInfo?.max || (budgetType !== 'min' ? newBudget : null);

        return await handleRecommendWithTradeOffs({
            category,
            brand,
            budget: newBudget,
            budgetMin,
            budgetMax,
            budgetType,
            isHardBudget: isHard,
            useCase,
            major,
            eliminatedBrands: context.eliminatedBrands || [],
            context: {
                ...context,
                category,
                brand,
                budget: newBudget,
                budgetMin,
                budgetMax,
                budgetType
            }
        });
    }

    // C. Người dùng kêu đắt ("đắt quá", "vượt ngân sách", "có con nào rẻ hơn không", "rẻ hơn nữa")
    if (isPriceObjection(message)) {
        const category = context.category || 'Laptop';
        const brand = context.brand || '';

        // Kiểm tra xem hiện tại đang có sản phẩm nào trên màn hình không
        const currentPrices = lastProducts.map(p => Number(p?.price || 0)).filter(p => p > 0);
        const minCurrentPrice = currentPrices.length > 0 ? Math.min(...currentPrices) : Infinity;

        let queryAffordable = {
            category,
            active: { $ne: false },
            stock: { $gt: 0 }
        };

        // Nếu đã có danh sách sản phẩm trước đó -> Tìm các sản phẩm rẻ hơn mức giá nhỏ nhất hiện tại!
        if (minCurrentPrice < Infinity) {
            queryAffordable.price = { $lt: minCurrentPrice };
        }
        if (brand) {
            queryAffordable.brand = new RegExp(escapeRegex(brand), 'i');
        }

        let affordableProducts = await Product.find(queryAffordable).sort({ price: -1, rating: -1 }).limit(3);

        // Nếu lọc theo brand không có máy rẻ hơn -> Thử mở rộng sang các thương hiệu khác cùng danh mục
        if (!affordableProducts.length && brand) {
            delete queryAffordable.brand;
            affordableProducts = await Product.find(queryAffordable).sort({ price: -1, rating: -1 }).limit(3);
        }

        if (affordableProducts.length > 0) {
            const lowest = affordableProducts[0];
            const downPay = Math.round(lowest.price * 0.3);
            const installmentMonth = Math.round((lowest.price - downPay) / 12);
            const priceSaving = minCurrentPrice < Infinity ? minCurrentPrice - lowest.price : 0;
            const savingText = priceSaving > 0 ? ` (Tiết kiệm thêm **${money(priceSaving)}** so với mức giá trước đó)` : '';

            const listText = affordableProducts.map((p, idx) => {
                const s = p.specs || {};
                const specHighlights = [s.cpu && `Chip ${s.cpu}`, s.ram && `RAM ${s.ram}`, s.battery && `Pin ${s.battery}`, s.camera && `Camera ${s.camera}`].filter(Boolean).slice(0, 2).join(' • ');
                return `${idx + 1}. 💡 **${p.name}** — Giá: **${money(p.price)}**${minCurrentPrice < Infinity && minCurrentPrice > p.price ? ` *(Tiết kiệm ${money(minCurrentPrice - p.price)})*` : ''}\n` +
                    `   • **Ưu điểm tối ưu:** ${specHighlights || 'Vận hành ổn định, chính hãng 100%'}.\n` +
                    `   • **Hỗ trợ:** Bảo hành ${p.warranty || '12 tháng'}, trả góp 0% chỉ từ ~${money(Math.round(p.price * 0.7 / 12))}/tháng.`;
            }).join('\n\n');

            const reply = `Dạ em hoàn toàn thấu hiểu băn khoăn về ngân sách của bạn! Để tối ưu tài chính tốt nhất cho bạn${savingText}, cửa hàng có các phương án giá kinh tế hơn sẵn hàng tại kho:\n\n` +
                `${listText}\n\n` +
                `👉 Bạn thấy phương án nào vừa vặn với túi tiền hơn, hoặc bạn có muốn em tính bảng trả góp 0% chi tiết cho bạn nhé? 😊`;

            return {
                reply,
                products: affordableProducts,
                suggestions: affordableProducts.map(p => `Xem ${p.name.slice(0, 20)}`).concat(['Tính trả góp 0%', 'Săn mã giảm giá']).slice(0, 5),
                context: {
                    ...context,
                    category,
                    budget: Math.max(...affordableProducts.map(p => p.price)),
                    budgetType: 'max',
                    lastProducts: affordableProducts,
                    currentIntent: 'handled_price_objection'
                }
            };
        } else if (minCurrentPrice < Infinity) {
            // Đã là sản phẩm rẻ nhất trong danh mục rồi (ví dụ Xiaomi Band 9 ở mức 990k)
            const currentLowestDoc = lastProducts.find(p => Number(p?.price) === minCurrentPrice) || lastProducts[0];
            const name = currentLowestDoc?.name || 'sản phẩm hiện tại';
            const categoryConfig = (config.CATEGORY_CONFIG && config.CATEGORY_CONFIG[category]) || { label: category.toLowerCase() };

            const reply = `Dạ hiện tại **${name}** với mức giá **${money(minCurrentPrice)}** đã là mẫu ${categoryConfig.label || category} có mức giá tốt và kinh tế nhất tại kho của shop rồi ạ! 🙏\n\n` +
                `Để hỗ trợ bạn mua sắm nhẹ nhàng nhất mà không lo áp lực tài chính, cửa hàng có các giải pháp sau:\n` +
                `1. 🎟️ **Mã giảm giá độc quyền:** Tặng ngay voucher giảm trực tiếp 100.000đ - 500.000đ khi thanh toán qua VNPay/MoMo.\n` +
                `2. 💳 **Trả góp 0% lãi suất:** Chia nhỏ thanh toán chỉ từ vài trăm nghìn mỗi tháng.\n` +
                `3. 🔄 **Thu cũ đổi mới:** Trợ giá thêm đến 2.000.000đ nếu bạn có thiết bị cũ muốn lên đời.\n\n` +
                `👉 Bạn có muốn em hỗ trợ áp mã giảm giá hôm nay để chốt mua mẫu **${name}** này với giá ưu đãi nhất không ạ? 😊`;

            return {
                reply,
                products: currentLowestDoc ? [currentLowestDoc] : [],
                suggestions: [
                    'Áp mã giảm giá ngay',
                    'Tư vấn trả góp 0%',
                    'Xem danh mục khác',
                    'Hỗ trợ đặt hàng'
                ],
                context: {
                    ...context,
                    category,
                    currentIntent: 'floor_price_reached'
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

        const reply = `Dạ em đã ghi nhận và loại bỏ thương hiệu **${brandToEliminate}** ra khỏi danh sách tư vấn cho bạn rồi ạ! 🤝\n\n` +
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

    // E. Người dùng muốn so sánh hoặc xin lời khuyên quyết định ("so sánh hai máy vừa rồi", "nên chọn mẫu nào phù hợp", "chọn con nào")
    const isComparisonOrDecisionRequest = [
        'so sanh', 'so voi', 'khac nhau gi', 'khac nhau', 'khac gi', '2 may nay', 'hai may nay', '3 may nay',
        'phan van', 'nen chon may nao', 'nen chon mau nao', 'nen lay con nao', 'nen mua con nao',
        'nen chon con nao', 'chon con nao', 'mau nao phu hop', 'con nao phu hop', 'may nao phu hop',
        'nen lay mau nao', 'nen mua mau nao', 'tu van chon', 'chon mau nao', 'nen chon con nao phu hop',
        'nen lay mau nao phu hop'
    ].some(k => norm.includes(k));

    if (isComparisonOrDecisionRequest) {
        const getProdId = item => {
            if (!item) return null;
            if (typeof item === 'number' || typeof item === 'string') return item;
            return item._id || item.id || null;
        };

        // 1. Nếu chỉ rõ "hai máy vừa rồi", "2 máy trên", hoặc đã có lastProducts
        if (lastProducts.length >= 2 && ['hai may', '2 may', 'vua roi', 'tren', 'do', 'nay', 'vua goi y'].some(k => norm.includes(k))) {
            const id1 = getProdId(lastProducts[0]);
            const id2 = getProdId(lastProducts[1]);
            const p1 = id1 ? await Product.findById(id1) : null;
            const p2 = id2 ? await Product.findById(id2) : null;
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
        if (lastProducts.length === 2) {
            const id1 = getProdId(lastProducts[0]);
            const id2 = getProdId(lastProducts[1]);
            const p1 = id1 ? await Product.findById(id1) : null;
            const p2 = id2 ? await Product.findById(id2) : null;
            if (p1 && p2) {
                return await buildComparisonResponse(p1, p2, context);
            }
        } else if (lastProducts.length >= 3) {
            const productIds = lastProducts.slice(0, 3).map(p => getProdId(p)).filter(Boolean);
            const prods = await Product.find({ _id: { $in: productIds } });
            if (prods.length >= 2) {
                const breakdown = prods.map((p, idx) => {
                    const s = p.specs || {};
                    const high = [s.cpu && `Chip ${s.cpu}`, s.ram && `RAM ${s.ram}`, s.screen && `Màn hình ${s.screen}`, s.battery && `Pin ${s.battery}`].filter(Boolean).slice(0, 2).join(' • ');
                    return `${idx + 1}. 🌟 **${p.name}** — Giá: **${money(p.price)}**\n` +
                        `   • **Điểm nổi bật:** ${high || 'Cấu hình tiêu chuẩn chính hãng'}.\n` +
                        `   • **Phù hợp nhất cho:** ${p.description ? p.description.slice(0, 120) + '...' : 'Khách hàng có nhu cầu sử dụng lâu dài bền bỉ'}.`;
                }).join('\n\n');

                const reply = `Dạ để giúp bạn dễ dàng quyết định mẫu máy phù hợp nhất trong 3 lựa chọn trên, em xin tóm tắt tiêu chí lựa chọn nhanh cho bạn nhé:\n\n` +
                    `${breakdown}\n\n` +
                    `👉 Bạn đang ưu tiên tiêu chí nào nhất (như tối ưu chi phí tiết kiệm, hiệu năng mạnh mẽ hay tính cơ động di chuyển) để em tư vấn chốt mẫu chuẩn xác nhất cho bạn nhé! 😊`;

                return {
                    reply,
                    products: prods,
                    suggestions: prods.map(p => `Xem ${p.name.slice(0, 20)}`).concat(['Tính trả góp 0%']).slice(0, 4),
                    context: {
                        ...context,
                        lastProducts: prods,
                        currentIntent: 'decision_guidance'
                    }
                };
            }
        }
    }

    // F. Người dùng hỏi sâu về sản phẩm đang xem / vừa được gợi ý ("máy này pin bao lâu", "nó có tác dụng gì", "mấy loại này có gì tốt", "ưu nhược điểm", "sản phẩm này có gì tốt", "tại sao tôi nên mua")
    const isDeepProductQuestion = /\b(may nay|con nay|mau nay|chiec nay|san pham nay|thiet bi nay|em nay|chu nay|pin|sac|man hinh|camera|chup anh|quay phim|choi game|gaming|nong|tan nhiet|nang|mong|nhe|ben|code|lap trinh|do hoa|render|uu diem|nhuoc diem|danh gia|review|tot khong|on khong|muot khong|ben khong|phu hop|co nen mua|nen mua khong|tai sao nen mua|tai sao toi nen mua|dung duoc gi|co gi tot|co gi hay|co gi noi bat|tai sao|vi sao|ly do|co nen|co dang|tac dung|cong dung|chuc nang|tinh nang|lam duoc gi|dung de lam gi|co tac dung gi)\b/i.test(norm);
    if (lastProducts.length > 0 && isDeepProductQuestion && !catInMsg && !brandInMsg && context.stage !== 'qualifying_needs') {
        const productIds = lastProducts.slice(0, 3).map(item => item?._id || item).filter(Boolean);
        const verifiedDocs = await Product.find({ _id: { $in: productIds }, active: { $ne: false } });
        if (verifiedDocs.length > 0) {
            const primary = verifiedDocs[0];
            const s = primary.specs || {};
            const isWhyOrStrengths = /\b(tai sao|vi sao|ly do|co gi tot|co gi hay|co gi noi bat|uu diem|co nen mua|nen mua khong|co dang)\b/i.test(norm);
            const isSmartWatchOrBand = primary.category === 'Đồng hồ thông minh' || /band|watch|dong ho|vong đeo tay/i.test(primary.name);

            let fallbackQa;
            if (isSmartWatchOrBand && /\b(tac dung|cong dung|dung duoc gi|lam duoc gi|tinh nang|chuc nang|co gi tot|co nen mua)\b/i.test(norm)) {
                fallbackQa = `Dạ mẫu **${primary.name}** (Giá: **${money(primary.price)}**) mang lại rất nhiều công năng thiết thực cho sức khỏe và cuộc sống hàng ngày của bạn:\n\n` +
                    `1. 🩺 **Theo dõi sức khỏe 24/7:** Đo nhịp tim liên tục, nồng độ oxy trong máu SpO2, theo dõi mức độ căng thẳng (stress) và phân tích giấc ngủ chuyên sâu.\n` +
                    `2. 🏃 **Trợ lý luyện tập thể thao:** Đếm bước chân, tính lượng calo tiêu thụ, hỗ trợ hàng chục chế độ thể thao (chạy bộ, đạp xe, bơi lội...).\n` +
                    `3. 📲 **Nhận thông báo thông minh:** Đồng bộ trực tiếp với điện thoại, hiển thị cuộc gọi, tin nhắn SMS, Zalo ngay trên cổ tay.\n` +
                    `4. 🔋 **Pin cực trâu & Kháng nước:** Thời lượng pin bền bỉ cả tuần chỉ với một lần sạc, chuẩn kháng nước yên tâm đi mưa và rửa tay.\n\n` +
                    `👉 Đây là thiết bị rất đáng mua để theo dõi sức khỏe mỗi ngày! Bạn có muốn em hỗ trợ thêm vào giỏ hàng hoặc tư vấn màu sắc sẵn hàng không ạ? 😊`;
            } else if (isWhyOrStrengths) {
                fallbackQa = `Dạ về lý do bạn rất nên cân nhắc sở hữu **${primary.name}** (Giá ưu đãi: **${money(primary.price)}**):\n\n` +
                    `1. 🚀 **Hiệu năng & Trải nghiệm thực tế:** ${[s.cpu && `Trang bị ${s.cpu}`, s.ram && `RAM ${s.ram}`, s.storage && `Bộ nhớ ${s.storage}`, s.screen && `Màn hình ${s.screen}`].filter(Boolean).join(', ') || 'Cấu hình tiêu chuẩn chính hãng'}, vận hành cực kỳ mượt mà, phản hồi nhạy bén và phục vụ tốt nhu cầu trong 3 - 5 năm tới.\n` +
                    `2. 🔋 **Độ bền & Tính cơ động:** ${s.battery ? `Thời lượng pin ${s.battery}` : 'Thời lượng pin bền bỉ cả ngày dài'}, ${s.weight ? `trọng lượng gọn nhẹ chỉ ${s.weight}` : 'thiết kế hiện đại, cao cấp'} thuận tiện mang theo học tập và làm việc.\n` +
                    `3. 🛡️ **Quyền lợi mua sắm tại cửa hàng:** Đảm bảo 100% chính hãng, bảo hành chính hãng ${primary.warranty || '12 - 24 tháng'} (lỗi 1 đổi 1 trong 30 ngày đầu), hỗ trợ trả góp 0% chỉ từ ~${money(Math.round(primary.price * 0.7 / 12))}/tháng.\n\n` +
                    `👉 Nhìn chung, đây là mẫu máy rất đáng tiền trong phân khúc! Bạn có muốn em tư vấn thêm về màu sắc sẵn hàng hoặc tính bảng trả góp chi tiết không ạ?`;
            } else {
                fallbackQa = `Dạ về thắc mắc của bạn đối với **${primary.name}** (Giá: **${money(primary.price)}**):\n\n` +
                    `• **Cấu hình thực tế:** ${[s.cpu && `Vi xử lý ${s.cpu}`, s.ram && `RAM ${s.ram}`, s.storage && `Bộ nhớ ${s.storage}`, s.screen && `Màn hình ${s.screen}`, s.battery && `Pin ${s.battery}`].filter(Boolean).join(' • ') || 'Cấu hình chính hãng tiêu chuẩn'}.\n` +
                    `• **Đánh giá sử dụng:** Máy đáp ứng mượt mà các tác vụ học tập, làm việc và giải trí hàng ngày với độ bền cao, bảo hành chính hãng ${primary.warranty || '12 - 24 tháng'} (lỗi 1 đổi 1 trong 30 ngày).\n\n` +
                    `👉 Bạn có muốn em tính chi tiết bảng trả góp 0% hoặc hỗ trợ đặt mua mẫu **${primary.name}** này ngay không ạ?`;
            }

            const groundedQa = await aiModelService.generateGroundedConsultation({
                userMessage: message,
                dialogueAct: 'product_qa',
                verifiedProducts: verifiedDocs,
                context: {
                    ...context,
                    currentMessage: message
                },
                fallbackText: fallbackQa
            });

            return {
                reply: groundedQa.reply,
                products: verifiedDocs,
                suggestions: [
                    `Thêm ${primary.name.slice(0, 20)} vào giỏ`,
                    'Tính trả góp 0%',
                    verifiedDocs.length >= 2 ? 'So sánh 2 máy trên' : 'So sánh với máy khác',
                    'Săn mã giảm giá'
                ],
                context: {
                    ...context,
                    lastProducts: verifiedDocs,
                    currentIntent: 'product_qa'
                },
                meta: {
                    provider: groundedQa.provider,
                    model: groundedQa.model,
                    isFallback: groundedQa.isFallback
                }
            };
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

    const diffPrice = Math.abs(p1.price - p2.price);
    const cheaper = p1.price < p2.price ? p1 : p2;
    const higher = p1.price >= p2.price ? p1 : p2;

    const p1Saving = p1.price < p2.price ? ` *(Tiết kiệm ${money(diffPrice)})*` : '';
    const p2Saving = p2.price < p1.price ? ` *(Tiết kiệm ${money(diffPrice)})*` : '';

    const introLine = `Dạ em đã lập bảng so sánh chi tiết giữa **${p1.name}** và **${p2.name}** dựa trên thông số thực tế tại kho để bạn dễ dàng cân nhắc nhé:\n\n`;
    const tableMarkdown = `${introLine}⚖️ **BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT & GIÁ BÁN THỰC TẾ**

| Tiêu chí so sánh | **${p1.name}** | **${p2.name}** |
| :--- | :--- | :--- |
| **Giá niêm yết** | **${money(p1.price)}**${p1Saving} | **${money(p2.price)}**${p2Saving} |
| **Tình trạng kho** | ${p1.stock > 0 ? `Còn ${p1.stock} máy` : 'Tạm hết'} | ${p2.stock > 0 ? `Còn ${p2.stock} máy` : 'Tạm hết'} |
| **Vi xử lý (CPU)** | ${s1.cpu || 'Tiêu chuẩn'} | ${s2.cpu || 'Tiêu chuẩn'} |
| **Bộ nhớ RAM** | ${s1.ram || 'Tiêu chuẩn'} | ${s2.ram || 'Tiêu chuẩn'} |
| **Ổ cứng lưu trữ** | ${s1.storage || 'Tiêu chuẩn'} | ${s2.storage || 'Tiêu chuẩn'} |
| **Màn hình** | ${s1.screen || 'Tiêu chuẩn'} | ${s2.screen || 'Tiêu chuẩn'} |
| **Thời lượng pin** | ${s1.battery || 'Tiêu chuẩn nhà sản xuất'} | ${s2.battery || 'Tiêu chuẩn nhà sản xuất'} |
| **Trọng lượng** | ${s1.weight || 'Tiêu chuẩn'} | ${s2.weight || 'Tiêu chuẩn'} |
| **Chính sách bảo hành** | ${p1.warranty || 'Chính hãng 12-24 tháng (Lỗi 1 đổi 1 trong 30 ngày)'} | ${p2.warranty || 'Chính hãng 12-24 tháng (Lỗi 1 đổi 1 trong 30 ngày)'} |`;

    const analysis =
        `🔍 **PHÂN TÍCH ĐÁNH ĐỔI & ĐIỂM KHÁC BIỆT:**\n` +
        `• **${cheaper.name}** có ưu thế vượt trội về tài chính: Giúp bạn **tiết kiệm ngay ${money(diffPrice)}** mà vẫn đáp ứng xuất sắc mọi nhu cầu lướt web, xem phim sắc nét, học tập và tác vụ hàng ngày.\n` +
        `• **${higher.name}** vượt trội về hiệu năng và trải nghiệm cao cấp: Cấu hình mạnh mẽ hơn (${(higher.specs || {}).cpu || 'chip cao cấp'}), tản nhiệt tối ưu, màn hình rực rỡ và dùng bền bỉ 4-5 năm không lo giật lag.\n\n` +
        `🎯 **LỜI KHUYÊN CHỌN MUA ĐÚNG NHU CẦU:**\n` +
        `👉 **Chốt mua ${cheaper.name} ngay nếu:** Bạn cần chiếc máy thực dụng, pin bền, tiết kiệm tối đa ngân sách để làm việc, học tập hoặc làm máy phụ.\n` +
        `👉 **Chốt mua ${higher.name} ngay nếu:** Bạn muốn thiết bị sang trọng, chơi game đồ họa mượt mà, camera sắc nét và đầu tư lâu dài không phải đổi máy.\n\n` +
        `🛡️ **ĐẶC QUYỀN MUA HÀNG HÔM NAY TẠI CỬA HÀNG:**\n` +
        `• 100% hàng mới chính hãng, cam kết chất lượng tuyệt đối.\n` +
        `• Lỗi 1 đổi 1 trong 30 ngày đầu tiên nếu phát sinh lỗi phần cứng.\n` +
        `• Hỗ trợ trả góp 0% lãi suất (chỉ cần CCCD, xét duyệt online trong 3 phút).\n` +
        `• Miễn phí giao hàng hỏa tốc trong 2h, kiểm tra máy ưng ý mới thanh toán.\n\n` +
        `👉 Bạn thấy mẫu máy nào phù hợp với thói quen sử dụng của bạn hơn để em hỗ trợ bạn đặt hàng ngay nhé?`;

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
            `Chọn mua ${p1.name.slice(0, 22)}`,
            `Chọn mua ${p2.name.slice(0, 22)}`,
            'Tính trả góp 0%',
            'Mã giảm giá hôm nay'
        ],
        context: {
            ...context,
            lastProducts: [p1, p2],
            comparedProducts: [p1, p2],
            currentIntent: 'compare_products',
            stage: 'comparison'
        },
        meta: {
            provider: grounded.provider,
            model: grounded.model,
            isFallback: grounded.isFallback
        }
    };
}

// Resolve brand-to-brand comparisons before the normal recommendation/product-type
// dispatcher. This is intentionally deterministic so an old budget in the
// conversation context cannot turn a comparison into a recommendation.
async function resolveBrandComparison(message, context = {}) {
    const norm = normalizeText(message);
    const compareWords = ['so sanh', 'so voi', 'khac nhau', 'nen chon', 'may nao tot hon', 'chenh gia', 'hai may'];
    const isComparisonFollowup = (context.currentIntent === 'compare_products' || context.stage === 'comparison') &&
        Array.isArray(context.lastProducts) && context.lastProducts.length >= 2 &&
        /pin|man hinh|camera|hieu nang|chenh gia|re hon|dang xem|vua chon|may nao/i.test(norm);
    if (!compareWords.some(word => norm.includes(word)) && !isComparisonFollowup) return null;

    // Read brands from the catalog rather than maintaining a brand allow-list.
    // This keeps comparisons working when a new brand is added to MongoDB.
    const catalogBrands = await Product.distinct('brand', { active: { $ne: false } });
    const brands = catalogBrands
        .filter(Boolean)
        .map(name => ({ key: normalizeText(name), name: String(name) }))
        .filter(brand => {
            const firstToken = brand.key.split(/\s+/)[0];
            return hasWordOrPhrase(norm, brand.key) ||
                (firstToken.length >= 3 && hasWordOrPhrase(norm, firstToken));
        });
    // Explicit category in the current utterance wins, then the active page.
    // Older conversation context is only a fallback and must not leak across
    // category switches (for example keyboard -> power bank).
    let category = inferCategory(message) || context.pageCategory || context.category || '';
    // Brand names such as Xiaomi also exist in phones; an explicit category
    // phrase (or the active catalog page) must take precedence.
    if (/tablet|may tinh bang|ipad|galaxy tab|xiaomi pad/i.test(norm)) category = 'Tablet';
    let products = [];

    // A follow-up such as “hai máy này” must use the products already shown.
    if (brands.length < 2 && context.lastProducts && context.lastProducts.length >= 2 &&
        (context.currentIntent === 'compare_products' || context.stage === 'comparison' ||
            /hai may|2 may|dang hien thi|vua roi|tren|chenh gia|man hinh|pin|camera/i.test(norm))) {
        const candIds = context.lastProducts.slice(0, 2).map(item => (typeof item === 'number' || typeof item === 'string') ? item : (item._id || item.id)).filter(Boolean);
        products = await Product.find({
            _id: { $in: candIds },
            active: { $ne: false }
        });
    }

    if (brands.length >= 2) {
        const query = { active: { $ne: false }, stock: { $gt: 0 } };
        if (category) query.category = category;
        const scoped = await Product.find(query).sort({ rating: -1, soldCount: -1, price: 1 });
        for (const brand of brands.slice(0, 2)) {
            const token = brand.key.split(/\s+/)[0];
            const candidates = scoped.filter(product => {
                const productBrand = normalizeText(product.brand || '');
                const productName = normalizeText(product.name || '');
                return productBrand === brand.key || productBrand.includes(token) || productName.includes(token);
            });
            if (candidates.length) products.push(candidates[0]);
        }
    }

    // “So sánh hai điện thoại Samsung này” names one brand but explicitly asks
    // for two models. Use the best two in that brand/category, never the stale
    // budget recommendation path.
    if (products.length === 0 && brands.length === 1 &&
        /hai dien thoai|2 dien thoai|hai may|2 may/i.test(norm)) {
        const query = { active: { $ne: false }, stock: { $gt: 0 } };
        if (category) query.category = category;
        const token = brands[0].key.split(/\s+/)[0];
        const scoped = await Product.find(query).sort({ rating: -1, soldCount: -1, price: 1 });
        products = scoped.filter(product => {
            const productBrand = normalizeText(product.brand || '');
            return productBrand === brands[0].key || productBrand.includes(token) || normalizeText(product.name || '').includes(token);
        }).slice(0, 2);
    }

    if (products.length !== 2) return null;
    return buildComparisonResponse(products[0], products[1], {
        ...context,
        currentMessage: message,
        category: category || products[0].category,
        budget: 0,
        budgetType: 'unspecified',
        currentIntent: 'compare_products'
    });
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
                    brandIntro = `Dạ với thương hiệu **${brandScope}** trong dòng **Tai nghe không dây**, cửa hàng có sẵn mẫu tai nghe cao cấp hàng đầu:\n` +
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
                ? `${brandIntro}${generalBreakdown}\n\n👉 Bạn muốn tìm mẫu **nhét tai nhỏ gọn (In-ear/TWS)** hay **chụp tai (Over-ear)**, và dự kiến ngân sách khoảng bao nhiêu để em tư vấn mẫu phù hợp nhất cho bạn nhé! 😊`
                : `Dạ chào bạn! Với dòng **Tai nghe không dây (Bluetooth / True Wireless)**, cửa hàng hiện phân phối chính hãng 100% các mẫu hàng đầu từ **Apple, Sony, Samsung, Marshall và JBL** (bảo hành 12 tháng, hỗ trợ trả góp 0%):\n\n` +
                `${generalBreakdown}\n\n` +
                `👉 Bạn đang tìm mẫu **nhét tai nhỏ gọn (In-ear/TWS)** hay **chụp tai thoải mái (Over-ear)**, và dự kiến tầm ngân sách khoảng bao nhiêu để em tư vấn mẫu ưng ý nhất cho bạn nhé! 😊`;

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

            const reply = `Dạ chào bạn! Nếu bạn thích sự ổn định tuyệt đối, không có độ trễ và không phải lo sạc pin của dòng **Tai nghe có dây**, cửa hàng có sẵn các mẫu chính hãng nổi bật:\n\n` +
                `${displayList}\n\n` +
                `1. **Apple EarPods Lightning MWTY3ZA/A (499.000 đ):** Lựa chọn kinh tế nhất, đàm thoại to rõ, cổng Lightning chuẩn cho iPhone/iPad.\n` +
                `2. **Sony Inzone H3 (2.490.000 đ):** Dòng chụp tai Gaming chuyên nghiệp với âm thanh không gian 360 Spatial Sound và mic đàm thoại khử tạp âm.\n\n` +
                `👉 Bạn đang dùng thiết bị cổng cắm nào (Lightning, Type-C hay Jack 3.5mm) để em chọn mẫu chuẩn xác nhất cho bạn nhé! 😊`;

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

            const reply = `Dạ chào bạn! Về khả năng **Chống ồn chủ động (ANC)** đỉnh cao để làm việc, học tập tập trung hoặc di chuyển trên máy bay/xe cộ, cửa hàng có những đại diện xuất sắc nhất:\n\n` +
                `• 👑 **Sony WH-1000XM5 (6.990.000 đ):** Chống ồn chụp tai top 1 thế giới với bộ xử lý kép V1 + QN1, đệm tai da êm ái.\n` +
                `• 🌟 **Sony WF-1000XM5 (5.490.000 đ):** Mẫu nhét tai True Wireless chống ồn xuất sắc nhất phân khúc nhỏ gọn.\n` +
                `• 🍏 **Apple AirPods Pro 2 USB-C (5.490.000 đ):** Chống ồn chủ động 2X, tích hợp Spatial Audio theo dõi đầu.\n` +
                `• 🔊 **JBL Tour Pro 2 (5.490.000 đ):** Chống ồn thích ứng True Adaptive NC kèm hộp sạc có màn hình cảm ứng LCD độc đáo.\n\n` +
                `👉 Bạn ưu tiên dòng **chụp tai (Over-ear)** hay **nhét tai (In-ear)** để em tư vấn chi tiết nhé!`;

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

            const reply = `Dạ chào bạn! Nếu bạn thích kiểu dáng **Tai nghe chụp tai (Over-ear)** êm ái, cách âm tự nhiên và âm trường rộng mở, cửa hàng có những lựa chọn hàng đầu:\n\n` +
                `• 🎸 **Marshall Major 5 (3.690.000 đ):** Thiết kế da vintage cổ điển, pin vượt trội lên tới 100 giờ, chất âm rock sống động.\n` +
                `• 🎧 **Sony WH-1000XM5 (6.990.000 đ):** Đỉnh cao âm thanh Hi-Res LDAC, chống ồn thông minh tự động tinh chỉnh theo môi trường.\n` +
                `• 🔊 **Sony WH-ULT900N ULT WEAR (3.990.000 đ):** Âm bass siêu trầm uy lực ULT POWER SOUND, chống ồn chủ động.\n` +
                `• 🎮 **Sony Inzone H3 (2.490.000 đ):** Chụp tai có dây tối ưu cho Gaming với âm thanh không gian 360 Spatial Sound.\n\n` +
                `👉 Bạn dự định sử dụng chủ yếu để nghe nhạc, xem phim hay chơi game để em gợi ý mẫu phù hợp nhất nhé! 😊`;

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
                const reply = `Dạ có ạ! Cửa hàng đang có **${candidates.length} mẫu ${requestedAccessory.label}** phù hợp để bạn tham khảo:\n\n` +
                    `${productLines}\n\n` +
                    `Bạn đang dùng máy tính hoặc thiết bị nào, và ưu tiên **giá tiết kiệm**, **gõ/điều khiển êm** hay **chơi game** để em chọn đúng một mẫu cho bạn nhé? 😊`;

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
                const reply = `Dạ chào bạn! Với dòng **Phụ kiện không dây**, cửa hàng có sẵn các thiết bị cao cấp phục vụ làm việc và giải trí:\n\n` +
                    candidates.map(p => `• 🖱️ **${p.name}** - Giá: **${money(p.price)}** (${p.brand})`).join('\n') + `\n\n` +
                    `👉 Bạn đang tìm **Chuột không dây**, **Bàn phím không dây** hay phụ kiện nào khác để em hỗ trợ nhé! 😊`;

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


    // 3. Phân loại ĐIỆN THOẠI theo tính năng: Camera / Gaming / Pin trâu
    if (cat === 'Điện thoại' || (!cat && /\b(chup anh|quay phim|camera|sac net|chup dep|quay video|chien game|choi game|cau hinh manh|game muot|pin trau|pin lau)\b/i.test(norm))) {
        const isCamera = /\b(chup anh|quay phim|camera|sac net|chup dep|quay video|zoom|song ao|cinematic)\b/i.test(norm);
        const isGaming = /\b(chien game|choi game|cau hinh manh|game muot|gaming|hieu nang|chip manh|snapdragon|a18|genshin|lien quan|pubg)\b/i.test(norm);
        const isBattery = /\b(pin trau|pin lau|luot web|pin khung|ben bi|xai ca ngay)\b/i.test(norm);

        if (isCamera) {
            const candidates = await Product.find({
                category: 'Điện thoại',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /iPhone 16 Pro Max|Galaxy S25 Ultra|Find X8|Xiaomi 14/i },
                    { description: /camera|chụp ảnh|quay phim/i }
                ]
            }).sort({ price: -1 }).limit(4);

            return {
                reply: `Dạ chào bạn! Nếu bạn ưu tiên **chụp ảnh và quay phim sắc nét chuyên nghiệp**, cửa hàng hiện có các mẫu flagship sở hữu hệ thống camera đỉnh cao nhất thị trường:\n\n` +
                    `• 📸 **iPhone 16 Pro Max 256GB (34.990.000 đ):** Camera Fusion 48MP thế hệ mới, ống kính Telephoto 5x tiềm vọng, quay video 4K 120fps Dolby Vision chuẩn rạp chiếu phim và nút điều khiển Camera Control tiện lợi.\n` +
                    `• 🌟 **Samsung Galaxy S25 Ultra 256GB (31.990.000 đ):** Cảm biến siêu nét 200MP kết hợp ProVisual Engine AI, zoom quang học 5x và Space Zoom 100x sắc nét, chụp đêm Nightography xuất sắc.\n` +
                    `• 🎨 **OPPO Find X8 Pro 5G (26.990.000 đ):** Hệ thống 4 camera 50MP tinh chỉnh bởi huyền thoại Hasselblad, chụp chân dung xóa phông cực nghệ.\n\n` +
                    `👉 Bạn đang nghiêng về phong cách màu chân thực chuẩn rạp của **iPhone** hay màu sắc sống động, zoom siêu xa của **Samsung Galaxy** để em tư vấn chi tiết hơn nhé! 😊`,
                products: candidates,
                suggestions: ['iPhone 16 Pro Max', 'Samsung Galaxy S25 Ultra', 'OPPO Find X8 Pro', 'Tầm giá dưới 20 triệu'],
                context: {
                    ...prev,
                    category: 'Điện thoại',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'chụp ảnh',
                    useCase: 'chụp ảnh & quay video',
                    lastProducts: candidates
                }
            };
        }

        if (isGaming) {
            const candidates = await Product.find({
                category: 'Điện thoại',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /iPhone 16 Pro Max|Galaxy S25 Ultra|Magic7|POCO|Xiaomi 14/i },
                    { description: /hiệu năng|gaming|game|Snapdragon|A18/i }
                ]
            }).sort({ price: -1 }).limit(4);

            return {
                reply: `Dạ chào bạn! Để **chiến game mượt mà, cấu hình mạnh mẽ và FPS cực kỳ ổn định không lo giật lag**, cửa hàng xin gợi ý các cỗ máy hiệu năng đỉnh nhất hiện nay:\n\n` +
                    `• 🚀 **iPhone 16 Pro Max 256GB (34.990.000 đ):** Chip Apple A18 Pro tiến trình 3nm thế hệ mới, hỗ trợ Ray Tracing đồ họa phần cứng, cân mọi tựa game nặng như Genshin Impact mượt mà ở 60 - 120 FPS.\n` +
                    `• 🔥 **Samsung Galaxy S25 Ultra 256GB (31.990.000 đ):** Vi xử lý Snapdragon 8 Elite for Galaxy mạnh nhất giới Android, buồng hơi tản nhiệt lớn hơn 40%, màn hình Dynamic AMOLED 2X 120Hz chống chói.\n` +
                    `• ⚡ **HONOR Magic7 Pro 5G (25.990.000 đ):** Chip Snapdragon 8 Elite, màn hình 120Hz mượt mà và sạc siêu nhanh 100W cày game cả ngày.\n\n` +
                    `👉 Bạn thường chơi những tựa game nào và dự kiến mức ngân sách khoảng bao nhiêu để em tư vấn cấu hình chuẩn nhất cho bạn nhé! 😊`,
                products: candidates,
                suggestions: ['iPhone 16 Pro Max', 'Samsung Galaxy S25 Ultra', 'HONOR Magic7 Pro', 'Tầm giá dưới 15 triệu'],
                context: {
                    ...prev,
                    category: 'Điện thoại',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'chiến game',
                    useCase: 'chơi game giải trí',
                    lastProducts: candidates
                }
            };
        }

        if (isBattery) {
            const candidates = await Product.find({
                category: 'Điện thoại',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /Galaxy A05s|HONOR 200|iPhone 16 Pro Max/i },
                    { description: /pin trâu|5000mAh|dung lượng cao/i }
                ]
            }).sort({ price: -1 }).limit(3);

            return {
                reply: `Dạ chào bạn! Với tiêu chí **pin trâu bền bỉ, lướt web mượt mà cả ngày dài**, cửa hàng có những lựa chọn tiêu biểu từ phân khúc kinh tế đến cao cấp:\n\n` +
                    `• 🔋 **Samsung Galaxy A05s (3.290.000 đ):** Pin khủng 5.000 mAh, sạc nhanh 25W, màn hình lớn 6.7 inch 90Hz mượt mà, xài thoải mái 1.5 - 2 ngày.\n` +
                    `• ⚡ **HONOR 200 5G (11.990.000 đ):** Pin 5.200 mAh Silicon-Carbon thế hệ mới, sạc siêu tốc 100W đầy pin chỉ trong 35 phút.\n` +
                    `• 👑 **iPhone 16 Pro Max (34.990.000 đ):** Thời lượng xem video lên đến 33 giờ liên tục - chiếc iPhone pin trâu nhất lịch sử Apple.\n\n` +
                    `👉 Bạn đang nhắm đến tầm giá phổ thông tiết kiệm hay phân khúc cao cấp để em gửi chi tiết nhé! 😊`,
                products: candidates,
                suggestions: ['Dưới 5 triệu', 'Tầm 10 - 15 triệu', 'Flagship cao cấp', 'Săn mã giảm giá'],
                context: {
                    ...prev,
                    category: 'Điện thoại',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'pin trâu',
                    useCase: 'pin trâu, lướt web',
                    lastProducts: candidates
                }
            };
        }
    }

    // 4. Phân loại TABLET theo tính năng: Học tập ghi chép bút cảm ứng / Đồ họa màn hình đẹp
    if (cat === 'Tablet' || (!cat && /\b(but cam ung|ghi chep|hoc tap|sinh vien|take note|ve do hoa|man hinh dep|liquid retina|dung phim)\b/i.test(norm))) {
        const isNote = /\b(but cam ung|ghi chep|hoc tap|sinh vien|take note|viet ve)\b/i.test(norm);
        const isGraphics = /\b(ve do hoa|do hoa|man hinh dep|liquid retina|dung phim|oled|m4)\b/i.test(norm);

        if (isNote || isGraphics) {
            const candidates = await Product.find({
                category: 'Tablet',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /iPad Gen 10|Lenovo Tab M11|MatePad 11|iPad Pro 11|Tab S9/i },
                    { description: /bút|học tập|ghi chép|đồ họa|vẽ/i }
                ]
            }).sort({ price: 1 }).limit(4);

            return {
                reply: `Dạ chào bạn! Để phục vụ **học tập ghi chép bằng bút cảm ứng, vẽ đồ họa và giải trí**, cửa hàng có sẵn các dòng tablet xuất sắc:\n\n` +
                    `• 📝 **Lenovo Tab M11 Kèm Bút Cảm Ứng (4.490.000 đ):** Mẫu tablet kinh tế nhất tặng kèm sẵn bút cảm ứng trong hộp, màn hình 11 inch 90Hz, 4 loa Dolby Atmos.\n` +
                    `• 🍎 **iPad Gen 10 10.9 inch (8.990.000 đ):** Thiết kế viền mỏng hiện đại, chip A14 Bionic mạnh mẽ, hỗ trợ Apple Pencil và Magic Keyboard Folio.\n` +
                    `• 💼 **Huawei MatePad 11.5 S Kèm Bàn Phím (11.990.000 đ):** Màn hình nhám chống lóa PaperMatte viết như trên giấy thật, kèm sẵn bàn phím thông minh.\n` +
                    `• 🎨 **iPad Pro 11 inch M4 (26.990.000 đ):** Siêu phẩm chip M4 đỉnh cao, màn hình Ultra Retina XDR Tandem OLED tuyệt mỹ chuyên cho Designer và Creator.\n\n` +
                    `👉 Bạn dự kiến mức ngân sách khoảng bao nhiêu triệu để em chọn phiên bản dung lượng phù hợp nhất nhé! 😊`,
                products: candidates,
                suggestions: ['Lenovo Tab M11 (Kèm bút)', 'iPad Gen 10 (8.99tr)', 'Huawei MatePad 11.5 S', 'iPad Pro M4'],
                context: {
                    ...prev,
                    category: 'Tablet',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'bút cảm ứng',
                    useCase: 'học tập & ghi chép',
                    lastProducts: candidates
                }
            };
        }
    }

    // 5. Phân loại ĐỒNG HỒ THÔNG MINH: Sức khỏe & GPS / Nghe gọi & Pin trâu
    if (cat === 'Đồng hồ thông minh' || (!cat && /\b(suc khoe|gps|the thao|chay bo|do tim|nghe goi|thong bao|pin trau)\b/i.test(norm))) {
        const isHealth = /\b(suc khoe|gps|the thao|chay bo|do tim|tap luyen|nhip tim|spo2)\b/i.test(norm);
        const isCall = /\b(nghe goi|thong bao|pin trau|pin lau|thoi trang|sang trong)\b/i.test(norm);

        if (isHealth || isCall) {
            const candidates = await Product.find({
                category: 'Đồng hồ thông minh',
                active: { $ne: false },
                stock: { $gt: 0 },
                $or: [
                    { name: /Garmin|Galaxy Watch|Apple Watch|Huawei Fit|Band 9/i },
                    { description: /GPS|sức khỏe|thể thao|nghe gọi/i }
                ]
            }).sort({ price: -1 }).limit(4);

            return {
                reply: `Dạ chào bạn! Để đồng hành cùng bạn **theo dõi sức khỏe, tập luyện thể thao GPS và nhận cuộc gọi thông minh**, cửa hàng có những mẫu Smartwatch tiêu biểu:\n\n` +
                    `• 🏃 **Garmin Forerunner 165 (6.990.000 đ) & Forerunner 55 (4.990.000 đ):** Chuyên gia chạy bộ và thể thao ngoài trời, định vị GPS chuẩn xác, gợi ý bài tập thích ứng và pin 11 - 14 ngày.\n` +
                    `• 🍎 **Apple Watch Series 10 (10.490.000 đ) & SE (5.990.000 đ):** Đồng bộ hoàn hảo với iPhone, màn hình OLED góc nhìn rộng, nghe gọi loa ngoài cực to rõ và đo ECG nhịp tim.\n` +
                    `• 💫 **Samsung Galaxy Watch 7 (6.490.000 đ):** Cảm biến BioActive thế hệ mới theo dõi chỉ số cơ thể, AI huấn luyện viên sức khỏe cá nhân.\n` +
                    `• 🔋 **Huawei Watch Fit 3 (2.790.000 đ) & Xiaomi Band 9 (890.000 đ):** Thiết kế vuông thời thượng, pin cực trâu 7 - 14 ngày liên tục.\n\n` +
                    `👉 Bạn dùng điện thoại iPhone hay Android, và ưu tiên tập thể thao chuyên sâu hay nghe gọi đàm thoại hàng ngày nhé! 😊`,
                products: candidates,
                suggestions: ['Garmin Forerunner 165', 'Apple Watch Series 10', 'Galaxy Watch 7', 'Huawei Fit 3'],
                context: {
                    ...prev,
                    category: 'Đồng hồ thông minh',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'sức khỏe & GPS',
                    lastProducts: candidates
                }
            };
        }
    }

    // 6. Phân loại MÁY CHƠI GAME: Cầm tay di động vs Console cắm TV 4K
    if (cat === 'Máy chơi game' || (!cat && /\b(cam tay|di dong|mang di|du lich|cam tv|tivi|console|4k|ps5|playstation|switch|rog ally|steam deck)\b/i.test(norm))) {
        const isHandheld = /\b(cam tay|di dong|mang di|du lich|nho gon|switch|rog ally|steam deck|msi claw|legion go)\b/i.test(norm);
        const isConsole = /\b(cam tv|tivi|console|4k|choi phong khach|ps5|playstation)\b/i.test(norm);

        if (isHandheld || isConsole) {
            const candidates = await Product.find({
                category: 'Máy chơi game',
                active: { $ne: false },
                stock: { $gt: 0 }
            }).sort({ price: -1 }).limit(4);

            return {
                reply: `Dạ chào bạn! Để thỏa mãn niềm đam mê **chiến game đỉnh cao**, cửa hàng cung cấp đầy đủ cả hai hệ máy chính hãng:\n\n` +
                    `• 📺 **Hệ Console Cắm TV 4K Đồ Họa Đỉnh Cao:**\n` +
                    `  - **Sony PlayStation 5 (PS5) Slim Standard (13.490.000 đ):** Đồ họa 4K 120fps Ray Tracing chân thực, ổ SSD siêu tốc tải game tích tắc, tay cầm DualSense phản hồi xúc giác đỉnh cao.\n\n` +
                    `• 🎮 **Hệ Máy Cầm Tay Di Động (Chơi mọi lúc mọi nơi):**\n` +
                    `  - **Nintendo Switch OLED (7.490.000 đ) & Switch Lite (4.290.000 đ):** Màn hình OLED rực rỡ, kho game gia đình độc quyền phong phú (Mario, Zelda, Pokemon).\n` +
                    `  - **ASUS ROG Ally Z1 Extreme (13.990.000 đ) & MSI Claw 8 (19.990.000 đ):** PC Handheld chạy Windows 11 mượt mà, chơi mượt các tựa game AAA từ Steam, Epic Games.\n\n` +
                    `👉 Bạn thích trải nghiệm cắm màn hình lớn phòng khách cùng người thân hay thích máy nhỏ gọn mang theo di chuyển nhé! 😊`,
                products: candidates,
                suggestions: ['PlayStation 5 Slim 4K', 'Nintendo Switch OLED', 'ASUS ROG Ally Z1 Extreme', 'Nintendo Switch Lite'],
                context: {
                    ...prev,
                    category: 'Máy chơi game',
                    currentIntent: 'feature_showcase',
                    featureKeyword: 'máy chơi game',
                    lastProducts: candidates
                }
            };
        }
    }
    return null;
}

async function checkUncarriedItemForCategory(message, category) {
    if (!category) return null;

    // Nếu người dùng đang nêu nhu cầu sử dụng, ngành học hoặc tiêu chí tính năng -> Tuyệt đối không phải hỏi thương hiệu lạ
    if (extractUseCase(message) || extractMajorOrField(message) || extractQualificationUseCase(message) || extractQualificationPreference(message)) {
        return null;
    }

    const norm = normalizeText(message);

    // Bỏ qua nếu tin nhắn chứa các từ khóa tính năng, kiểu dáng, kỹ thuật phổ biến
    const FEATURE_REGEX = /\b(khong day|co day|bluetooth|chong on|truewireless|true wireless|tws|chup tai|nhet tai|in ear|over ear|on ear|gaming|game|chien game|cau hinh|hieu nang|chip|ram|sac net|chup anh|quay phim|van phong|ban phim co|phim co|chuot khong day|chuot co day|sac nhanh|pin trau|mong nhe|do hoa|lap trinh|hoc tap|sinh vien|gia re|cao cap|chinh hang|chong nuoc|the thao|dam thoai|re|tot|dep|muot|manh|gia|tien|ngan sach|trieu|tr|chup|quay|camera|man hinh|loa|mic)\b/i;
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
        .replace(/\b(tu van|gioi thieu|goi y|de xuat|muon|can|tim|hoi|xem|mua|ban|lay|chon|chuyen|doi|biet|thay|nghi|tinh|hieu|phan van|do du|dan do|chua ro|suy nghi)\b/gi, ' ')
        .replace(/\b(co|khong|gi|nao|chua|sao|dau|may|the nao|ra sao|a|nhe|nha|gium|giup|di|thoi|nhi|ukm|ok|roi|thi|ma|la|hay|hoac|neu|vay|the|con|khac|ro)\b/gi, ' ')
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
        'chinh', 'hang', 'loai', 'mau', 'dong', 'chiec', 'cai', 'may', 'con', 'ben', 'cua', 'shop', 'tech',
        'biet', 'thay', 'nghi', 'tinh', 'hieu', 'ro', 'sao', 'nao'
    ]);
    const words = stripped.toLowerCase().split(/\s+/);
    if (words.every(w => PROTECTED_TERMS.has(w))) return null;
    if (words.length > 2) return null; // Thương hiệu lạ chỉ từ 1-2 từ, câu miêu tả dài không phải thương hiệu

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
            reply: `Dạ chào bạn! Hiện tại cửa hàng **chưa phân phối dòng sản phẩm ${display}** trong danh mục **${category}** ạ. 🙏\n\n` +
                `Cửa hàng hiện phân phối chính hãng 100% các thương hiệu hàng đầu với đầy đủ bảo hành chính hãng và hỗ trợ trả góp 0%:\n` +
                `${brandsList}\n\n` +
                `👉 Bạn có muốn tham khảo các mẫu ${category} chính hãng từ những thương hiệu này trong khoảng ngân sách bao nhiêu để em tư vấn chi tiết cho bạn nhé! 😊`,
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

function isHearingAidMedicalQuestion(message) {
    const text = normalizeText(message);
    return /(nghe kem|kho nghe|nghenh ngang|suy giam thinh luc|chan doan|dieu tri|chua khoi|phuc hoi thinh luc)/i.test(text);
}

function buildHearingAidSafetyResponse() {
    return {
        reply: 'Em có thể tư vấn thông tin sản phẩm máy trợ thính như thiết kế, tính năng, Bluetooth, pin, thông số được công bố, giá và bảo hành. Em không thể chẩn đoán, điều trị hoặc khẳng định máy có thể chữa khỏi hay khôi phục thính lực. Nếu bạn đang gặp khó khăn khi nghe, hãy trao đổi với chuyên gia thính học hoặc cơ sở y tế phù hợp. Bạn không cần chia sẻ thông tin sức khỏe cá nhân để được tư vấn sản phẩm.',
        products: [],
        suggestions: ['Xem máy trợ thính', 'Tư vấn Bluetooth', 'Tư vấn pin và sạc'],
        context: { category: 'Máy trợ thính', currentIntent: 'hearing_aid_information', stage: 'hearing_aid_safety' },
        meta: { provider: 'deterministic_engine', isFallback: true, model: 'none' }
    };
}

function isStoreOverviewQuery(message) {
    const norm = normalizeText(message);
    return /\b(shop|cua hang|ben ban|he thong|tech|techecommerce)\s+(ban|co|kinh doanh|phan phoi)\s+(nhung gi|gi|mat hang gi|san pham gi|dong nao|cac gi)\b/i.test(norm) ||
        /\b(shop|cua hang|ben ban)\s+co\s+nhung\s+(mat hang|san pham|loai|dong)\s+(gi|nao)\b/i.test(norm) ||
        /\b(cac|nhung)\s+mat hang\s+(cua\s+)?(shop|cua hang)\b/i.test(norm) ||
        /\b(danh muc|mat hang|san pham)\s+(cua\s+)?(shop|cua hang|techecommerce)\b/i.test(norm) ||
        /^(shop ban nhung gi|cua hang ban gi|shop co nhung gi|ben ban ban gi|shop ban gi)$/i.test(norm);
}

async function coordinateConsultation({ message, user = null, context = {} }) {
    let nluResult = null;
    const isNluEnabled = process.env.NLU_PIPELINE !== 'off';

    if (isNluEnabled) {
        try {
            nluResult = nlu.processInput(message, context);
            const preGuard = nlu.applyPreGuardrails({
                nluResult,
                rawMessage: message,
                context
            });
            if (preGuard && preGuard.intercepted) {
                return preGuard.response;
            }

            // Đồng bộ dữ liệu ngân sách đã bóc tách từ NLU vào context
            if (nluResult.entities?.budget && !context.budget) {
                context.budget = nluResult.entities.budget.target || nluResult.entities.budget.max;
                if (nluResult.entities.budget.max && !nluResult.entities.budget.min) {
                    context.budgetType = 'hard';
                }
            }
            if (nluResult.entities?.category && !context.category) {
                context.category = nluResult.entities.category;
            }
            if (nluResult.entities?.brand && !context.brand) {
                context.brand = nluResult.entities.brand;
            }
            context.nluIntents = nluResult.intents;
            context.nlu = nluResult;
        } catch (nluErr) {
            console.warn('[NLU Pipeline Warning] Chuyển về luồng điều phối tiêu chuẩn:', nluErr.message);
        }
    }

    let response = await _coordinateConsultationCore({ message, user, context });

    if (isNluEnabled && nluResult && response) {
        try {
            response = nlu.applyPostGuardrails({
                response,
                nluResult,
                context
            });
        } catch (postErr) {
            console.warn('[NLU Post-Guardrail Warning]:', postErr.message);
        }
    }

    return response;
}

async function _coordinateConsultationCore({ message, user = null, context = {} }) {
    const text = normalizeText(message);
    const prev = { ...(context || {}), currentMessage: message };

    // Nếu khách đang đứng ở trang chi tiết 1 sản phẩm (pageProductId) và hỏi về "máy này / sản phẩm này"
    if (prev.pageProductId && (!Array.isArray(prev.lastProducts) || prev.lastProducts.length === 0)) {
        try {
            const pageProd = await Product.findOne({
                $or: [
                    { _id: Number(prev.pageProductId) || 0 },
                    { _id: prev.pageProductId },
                    { id: Number(prev.pageProductId) || 0 }
                ],
                active: { $ne: false }
            });
            if (pageProd) {
                prev.lastProducts = [pageProd];
                if (!prev.category) prev.category = pageProd.category;
            }
        } catch (_) { }
    }

    if (Array.isArray(prev.lastProducts) && prev.lastProducts.length > 0 && (typeof prev.lastProducts[0] === 'number' || typeof prev.lastProducts[0] === 'string')) {
        try {
            const loadedProds = await Product.find({
                _id: { $in: prev.lastProducts.map(id => Number(id) || id) },
                active: { $ne: false }
            });
            if (loadedProds.length > 0) {
                prev.lastProducts = loadedProds;
                if (!prev.category) prev.category = loadedProds[0].category;
            }
        } catch (_) { }
    }

    // Establish one authoritative category for the entire turn. Explicit
    // words in the current message win; otherwise use the active catalog page.
    // This prevents downstream legacy branches (which default to Laptop) from
    // answering a tablet, headphone, watch or accessory question incorrectly.
    const messageCategory = inferCategory(message);
    const pageCategory = prev.pageCategory || '';
    const authoritativeCategory = messageCategory || pageCategory || prev.category || '';
    if (authoritativeCategory) {
        prev.category = authoritativeCategory;
        if (pageCategory && messageCategory && messageCategory !== pageCategory) {
            prev.categorySource = 'message';
        } else if (pageCategory) {
            prev.categorySource = 'page';
        }
    }
    // Capture obvious needs before the slot-filling branches run. This keeps
    // a complete request such as "laptop văn phòng lướt web" from being
    // treated as an empty generic consultation.
    if (!prev.useCase) {
        if (/van phong|luot web|word|excel|hoc tap|sinh vien/.test(text)) {
            prev.useCase = 'làm việc văn phòng / học tập';
        } else if (/lap trinh|code|docker|cntt|cong nghe thong tin|ide/.test(text)) {
            prev.useCase = 'lập trình & công nghệ';
        } else if (/gaming|choi game|fps|genshin|valorant/.test(text)) {
            prev.useCase = 'chơi game giải trí';
        } else if (/do hoa|dung video|render|photoshop|premiere/.test(text)) {
            prev.useCase = 'thiết kế đồ họa & video';
        }
    }
    if (messageCategory && Array.isArray(prev.lastProducts) && prev.lastProducts.length) {
        const hasOtherCategory = prev.lastProducts.some(product =>
            product && product.category && product.category !== messageCategory
        );
        if (hasOtherCategory) prev.lastProducts = [];
    }

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

    if (authoritativeCategory === 'Máy trợ thính' && isHearingAidMedicalQuestion(message)) {
        return buildHearingAidSafetyResponse();
    }

    // 0b. Kiểm tra câu hỏi tổng quan cửa hàng ("shop bạn bán những gì", "cửa hàng bán gì")
    if (isStoreOverviewQuery(message)) {
        return {
            reply: `Dạ chào bạn! Cửa hàng bên em chuyên phân phối thiết bị công nghệ chính hãng 100% với 7 danh mục sản phẩm chính:\n\n` +
                `• 📱 **Điện thoại:** iPhone, Samsung Galaxy, Xiaomi, POCO, HONOR...\n` +
                `• 💻 **Laptop:** MacBook, ASUS, Dell, Lenovo, HP, Acer, MSI...\n` +
                `• 📲 **Tablet:** iPad, Samsung Galaxy Tab, Xiaomi Pad...\n` +
                `• ⌚ **Đồng hồ thông minh:** Apple Watch, Galaxy Watch, Garmin...\n` +
                `• 🎮 **Máy chơi game:** PlayStation 5 Slim, Nintendo Switch OLED, Steam Deck OLED...\n` +
                `• 🎧 **Tai nghe:** Sony, Marshall, Apple AirPods, Galaxy Buds...\n` +
                `• 🔌 **Phụ kiện:** Chuột máy tính, bàn phím cơ, củ sạc nhanh GaN, pin sạc dự phòng, hub chuyển đổi...\n\n` +
                `👉 Bạn đang quan tâm đến nhóm sản phẩm nào để em tư vấn chi tiết nhất cho bạn nhé! 😊`,
            products: [],
            suggestions: ['Điện thoại chính hãng', 'Laptop học tập & làm việc', 'Máy chơi game', 'Phụ kiện công nghệ'],
            context: { stage: 'store_overview', currentIntent: 'store_overview' },
            meta: { provider: 'deterministic_engine', isFallback: true, model: 'none' }
        };
    }

    // 1. Kiểm tra câu hỏi chẩn đoán máy cũ (Core i5 Gen 8, nâng cấp SSD/RAM vs Mua mới)
    if (isOldDeviceDiagnosis(message)) {
        return await handleOldDeviceDiagnosis(message, prev);
    }

    // 1b. Kiểm tra tri thức chính sách cửa hàng, xử lý từ chối, mẹo công nghệ & đối đáp đời thường
    // Chỉ áp dụng smartAnswer khi câu hỏi KHÔNG hỏi tìm/tư vấn sản phẩm theo ngân sách hoặc danh mục cụ thể
    const hasExplicitBudget = Boolean(extractBudget(message)) || Boolean(extractBudgetInfo(message)?.amount);
    const hasExplicitProductQuery = Boolean(detectProductType(message)) || Boolean(inferCategory(message));
    const isConsultationSearch = /\b(tu van|gioi thieu|goi y|chon giup|muon mua|can mua|tim mua|tim|mua|co ban)\b/i.test(text);

    const isContextualFollowUpSignal = Array.isArray(prev.lastProducts) && prev.lastProducts.length > 0 &&
        /\b(nam\s+choi|nam|mau\s+nao|may\s+nao|con\s+nao|phu\s+hop|nen\s+chon|nen\s+mua|so\s+sanh|phan\s+van)\b/i.test(text);

    if (!isContextualFollowUpSignal && !hasExplicitBudget && !(hasExplicitProductQuery && isConsultationSearch)) {
        const smartAnswer = matchSmartAnswer(message);
        if (smartAnswer) {
            return {
                reply: smartAnswer.reply,
                products: prev.lastProducts || [],
                suggestions: smartAnswer.suggestions,
                context: { ...prev, ...smartAnswer.context },
                meta: { provider: 'store_knowledge_engine', isFallback: false, model: 'none' }
            };
        }
    }

    // 2a. Kiểm tra nếu câu hỏi nhắc đến 2 sản phẩm cụ thể để so sánh ("So sánh MacBook Air M2 và Asus ROG Strix", "iPad Air 11inch với Gen 10 có j khác nhau", "so sánh gen 10 và air M2")
    const earlyComparingIntent = (
        prev.stage === 'awaiting_comparison_products' ||
        prev.currentIntent === 'compare_products' ||
        ['so sanh', 'so voi', 'khac nhau gi', 'khac nhau', 'khac gi', 'khac j', 'co j khac', 'co gi khac', 'co gi khac nhau', 'co j khac nhau', 'hay nen mua', 'phan van', 'nen chon may nao', 'giua'].some(k => text.includes(k)) ||
        /\b(?:va|voi|vs|hay|hoac)\b/i.test(text)
    );

    if (earlyComparingIntent) {
        // Phân tích câu so sánh có liên từ nối: "so sánh A và B", "A với B có j khác", "giữa A và B"
        const cleanMsg = text
            .replace(/^(?:so sanh|so voi|giua|phan van|nen mua|nen chon)\s+/i, '')
            .replace(/\s+(?:co j khac|co gi khac|co j khac nhau|co gi khac nhau|khac nhau gi|khac gi|khac j|khac nhau|nen mua may nao|nen chon may nao|thi sao).*$/i, '')
            .trim();
        const parts = cleanMsg.split(/\s+(?:va|vs|hay|voi|hoac)\s+/i).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const p1 = await findExactProductInCatalog(parts[0]);
            const p2 = await findExactProductInCatalog(parts[1]);
            if (p1 && p2 && String(p1._id) !== String(p2._id)) {
                return await buildComparisonResponse(p1, p2, {
                    ...prev,
                    currentMessage: message,
                    category: authoritativeCategory || p1.category || p2.category
                });
            }
        }
    }

    // Explicit model names must be resolved before brand-level comparison.
    const earlyMatchedProducts = await findAllMatchingProductsInCatalog(message);

    if (earlyComparingIntent && earlyMatchedProducts.length >= 2 && String(earlyMatchedProducts[0]._id) !== String(earlyMatchedProducts[1]._id)) {
        return await buildComparisonResponse(earlyMatchedProducts[0], earlyMatchedProducts[1], {
            ...prev,
            currentMessage: message,
            category: authoritativeCategory || earlyMatchedProducts[0].category
        });
    }

    // Contextual comparison: Khách chỉ nêu 1 sản phẩm mới ("với Gen 10 thì sao", "so với Gen 10 có j khác"),
    // trong khi lượt trước đã có sản phẩm (ví dụ iPad Air)
    if (earlyComparingIntent && earlyMatchedProducts.length === 1 && Array.isArray(prev.lastProducts) && prev.lastProducts.length > 0) {
        const p1Id = prev.lastProducts[0]?._id || prev.lastProducts[0];
        if (p1Id && String(p1Id) !== String(earlyMatchedProducts[0]._id)) {
            const p1 = await Product.findById(p1Id);
            if (p1) {
                return await buildComparisonResponse(p1, earlyMatchedProducts[0], {
                    ...prev,
                    currentMessage: message,
                    category: authoritativeCategory || p1.category
                });
            }
        }
    }

    const brandComparison = await resolveBrandComparison(message, prev);
    if (brandComparison) return brandComparison;

    const matchedProducts = await findAllMatchingProductsInCatalog(message);
    const isComparingIntent = earlyComparingIntent;

    if (matchedProducts.length >= 2 && String(matchedProducts[0]._id) !== String(matchedProducts[1]._id) && isComparingIntent) {
        return await buildComparisonResponse(matchedProducts[0], matchedProducts[1], prev);
    }

    // Contextual comparison fallback
    if (isComparingIntent && matchedProducts.length === 1 && Array.isArray(prev.lastProducts) && prev.lastProducts.length > 0) {
        const p1Id = prev.lastProducts[0]?._id || prev.lastProducts[0];
        if (p1Id && String(p1Id) !== String(matchedProducts[0]._id)) {
            const p1 = await Product.findById(p1Id);
            if (p1) {
                return await buildComparisonResponse(p1, matchedProducts[0], prev);
            }
        }
    }

    // Never downgrade an explicit comparison into a stale budget/recommendation
    // flow. If model resolution is ambiguous, ask for the missing model names.
    if (isComparingIntent && matchedProducts.length < 2) {
        return {
            reply: 'Em nhận ra bạn muốn so sánh sản phẩm, nhưng chưa xác định chắc chắn đủ hai mẫu trong catalog. Bạn gửi giúp em tên đầy đủ hoặc mã sản phẩm của hai mẫu cần so sánh nhé.',
            products: matchedProducts,
            suggestions: ['Gửi tên đầy đủ sản phẩm', 'So sánh sản phẩm đang hiển thị'],
            context: { ...prev, currentMessage: message, currentIntent: 'compare_products', stage: 'awaiting_comparison_products', lastProducts: matchedProducts },
            meta: { provider: 'deterministic_engine', isFallback: true, model: 'none' }
        };
    }

    // 2b. Kiểm tra câu tra cứu chính xác 1 model / biến thể (Exact Lookup)
    // Nếu khách đã chỉ rõ model máy -> trả lời đúng sản phẩm, giá, tồn kho ngay lập tức!
    if (matchedProducts.length >= 1 && !isComparingIntent) {
        return await handleExactProductLookup(matchedProducts[0], prev, message);
    }

    // Khách đang được hỏi về một loại sản phẩm nhưng chuyển hẳn sang loại khác
    // (ví dụ: đang hỏi tai nghe rồi nói "điện thoại") hoặc bắt đầu hỏi tư vấn lại từ đầu thì phải reset bộ slot cũ.
    const requestedProductType = detectProductType(message);
    const isExplicitConsultationRestart = /\b(tu van|gioi thieu|goi y|chon giup|muon mua|can mua|tim mua)\b/i.test(text);

    // A budget-only follow-up must not inherit an unrelated sub-type from the
    // previous turn (for example `keyboard`) while the customer is on the
    // general Accessories page. Keep the category, but restart sub-type
    // selection so “500k–1.5m” is not answered with keyboard products.
    const hasBudgetOnlySignal = Boolean(extractBudget(message)) ||
        /(?:duoi|toi da|khoang|tam gia|ngan sach|trieu|tram nghin|nghin|ngan|dong)/i.test(text);
    const isAccessoriesScope = [prev.pageCategory, prev.category]
        .filter(Boolean)
        .some(value => normalizeText(value).includes('phu kien'));
    const preservesAccessorySubtype = ['power_bank', 'charger'].includes(prev.productType);
    if (!requestedProductType && hasBudgetOnlySignal && prev.productType &&
        isAccessoriesScope && !preservesAccessorySubtype) {
        delete prev.productType;
        delete prev.stage;
        prev.currentIntent = 'recommend_product';
        prev.category = prev.pageCategory || prev.category;
        prev.lastProducts = [];
    }

    if (requestedProductType && !extractBudget(message) && (requestedProductType.key !== prev.productType || (isExplicitConsultationRestart && !extractBudget(message) && !extractQualificationUseCase(message) && !extractBrandPreference(message)))) {
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
            preference: '',
            qualification: {},
            missingSlots: ['budget', 'useCase', 'preference', 'brand'],
            lastProducts: [],
            topProduct: null
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
    const hasDeepQuestionSignal = /\b(may nay|con nay|mau nay|chiec nay|san pham nay|thiet bi nay|em nay|chu nay|tai sao|vi sao|ly do|co nen|co dang|co gi tot|co gi hay|co gi noi bat|uu diem|nhuoc diem|danh gia|review|tot khong|on khong|muot khong|ben khong|phu hop|co nen mua|nen mua khong|tai sao nen mua|dung duoc gi|choi game|pin|camera|man hinh|cau hinh|tac dung|cong dung|chuc nang|lam duoc gi|dung de lam gi|co tac dung gi|tinh nang|tinh nang gi)\b/i.test(text);
    const isBudgetCorrection = /\b(tren\s+\d+|tren\s+\d+tr|tren\s+\d+\s+trieu|tim\s+tren|bao\s+la\s+tren|noi\s+la\s+tren|goi\s+y\s+duoi|cai\s+nay\s+la\s+duoi)\b/i.test(text) || (text.includes('tren') && text.includes('20') && (text.includes('ma') || text.includes('sao') || text.includes('duoi')));
    if (Array.isArray(prev.lastProducts) && prev.lastProducts.length > 0 &&
        (/may thu|mau thu|so sanh|dat qua|re qua|gia cao|may vua roi|mau vua roi/i.test(text) || isCheaperRequest(text) || isBudgetCorrection || extractOrdinalReference(message) || extractEliminatedBrand(message) || hasDeepQuestionSignal)) {
        const earlyContextualResponse = await handleContextualFollowUp(message, prev);
        if (earlyContextualResponse) return earlyContextualResponse;
    }

    if (prev.stage === 'qualifying_needs' && (prev.productType || prev.category)) {
        const qualifyingProductType = prev.productType
            ? PRODUCT_TYPE_INTENTS.find(type => type.key === prev.productType)
            : null;
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
    const budgetInfo = extractBudgetInfo(message);
    const explicitBudgetInMsg = budgetInfo?.amount || extractBudget(message);

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
    const isBudgetQuery = Boolean(explicitBudgetInMsg || ['tam gia', 'ngan sach', 'khoang', 'duoi', 'tren', 'trieu', 'trieu dong', 'muc gia', 'tam tien'].some(k => text.includes(k)));
    const newBudget = explicitBudgetInMsg || (isBudgetQuery ? (prev.budget || 0) : 0);
    const budgetType = budgetInfo?.type || prev.budgetType || 'unspecified';
    const budgetMin = budgetInfo ? budgetInfo.min : (prev.budgetMin || null);
    const budgetMax = budgetInfo ? budgetInfo.max : (prev.budgetMax || null);
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
        budgetMin,
        budgetMax,
        budgetType: budgetType || (isHard ? 'hard' : (prev.budgetType || 'unspecified')),
        useCase,
        major,
        techProficiency: userProficiency,
        eliminatedBrands: eliminated
    };

    // 6. YÊU CẦU CỐT LÕI: KHI KHÁCH HÀNG MUỐN NGÂN SÁCH TRONG TẦM GIÁ -> MỚI NHẢY RA ĐỂ TƯ VẤN KHÁCH HÀNG
    // "còn khi khách hàng muốn ngân sách trong tầm giá thì mới nhảy ra để tư vấn khách hàng"
    if (newBudget > 0 || (budgetMin && budgetMin > 0)) {
        return await handleRecommendWithTradeOffs({
            category: category || 'Điện thoại',
            brand,
            budget: newBudget,
            budgetMin,
            budgetMax,
            budgetType,
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

    // 8. Nếu không khớp danh mục, sản phẩm hay ngân sách:
    // Xử lý thông minh câu hỏi giao lưu, hỏi vui, toán học, hoặc phản hồi tự nhiên khi gặp câu khó/chưa rõ ý.
    // Tuyệt đối KHÔNG trả về câu chào spam danh sách sản phẩm lặp đi lặp lại!
    return await handleConversationalOrUnclearQuery(message, updatedContext);
}

/**
 * Xử lý các câu hỏi vui, toán học, chit-chat hoặc các câu hỏi khó/lạ mà AI chưa hiểu rõ
 */
async function handleConversationalOrUnclearQuery(message, context = {}) {
    const norm = normalizeText(message);
    const cleanMsg = String(message || '').trim();

    // 1. Phép tính toán học (ví dụ: "1+1", "1 + 1 bằng mấy", "10 * 5", "100 chia 2", "5x5")
    const mathMatch = cleanMsg.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/xX×÷]|cong|tru|nhan|chia)\s*(\d+(?:\.\d+)?)/i);
    let deterministicMathReply = null;
    if (mathMatch) {
        const num1 = parseFloat(mathMatch[1]);
        const opRaw = mathMatch[2].toLowerCase();
        const num2 = parseFloat(mathMatch[3]);
        let calcResult = null;
        if (opRaw === '+' || opRaw === 'cong') calcResult = num1 + num2;
        else if (opRaw === '-' || opRaw === 'tru') calcResult = num1 - num2;
        else if (opRaw === '*' || opRaw === 'x' || opRaw === '×' || opRaw === 'nhan') calcResult = num1 * num2;
        else if (opRaw === '/' || opRaw === '÷' || opRaw === 'chia') calcResult = num2 !== 0 ? (Math.round((num1 / num2) * 100) / 100) : 'vô cực';

        if (calcResult !== null) {
            const opSymbol = (opRaw === 'cong' || opRaw === '+') ? '+' : (opRaw === 'tru' || opRaw === '-') ? '-' : (opRaw === 'nhan' || opRaw === '*' || opRaw === 'x' || opRaw === '×') ? 'x' : '÷';
            deterministicMathReply = `Dạ kết quả ${num1} ${opSymbol} ${num2} = **${calcResult}** nè bạn ơi! 😄\n\nBạn đang kiểm tra độ thông minh của AI bên em đúng không nè? Nếu bạn đang tính toán ngân sách sắm thiết bị công nghệ hay cần săn combo giảm giá hời thì cứ nhắn em hỗ trợ nhé!`;
        }
    }

    // 2. Phân loại câu hỏi đùa / hỏi vui / tâm sự đời thường / câu hỏi khó
    let fallbackText = deterministicMathReply;
    let customSuggestions = null;

    if (!fallbackText) {
        const smart = matchSmartAnswer(message);
        if (smart) {
            fallbackText = smart.reply;
            customSuggestions = smart.suggestions;
        }
    }

    if (!fallbackText) {
        const isHumorOrChitChat = /\b(vui khong|buon|chan|met|khoe khong|an com chua|ngu chua|hat|ke chuyen|nguoi yeu|may tuoi|ten gi|ai tao ra|troi dep|troi mua|xinh khong|yeu khong|co nguoi yeu)\b/i.test(norm);
        if (isHumorOrChitChat) {
            fallbackText = `Dạ gặp được bạn ghé thăm cửa hàng là em thấy rất vui và tràn đầy năng lượng rồi nè! 😊\n\nEm là Trợ lý AI công nghệ luôn sẵn sàng đồng hành cùng bạn. Hôm nay bạn đang có hứng thú ngắm nghía thiết bị nào để phục vụ công việc, học tập hay giải trí không? Cứ chia sẻ với em nhé!`;
        } else {
            // Câu hỏi khó, triết lý, lạ hoặc chưa rõ ý
            fallbackText = `Dạ câu này em chưa hiểu rõ ý bạn lắm nè 😅\n\nBạn có thể diễn đạt rõ hơn một chút được không, ví dụ như bạn đang cần tìm loại sản phẩm nào (Laptop, Điện thoại, Tablet, Tai nghe, Phụ kiện...), mức ngân sách khoảng bao nhiêu hoặc cần hỗ trợ về tính năng gì để em tư vấn chuẩn xác nhất nhé!`;
        }
    }

    // 3. Tận dụng mô hình AI (Gemini) để trả lời tự nhiên, hóm hỉnh như con người
    const aiResult = await aiModelService.generateConversationalResponse({
        userMessage: message,
        context,
        fallbackText
    });

    return {
        reply: aiResult.reply || fallbackText,
        products: [],
        suggestions: customSuggestions || [
            'Tư vấn Laptop sinh viên',
            'Tư vấn Điện thoại chụp ảnh',
            'Xem máy tính bảng học tập',
            'Săn mã giảm giá hôm nay'
        ],
        context,
        meta: {
            provider: aiResult.provider,
            model: aiResult.model,
            isFallback: aiResult.isFallback
        }
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
    , isHearingAidMedicalQuestion
    , buildHearingAidSafetyResponse
};
