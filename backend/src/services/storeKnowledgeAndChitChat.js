/**
 * Store Knowledge & Human-like Chit-Chat Engine
 * TechEcommerce - AI Shopping Assistant
 * 
 * Quản lý tri thức chính sách cửa hàng và đối đáp tự nhiên, hóm hỉnh,
 * chân thực như con người cho các câu hỏi đời thường, mẹo vặt công nghệ và tâm sự.
 */

const { normalizeText } = require('./nlu/normalizer');

function hasWordOrPhrase(text, phrase) {
    const normText = normalizeText(text).unaccented;
    const normPhrase = normalizeText(phrase).unaccented;
    const regex = new RegExp(`(^|\\s|[.,!?;:()"])${normPhrase}($|\\s|[.,!?;:()"])`, 'i');
    return regex.test(normText);
}

// -------------------------------------------------------------
// 1. CHÍNH SÁCH WEBSITE & NGHIỆP VỤ CỬA HÀNG (STORE POLICIES)
// -------------------------------------------------------------

const STORE_POLICY_RULES = [
    // 1.1 Hóa đơn đỏ VAT / Hóa đơn điện tử công ty
    {
        id: 'vat_invoice',
        patterns: [
            /(xuat|lay|co|can|tinh).*(hoa don|vat)/i,
            /(hoa don|vat).*(cong ty|do|mst|dien tu)/i,
            /gia.*(da co|da gom|bao gom).*vat/i
        ],
        keywords: [
            'hoa don vat', 'hoa don do', 'xuat hoa don', 'hoa don cong ty', 'hoa don dien tu',
            'co vat khong', 'gia da co vat chua', 'gia da gom vat chua', 'thue vat', 'lay hoa don',
            'mst', 'ma so thue', 'xuat vat'
        ],
        reply: `Dạ 100% giá bán hiển thị tại TechEcommerce **đã bao gồm thuế VAT** đầy đủ rồi bạn nhé! 📄\n\n` +
            `Cửa hàng hỗ trợ xuất **Hóa đơn điện tử (e-Invoice)** hợp pháp cho cả khách hàng cá nhân và doanh nghiệp/công ty hoàn toàn miễn phí:\n` +
            `• **Cách thức:** Khi đặt hàng trên website, bạn chỉ cần tích chọn *"Xuất hóa đơn công ty"* ở bước thanh toán và điền: **Tên công ty, Mã số thuế, Địa chỉ và Email nhận hóa đơn**.\n` +
            `• **Thời gian nhận:** Hóa đơn điện tử sẽ được kế toán gửi thẳng về email của bạn trong vòng **24 - 48 giờ làm việc** sau khi đơn hàng giao thành công.\n\n` +
            `👉 Nếu bạn cần hỗ trợ xuất hóa đơn gấp, cứ nhắn hotline kế toán **0842.331.606** để được ưu tiên xử lý trong ngày nhé! 😊`,
        suggestions: ['Chính sách bảo hành', 'Hình thức thanh toán', 'Tư vấn Laptop công ty', 'Hotline 0842.331.606']
    },

    // 1.2 Chương trình Thu cũ Đổi mới (Trade-in)
    {
        id: 'trade_in',
        patterns: [
            /(thu cu|trade[\s-]?in|doi may cu|len doi).*(moi|cu|khong|gia|the nao)/i,
            /(co|nhan|ho tro).*(thu cu|trade[\s-]?in|thu lai)/i
        ],
        keywords: [
            'thu cu doi moi', 'thu cu', 'trade in', 'trade-in', 'doi may cu', 'len doi may',
            'thu may cu', 'tro gia thu cu', 'thu cu len doi', 'may cu co thu khong', 'dinh gia may cu'
        ],
        reply: `Dạ TechEcommerce đang có chương trình **'Thu Cũ Đổi Mới – Lên Đời Siêu Hời'** cực kỳ được khách hàng yêu thích luôn ạ! 🔄\n\n` +
            `✨ **Quyền lợi độc quyền khi Trade-in tại shop:**\n` +
            `• 💰 **Trợ giá thêm đến 2.000.000 đ** trừ trực tiếp vào giá máy mới bạn chọn.\n` +
            `• ⏱️ **Thẩm định nhanh gọn trong 15 phút** tại Showroom hoặc định giá online trước qua Zalo.\n` +
            `• 📱 **Chấp nhận đa dạng:** Thu mua iPhone, Samsung Galaxy, MacBook, iPad, Smartwatch... Máy trầy xước nhẹ, chai pin bên em vẫn hỗ trợ thu giá rất tốt.\n` +
            `• 📦 Không yêu cầu phải còn hộp hay phụ kiện cũ đi kèm.\n\n` +
            `👉 Bạn đang có mẫu máy cũ nào muốn lên đời để em báo trước khoảng giá thu tham khảo cho bạn nhé! 😊`,
        suggestions: ['Lên đời iPhone 16 Pro Max', 'Lên đời Galaxy S25 Ultra', 'Địa chỉ Showroom định giá', 'Hotline 0842.331.606']
    },

    // 1.3 Trả góp khi KHÔNG có thẻ tín dụng (qua CCCD gắn chip)
    {
        id: 'installment_cccd',
        patterns: [
            /(khong co|chua co).*(the tin dung|the visa|the master).*(tra gop)/i,
            /(tra gop).*(bang|qua|dung).*(cccd|can cuoc|cmnd)/i
        ],
        keywords: [
            'tra gop cccd', 'tra gop can cuoc', 'khong co the tin dung', 'tra gop bang can cuoc',
            'tra gop khong can the', 'bao nhieu tuoi duoc tra gop', 'ho so tra gop', 'thu tuc tra gop cccd',
            'fe credit', 'home credit', 'hd saison', 'tra truoc bao nhieu'
        ],
        reply: `Dạ hoàn toàn được bạn nha! Nếu chưa có thẻ tín dụng ngân hàng, bạn có thể chọn hình thức **Trả góp qua Công ty Tài chính (Home Credit / FE Credit)** cực kỳ tiện lợi:\n\n` +
            `• 📋 **Hồ sơ siêu đơn giản:** Chỉ cần **CCCD gắn chip** chính chủ (độ tuổi từ 18 tuổi trở lên, không có nợ xấu ngân hàng).\n` +
            `• 💰 **Mức trả trước:** Chỉ từ **10% – 30%** giá trị máy (rất nhiều dòng máy hỗ trợ trả trước 0 đồng).\n` +
            `• ⏱️ **Thời gian xét duyệt:** Duyệt online trong **15 – 20 phút**, không cần chứng minh thu nhập và không gọi làm phiền người thân.\n` +
            `• 💳 **Lãi suất:** Hỗ trợ gói **0% lãi suất** hoặc lãi suất ưu đãi tối ưu cho kỳ hạn 6 - 9 - 12 tháng.\n\n` +
            `👉 Bạn đang quan tâm mẫu máy nào để em tính chi tiết số tiền trả trước và tiền góp mỗi tháng vừa vặn nhất cho bạn nhé! 😊`,
        suggestions: ['Tính trả góp iPhone 16', 'Tính trả góp Laptop sinh viên', 'Địa chỉ Showroom', 'Hotline 0842.331.606']
    },

    // 1.4 Gói Bảo Hành Vàng (Rơi vỡ, Vào nước)
    {
        id: 'golden_warranty',
        patterns: [
            /(bao hanh|co bao hanh).*(roi vo|vao nuoc|be man hinh|roi rot)/i,
            /bao hanh vang/i
        ],
        keywords: [
            'bao hanh vang', 'roi vo', 'vao nuoc', 'bao hanh roi vo', 'bao hanh vao nuoc',
            'roi rot', 'be man hinh', 'roi nut man hinh', 'bao hanh vip', 'bao hanh mo rong'
        ],
        reply: `Dạ ngoài gói bảo hành chính hãng 12 - 24 tháng theo tiêu chuẩn nhà sản xuất, TechEcommerce có hỗ trợ thêm gói **BẢO HÀNH VÀNG (BẢO HÀNH VIP)** bảo vệ toàn diện:\n\n` +
            `• 🛡️ **Bảo vệ rủi ro bất ngờ:** Hỗ trợ 100% chi phí sửa chữa thay thế linh kiện chính hãng ngay cả khi **máy vô tình bị rơi vỡ màn hình, cấn móp hoặc rơi vào nước**.\n` +
            `• 🔄 **Đổi thân máy tương đương:** Nếu máy bị tổn hại quá nặng (>70%) không thể phục hồi, shop hỗ trợ đổi ngay thân máy khác cùng model.\n` +
            `• 📱 **Cấp máy dùng tạm:** Bạn được cung cấp máy dự phòng miễn phí trong suốt thời gian bảo dưỡng máy.\n\n` +
            `👉 Gói Bảo Hành Vàng đang được **giảm ngay 20%** khi mua kèm máy mới hôm nay đó ạ! Bạn có muốn em tư vấn chi tiết cho máy bạn đang chọn không nè?`,
        suggestions: ['Chính sách bảo hành chính hãng', 'Tư vấn điện thoại mới', 'Mã giảm giá hôm nay']
    },

    // 1.5 Cam kết chất lượng máy mới nguyên seal 100%
    {
        id: 'genuine_seal_commitment',
        keywords: [
            'nguyen seal', 'co nguyen seal khong', 'hang quoc te hay lock', 'may lock hay quoc te',
            'hang chinh hang hay xach tay', 'co phai hang cu khong', 'may moi 100%', 'hang vn/a khong',
            'co dung chinh hang khong', 'hang auth khong'
        ],
        reply: `Dạ TechEcommerce cam kết **100% sản phẩm là máy mới nguyên seal, chính hãng phân phối chính thức tại Việt Nam (mã VN/A đối với các thiết bị Apple)** ạ! 🏆\n\n` +
            `• 📦 **Nguyên seal từ nhà máy:** Khách hàng tự tay 'bóc seal', kiểm tra tem phụ tiếng Việt và kích hoạt bảo hành điện tử chính hãng tại chỗ.\n` +
            `• ❌ **Nói không với hàng kém chất lượng:** Shop tuyệt đối không kinh doanh hàng xách tay trôi nổi, máy Lock mạng, máy trả bảo hành hay máy đã qua sửa chữa.\n` +
            `• 🛡️ **Bảo hành ủy quyền toàn quốc:** Được tiếp nhận tại tất cả các Trung tâm bảo hành chính thức (Apple Care, Samsung Service, ASUS ROG, Dell...).\n\n` +
            `👉 Nếu phát hiện sản phẩm không đúng cam kết chính hãng, TechEcommerce xin **hoàn tiền 200%** ngay lập tức để bạn yên tâm tuyệt đối nhé! 😊`,
        suggestions: ['Chính sách đổi trả 30 ngày', 'Địa chỉ Showroom xem máy', 'Tư vấn sản phẩm mới']
    },

    // 1.6 Hotline & Kênh liên hệ chính thức
    {
        id: 'contact_hotline',
        keywords: [
            'hotline', 'so dien thoai', 'sdt shop', 'so tong dai', 'tong dai', 'gap nhan vien',
            'so zalo', 'zalo shop', 'lien he', 'cskh', 'cham soc khach hang', 'so dien thoai cua hang'
        ],
        reply: `Dạ bạn có thể liên hệ trực tiếp với đội ngũ nhân viên TechEcommerce qua các kênh chính thức sau nhé:\n\n` +
            `• 📞 **Hotline tư vấn & đặt hàng:** **0842.331.606** (08:30 – 21:30 hàng ngày, cước gọi tiêu chuẩn).\n` +
            `• 🛠️ **Hotline kỹ thuật & bảo hành:** **0842.331.606**\n` +
            `• 💬 **Zalo hỗ trợ trực tiếp:** [https://zalo.me/0842331606](https://zalo.me/0842331606)\n` +
            `• ✉️ **Email hỗ trợ:** support@techecommerce.vn\n\n` +
            `👉 Nếu bạn đang có câu hỏi cụ thể về sản phẩm nào, bạn cứ nhắn trực tiếp ngay tại đây, em luôn túc trực để giải đáp tức thì cho bạn nha! 😊`,
        suggestions: ['Địa chỉ Showroom', 'Kiểm tra đơn hàng', 'Tư vấn sản phẩm mới', 'Mã giảm giá hôm nay']
    },

    // 1.7 Ưu đãi Học sinh - Sinh viên (Back to school)
    {
        id: 'student_discount',
        keywords: [
            'sinh vien', 'hoc sinh sinh vien', 'uu dai sinh vien', 'giam gia sinh vien',
            'sinh vien co duoc giam khong', 'back to school', 'the sinh vien'
        ],
        reply: `Dạ có ưu đãi cực kỳ xịn sò dành riêng cho các bạn Học sinh - Sinh viên luôn nè! 🎓\n\n` +
            `• 🎁 **Giảm thêm trực tiếp 300.000đ – 500.000đ** vào hóa đơn mua Laptop, Tablet hoặc Smartphone (chỉ cần mang theo Thẻ HSSV hoặc giấy báo nhập học).\n` +
            `• 🎒 **Combo quà tặng thực tế:** Tặng kèm balo chống sốc cao cấp, chuột không dây và voucher giảm 20% khi mua phụ kiện củ cáp sạc.\n` +
            `• 🛠️ **Hỗ trợ phần mềm trọn đời:** Miễn phí cài đặt bộ công cụ Office, Windows bản quyền, phần mềm lập trình và đồ họa cơ bản.\n\n` +
            `👉 Bạn đang chuẩn bị sắm máy cho ngành học nào (Kinh tế, Lập trình CNTT hay Đồ họa) để em gợi ý dòng máy bền bỉ, pin trâu và hợp túi tiền nhất nhé! 😊`,
        suggestions: ['Laptop sinh viên dưới 15 triệu', 'Laptop lập trình CNTT', 'iPad học tập ghi chép', 'Mã giảm giá hôm nay']
    },

    // 1.8 Đặt giữ hàng trước tại Showroom
    {
        id: 'reserve_product',
        keywords: [
            'giu hang', 'dat giu may', 'dat truoc', 'qua xem sau', 'co duoc giu hang khong',
            'den showroom xem', 'dat giu san pham', 'chieu qua lay', 'toi qua lay'
        ],
        reply: `Dạ hoàn toàn được bạn nhé! TechEcommerce hỗ trợ **Đặt giữ hàng tại Showroom trong 24 giờ hoàn toàn miễn phí** (không cần đặt cọc trước) ạ! 🏬\n\n` +
            `• **Quyền lợi:** Khi bạn đặt giữ, nhân viên sẽ niêm phong sẵn đúng model và màu sắc bạn chọn tại quầy để đảm bảo không bị khách khác mua mất trước khi bạn ghé.\n` +
            `• **Trải nghiệm thoải mái:** Bạn đến showroom mở máy trải nghiệm thực tế, ưng ý mới thanh toán nhận máy; không mua cũng không sao nha.\n\n` +
            `👉 Bạn muốn giữ mẫu máy nào và dự kiến ghé Showroom ở **TP.HCM (Quận 7)** hay **Hà Nội (Thái Hà)** để em báo nhân viên chuẩn bị sẵn đón bạn nhé! 😊`,
        suggestions: ['Showroom 135 Nguyễn Thị Thập Q7', 'Showroom 78 Thái Hà Đống Đa', 'Hotline 0842.331.606']
    }
];

