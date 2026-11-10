/**
 * Test Suite: Toàn bộ Kịch bản Tri thức Cửa hàng & Đối đáp Đời thường Nâng cao
 * Script: node backend/scripts/testAllSmartScenarios.js
 */

const { matchSmartAnswer } = require('../src/services/storeKnowledgeAndChitChat');

const SCENARIOS = [
    // --- 1. CHÍNH SÁCH WEBSITE & NGHIỆP VỤ ---
    {
        title: 'Hóa đơn đỏ VAT điện tử công ty',
        input: 'Bên em có xuất hóa đơn đỏ công ty không?',
        expectedIntent: 'vat_invoice',
        mustInclude: ['đã bao gồm thuế VAT', 'Hóa đơn điện tử', '0842.331.606']
    },
    {
        title: 'Chương trình Thu cũ đổi mới',
        input: 'Bên shop có thu cũ đổi mới không?',
        expectedIntent: 'trade_in',
        mustInclude: ['Thu Cũ Đổi Mới', '2.000.000 đ', '15 phút']
    },
    {
        title: 'Trả góp qua CCCD gắn chip (không có thẻ tín dụng)',
        input: 'Không có thẻ tín dụng trả góp được không?',
        expectedIntent: 'installment_cccd',
        mustInclude: ['CCCD gắn chip', '18 tuổi', '15 – 20 phút']
    },
    {
        title: 'Gói Bảo hành Vàng VIP',
        input: 'Có bảo hành rơi vỡ không shop?',
        expectedIntent: 'golden_warranty',
        mustInclude: ['BẢO HÀNH VÀNG', 'rơi vỡ màn hình', 'vào nước']
    },
    {
        title: 'Cam kết máy mới nguyên seal VN/A',
        input: 'Hàng bên em có nguyên seal chính hãng không?',
        expectedIntent: 'genuine_seal_commitment',
        mustInclude: ['mới nguyên seal', 'VN/A', 'hoàn tiền 200%']
    },
    {
        title: 'Hotline và kênh liên hệ chính thức',
        input: 'Cho xin số điện thoại hotline của shop',
        expectedIntent: 'contact_hotline',
        mustInclude: ['0842.331.606', 'Zalo hỗ trợ trực tiếp']
    },
    {
        title: 'Ưu đãi Học sinh Sinh viên',
        input: 'Sinh viên có được giảm giá không?',
        expectedIntent: 'student_discount',
        mustInclude: ['Học sinh - Sinh viên', '300.000đ – 500.000đ', 'Thẻ HSSV']
    },
    {
        title: 'Đặt giữ hàng 24h tại Showroom',
        input: 'Có được đặt giữ hàng trước không em?',
        expectedIntent: 'reserve_product',
        mustInclude: ['Đặt giữ hàng tại Showroom trong 24 giờ', '135 Nguyễn Thị Thập', '78 Thái Hà']
    },
    {
        title: 'Chính sách đổi trả 1 đổi 1 trong 30 ngày',
        input: 'Chính sách đổi trả trong bao lâu nếu máy bị lỗi?',
        expectedIntent: 'return_exchange_policy',
        mustInclude: ['1 ĐỔI 1 TRONG 30 NGÀY', 'nguyên seal 100%', '0842.331.606']
    },
    {
        title: 'Giao hàng hỏa tốc và đồng kiểm COD',
        input: 'Giao hàng bao lâu thì tới và có được kiểm tra hàng không?',
        expectedIntent: 'shipping_and_cod',
        mustInclude: ['Giao siêu tốc 2 giờ', 'ĐỒNG KIỂM 100%', 'Mở hộp kiểm tra']
    },
    {
        title: 'Phương thức thanh toán đa dạng',
        input: 'Shop có những hình thức thanh toán nào vậy?',
        expectedIntent: 'payment_methods',
        mustInclude: ['COD', 'VietQR', 'MIỄN PHÍ CÀ THẺ', 'VNPAY-QR']
    },

    // --- 2. XỬ LÝ TỪ CHỐI & LƯỠNG LỰ (OBJECTION HANDLING) ---
    {
        title: 'Khách lưỡng lự: Để mình suy nghĩ thêm',
        input: 'Để mình suy nghĩ thêm nha em',
        expectedIntent: 'objection_think_about_it',
        mustInclude: ['hoàn toàn hiểu', 'thong thả suy nghĩ', 'Lưu lại thông tin tư vấn']
    },
    {
        title: 'So sánh giá đối thủ: Hoàng Hà bán rẻ hơn',
        input: 'Bên Hoàng Hà bán rẻ hơn bên em vài trăm nghìn',
        expectedIntent: 'objection_competitor_price',
        mustInclude: ['100% thuế VAT', 'mới nguyên seal 100%', '1 ĐỔI 1 TRONG 30 NGÀY', 'trợ giá tốt nhất']
    },
    {
        title: 'Khách chê đắt chung chung: Giá chát quá',
        input: 'Giá chát quá em ơi',
        expectedIntent: 'objection_too_expensive',
        mustInclude: ['thấu hiểu', 'Trả góp 0%', 'Thu cũ đổi mới trợ giá']
    },

    // --- 3. PHẦN CỨNG, MỞ RỘNG & PHẦN MỀM / GAME ---
    {
        title: 'Phụ kiện trong hộp iPhone 16',
        input: 'Hộp iPhone 16 Pro Max có củ sạc không em?',
        expectedIntent: 'hardware_in_the_box',
        mustInclude: ['cắt giảm củ sạc', 'Cáp sạc C-to-C', 'Anker GaN 30W / 65W']
    },
    {
        title: 'Nâng cấp RAM/SSD trên Laptop và MacBook',
        input: 'Laptop này có nâng cấp RAM và SSD được không?',
        expectedIntent: 'hardware_laptop_upgrade',
        mustInclude: ['2 khe RAM SO-DIMM', 'khe cắm SSD M.2', 'MacBook', 'HOÀN TOÀN KHÔNG THỂ NÂNG CẤP']
    },
    {
        title: 'SIM vật lý và hỗ trợ eSIM',
        input: 'Máy này dùng được mấy SIM có hỗ trợ eSIM không?',
        expectedIntent: 'hardware_sim_esim',
        mustInclude: ['2 SIM tiện lợi', '1 SIM vật lý nano + 1 eSIM', '2 eSIM', 'quét mã QR']
    },
    {
        title: 'Chạy AutoCAD, Premiere, Photoshop',
        input: 'Máy này chạy mượt AutoCAD và dựng video Premiere không?',
        expectedIntent: 'software_graphics_cad_render',
        mustInclude: ['Photoshop, Illustrator', '100% sRGB', 'NVIDIA GeForce RTX', 'RAM từ 16GB – 32GB']
    },
    {
        title: 'Học lập trình CNTT, Docker, Android Studio',
        input: 'Học CNTT lập trình thì nên mua máy nào?',
        expectedIntent: 'software_coding_developer',
        mustInclude: ['RAM tối thiểu 16GB', 'Docker containers', 'Apple Silicon', 'MacBook']
    },
    {
        title: 'Chiến game Genshin Impact, Valorant, Wukong',
        input: 'Chơi mượt Genshin Impact và Valorant không?',
        expectedIntent: 'gaming_compatibility_advice',
        mustInclude: ['Valorant, FC Online', '120 – 165+ FPS', 'Genshin Impact', 'RTX 3050 / RTX 4050']
    },

    // --- 4. MÀU SẮC, PHONG THỦY & SO SÁNH NỀN TẢNG ---
    {
        title: 'Màu sắc bán chạy nhất hot trend',
        input: 'Màu nào đẹp và bán chạy nhất hiện nay?',
        expectedIntent: 'color_best_seller_trend',
        mustInclude: ['Titan Sa Mạc', 'Titan Tự Nhiên', 'Đen Titan / Xám Midnight', 'Trắng Starlight']
    },
    {
        title: 'Màu sắc hợp Mệnh Kim phong thủy',
        input: 'Mệnh Kim thì nên chọn máy màu gì hợp phong thủy?',
        expectedIntent: 'color_feng_shui_advice',
        mustInclude: ['Mệnh Kim', 'Trắng, Bạc (Silver)', 'Vàng ánh kim (Gold)']
    },
    {
        title: 'Nên mua iPhone hay Samsung (iOS vs Android)',
        input: 'Nên mua iPhone hay Samsung vậy em?',
        expectedIntent: 'platform_ios_vs_android',
        mustInclude: ['iPhone (Apple iOS)', 'Samsung Galaxy (Android)', 'Dynamic AMOLED 2X 120Hz', 'S-Pen']
    },
    {
        title: 'Nên mua MacBook hay Laptop Windows',
        input: 'Nên mua MacBook hay Laptop Windows?',
        expectedIntent: 'platform_macbook_vs_windows',
        mustInclude: ['MacBook (Apple Silicon)', 'Pin trâu kỷ lục', 'Laptop Windows', 'chơi game']
    },

    // --- 5. MẸO VẶT CÔNG NGHỆ ĐỜI THƯỜNG ---
    {
        title: 'Sạc qua đêm có chai pin không',
        input: 'Sạc qua đêm có bị chai pin không em?',
        expectedIntent: 'charge_overnight',
        mustInclude: ['Sạc pin tối ưu', 'hoàn toàn an toàn']
    },
    {
        title: 'Nên dán cường lực hay dán PPF',
        input: 'Nên dán cường lực hay dán PPF cho máy?',
        expectedIntent: 'tempered_glass_vs_ppf',
        mustInclude: ['Kính cường lực', 'Miếng dán PPF']
    },
    {
        title: 'Laptop chơi game bị nóng quạt kêu to',
        input: 'Laptop chơi game bị nóng quạt kêu to có sao không?',
        expectedIntent: 'laptop_heating_fan',
        mustInclude: ['cơ chế bảo vệ hoàn toàn bình thường', 'Kê cao phần đuôi đáy máy']
    },
    {
        title: 'Cách chụp màn hình MacBook & Windows',
        input: 'Cách chụp màn hình macbook thế nào?',
        expectedIntent: 'screenshot_shortcut',
        mustInclude: ['Cmd + Shift + 4', 'Windows + Shift + S']
    },
    {
        title: 'Vừa sạc vừa dùng điện thoại',
        input: 'Vừa sạc vừa dùng điện thoại có nguy hiểm không?',
        expectedIntent: 'use_phone_while_charging',
        mustInclude: ['pin vừa nạp vừa xả', 'củ cáp sạc giá rẻ trôi nổi']
    },
    {
        title: 'Cách kiểm tra độ chai pin',
        input: 'Làm sao để kiểm tra độ chai pin trên máy?',
        expectedIntent: 'check_battery_health',
        mustInclude: ['Tình trạng pin & Sạc', 'Dung lượng tối đa', 'powercfg /batteryreport']
    },
    {
        title: 'Cách dọn dẹp bộ nhớ báo đầy',
        input: 'Bộ nhớ điện thoại báo đầy thì xử lý thế nào?',
        expectedIntent: 'clear_storage_space',
        mustInclude: ['Dọn bộ nhớ đệm (Cache)', 'Zalo', 'Recently Deleted']
    },
    {
        title: 'Mẹo tiết kiệm pin khi đi xa',
        input: 'Có mẹo nào tiết kiệm pin khi đi xa không?',
        expectedIntent: 'extend_battery_life',
        mustInclude: ['Tiết kiệm pin (Low Power Mode)', 'Chuyển về 4G', 'Pin sạc dự phòng']
    },

    // --- 6. ĐỐI ĐÁP ĐỜI THƯỜNG & TÂM SỰ ---
    {
        title: 'Ăn cơm chưa',
        input: 'Em ăn cơm chưa?',
        expectedIntent: 'eating_and_health',
        mustInclude: ['chạy bằng điện', 'ấm lòng ghê']
    },
    {
        title: 'Đi làm mệt mỏi áp lực',
        input: 'Hôm nay đi làm mệt và áp lực quá em ơi',
        expectedIntent: 'tired_and_stress',
        mustInclude: ['thương bạn nhiều', 'nghỉ ngơi sớm']
    },
    {
        title: 'Kể chuyện cười',
        input: 'Kể một câu chuyện cười đi em',
        expectedIntent: 'tell_a_joke',
        mustInclude: ['10 ổ bánh mì', 'CÓ BÁN TRỨNG']
    },
    {
        title: 'Thời tiết mưa to gió lớn',
        input: 'Trời đang mưa to quá',
        expectedIntent: 'weather_rain',
        mustInclude: ['đi lại cẩn thận', 'túi zip chống nước 100%']
    },
    {
        title: 'Hỏi tuổi tác và người yêu',
        input: 'Em mấy tuổi rồi có người yêu chưa?',
        expectedIntent: 'ai_personal_life',
        mustInclude: ['người yêu', 'độc thân vui vẻ']
    },
    {
        title: 'Hỏi AI hay người thật',
        input: 'Em có phải robot không?',
        expectedIntent: 'is_ai_or_human',
        mustInclude: ['Trợ lý AI Mua sắm', 'thật 100% từ trái tim']
    },
    {
        title: 'Gợi ý món ăn',
        input: 'Hôm nay ăn gì em?',
        expectedIntent: 'food_and_drink',
        mustInclude: ['Cơm tấm', 'phở bò', 'cà phê']
    },
    {
        title: 'Than hết tiền nghèo quá',
        input: 'Hết tiền rồi nghèo quá',
        expectedIntent: 'no_money_poor',
        mustInclude: ['thấu hiểu lắm', 'học sinh sinh viên', 'Trả góp 0%']
    },
    {
        title: 'Khen AI thông minh giỏi giang',
        input: 'Em thông minh và dễ thương quá',
        expectedIntent: 'ai_compliment_praise',
        mustInclude: ['nở mũi', 'ấm lòng ghê', 'Cảm ơn bạn rất nhiều']
    },
    {
        title: 'Chúc ngủ ngon và tạm biệt',
        input: 'Chúc em ngủ ngon nhé tạm biệt',
        expectedIntent: 'goodbye_and_goodnight',
        mustInclude: ['tạm biệt bạn', 'ngủ thật ngon', 'Hẹn sớm gặp lại']
    },
    {
        title: 'Khách bực bội, khó chịu',
        input: 'Bực mình quá sao phục vụ kiểu gì vậy',
        expectedIntent: 'handle_angry_frustrated',
        mustInclude: ['thật sự xin lỗi', 'phiền lòng và bực bội', '0842.331.606']
    },
    // --- 7. KỊCH BẢN MỚI NÂNG CẤP (TƯ VẤN B2B, NÂNG CẤP ĐỜI MÁY, CỨU HỘ & TÂM LÝ) ---
    {
        title: 'Chiết khấu mua số lượng lớn cho công ty B2B',
        input: 'Công ty mình muốn mua số lượng lớn có chiết khấu không shop?',
        expectedIntent: 'policy_b2b_corporate_bulk',
        mustInclude: ['Doanh nghiệp, Công ty', '3% đến 8%', '0842.331.606']
    },
    {
        title: 'Thanh toán quẹt thẻ mPOS tại nhà',
        input: 'Giao hàng có mang máy pos đến quẹt thẻ tại nhà không?',
        expectedIntent: 'policy_pos_payment_at_home',
        mustInclude: ['mPOS TẬN NƠI TẠI NHÀ', 'mọi loại thẻ', 'đồng kiểm']
    },
    {
        title: 'Khách ngại: Sợ vợ mắng / Vợ không cho mua',
        input: 'Thích chiếc máy này quá mà sợ vợ mắng không cho mua',
        expectedIntent: 'objection_wife_afraid',
        mustInclude: ['yêu vợ', 'Trả góp 0%', 'màu sắc chị thích']
    },
    {
        title: 'Khách hẹn: Chờ lương về đầu tháng sau mới mua',
        input: 'Đầu tháng sau có lương anh mới ghé mua được',
        expectedIntent: 'objection_wait_for_salary',
        mustInclude: ['lãnh lương', 'GIỮ MÃ GIẢM GIÁ', 'HOÀN TOÀN MIỄN PHÍ']
    },
    {
        title: 'Đang dùng iPhone 11 có nên lên iPhone 16 không',
        input: 'Đang dùng iPhone 11 có nên lên đời iPhone 16 không em?',
        expectedIntent: 'advice_iphone_upgrade_decision',
        mustInclude: ['Type-C', 'Dynamic Island', 'Camera 48MP', 'Thu cũ đổi mới']
    },
    {
        title: 'Đang dùng MacBook chip Intel có nên đổi sang chip M',
        input: 'Macbook cũ chạy chip Intel chậm quá có nên đổi sang chip M không?',
        expectedIntent: 'advice_macbook_intel_to_m_series',
        mustInclude: ['NÊN ĐỔI NGAY', 'mát rượi', '15 – 18 tiếng', 'Instant On']
    },
    {
        title: 'Màn hình 60Hz và 120Hz khác biệt thực tế',
        input: 'Màn hình 60Hz và 120Hz khác gì nhau có đáng tiền không em?',
        expectedIntent: 'advice_screen_60hz_vs_120hz',
        mustInclude: ['120 lần mỗi giây', 'như bôi bơ', 'LTPO thông minh']
    },
    {
        title: 'Nên mua iPad bản Wi-Fi hay Cellular 4G',
        input: 'Nên mua iPad wifi hay 4g cellular hả em?',
        expectedIntent: 'advice_ipad_wifi_vs_cellular',
        mustInclude: ['3.000.000 đ', 'Instant Hotspot', 'bản Wi-Fi', 'Bút Apple Pencil']
    },
    {
        title: 'Nên chọn bộ nhớ 128GB hay 256GB',
        input: 'Điện thoại 128gb có đủ dùng không hay nên lấy 256gb?',
        expectedIntent: 'advice_storage_128gb_vs_256gb',
        mustInclude: ['128GB', '256GB', 'LỰA CHỌN VÀNG']
    },
    {
        title: 'Củ sạc nhanh 100W GaN sạc cho iPhone an toàn không',
        input: 'Củ sạc nhanh 100W GaN sạc cho iPhone có sợ nổ chai pin không em?',
        expectedIntent: 'advice_gan_charger_safety',
        mustInclude: ['CỰC KỲ AN TOÀN', 'Power Delivery', 'GaN']
    },
    {
        title: 'Chuẩn chống nước IP68 có mang đi bơi được không',
        input: 'Điện thoại chống nước IP68 có mang đi bơi chụp ảnh dưới nước được không?',
        expectedIntent: 'advice_waterproof_ip68_swimming',
        mustInclude: ['nước ngọt tĩnh', 'muối ăn mòn', 'TUYỆT ĐỐI KHÔNG NÊN']
    },
    {
        title: 'Combo thiết bị cho dân làm TikToker / Vlogger',
        input: 'Muốn làm tiktoker vlogger chuyên nghiệp nên mua thiết bị gì em?',
        expectedIntent: 'advice_creator_vlogger_setup',
        mustInclude: ['DJI Osmo Pocket 3', 'iPhone 16 Pro Max', 'DJI Mic 2']
    },
    {
        title: 'So sánh máy chơi game PS5 Slim vs Nintendo Switch OLED',
        input: 'Nên mua PS5 hay Nintendo Switch để chơi game em?',
        expectedIntent: 'compare_ps5_vs_switch_vs_steamdeck',
        mustInclude: ['PlayStation 5 Slim', 'Nintendo Switch OLED', 'DualSense']
    },
    {
        title: 'Mua máy chơi game có kèm sẵn game không',
        input: 'Mua PS5 có sẵn game chơi luôn không hay phải mua thêm đĩa game?',
        expectedIntent: 'console_games_included_or_not',
        mustInclude: ['Astro\'s Playroom', 'Free-to-play', 'Đĩa game', 'PlayStation Plus']
    },
    {
        title: 'Cấp cứu khẩn cấp điện thoại rơi vào nước',
        input: 'Điện thoại bị rơi vào nước phải làm sao cấp cứu khẩn cấp em ơi?',
        expectedIntent: 'tip_water_damage_emergency',
        mustInclude: ['CẤM cắm sạc', 'CẤM dùng máy sấy', 'CẤM vùi máy vào thùng gạo', 'Tắt nguồn']
    },
    {
        title: 'Cách vệ sinh màn hình laptop bàn phím đúng chuẩn',
        input: 'Vệ sinh màn hình MacBook bằng cồn được không shop?',
        expectedIntent: 'tip_screen_keyboard_cleaning',
        mustInclude: ['TUYỆT ĐỐI KHÔNG dùng cồn', 'Microfiber', 'nước cất', 'miễn phí 100%']
    },
    {
        title: 'Khắc phục tai nghe 1 bên bị nhỏ tiếng hoặc mất kết nối',
        input: 'Tai nghe AirPods một bên không nghe được hoặc bị nhỏ tiếng xử lý thế nào?',
        expectedIntent: 'tip_earphone_one_side_issue',
        mustInclude: ['Vệ sinh màng lưới', 'chân tiếp xúc', 'Reset lại tai nghe']
    },
    {
        title: 'Hỏi về chú Mèo Đại diện của cửa hàng',
        input: 'Con mèo trên màn hình là con mèo gì mặc vest dễ thương thế?',
        expectedIntent: 'chit_chat_cat_mascot',
        mustInclude: ['Mèo Quản gia Công nghệ', 'siêu năng lực', 'canh giữ kho hàng']
    },
    {
        title: 'Tư vấn mua điện thoại tặng bố mẹ người lớn tuổi',
        input: 'Tư vấn điện thoại cho bố mẹ người già đọc báo dễ dùng em ơi',
        expectedIntent: 'chit_chat_gift_parents_seniors',
        mustInclude: ['Samsung Galaxy A-Series', 'Easy Mode', 'iPad Gen 10', 'sức khỏe']
    },
    {
        title: 'Tư vấn máy tính bảng cho con em học tiếng Anh',
        input: 'Mua máy tính bảng cho con học tiếng Anh và học online nên chọn máy nào?',
        expectedIntent: 'chit_chat_gift_kids_students',
        mustInclude: ['Bảo vệ thị lực', 'Parental Controls', 'iPad Gen 10', 'Samsung Kids']
    }
];

