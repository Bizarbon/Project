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
    ]
};