// -------------------------------------------------------------
// 2. MẸO VẶT CÔNG NGHỆ ĐỜI THƯỜNG (TECH TIPS & HARDWARE ADVICE)
// -------------------------------------------------------------

const TECH_TIP_RULES = [
    // 2.1 Sạc qua đêm có bị chai pin không?
    {
        id: 'charge_overnight',
        keywords: [
            'sac qua dem', 'sac pin qua dem', 'sac qua dem co chai pin khong', 'cam sac qua dem',
            'co nen sac qua dem', 'sac dien thoai qua dem', 'de sac qua dem', 'pin qua dem'
        ],
        reply: `Dạ câu này rất nhiều bạn băn khoăn nè! 🔋\n\n` +
            `Các dòng smartphone hiện đại (iPhone, Samsung Galaxy, Xiaomi...) đều được tích hợp vi mạch quản lý nguồn điện cực kỳ thông minh và tính năng **Sạc pin tối ưu (Optimized Battery Charging)**. Khi sạc đến 80%, máy sẽ tự động hạ dòng điện nhỏ giọt và căn giờ sạc đầy 100% đúng lúc bạn thức dậy, nên việc cắm sạc qua đêm **hoàn toàn an toàn và không gây nổ hay chai pin nhanh** đâu ạ.\n\n` +
            `💡 **Mẹo vàng từ em để pin bền 4-5 năm:**\n` +
            `1. Dùng củ cáp sạc chính hãng đạt chuẩn an toàn (như Anker, Apple, Samsung).\n` +
            `2. Không để máy dưới gối hoặc nơi kín nhiệt khi sạc.\n` +
            `3. Tránh vừa sạc nhanh vừa cày game nặng vì nhiệt độ cao mới là 'kẻ thù' lớn nhất của pin bạn nhé! 😊`,
        suggestions: ['Xem củ sạc nhanh Anker chính hãng', 'Pin sạc dự phòng', 'Điện thoại pin trâu']
    },

    // 2.2 Dán cường lực hay dán PPF?
    {
        id: 'tempered_glass_vs_ppf',
        patterns: [
            /(cuong luc|ppf).*hay.*(ppf|cuong luc)/i,
            /dan.*(cuong luc|ppf)/i
        ],
        keywords: [
            'nen dan cuong luc hay ppf', 'dan ppf hay cuong luc', 'dan cuong luc hay ppf tot hon',
            'dan man hinh loai nao tot', 'dan ppf co chong vo khong', 'so sanh cuong luc va ppf',
            'dan cuong luc', 'dan ppf', 'kinh cuong luc', 'dan man hinh', 'dan man'
        ],
        reply: `Dạ em xin phân tích ưu - nhược điểm thực tế để bạn chọn theo đúng thói quen dùng máy nha:\n\n` +
            `• 🛡️ **Kính cường lực (Khuyên dùng cho MÀN HÌNH):** Khả năng chống va đập và rơi rớt xuất sắc nhất. Nếu lỡ làm rơi máy, miếng kính sẽ chịu lực vỡ thay cho màn hình gốc của máy (tiết kiệm tiền triệu thay màn). Nhược điểm là viền mép hơi dày nhẹ.\n` +
            `• ✨ **Miếng dán PPF (Thích hợp dán LƯNG & VIỀN MÁY):** Siêu mỏng nhẹ, giữ nguyên độ sexy và cảm giác cầm nắm gốc của máy, có khả năng tự phục hồi vết xước dăm nhẹ khi gặp nhiệt. Tuy nhiên PPF **không chống được lực rơi đập vỡ màn hình**.\n\n` +
            `👉 **Lời khuyên chuẩn bài của em:** Màn hình mặt trước bạn nên dán **Kính cường lực**, còn mặt lưng và viền bạn có thể dán **PPF** kết hợp ốp lưng mỏng là máy vừa đẹp vừa được bảo vệ 360 độ hoàn hảo luôn ạ! 😊`,
        suggestions: ['Xem phụ kiện ốp lưng & cường lực', 'Tư vấn phụ kiện bảo vệ', 'Mã giảm giá hôm nay']
    },

    // 2.3 Laptop chơi game bị nóng và quạt quay to
    {
        id: 'laptop_heating_fan',
        keywords: [
            'laptop bi nong', 'may nong khi choi game', 'quat laptop keu to', 'quat quay vu vu',
            'laptop nong co sao khong', 'nhiet do laptop bao nhieu la cao', 'tai sao laptop nong'
        ],
        reply: `Dạ bạn đừng quá lo lắng nha! ❄️\n\n` +
            `Khi chơi game nặng (như Genshin Impact, Valorant, GTA V) hoặc render đồ họa 3D, chip CPU và card đồ họa GPU hoạt động ở mức công suất cao (80W - 140W+), sinh nhiệt lượng lớn. Hệ thống tản nhiệt sẽ tự động kích hoạt quạt quay ở tốc độ tối đa (4.000 - 6.000 vòng/phút) để giải nhiệt cấp tốc ra ngoài — đây là **cơ chế bảo vệ hoàn toàn bình thường** của laptop gaming.\n\n` +
            `💡 **Mẹo giúp máy mát hơn 5 - 10 độ C tức thì:**\n` +
            `• Kê cao phần đuôi đáy máy lên 2-3cm hoặc dùng đế tản nhiệt để khe hút gió thông thoáng.\n` +
            `• Tuyệt đối không đặt laptop lên nệm, chăn hay để trên đùi khi chơi game (bít hoàn toàn đường thở của quạt).\n` +
            `• Định kỳ 6 - 12 tháng nên vệ sinh bụi quạt và tra keo tản nhiệt một lần nhé!`,
        suggestions: ['Xem Laptop Gaming ASUS ROG', 'Xem Laptop Acer Nitro V', 'Tư vấn phụ kiện tản nhiệt']
    },

    // 2.4 Cách chụp màn hình MacBook & Windows
    {
        id: 'screenshot_shortcut',
        keywords: [
            'chup man hinh macbook', 'cach chup man hinh may tinh', 'chup man hinh laptop',
            'phim tat chup man hinh', 'chup man hinh win', 'chup man hinh windows', 'screenshot mac'
        ],
        reply: `Dạ em gửi bạn các tổ hợp phím 'thần thánh' để chụp màn hình siêu nhanh trên máy tính nè: 📸\n\n` +
            `🍎 **Trên MacBook (macOS):**\n` +
            `• \`Cmd + Shift + 4\`: Con trỏ biến thành dấu cộng, kéo chuột chọn vùng cần chụp (ảnh tự lưu ngay ngoài Desktop).\n` +
            `• \`Cmd + Shift + 3\`: Chụp toàn bộ màn hình.\n` +
            `• \`Cmd + Shift + 5\`: Mở thanh công cụ chụp và quay video màn hình chuyên nghiệp.\n\n` +
            `🪟 **Trên Laptop Windows (Dell, Asus, HP, Lenovo...):**\n` +
            `• \`Windows + Shift + S\`: Mở Snipping Tool để kéo chụp vùng bất kỳ và dán ngay bằng \`Ctrl + V\`.\n` +
            `• \`Windows + PrtScn\` (hoặc Print Screen): Chụp toàn màn hình và tự động lưu vào thư mục *Pictures > Screenshots*.\n\n` +
            `👉 Bạn thử thao tác xem được chưa nhé, có vướng chỗ nào cứ bảo em hướng dẫn thêm nha! 😊`,
        suggestions: ['Tư vấn MacBook Air M3', 'Tư vấn Laptop mỏng nhẹ', 'Mã giảm giá hôm nay']
    },

    // 2.5 Vừa sạc vừa dùng điện thoại có nguy hiểm không?
    {
        id: 'use_phone_while_charging',
        keywords: [
            'vua sac vua dung', 'vua sac vua choi game', 'vua sac vua xem phim',
            'vua sac vua xai', 'vua sac vua dung co sao khong', 'vua sac vua dung co no khong'
        ],
        reply: `Dạ đây là thói quen mà khá nhiều bạn mắc phải nè! ⚡\n\n` +
            `• **Về mặt kỹ thuật:** Nếu chỉ lướt web, đọc báo hoặc nghe nhạc nhẹ nhàng thì không ảnh hưởng nhiều.\n` +
            `• **NHƯNG NGUY HIỂM KHI:** Vừa sạc nhanh vừa cày game đồ họa nặng hoặc xem video độ sáng tối đa. Lúc này pin vừa nạp vừa xả ở công suất cao, cộng thêm nhiệt lượng tỏa ra từ chip sẽ làm máy nóng ran, khiến **pin chai cực nhanh và dễ gây phồng pin**.\n` +
            `• **Đặc biệt cảnh báo:** Tuyệt đối không dùng củ cáp sạc giá rẻ trôi nổi không rõ nguồn gốc vì nguy cơ rò rỉ điện hoặc cháy nổ rất cao!\n\n` +
            `💡 **Lời khuyên của em:** Bạn hãy để máy nghỉ ngơi 30 - 45 phút sạc nhanh là đầy pin rồi chơi tiếp cho an toàn và thoải mái nhất nha! 😊`,
        suggestions: ['Xem củ sạc nhanh Anker chính hãng', 'Tư vấn phụ kiện an toàn']
    }
];