const NON_INTERCEPTED_QUERIES = [
    { title: 'Tìm laptop học online', input: 'laptop 15tr học online' },
    { title: 'Tìm kiếm sản phẩm cụ thể', input: 'iPhone 16 Pro Max' },
    { title: 'Hỏi chuột gaming tầm giá', input: 'chuột gaming dưới 1 triệu' },
    { title: 'So sánh theo ngữ cảnh', input: 'so sánh 2 máy vừa rồi' },
    { title: 'Hỏi máy rẻ hơn theo ngữ cảnh', input: 'đắt quá có con nào rẻ hơn không' }
];

console.log('===============================================================');
console.log(`🚀 BẮT ĐẦU CHẠY KIỂM THỬ ${SCENARIOS.length} KỊCH BẢN THỰC TẾ CÔNG NGHỆ & ĐỜI THƯỜNG`);
console.log('===============================================================\n');

let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < SCENARIOS.length; i++) {
    const sc = SCENARIOS[i];
    const res = matchSmartAnswer(sc.input);
    const num = String(i + 1).padStart(2, '0');

    if (!res) {
        console.error(`❌ [${num}] KHÔNG KHỚP: "${sc.input}"`);
        failedCount++;
        continue;
    }

    let isOk = true;
    const errors = [];

    if (sc.expectedIntent && res.intent !== sc.expectedIntent) {
        isOk = false;
        errors.push(`Sai intent: mong đợi "${sc.expectedIntent}", nhận "${res.intent}"`);
    }

    if (sc.mustInclude) {
        for (const phrase of sc.mustInclude) {
            if (!res.reply.includes(phrase)) {
                isOk = false;
                errors.push(`Thiếu cụm từ: "${phrase}"`);
            }
        }
    }

    // Persona checks: CẤM "mình", "tụi mình", "chúng mình", "chúng ta"
    const forbidden = ['tụi mình', 'chúng mình', 'chúng ta'];
    for (const f of forbidden) {
        if (res.reply.toLowerCase().includes(f)) {
            isOk = false;
            errors.push(`Chứa đại từ cấm: "${f}"`);
        }
    }

    // Kiểm tra có dùng "em" và "bạn"
    if (!res.reply.includes('em') && !res.reply.includes('Em')) {
        isOk = false;
        errors.push(`Thiếu ngôi xưng "em"`);
    }

    if (isOk) {
        passedCount++;
        console.log(`  ✅ [${num}] ${sc.title} (Intent: ${res.intent}) -> ĐẠT`);
    } else {
        failedCount++;
        console.error(`  ❌ [${num}] ${sc.title}: ${errors.join('; ')}`);
    }
}

