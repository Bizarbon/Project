/**
 * Cấu hình cho hệ thống NLU & Guardrails (Giai đoạn A)
 * TechEcommerce - AI Shopping Assistant
 */

module.exports = {
    // Hotline và kênh hỗ trợ chính thức của TechEcommerce
    HOTLINE_SALES: process.env.TECHECOMMERCE_HOTLINE_SALES || '0842.331.606',
    HOTLINE_SUPPORT: process.env.TECHECOMMERCE_HOTLINE_SUPPORT || '0842.331.606',
    ZALO_SUPPORT: process.env.TECHECOMMERCE_ZALO || 'https://zalo.me/0842331606',
    EMAIL_SUPPORT: 'support@techecommerce.vn',

    // Ngưỡng dung sai mặc định cho ngân sách dạng "khoảng / tầm 15tr" (±15%)
    DEFAULT_RANGE_RATIO: 0.15,

    // Cờ bật/tắt toàn bộ pipeline NLU qua biến môi trường (mặc định bật)
    NLU_ENABLED: process.env.NLU_PIPELINE !== 'off',

    // Danh sách các thương hiệu chính hãng được TechEcommerce phân phối
    SUPPORTED_BRANDS: [
        'Apple', 'Samsung', 'Asus', 'Lenovo', 'Dell', 'HP', 'Acer', 'MSI',
        'Xiaomi', 'OPPO', 'Sony', 'Garmin', 'Nintendo', 'Logitech', 'Anker',
        'Ugreen', 'DJI', 'Marshall', 'Huawei', 'POCO', 'HONOR'
    ],

    // Danh sách 7 danh mục sản phẩm chính thức
    SUPPORTED_CATEGORIES: [
        'Điện thoại',
        'Laptop',
        'Tablet',
        'Tai nghe',
        'Đồng hồ thông minh',
        'Máy chơi game',
        'Phụ kiện'
    ],

    // Xưng hô chuẩn mực nhất quán: Bot xưng 'em', gọi khách là 'bạn'
    BOT_PRONOUN: 'em',
    USER_PRONOUN: 'bạn',

    // Cấu hình slot câu hỏi và thuật ngữ theo từng danh mục (Tránh dùng từ 'máy' cho phụ kiện)
    CATEGORY_CONFIG: {
        'Điện thoại': {
            term: 'máy',
            label: 'điện thoại',
            primarySlots: ['budget', 'useCase'],
            budgetUnit: 'triệu',
            defaultBudgetSuggestions: ['Điện thoại dưới 10 triệu', 'Điện thoại 10 - 20 triệu', 'Điện thoại trên 20 triệu']
        },
        'Laptop': {
            term: 'máy',
            label: 'laptop',
            primarySlots: ['budget', 'useCase'],
            budgetUnit: 'triệu',
            defaultBudgetSuggestions: ['Laptop dưới 15 triệu', 'Laptop 15 - 25 triệu', 'Laptop trên 25 triệu']
        },
        'Tablet': {
            term: 'máy',
            label: 'máy tính bảng',
            primarySlots: ['budget', 'useCase'],
            budgetUnit: 'triệu',
            defaultBudgetSuggestions: ['Tablet dưới 10 triệu', 'Tablet 10 - 20 triệu', 'Tablet trên 20 triệu']
        },
        'Máy chơi game': {
            term: 'máy',
            label: 'máy chơi game',
            primarySlots: ['budget', 'useCase'],
            budgetUnit: 'triệu',
            defaultBudgetSuggestions: ['PlayStation 5 Slim', 'Nintendo Switch OLED', 'Steam Deck OLED']
        },
        'Tai nghe': {
            term: 'mẫu tai nghe',
            label: 'tai nghe',
            primarySlots: ['useCase', 'budget'],
            budgetUnit: 'k_or_triệu',
            defaultBudgetSuggestions: ['Tai nghe dưới 1 triệu', 'Tai nghe 1 - 3 triệu', 'Tai nghe trên 3 triệu']
        },
        'Đồng hồ thông minh': {
            term: 'mẫu đồng hồ',
            label: 'đồng hồ thông minh',
            primarySlots: ['useCase', 'budget'],
            budgetUnit: 'triệu',
            defaultBudgetSuggestions: ['Đồng hồ dưới 5 triệu', 'Đồng hồ 5 - 10 triệu', 'Đồng hồ trên 10 triệu']
        },
        'Phụ kiện': {
            term: 'mẫu phụ kiện',
            label: 'phụ kiện',
            primarySlots: ['useCase', 'budget'],
            budgetUnit: 'k_or_triệu',
            defaultBudgetSuggestions: ['Phụ kiện dưới 500k', 'Phụ kiện 500k - 1.5 triệu', 'Phụ kiện trên 1.5 triệu']
        }
    }
};