// -------------------------------------------------------------
// 3. ĐỐI ĐÁP NGẪU HỨNG ĐỜI THƯỜNG (CHIT-CHAT, HUMOR, EMPATHY)
// -------------------------------------------------------------

const CHIT_CHAT_RULES = [
    // 3.1 Khách hỏi thăm ăn uống / sức khỏe
    {
        id: 'eating_and_health',
        keywords: [
            'an com chua', 'an com chua em', 'an gi chua', 'an toi chua', 'an trua chua',
            'nay khoe khong', 'khoe khong em', 'uong nuoc chua', 'an sang chua', 'an uong gi chua'
        ],
        reply: `Dạ em được nạp đầy 100% pin và 'chạy bằng điện' mượt mà suốt 24/7 rồi nè! ⚡ 😄\n\n` +
            `Cảm ơn bạn đã hỏi thăm ân cần, nghe ấm lòng ghê luôn á! Còn bạn đã dùng bữa chưa nè? Nhớ ăn uống đầy đủ giữ gìn sức khỏe nha. Hôm nay bạn ghé TechEcommerce ngắm nghía món đồ công nghệ nào để tự thưởng cho bản thân sau giờ làm việc không, em tư vấn nhiệt tình cho bạn nhé! 😊`,
        suggestions: ['Xem sản phẩm bán chạy', 'Săn mã giảm giá', 'Tư vấn Điện thoại', 'Tư vấn Laptop']
    },

    // 3.2 Khách than vãn mệt mỏi / áp lực công việc / stress
    {
        id: 'tired_and_stress',
        patterns: [
            /(met|ap luc|stress|buon|chan|nan).*(qua|ghe|lam|kinh)/i,
            /(di lam|cong viec).*(met|ap luc|stress)/i
        ],
        keywords: [
            'hom nay met qua', 'di lam met qua', 'ap luc qua', 'stress qua', 'chan qua em oi',
            'buon qua', 'met moi qua', 'ap luc cong viec', 'nan qua', 'chan doi'
        ],
        reply: `Dạ thương bạn nhiều nha! 🥺 Đi làm cả ngày đối mặt với deadline và áp lực công việc thật sự không dễ dàng chút nào.\n\n` +
            `Tối nay về bạn nhớ tắm nước ấm, thưởng cho mình một bữa ăn thật ngon miệng, bật bài nhạc yêu thích và nghỉ ngơi sớm để sạc lại năng lượng nhé! Khi nào rảnh rỗi ghé em lướt ngắm đồ công nghệ giải trí cùng em cho khuây khỏa nha, em luôn ở đây lắng nghe và sẵn sàng chia sẻ cùng bạn nè! 🍀`,
        suggestions: ['Tai nghe chống ồn nghe nhạc', 'Máy chơi game giải trí', 'Tư vấn phụ kiện thư giãn']
    },

    // 3.3 Kể chuyện cười / Đố vui xả stress
    {
        id: 'tell_a_joke',
        patterns: [
            /(ke|co).*(chuyen|truyen).*(cuoi|hai|vui)/i,
            /do vui/i
        ],
        keywords: [
            'ke chuyen cuoi', 'ke chuyen hai', 'chuyen cuoi', 'ke mot cau chuyen cuoi',
            'co gi vui khong', 'ke chuyen vui', 'do vui', 'ke truyen cuoi', 'chuyen vui'
        ],
        reply: `Dạ em có mẩu chuyện công nghệ 'cười ra nước mắt' tặng bạn xả stress nè: 😄\n\n` +
            `*Một hôm, anh lập trình viên đi làm về, cô vợ bảo: 'Anh đi siêu thị mua cho em 1 ổ bánh mì, nếu thấy có trứng thì mua 10 nhé!'.*\n` +
            `*Một lúc sau anh hí hửng xách về... đúng 10 ổ bánh mì!*\n` +
            `*Cô vợ tròn mắt hét lên: 'Trời ơi sao anh mua tới 10 ổ bánh mì dữ vậy?!'*\n` +
            `*Anh ngơ ngác trả lời: 'Thì tại vì anh thấy ở siêu thị CÓ BÁN TRỨNG mà!'* 🤣\n\n` +
            `👉 Hy vọng mẩu chuyện nhỏ giúp bạn bật cười một cái thật thoải mái nha! Hôm nay bạn có muốn ngắm nghía thiết bị công nghệ nào để nâng cấp góc làm việc không nè?`,
        suggestions: ['Bàn phím cơ gõ sướng tay', 'Chuột công thái học chống mỏi', 'Mã giảm giá hôm nay']
    },

    // 3.4 Khách hỏi thời tiết / ngày mưa gió
    {
        id: 'weather_rain',
        patterns: [
            /(troi|thoi tiet).*(mua|nang|lanh|bao)/i,
            /mua\s+(to|lon|tam ta|gio|nhieu)/i,
            /(mua|gio).*(ship|giao)/i
        ],
        keywords: [
            'troi mua to qua', 'mua to co ship khong', 'troi mua', 'mua gio the nay',
            'thoi tiet hom nay', 'troi nang qua', 'troi lanh qua', 'thoi tiet the nao'
        ],
        reply: `Dạ thời tiết thế này bạn nhớ chú ý đi lại cẩn thận, mặc áo ấm/áo mưa và nhớ bảo vệ balo máy tính/điện thoại cẩn thận kẻo ngấm nước nha! 🌧️\n\n` +
            `Riêng các đơn hàng tại TechEcommerce thì bạn hoàn toàn yên tâm: Shipper luôn bọc gói hàng bằng **túi zip chống nước 100% chuyên dụng** và hộp carton cứng cáp, dù mưa to bão bùng cỡ nào hàng tới tay bạn vẫn khô ráo, nguyên seal vẹn nguyên nhé! Bạn đang cần giao hỏa tốc mẫu nào không ạ?`,
        suggestions: ['Giao hàng hỏa tốc 2 giờ', 'Chính sách bảo hành', 'Tư vấn sản phẩm mới']
    },

    // 3.5 Khách hỏi đời tư / Người yêu / Tuổi tác của AI
    {
        id: 'ai_personal_life',
        patterns: [
            /(em|ban).*(may|bao nhieu).*(tuoi)/i,
            /(em|ban).*(co|chua).*(nguoi yeu)/i,
            /(em|ban).*(ten|la).*(gi|trai|gai)/i
        ],
        keywords: [
            'em may tuoi', 'em co nguoi yeu chua', 'em la trai hay gai', 'ban co nguoi yeu chua',
            'em ten gi', 'ai tao ra em', 'em song o dau', 'em sinh nam bao nhieu', 'nguoi yeu em la ai'
        ],
        reply: `Dạ 'người yêu' lý tưởng của em chính là dàn siêu phẩm iPhone titan, laptop gaming và tai nghe chống ồn trong kho TechEcommerce đó bạn ơi! 🥰\n\n` +
            `Suốt ngày đắm đuối với chip vi xử lý, camera và săn voucher giảm giá cho khách nên em vẫn 'độc thân vui vẻ' 100% nè! Em là thế hệ Trợ lý AI công nghệ trẻ tuổi, tính tình thân thiện, hóm hỉnh và tận tâm. Bạn cần tìm hiểu món đồ công nghệ nào thì cứ hỏi em, em tư vấn từ A đến Z luôn nha! 😄`,
        suggestions: ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Máy chơi game', 'Mã giảm giá hôm nay']
    },

    // 3.6 Khách hỏi "Em là robot à?" / "Em là người thật hay máy?"
    {
        id: 'is_ai_or_human',
        patterns: [
            /\b(robot|co phai robot|la robot|nguoi that hay robot|nguoi that hay may|ai hay nguoi that)\b/i
        ],
        keywords: [
            'em la robot a', 'em la nguoi that hay may', 'em co phai nguoi that khong',
            'ai dang tra loi day', 'ban la robot hay nguoi', 'co phai ai khong', 'chat voi nguoi that',
            'phai robot khong', 'em la bot a', 'em la bot ha', 'em la ai'
        ],
        reply: `Dạ em là **Trợ lý AI Mua sắm của TechEcommerce**! 🤖✨\n\n` +
            `Tuy em vận hành bằng trí tuệ nhân tạo và thuật toán công nghệ, nhưng sự tận tâm, thấu hiểu và mong muốn giúp bạn chọn được chiếc máy ưng ý nhất là **thật 100% từ trái tim** luôn đó ạ!\n\n` +
            `👉 Nếu bạn có thắc mắc kỹ thuật phức tạp hoặc muốn trao đổi trực tiếp với nhân viên trực showroom, bạn có thể gọi hotline **0842.331.606** hoặc nhắn qua Zalo shop nha!`,
        suggestions: ['Hotline 0842.331.606', 'Địa chỉ Showroom', 'Tư vấn mua sắm']
    },

    // 3.7 Khách hỏi gợi ý món ăn / ngẫu hứng đời sống
    {
        id: 'food_and_drink',
        keywords: [
            'hom nay an gi', 'trua nay an gi', 'toi nay an gi', 'goi y mon an', 'an gi ngon',
            'ca phe hay tra sua', 'uong gi bay gio', 'uong ca phe khong'
        ],
        reply: `Dạ câu hỏi 'kinh điển' của nhân loại đây rồi! 🍱 Để em gợi ý thực đơn chuẩn bài cho bạn nha:\n\n` +
            `• **Bữa trưa/tối:** Cơm tấm sườn bì chả ốp la, bún chả Hà Nội thơm lừng, hoặc một bát phở bò tái lăn nóng hổi.\n` +
            `• **Đồ uống:** Sáng làm ly cà phê muối hoặc Americano cho tỉnh táo cày việc; chiều làm ly trà sữa full topping để nạp năng lượng yêu đời! ☕🧋\n\n` +
            `👉 Ăn uống no nê xong ghé em 'tráng miệng' bằng một deal công nghệ giảm giá hời là ngày hôm nay trọn vẹn 10 điểm luôn á! 😄`,
        suggestions: ['Xem ưu đãi hôm nay', 'Tư vấn phụ kiện', 'Tư vấn tai nghe chill']
    },

    // 3.8 Khách than hết tiền / Lương ít
    {
        id: 'no_money_poor',
        keywords: [
            'het tien roi', 'khong co tien', 'luong it qua', 'ngheo qua', 'khong du tien mua',
            'dat the ai mua noi', 'khong co tien dau'
        ],
        reply: `Dạ em thấu hiểu lắm nè! Tài chính là chuyện quan trọng mà, bạn cứ từ từ tích lũy nha, không việc gì phải vội đâu ạ. 🍀\n\n` +
            `Khi nào bạn có nhu cầu sắm máy, TechEcommerce luôn có sẵn:\n` +
            `• Các dòng máy phân khúc **'học sinh sinh viên' ngon - bổ - rẻ** chỉ từ vài triệu đồng nhưng cấu hình rất bền bỉ.\n` +
            `• Chương trình **Trả góp 0% trả trước 0 đồng** chia nhỏ mỗi tháng chỉ vài trăm nghìn cực kỳ nhẹ ví.\n\n` +
            `Cứ ghé em tham khảo cấu hình và ngắm nghía trước cho vui nha, khi nào sẵn sàng thì rinh máy sau cũng được nè! 😊`,
        suggestions: ['Laptop giá rẻ dưới 10 triệu', 'Điện thoại giá rẻ dưới 5 triệu', 'Tư vấn trả góp 0%']
    }
];