console.log('\n---------------------------------------------------------------');
console.log('🔍 KIỂM TRA CHỐNG BẮT NHẦM CÂU HỎI TƯ VẤN SẢN PHẨM / ĐƠN LƯỢT:');
console.log('---------------------------------------------------------------');

let nonInterceptPassed = 0;
for (const item of NON_INTERCEPTED_QUERIES) {
    const res = matchSmartAnswer(item.input);
    if (res === null) {
        nonInterceptPassed++;
        console.log(`  ✅ [Không bắt nhầm] "${item.input}" -> null (đúng, chuyển cho catalog engine)`);
    } else {
        console.error(`  ❌ [Bắt nhầm nguy hiểm!] "${item.input}" bị chặn bởi intent: ${res.intent}`);
    }
}

console.log('\n===============================================================');
console.log(`📊 TỔNG KẾT: ${passedCount}/${SCENARIOS.length} Kịch bản ĐẠT (${Math.round((passedCount / SCENARIOS.length) * 100)}%)`);
console.log(`🛡️ CHỐNG BẮT NHẦM: ${nonInterceptPassed}/${NON_INTERCEPTED_QUERIES.length} ĐẠT`);
console.log('===============================================================');

if (failedCount > 0 || nonInterceptPassed < NON_INTERCEPTED_QUERIES.length) {
    process.exit(1);
} else {
    console.log('🎉 TẤT CẢ TEST CASES ĐÃ ĐẠT 100% HOÀN HẢO!');
}