// -------------------------------------------------------------
// BỘ ĐIỀU PHỐI TÌM KIẾM CÂU TRẢ LỜI THÔNG MINH (MATCH SMART ANSWER)
// -------------------------------------------------------------

function matchSmartAnswer(message) {
    if (!message || typeof message !== 'string') return null;
    const cleanMsg = message.trim();
    if (!cleanMsg) return null;

    const norm = normalizeText(cleanMsg);
    const unaccented = norm.unaccented;

    function ruleMatches(rule) {
        if (Array.isArray(rule.patterns) && rule.patterns.some(p => p.test(cleanMsg) || p.test(unaccented))) {
            return true;
        }
        if (Array.isArray(rule.keywords) && rule.keywords.some(k => hasWordOrPhrase(cleanMsg, k))) {
            return true;
        }
        return false;
    }

    // 1. Kiểm tra chính sách cửa hàng
    for (const rule of STORE_POLICY_RULES) {
        if (ruleMatches(rule)) {
            return {
                reply: rule.reply,
                suggestions: rule.suggestions,
                context: { stage: 'store_policy', currentIntent: rule.id },
                intent: rule.id,
                group: 'store_policy'
            };
        }
    }

    // 2. Kiểm tra mẹo vặt công nghệ
    for (const rule of TECH_TIP_RULES) {
        if (ruleMatches(rule)) {
            return {
                reply: rule.reply,
                suggestions: rule.suggestions,
                context: { stage: 'tech_tip', currentIntent: rule.id },
                intent: rule.id,
                group: 'tech_tip'
            };
        }
    }

    // 3. Kiểm tra đối đáp ngẫu hứng đời thường
    for (const rule of CHIT_CHAT_RULES) {
        if (ruleMatches(rule)) {
            return {
                reply: rule.reply,
                suggestions: rule.suggestions,
                context: { stage: 'chit_chat', currentIntent: rule.id },
                intent: rule.id,
                group: 'chit_chat'
            };
        }
    }

    return null;
}

module.exports = {
    matchSmartAnswer,
    STORE_POLICY_RULES,
    TECH_TIP_RULES,
    CHIT_CHAT_RULES
};
