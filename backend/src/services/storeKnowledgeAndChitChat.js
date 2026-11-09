/**
 * Store Knowledge & Human-like Chit-Chat Engine
 * TechEcommerce - AI Shopping Assistant
 * 
 * Quản lý tri thức chính sách cửa hàng, xử lý từ chối, giải đáp phần cứng/phần mềm,
 * so sánh nền tảng, phong thủy công nghệ và đối đáp tự nhiên, hóm hỉnh như con người.
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
            `👉 Bạn muốn giữ mẫu máy nào và dự kiến ghé Showroom ở **135 Nguyễn Thị Thập (Quận 7, TP.HCM)** hay **78 Thái Hà (Đống Đa, Hà Nội)** để em báo nhân viên chuẩn bị sẵn đón bạn nhé! 😊`,
        suggestions: ['Showroom 135 Nguyễn Thị Thập Q7', 'Showroom 78 Thái Hà Đống Đa', 'Hotline 0842.331.606']
    },

    // 1.9 Chính sách Đổi trả 1 đổi 1 trong 30 ngày
    {
        id: 'return_exchange_policy',
        patterns: [
            /(doi tra|tra hang|1 doi 1).*(trong bao lau|the nao|bao nhieu ngay|quy dinh|chinh sach)/i,
            /(may loi|bi loi).*(co duoc doi|doi may moi|doi tra)/i
        ],
        keywords: [
            'chinh sach doi tra', 'doi tra trong bao lau', '1 doi 1 trong bao lau', 'may loi co duoc doi khong',
            'doi tra 30 ngay', 'quy dinh doi tra', 'doi may moi neu loi', 'doi tra hang', 'tra hang hoan tien'
        ],
        reply: `Dạ TechEcommerce áp dụng chính sách **1 ĐỔI 1 TRONG 30 NGÀY ĐẦU TIÊN** cực kỳ an tâm cho khách hàng luôn ạ! 🔄\n\n` +
            `• ⏱️ **30 ngày đầu bao test:** Nếu máy phát sinh lỗi phần cứng từ nhà sản xuất, bạn được đổi ngay một **thân máy mới nguyên seal 100% cùng model** hoàn toàn miễn phí.\n` +
            `• 📦 **Điều kiện đơn giản:** Máy còn giữ nguyên hộp, phụ kiện đi kèm và không bị cấn móp, biến dạng do tác động ngoại lực.\n` +
            `• 🛠️ **Sau 30 ngày:** Máy được bảo hành chính hãng theo đúng tiêu chuẩn 12 – 24 tháng của Apple Care, Samsung Service, Asus, Dell... trên toàn quốc.\n\n` +
            `👉 Nếu cần hỗ trợ kỹ thuật hoặc kiểm tra bảo hành, bạn cứ nhắn em hoặc gọi hotline kỹ thuật **0842.331.606** nhé! 😊`,
        suggestions: ['Chính sách bảo hành vàng', 'Địa chỉ Showroom', 'Hotline 0842.331.606']
    },

    // 1.10 Chính sách Giao hàng & Đồng kiểm khi nhận hàng
    {
        id: 'shipping_and_cod',
        patterns: [
            /(giao hang|ship).*(bao lau|may ngay|co lau khong|phi ship|tinh phi)/i,
            /(co duoc|cho).*(kiem tra hang|dong kiem|mo hop).*(khi nhan|truoc khi thanh toan)/i
        ],
        keywords: [
            'giao hang bao lau thi toi', 'co duoc kiem tra hang khong', 'ship bao lau', 'phi ship bao nhieu',
            'ship cod khong', 'giao hoa toc', 'kiem tra truoc khi thanh toan', 'dong kiem khi nhan hang', 'ship toan quoc khong'
        ],
        reply: `Dạ thời gian giao hàng và chính sách kiểm hàng tại TechEcommerce rất nhanh chóng và minh bạch ạ! 🚚📦\n\n` +
            `• ⚡ **Giao siêu tốc 2 giờ:** Áp dụng cho đơn hàng nội thành TP.HCM (Quận 7, Q1, Q3, Bình Thạnh...) và Hà Nội (Đống Đa, Cầu Giấy, Hoàn Kiếm...).\n` +
            `• 🚛 **Giao toàn quốc:** Từ 1 – 3 ngày làm việc qua đối tác vận chuyển hỏa tốc chuyên nghiệp (GHTK, Viettel Post).\n` +
            `• 🆓 **Miễn phí vận chuyển:** Cho tất cả đơn hàng công nghệ có giá trị từ **500.000 đ** trở lên.\n` +
            `• 🔍 **ĐẶC QUYỀN ĐỒNG KIỂM 100%:** Bạn được quyền **Mở hộp kiểm tra ngoại quan máy, phụ kiện, tem niêm phong và cắm sạc lên nguồn** trước khi thanh toán tiền cho shipper. Nếu hàng không đúng mô tả, bạn có quyền từ chối nhận mà không mất bất kỳ chi phí nào!`,
        suggestions: ['Giao hàng hỏa tốc 2 giờ', 'Chính sách đổi trả 30 ngày', 'Hotline 0842.331.606']
    },

    // 1.11 Phương thức Thanh toán
    {
        id: 'payment_methods',
        patterns: [
            /(hinh thuc|phuong thuc).*(thanh toan)/i,
            /(co the|co duoc).*(quet the|chuyen khoan|tra tien mat|quet qr)/i
        ],
        keywords: [
            'hinh thuc thanh toan', 'phuong thuc thanh toan', 'co nhung cach thanh toan nao', 'quet the co mat phi khong',
            'thanh toan bang gi', 'tra bang the visa duoc khong', 'thanh toan vnpay momo', 'thanh toan cod'
        ],
        reply: `Dạ em xin gửi bạn các hình thức thanh toán linh hoạt, tiện lợi và an toàn tuyệt đối tại TechEcommerce ạ: 💳✨\n\n` +
            `1. 💵 **Thanh toán tiền mặt khi nhận hàng (COD):** Áp dụng toàn quốc sau khi bạn đã đồng kiểm hàng ưng ý.\n` +
            `2. 📱 **Quét mã QR / Chuyển khoản ngân hàng 24/7:** Quét mã VietQR tự động xác nhận đơn tức thì trong 3 giây.\n` +
            `3. 💳 **Quẹt thẻ tại Showroom hoặc tại nhà:** Chấp nhận thẻ ATM nội địa Napas, Visa, Mastercard, JCB... **HOÀN TOÀN MIỄN PHÍ CÀ THẺ** (shop chịu 100% phí cà thẻ cho bạn).\n` +
            `4. 🎁 **Ví điện tử & Cổng VNPAY-QR / MoMo:** Thường xuyên có chương trình nhập mã giảm thêm trực tiếp **300.000đ – 500.000đ** vào hóa đơn.\n` +
            `5. 📄 **Trả góp:** Hỗ trợ Trả góp 0% qua thẻ tín dụng và Trả góp qua CCCD gắn chip xét duyệt 15 phút.\n\n` +
            `👉 Bạn dự kiến thanh toán bằng hình thức nào để em hướng dẫn nhận ưu đãi tốt nhất nhé! 😊`,
        suggestions: ['Tư vấn Trả góp 0%', 'Săn mã giảm giá VNPAY', 'Hotline 0842.331.606']
    }
];

// -------------------------------------------------------------
// 2. XỬ LÝ TỪ CHỐI & LƯỠNG LỰ (OBJECTION HANDLING)
// -------------------------------------------------------------

const OBJECTION_RULES = [
    // 2.1 Khách lưỡng lự: "Để suy nghĩ thêm", "Chưa mua đâu", "Để hỏi ý kiến"
    {
        id: 'objection_think_about_it',
        patterns: [
            /(de|cho).*(suy nghi|can nhac|xem lai|tinh lai|hoi vo|hoi chong|hoi ban|hoi y kien)/i,
            /chua mua (dau|ngay|voi)/i,
            /chi xem (thoi|tham khao)/i
        ],
        keywords: [
            'de minh suy nghi them', 'de suy nghi them', 'de anh suy nghi them', 'de chi suy nghi them',
            'de em suy nghi da', 'de can nhac them', 'chua mua dau', 'de xem lai da', 'de hoi vo da',
            'de hoi y kien', 'xem thoi chu chua mua', 'de coi lai', 'de suy nghi da', 'de xem sau nha'
        ],
        reply: `Dạ em hoàn toàn hiểu ạ! Sắm một món đồ công nghệ giá trị cao thì việc cân nhắc kỹ lưỡng và hỏi thêm ý kiến người thân là điều vô cùng đúng đắn luôn bạn nhé. Bạn cứ thong thả suy nghĩ và tham khảo thêm nha, không việc gì phải vội đâu ạ! 🍀\n\n` +
            `Em xin phép **Lưu lại thông tin tư vấn** và ưu đãi ngày hôm nay (voucher giảm giá + combo quà tặng) trên hệ thống cho bạn. Khi nào bạn sẵn sàng rinh máy, chỉ cần nhắn lại cho em hoặc ghé TechEcommerce là được áp dụng ngay mức giá ưu đãi nhất nhé!\n\n` +
            `Chúc bạn một ngày thật nhiều niềm vui và chọn được chiếc máy ưng ý nhất nha! 😊`,
        suggestions: ['Lưu tóm tắt tư vấn', 'Xem lại mã giảm giá hôm nay', 'Địa chỉ Showroom trải nghiệm', 'Hotline 0842.331.606']
    },

    // 2.2 So sánh giá với đối thủ / Thắc mắc đắt hơn chỗ khác
    {
        id: 'objection_competitor_price',
        patterns: [
            /(sao|vi sao|tai sao).*(dat hon|re hon|chenh).*(fpt|the gioi di dong|tgdd|hoang ha|cellphone|cho khac|ben khac)/i,
            /(fpt|the gioi di dong|tgdd|hoang ha|cellphone|cho khac|ben khac).*(ban re hon|re hon|gia re hon)/i
        ],
        keywords: [
            'ben hoang ha ban re hon', 'ben cellphones ban re hon', 'ben fpt ban re hon', 'ben the gioi di dong ban re hon',
            'sao ben em dat hon the gioi di dong', 'sao ben em dat hon fpt', 'sao ben em dat hon hoang ha', 'sao ben kia re hon',
            'sao gia chenh the', 'sao ben em dat the', 'sao gia cao the', 'ben kia ban re hon'
        ],
        reply: `Dạ em rất cảm ơn bạn đã so sánh và góp ý thẳng thắn ạ! Giá niêm yết tại các hệ thống bán lẻ đôi lúc có sự chênh lệch nhẹ do chính sách quà tặng và gói dịch vụ hậu mãi đi kèm. Em xin chia sẻ 5 quyền lợi vượt trội chỉ có tại TechEcommerce để bạn dễ cân nhắc nha:\n\n` +
            `1. 📄 **Giá đã bao gồm 100% thuế VAT:** Nhiều nơi để giá chưa VAT, khi xuất hóa đơn công ty sẽ bị tính phụ thu thêm 8% - 10%.\n` +
            `2. 🏆 **Hàng chính hãng mới nguyên seal 100%:** Cam kết xuất xứ phân phối chính thức tại VN (mã VN/A cho Apple), bảo hành tại tất cả TTBH ủy quyền toàn quốc. Phát hiện hàng xách tay/đã active đền tiền 200%.\n` +
            `3. 🔄 **Đặc quyền 1 ĐỔI 1 TRONG 30 NGÀY:** Thời gian bao test lỗi nhà sản xuất dài gấp đôi so với chuẩn 15 ngày thông thường.\n` +
            `4. 🎁 **Ưu đãi thanh toán độc quyền:** Giảm thêm 300.000đ – 500.000đ khi quét VNPAY-QR hoặc MoMo + Miễn phí vệ sinh dán máy trọn đời.\n` +
            `5. 🤝 **Hỗ trợ cân đối giá:** Nếu bên bạn thấy là hàng chính hãng mới 100% cùng phiên bản, bạn cứ gửi link cho em, TechEcommerce luôn có chính sách trợ giá tốt nhất để bạn không bị thiệt thòi nhé! 😊`,
        suggestions: ['Chính sách 1 đổi 1 trong 30 ngày', 'Săn voucher VNPAY giảm 500k', 'Tư vấn sản phẩm mới', 'Hotline 0842.331.606']
    },

    // 2.3 Khách chê đắt chung chung
    {
        id: 'objection_too_expensive',
        patterns: [
            /^(gia )?(dat|chat|cao) (qua|the|kinh|vai)[!.,? ]*$/i,
            /(dat|gia cao|gia chat) (qua|the|kinh) (em|shop|ad)?[!.,? ]*$/i
        ],
        keywords: [
            'dat qua em oi', 'sao dat the', 'gia chat qua', 'gia cao qua', 'gia hoi cao',
            'hoi mac', 'dat qua nhi', 'mac qua vay', 'gia dat qua'
        ],
        reply: `Dạ em rất thấu hiểu băn khoăn về ngân sách của bạn nè! Đồ công nghệ cao cấp thì mức giá ban đầu nghe qua có vẻ hơi cao, nhưng bù lại máy mang lại độ mượt mà, màn hình đẹp và độ bền vượt trội suốt 4 - 5 năm tới, tính ra mỗi ngày chỉ mười mấy nghìn đồng thôi ạ. 🍀\n\n` +
            `💡 **TechEcommerce có nhiều giải pháp giúp bạn nhẹ ví hơn:**\n` +
            `• Gói **Trả góp 0% lãi suất** chia nhỏ thanh toán mỗi tháng chỉ từ vài trăm nghìn đồng.\n` +
            `• Chương trình **Thu cũ đổi mới trợ giá thêm đến 2.000.000 đ** từ máy cũ của bạn.\n` +
            `• Hoặc em có thể tư vấn các mẫu đời trước hoặc phân khúc lân cận cấu hình tương đương với mức giá mềm hơn 20% - 30% nè!\n\n` +
            `👉 Bạn có muốn em tìm mẫu máy cấu hình ngon mà giá mềm hơn trong tầm này cho bạn không ạ? 😊`,
        suggestions: ['Xem dòng máy giá mềm hơn', 'Tư vấn Trả góp 0%', 'Thu cũ đổi mới trợ giá 2tr', 'Mã giảm giá hôm nay']
    }
];

// -------------------------------------------------------------
// 3. CHI TIẾT PHẦN CỨNG, MỞ RỘNG & PHẦN MỀM / GAME
// -------------------------------------------------------------

const HARDWARE_AND_SOFTWARE_RULES = [
    // 3.1 Phụ kiện trong hộp / Hộp có củ sạc không
    {
        id: 'hardware_in_the_box',
        patterns: [
            /(trong hop|hop may|hop iphone|hop dien thoai).*(co cu sac|co sac|tang sac|tang cu sac|kem sac|kem cu sac|gom nhung gi|co gi)/i,
            /(co|tang).*(kem|theo).*(cu sac|coc sac)/i
        ],
        keywords: [
            'trong hop co cu sac khong', 'hop co cu sac khong', 'hop co sac khong', 'co tang kem cu sac khong',
            'trong hop gom nhung gi', 'phu kien trong hop co gi', 'hop iphone 16 co cu sac khong', 'hop iphone co sac khong',
            'hop may co gi', 'co tang cu sac khong'
        ],
        reply: `Dạ em xin chia sẻ chi tiết theo quy chuẩn đóng gói chính thức từ hãng nhé! 📦\n\n` +
            `• 📱 **Đối với iPhone (từ iPhone 12 đến iPhone 16 series) và Samsung Galaxy cao cấp (S21 đến S25 series):** Hãng đã cắt giảm củ sạc theo chính sách bảo vệ môi trường toàn cầu. Trong hộp **CHỈ CÓ: Thân máy mới nguyên seal + Cáp sạc C-to-C + Cây lấy SIM và Sách hướng dẫn** (KHÔNG có củ sạc và tai nghe).\n` +
            `• 💻 **Đối với Laptop & Máy chơi game:** Luôn đi kèm đầy đủ bộ củ cáp nguồn sạc zin theo máy.\n\n` +
            `💡 **Ưu đãi trợ giá phụ kiện tại TechEcommerce:** Khi mua kèm máy mới, bạn được mua **Củ sạc nhanh Anker GaN 30W / 65W chính hãng** giảm giá ngay 20% chỉ còn từ 250.000đ – 390.000đ (sạc siêu nhanh 30 phút đầy 50% pin và an toàn chống cháy nổ tuyệt đối). Bạn có muốn em thêm củ sạc vào đơn cho tiện không nè? 😊`,
        suggestions: ['Xem củ sạc nhanh Anker 30W', 'Xem củ sạc Anker 65W 3 cổng', 'Ốp lưng & Kính cường lực', 'Mã giảm giá hôm nay']
    },

    // 3.2 Khả năng nâng cấp RAM và SSD trên Laptop
    {
        id: 'hardware_laptop_upgrade',
        patterns: [
            /(laptop|may tinh|macbook).*(nang cap).*(ram|ssd|o cung)/i,
            /(nang cap).*(ram|ssd|o cung).*(duoc khong|the nao|khong)/i
        ],
        keywords: [
            'laptop nay co nang cap ram duoc khong', 'co nang cap ssd duoc khong', 'nang cap ram nhu the nao',
            'macbook co nang cap ram duoc khong', 'may co may khe ram', 'nang cap o cung duoc khong',
            'nang cap ram ssd', 'laptop co nang cap duoc khong'
        ],
        reply: `Dạ về khả năng nâng cấp linh kiện trên máy tính, em xin phân loại cụ thể như sau nha: 🛠️\n\n` +
            `• 🎮 **Laptop Gaming & Laptop văn phòng Windows (Asus TUF, Acer Nitro, Dell, HP, Lenovo...):** Đa số đều trang bị **2 khe RAM SO-DIMM tháo rời** (hỗ trợ nâng cấp lên 32GB hoặc 64GB) và **khe cắm SSD M.2 NVMe PCIe thứ 2** để bạn gắn thêm ổ cứng 1TB - 2TB lưu trữ game và dữ liệu cực kỳ dễ dàng.\n` +
            `• 🍏 **MacBook (Apple Silicon M1, M2, M3, M4):** RAM và SSD được hàn tích hợp trực tiếp vào vi xử lý (Unified Memory Architecture) nên **HOÀN TOÀN KHÔNG THỂ NÂNG CẤP VỀ SAU**. Lời khuyên vàng của em là bạn nên chọn phiên bản RAM 16GB hoặc 24GB ngay từ đầu để dùng thoải mái 5 - 6 năm nhé!\n` +
            `• 💻 **Ultrabook mỏng nhẹ:** Thường dùng RAM Onboard hàn chết, nhưng khe SSD vẫn có thể tháo nâng cấp dung lượng được.\n\n` +
            `👉 Tại Showroom TechEcommerce, kỹ thuật viên hỗ trợ nâng cấp RAM/SSD lấy ngay trong 20 phút và miễn phí công lắp đặt nhé!`,
        suggestions: ['Tư vấn MacBook RAM 16GB', 'Tư vấn Laptop Gaming dễ nâng cấp', 'Hotline kỹ thuật 0842.331.606']
    },

    // 3.3 SIM & Khả năng hỗ trợ eSIM
    {
        id: 'hardware_sim_esim',
        patterns: [
            /(may|dien thoai|iphone|samsung).*(may sim|may esim|2 sim|ho tro esim|dung esim)/i,
            /(co ho tro|dung duoc).*(esim|2 sim)/i
        ],
        keywords: [
            'may nay may sim', 'co dung duoc 2 sim khong', 'co ho tro esim khong', 'dung duoc may esim',
            'cai esim the nao', 'dien thoai 2 sim', 'iphone may sim', 'co esim khong', 'ho tro esim khong'
        ],
        reply: `Dạ em xin thông tin đến bạn: 100% các dòng smartphone và smartwatch chính hãng phân phối tại TechEcommerce đều hỗ trợ **2 SIM tiện lợi** bạn nhé! 📶\n\n` +
            `• 🍏 **iPhone chính hãng VN/A (từ iPhone XS/XR đến iPhone 16 series):** Hỗ trợ **1 SIM vật lý nano + 1 eSIM**, hoặc **2 eSIM hoạt động song song cùng lúc**. Máy có thể lưu danh bạ tới 8 eSIM khác nhau để bạn chuyển đổi khi đi du lịch nước ngoài.\n` +
            `• 🤖 **Samsung Galaxy & Android:** Hỗ trợ 2 SIM vật lý nano hoặc 1 SIM vật lý + 1 eSIM.\n` +
            `• ⌚ **Smartwatch (Apple Watch LTE, Galaxy Watch LTE):** Hỗ trợ eSIM độc lập (MultiSIM) dùng chung số thuê bao với điện thoại, giúp bạn chạy bộ nghe gọi mà không cần cầm điện thoại theo.\n\n` +
            `👉 Cài đặt eSIM cực kỳ đơn giản: Chỉ cần quét mã QR qua app nhà mạng (My Viettel, VNPT Vinaphone, My MobiFone) là kích hoạt được ngay trong 3 - 5 phút thôi ạ!`,
        suggestions: ['Tư vấn iPhone chính hãng VN/A', 'Tư vấn Samsung Galaxy 2 SIM', 'Apple Watch có LTE/eSIM']
    },

    // 3.4 Đồ họa & Dựng phim: AutoCAD, Premiere, Photoshop, Illustrator, Blender
    {
        id: 'software_graphics_cad_render',
        patterns: [
            /(chay|dung|lam|ve|render).*(autocad|photoshop|premiere|illustrator|blender|revit|sketchup|do hoa 3d|3ds max)/i,
            /(hoc thiet ke do hoa|lam do hoa).*(nen mua|dung may)/i
        ],
        keywords: [
            'chay muot autocad khong', 'co lam do hoa duoc khong', 'dung video premiere 4k co lag khong',
            'chay photoshop ngon khong', 've 3d blender duoc khong', 'hoc thiet ke do hoa nen mua may nao',
            'chay autocad', 'dung premiere', 'chay blender', 'render video 4k'
        ],
        reply: `Dạ để chạy mượt mà các tác vụ thiết kế đồ họa và dựng phim, em xin gợi ý tiêu chuẩn cấu hình thực tế nha: 🎨\n\n` +
            `• 🖼️ **Thiết kế 2D (Photoshop, Illustrator, Canva, Figma):** Cần tối thiểu **CPU Intel Core i5 / AMD Ryzen 5 / Apple M-series, RAM 16GB** và đặc biệt là **Màn hình chuẩn màu (100% sRGB hoặc Retina)** để in ấn thiết kế không bị lệch màu. (MacBook Air M2/M3 hoặc ASUS Zenbook cực kỳ xuất sắc).\n` +
            `• 🎬 **Dựng phim Video & 3D (Premiere Pro, After Effects, AutoCAD, Revit, Blender, SketchUp):** Bắt buộc cần **Card đồ họa rời NVIDIA GeForce RTX (RTX 3050 / 4050 / 4060 trở lên)** để tăng tốc CUDA Core khi render, kèm **RAM từ 16GB – 32GB** và quạt tản nhiệt kép để render nhiều giờ không bị tụt xung.\n\n` +
            `👉 Bạn đang chuyên về 2D hay render 3D để em chọn đúng dòng máy vừa vặn túi tiền nhất cho bạn nhé! 😊`,
        suggestions: ['Xem Laptop đồ họa ASUS ROG', 'Xem MacBook Air/Pro làm đồ họa', 'Tư vấn Laptop dưới 20 triệu']
    },

    // 3.5 Học Lập trình CNTT, Kỹ thuật phần mềm, Data Science
    {
        id: 'software_coding_developer',
        patterns: [
            /(hoc|lam|code).*(cntt|cong nghe thong tin|lap trinh|developer|phan mem|docker|android studio)/i,
            /(laptop|may tinh|macbook).*(cho lap trinh|hoc cntt|hoc code)/i
        ],
        keywords: [
            'hoc cntt mua may nao', 'laptop lap trinh', 'code web mua may nao', 'lap trinh vien nen dung may gi',
            'chay docker android studio', 'hoc cong nghe thong tin nen mua laptop nao', 'laptop cho sinh vien it',
            'macbook cho lap trinh', 'laptop cho lap trinh vien'
        ],
        reply: `Dạ chào đồng nghiệp tương lai của ngành công nghệ nha! 💻 Để học Lập trình CNTT (Code Web, App Mobile, Backend, AI / Data Science) mượt mà suốt 4 năm đại học, cấu hình 'chân ái' cần có:\n\n` +
            `• 🧠 **RAM tối thiểu 16GB (Khuyên dùng 32GB):** Bắt buộc phải có để gánh Docker containers, IDE nặng (VS Code, IntelliJ, Android Studio) và chạy máy ảo / mở hàng chục tab tài liệu mà không tràn RAM.\n` +
            `• ⚡ **CPU đa nhân đa luồng:** Intel Core i5/i7 thế hệ 12 trở lên, AMD Ryzen 7 hoặc chip Apple Silicon M2/M3/M4 (compile code siêu tốc).\n` +
            `• ⌨️ **Bàn phím & Màn hình:** Bàn phím hành trình sâu gõ êm tay đỡ mỏi, màn hình chống chói Full HD/2K bảo vệ mắt khi cày code ban đêm.\n` +
            `• 🍏 **Chọn Mac hay Windows?** Nếu bạn học Lập trình iOS (Swift/Xcode) thì MacBook là bắt buộc. Nếu bạn học Game Dev (Unity, Unreal) hoặc mạng máy tính thì Laptop Windows sẽ tiện lợi hơn.\n\n` +
            `👉 Bạn dự kiến ngân sách bao nhiêu để em lọc chiếc máy lập trình chuẩn nhất cho bạn nhé!`,
        suggestions: ['MacBook Pro M3 cho lập trình', 'Laptop Lenovo LOQ / ASUS Gaming', 'Laptop cấu hình RAM 16GB']
    },

    // 3.6 Chiến các tựa game cụ thể: Genshin, Valorant, FC Online, LoL, CS2, Wukong
    {
        id: 'gaming_compatibility_advice',
        patterns: [
            /(choi|keo|chien).*(muot|noi|on|duoc).*(genshin|valorant|fc online|wukong|cyberpunk|cs2)/i,
            /(choi|chien).*(genshin|valorant|fc online|black myth wukong).*(bao nhieu fps|co muot|co lag)/i
        ],
        keywords: [
            'choi muot genshin impact khong', 'choi valorant bao nhieu fps', 'da fc online co giat khong',
            'choi black myth wukong duoc khong', 'laptop choi game duoi 20 trieu', 'choi genshin impact',
            'choi black myth wukong'
        ],
        reply: `Dạ về hiệu năng chiến game, em xin phân tích theo từng nhóm game thực tế nè: 🎮\n\n` +
            `• 🎯 **Game eSports phổ thông (Liên Minh Huyền Thoại, Valorant, FC Online, CS2):** Cấu hình rất tối ưu! Ngay cả các dòng laptop có card on-board mạnh (như Radeon 680M / 780M) hoặc card GTX 1650 / RTX 2050 đã chiến mượt **120 – 165+ FPS**, tận dụng trọn vẹn màn hình tần số quét cao.\n` +
            `• ⚔️ **Game thế giới mở & Đồ họa nặng (Genshin Impact, Honkai Star Rail, GTA V):** Nên chọn máy có **RTX 3050 / RTX 4050 trở lên** để bật Max Setting 60 FPS mà nhiệt độ vẫn ổn định mát mẻ.\n` +
            `• 🐒 **Siêu phẩm AAA (Black Myth: Wukong, Cyberpunk 2077):** Khuyên dùng cấu hình có **RTX 4060 trở lên kết hợp công nghệ DLSS 3 Frame Generation** để trải nghiệm đồ họa Ray Tracing đỉnh chóp.\n\n` +
            `👉 Bạn dự kiến ngân sách bao nhiêu để em chọn chiếc laptop gaming tản nhiệt mát nhất trong tầm giá cho bạn nhé! 😊`,
        suggestions: ['Xem Laptop Acer Nitro V RTX 4050', 'Xem Laptop ASUS ROG Strix', 'Tư vấn Laptop dưới 20 triệu']
    }
];

// -------------------------------------------------------------
// 4. MÀU SẮC, PHONG THỦY & SO SÁNH NỀN TẢNG
// -------------------------------------------------------------

const COMPARISON_AND_FENGSHUI_RULES = [
    // 4.1 Màu sắc hợp Mệnh Phong Thủy Công Nghệ (Ưu tiên kiểm tra trước câu hỏi màu chung)
    {
        id: 'color_feng_shui_advice',
        patterns: [
            /(menh|hop menh).*(kim|moc|thuy|hoa|tho)/i,
            /(phong thuy).*(mau|chon mau)/i
        ],
        keywords: [
            'menh kim chon mau gi', 'menh moc hop mau gi', 'menh thuy hop mau nao', 'menh hoa mua may mau gi',
            'menh tho hop mau gi', 'phong thuy mau sac', 'menh kim hop mau gi', 'menh hoa hop mau nao', 'menh tho hop mau nao'
        ],
        reply: `Dạ chọn màu thiết bị công nghệ hợp mệnh vừa giúp bạn tự tin dùng máy vừa mang lại nguồn năng lượng tài lộc, hanh thông trong công việc nè: 🔮✨\n\n` +
            `• 🪙 **Mệnh Kim:** Hợp với màu **Trắng, Bạc (Silver), Vàng ánh kim (Gold), Titan Tự Nhiên** hoặc màu **Vàng đất (Thổ sinh Kim)** mang lại may mắn, thịnh vượng.\n` +
            `• 🌊 **Mệnh Thủy:** Rất hợp với màu **Đen (Midnight / Black), Xanh dương (Blue / Titan Xanh)** và màu **Trắng, Bạc (Kim sinh Thủy)**.\n` +
            `• 🌲 **Mệnh Mộc:** Tương sinh với màu **Xanh lá cây (Green / Mint), Đen, Xanh dương đậm (Thủy sinh Mộc)** giúp công việc phát triển vững bền.\n` +
            `• 🔥 **Mệnh Hỏa:** Tuyệt đẹp với màu **Đỏ, Cam, Hồng, Tím** hoặc kết hợp **Xanh lá cây (Mộc sinh Hỏa)** tiếp thêm nhiệt huyết, sáng tạo.\n` +
            `• 🏜️ **Mệnh Thổ:** Cực kỳ hợp với màu **Titan Sa Mạc (Desert Titanium), Nâu đồng, Vàng cát** hoặc tone màu **Đỏ, Hồng (Hỏa sinh Thổ)** thu hút tài lộc.\n\n` +
            `👉 Bạn đang chọn máy thuộc mệnh nào để em lọc ngay những model có tone màu 'chân ái' đó cho bạn nhé! 😊`,
        suggestions: ['Xem máy màu Titan Sa Mạc', 'Xem máy màu Xanh Blue', 'Xem máy màu Trắng Bạc']
    },

    // 4.2 Màu nào đẹp / bán chạy nhất
    {
        id: 'color_best_seller_trend',
        patterns: [
            /(mau|mau sac).*(nao|gi).*(dep nhat|ban chay nhat|hot nhat|trend|sang nhat)/i,
            /(nen chon|nen lay).*(mau nao|mau gi)/i
        ],
        keywords: [
            'mau nao dep nhat', 'mau nao ban chay nhat', 'mau hot trend', 'nen chon mau titan nao',
            'mau nao nhin sang nhat', 'nen mua mau nao', 'mau sac nao dep'
        ],
        reply: `Dạ mỗi màu sắc đều mang một phong cách và cá tính riêng, nhưng theo dữ liệu bán chạy nhất tại hệ thống TechEcommerce thì:\n\n` +
            `• 🌟 **Top 1 Bán Chạy Nhất (Hot Trend):** Màu **Titan Sa Mạc (Desert Titanium)** và **Titan Tự Nhiên (Natural Titanium)** — đây là 2 tone màu sang trọng bậc nhất, viền titan phay xước chống bám vân tay và nhận diện dòng máy mới cực kỳ đẳng cấp.\n` +
            `• 🖤 **Vẻ đẹp không bao giờ lỗi mốt:** Màu **Đen Titan / Xám Midnight** nam tính, mạnh mẽ, sạch sẽ và giữ được vẻ mới mẻ rất lâu.\n` +
            `• 🤍 **Thanh lịch, trẻ trung:** Màu **Trắng Starlight / Bạc Silver** sáng bừng góc làm việc, rất được các bạn nữ và dân văn phòng ưa chuộng.\n\n` +
            `👉 Bạn đang hướng tới phong cách tối giản thanh lịch hay nổi bật cá tính để em chọn màu phù hợp nhất nhé! 😊`,
        suggestions: ['Xem iPhone Titan Sa Mạc', 'Xem iPhone Titan Tự Nhiên', 'Xem MacBook Bạc Silver']
    },

    // 4.3 Nên mua iPhone hay Samsung? (iOS vs Android)
    {
        id: 'platform_ios_vs_android',
        patterns: [
            /(nen mua|chon|so sanh).*(iphone hay samsung|samsung hay iphone|ios hay android|android hay ios)/i,
            /(iphone|samsung).*(hay).*(samsung|iphone)/i
        ],
        keywords: [
            'nen mua iphone hay samsung', 'iphone va samsung nen mua con nao', 'ios hay android tot hon',
            'phan van giua iphone va samsung', 'samsung hay iphone tot hon', 'nen dung iphone hay samsung'
        ],
        reply: `Dạ đây là 'cuộc chiến thế kỷ' của giới công nghệ luôn nè! Em xin phân tích ưu điểm cốt lõi để bạn chọn đúng gu của mình nha: ⚖️\n\n` +
            `• 🍎 **Chọn iPhone (Apple iOS) nếu bạn thích:**\n` +
            `  - Hệ điều hành mượt mà, ổn định lâu dài (4 - 6 năm không lo giật lag).\n` +
            `  - Quay video và chất lượng up story/reels Instagram, TikTok, Facebook đẹp và nét nhất thế giới.\n` +
            `  - Giữ giá cực tốt khi muốn lên đời và kết nối hệ sinh thái Apple (MacBook, Apple Watch, iPad, AirPods) hoàn hảo không đối thủ.\n\n` +
            `• 🌌 **Chọn Samsung Galaxy (Android) nếu bạn thích:**\n` +
            `  - Màn hình Dynamic AMOLED 2X 120Hz viền siêu mỏng, xem phim rực rỡ đã mắt.\n` +
            `  - Đa nhiệm tự do, chia đôi màn hình, gắn bút S-Pen ghi chú chuyên nghiệp và tính năng Galaxy AI thông minh.\n` +
            `  - Camera zoom 100x đỉnh cao và công nghệ sạc siêu nhanh 45W tiết kiệm thời gian.\n\n` +
            `👉 Bạn quan tâm tầm giá bao nhiêu để em so sánh trực tiếp hai model kỳ phùng địch thủ trong tầm giá đó cho bạn nhé! 😊`,
        suggestions: ['So sánh iPhone 16 vs Galaxy S24', 'Tư vấn iPhone chính hãng', 'Tư vấn Samsung Galaxy']
    },

    // 4.4 Nên mua MacBook hay Laptop Windows?
    {
        id: 'platform_macbook_vs_windows',
        patterns: [
            /(nen mua|chon|so sanh).*(macbook hay laptop|laptop hay macbook|mac hay win|macbook hay dell|macbook hay asus)/i
        ],
        keywords: [
            'nen mua macbook hay laptop windows', 'macbook hay dell tot hon', 'nen dung mac hay win',
            'phan van giua macbook va laptop', 'macbook va laptop windows nen chon cai nao'
        ],
        reply: `Dạ em xin tóm gọn ưu thế của 2 thế giới máy tính để bạn chọn theo đúng tính chất công việc nha: 💻\n\n` +
            `• 🍏 **Nên chọn MacBook (Apple Silicon):** Nếu bạn là dân văn phòng, marketing, sinh viên kinh tế, content creator hoặc lập trình viên web/mobile cần một chiếc máy **Pin trâu kỷ lục (15 - 18 tiếng không cần cắm sạc)**, máy mát rượi không quạt hú, trackpad rê chuột mượt mà không cần chuột rời, màn hình Retina sắc nét và loa hay nhất phân khúc.\n\n` +
            `• 🪟 **Nên chọn Laptop Windows:** Nếu bạn cần **chơi game (mọi tựa game)**, làm đồ họa 3D/AutoCAD/Revit chuyên sâu, dùng phần mềm kế toán (MISA), hoặc cần khả năng nâng cấp RAM/SSD dễ dàng và cổng kết nối đa dạng.\n\n` +
            `👉 Ngành nghề hoặc nhu cầu chính của bạn là gì để em tư vấn chiếc máy 'chân ái' phục vụ bạn tốt nhất nhé! 😊`,
        suggestions: ['Tư vấn MacBook Air M3', 'Tư vấn Laptop Windows mỏng nhẹ', 'Tư vấn Laptop Gaming']
    }
];

// -------------------------------------------------------------
// 5. MẸO VẶT CÔNG NGHỆ ĐỜI THƯỜNG (TECH TIPS & HARDWARE ADVICE)
// -------------------------------------------------------------

const TECH_TIP_RULES = [
    // 5.1 Sạc qua đêm có bị chai pin không?
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

    // 5.2 Dán cường lực hay dán PPF?
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

    // 5.3 Laptop chơi game bị nóng và quạt quay to
    {
        id: 'laptop_heating_fan',
        patterns: [
            /(laptop|may|may tinh).*(nong|quat keu|quat quay)/i,
            /(quat).*(keu to|quay vu vu|keu re re)/i,
            /(choi game).*(nong|quat keu)/i
        ],
        keywords: [
            'laptop bi nong', 'may nong khi choi game', 'quat laptop keu to', 'quat quay vu vu',
            'laptop nong co sao khong', 'nhiet do laptop bao nhieu la cao', 'tai sao laptop nong'
        ],
        reply: `Dạ bạn đừng quá lo lắng nha, để em giải thích nguyên lý cho bạn an tâm nè! ❄️\n\n` +
            `Khi chơi game nặng (như Genshin Impact, Valorant, GTA V) hoặc render đồ họa 3D, chip CPU và card đồ họa GPU hoạt động ở mức công suất cao (80W - 140W+), sinh nhiệt lượng lớn. Hệ thống tản nhiệt sẽ tự động kích hoạt quạt quay ở tốc độ tối đa (4.000 - 6.000 vòng/phút) để giải nhiệt cấp tốc ra ngoài — đây là **cơ chế bảo vệ hoàn toàn bình thường** của laptop gaming.\n\n` +
            `💡 **Mẹo giúp máy mát hơn 5 - 10 độ C tức thì:**\n` +
            `• Kê cao phần đuôi đáy máy lên 2-3cm hoặc dùng đế tản nhiệt để khe hút gió thông thoáng.\n` +
            `• Tuyệt đối không đặt laptop lên nệm, chăn hay để trên đùi khi chơi game (bít hoàn toàn đường thở của quạt).\n` +
            `• Định kỳ 6 - 12 tháng nên vệ sinh bụi quạt và tra keo tản nhiệt một lần nhé!`,
        suggestions: ['Xem Laptop Gaming ASUS ROG', 'Xem Laptop Acer Nitro V', 'Tư vấn phụ kiện tản nhiệt']
    },

    // 5.4 Cách chụp màn hình MacBook & Windows
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

    // 5.5 Vừa sạc vừa dùng điện thoại có nguy hiểm không?
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
    },

    // 5.6 Cách kiểm tra độ chai pin trên máy
    {
        id: 'check_battery_health',
        patterns: [
            /(kiem tra|xem|check).*(pin chai|do chai pin|tinh trang pin|chai bao nhieu)/i,
            /(pin chai|do chai pin).*(bao nhieu thi thay|khi nao thay)/i
        ],
        keywords: [
            'cach kiem tra pin chai', 'xem pin chai the nao', 'kiem tra pin iphone', 'do chai pin bao nhieu thi nen thay',
            'xem pin macbook', 'kiem tra tinh trang pin', 'check pin dien thoai', 'pin chai bao nhieu'
        ],
        reply: `Dạ cách kiểm tra sức khỏe pin trên các thiết bị rất đơn giản nè bạn ơi: 🔋🔍\n\n` +
            `🍎 **Trên iPhone / iPad:**\n` +
            `• Vào *Cài đặt > Pin > Tình trạng pin & Sạc*. Bạn sẽ thấy mục **Dung lượng tối đa**.\n` +
            `• 💡 **Mức khuyến nghị:** Nếu pin còn trên 80% thì máy vẫn hoạt động với hiệu năng đỉnh cao bình thường. Nếu dưới 80% hoặc có thông báo *"Bảo trì"*, bạn nên thay pin mới chính hãng để máy không bị sập nguồn đột ngột nhé!\n\n` +
            `🍏 **Trên MacBook:**\n` +
            `• Nhấn giữ phím \`Option\` và click vào biểu tượng Pin ở góc phải thanh Menu (hoặc vào *Cài đặt hệ thống > Pin > Tình trạng pin*).\n\n` +
            `🪟 **Trên Laptop Windows:**\n` +
            `• Mở CMD gõ lệnh: \`powercfg /batteryreport\` rồi nhấn Enter. Mở file HTML vừa tạo ra để xem dung lượng xuất xưởng (Design Capacity) so với dung lượng hiện tại (Full Charge Capacity) là biết chính xác 100%!`,
        suggestions: ['Xem củ sạc nhanh chính hãng', 'Tư vấn phụ kiện pin dự phòng', 'Hotline 0842.331.606']
    },

    // 5.7 Cách dọn dẹp giải phóng dung lượng bộ nhớ đầy
    {
        id: 'clear_storage_space',
        patterns: [
            /(bo nho|dung luong).*(day|bao day|het dung luong)/i,
            /(don rac|giai phong|xoa bo nho dem).*(dien thoai|may tinh)/i
        ],
        keywords: [
            'bo nho day phai lam sao', 'cach don rac dien thoai', 'bo nho bao day', 'xoa bo nho dem',
            'giai phong dung luong', 'het dung luong bo nho', 'cach don bo nho', 'dien thoai bao day bo nho'
        ],
        reply: `Dạ khi bộ nhớ báo đầy, em mách bạn 3 cách dọn dẹp cấp tốc lấy lại ngay 10GB – 30GB bộ nhớ trống nè: 🧹📱\n\n` +
            `1. 💬 **Dọn bộ nhớ đệm (Cache) của app mạng xã hội:** Mở Telegram, Zalo, TikTok, Facebook vào phần *Cài đặt > Dữ liệu và Lưu trữ > Xóa bộ nhớ đệm (Clear Cache)*. Riêng Zalo và Telegram thường tích trữ tới 10GB – 20GB ảnh/video rác mà bạn không hề hay biết!\n` +
            `2. 🗑️ **Dọn sạch mục 'Đã xóa gần đây' (Recently Deleted):** Nhiều bạn xóa ảnh và video nhưng quên mất chúng vẫn nằm trong thùng rác 30 ngày và vẫn chiếm dung lượng như bình thường.\n` +
            `3. ☁️ **Bật tối ưu hóa dung lượng:** Trên iPhone bật *Cài đặt > Ảnh > Tối ưu hóa dung lượng iPhone*, ảnh gốc sẽ lưu trên iCloud và chỉ giữ bản nhẹ trên máy.\n\n` +
            `👉 Nếu máy của bạn là bản 64GB đã quá chật chội, khi lên đời bạn nên chọn bản **128GB hoặc 256GB** để dùng thoải mái không lo xóa ảnh nhé!`,
        suggestions: ['Tư vấn iPhone 128GB/256GB', 'Tư vấn điện thoại dung lượng lớn', 'Mã giảm giá hôm nay']
    },

    // 5.8 Mẹo tiết kiệm pin khi đi xa / đi du lịch
    {
        id: 'extend_battery_life',
        patterns: [
            /(tiet kiem pin|pin trau hon).*(di xa|du lich|di choi)/i,
            /(cach|meo).*(tiet kiem pin|keo dai thoi luong pin)/i
        ],
        keywords: [
            'cach tiet kiem pin', 'lam sao de pin trau hon', 'meo tiet kiem pin khi di du lich',
            'tiet kiem pin dien thoai', 'pin nhanh het lam sao'
        ],
        reply: `Dạ khi đi phượt hay du lịch xa cả ngày, em gửi bạn bộ bí kíp giữ pin 'sống dai' cực kỳ hữu hiệu nè: 🏕️🔋\n\n` +
            `• 🌙 **Bật chế độ Tiết kiệm pin (Low Power Mode):** Giảm xung nhịp CPU nhẹ và tạm dừng các tiến trình đồng bộ ngầm không cần thiết.\n` +
            `• 📡 **Chuyển về 4G thay vì 5G khi ở vùng sóng yếu:** Khi sóng chập chờn, máy phải liên tục phát công suất cao để bắt sóng 5G khiến pin tụt cực nhanh.\n` +
            `• 📍 **Tắt quyền vị trí (GPS) chạy nền:** Vào *Quyền riêng tư > Dịch vụ định vị*, chuyển các app không cần định vị liên tục sang chế độ *"Khi dùng ứng dụng"*.\n` +
            `• ☀️ **Hạ độ sáng màn hình thủ công:** Màn hình chiếm tới 50% - 70% điện năng tiêu thụ của máy đó ạ.\n\n` +
            `💡 Để an tâm tuyệt đối chụp ảnh check-in suốt chuyến đi, bạn nên thủ sẵn một cục **Pin sạc dự phòng Anker 10.000mAh – 20.000mAh** nhỏ gọn nhé!`,
        suggestions: ['Xem pin sạc dự phòng Anker', 'Điện thoại pin trâu 5000mAh', 'Mã giảm giá hôm nay']
    }
];

// -------------------------------------------------------------
// 6. ĐỐI ĐÁP NGẪU HỨNG ĐỜI THƯỜNG (CHIT-CHAT, HUMOR, EMPATHY)
// -------------------------------------------------------------

const CHIT_CHAT_RULES = [
    // 6.1 Khách hỏi thăm ăn uống / sức khỏe
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

    // 6.2 Khách than vãn mệt mỏi / áp lực công việc / stress
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

    // 6.3 Kể chuyện cười / Đố vui xả stress
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

    // 6.4 Khách hỏi thời tiết / ngày mưa gió
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
        reply: `Dạ thời tiết thế này em khuyên bạn nhớ chú ý đi lại cẩn thận, mặc áo ấm/áo mưa và nhớ bảo vệ balo máy tính/điện thoại cẩn thận kẻo ngấm nước nha! 🌧️\n\n` +
            `Riêng các đơn hàng tại TechEcommerce thì bạn hoàn toàn yên tâm: Shipper luôn bọc gói hàng bằng **túi zip chống nước 100% chuyên dụng** và hộp carton cứng cáp, dù mưa to bão bùng cỡ nào hàng tới tay bạn vẫn khô ráo, nguyên seal vẹn nguyên nhé! Bạn đang cần em giao hỏa tốc mẫu nào không ạ?`,
        suggestions: ['Giao hàng hỏa tốc 2 giờ', 'Chính sách bảo hành', 'Tư vấn sản phẩm mới']
    },

    // 6.5 Khách hỏi đời tư / Người yêu / Tuổi tác của AI
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

    // 6.6 Khách hỏi "Em là robot à?" / "Em là người thật hay máy?"
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

    // 6.7 Khách hỏi gợi ý món ăn / ngẫu hứng đời sống
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

    // 6.8 Khách than hết tiền / Lương ít
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
    },

    // 6.9 Khách khen AI thông minh, giỏi, dễ thương
    {
        id: 'ai_compliment_praise',
        patterns: [
            /(em|bot|ai).*(thong minh|gioi|de thuong|dinh|co tam|hay qua)/i,
            /(gioi qua|thong minh qua|de thuong qua|xin qua)/i
        ],
        keywords: [
            'em gioi qua', 'thong minh the', 'de thuong qua', 'gioi qua em', 'ai nay xin the',
            'bot thong minh qua', 'tu van co tam qua', 'khen em', 'em dinh qua'
        ],
        reply: `Dạ nghe bạn khen mà em 'nở mũi' và ấm lòng ghê luôn á! 🥰 Cảm ơn bạn rất nhiều nha!\n\n` +
            `Sự hài lòng và nụ cười của bạn chính là nguồn năng lượng lớn nhất giúp em ngày càng hoàn thiện và tư vấn tận tâm hơn nữa nè. Nếu bạn có bất kỳ băn khoăn nào về công nghệ hoặc cần săn deal hời thì cứ nói với em nha, em luôn ở đây đồng hành cùng bạn! ✨`,
        suggestions: ['Xem sản phẩm mới', 'Săn mã giảm giá', 'Địa chỉ Showroom', 'Tư vấn mua sắm']
    },

    // 6.10 Khách chào tạm biệt / Chúc ngủ ngon
    {
        id: 'goodbye_and_goodnight',
        patterns: [
            /(chuc|ngu).*(ngon|mo dep)/i,
            /(tam biet|bye|chao tam biet|hen gap lai|mai gap)/i
        ],
        keywords: [
            'tam biet', 'bye em', 'ngu ngon nhe', 'chuc em ngu ngon', 'mai gap lai',
            'chuc ngu ngon', 'hen gap lai', 'bye bye', 'di ngu day'
        ],
        reply: `Dạ em tạm biệt bạn nhé! 👋 Chúc bạn có một giấc ngủ thật ngon, có những giấc mơ đẹp và ngày mai thức dậy tràn đầy năng lượng tươi mới nha! 🌙✨\n\n` +
            `Khi nào rảnh rỗi hoặc cần hỗ trợ bất kỳ thiết bị công nghệ nào, TechEcommerce luôn sẵn sàng đón bạn 24/7. Hẹn sớm gặp lại bạn nè!`,
        suggestions: ['Xem ưu đãi ngày mai', 'Chính sách bảo hành', 'Hotline 0842.331.606']
    },

    // 6.11 Khách bực bội / Nóng giận nhẹ
    {
        id: 'handle_angry_frustrated',
        patterns: [
            /(buc minh|kho chiu|tuc|gian|cau|dien).*(qua|the|kinh)/i,
            /(lam an|phuc vu).*(kieu gi|te the|chan the)/i
        ],
        keywords: [
            'buc minh qua', 'sao lau the', 'kho chiu the nho', 'lam an kieu gi day',
            'chan cha buon noi', 'phuc vu kieu gi day', 'dien het ca nguoi'
        ],
        reply: `Dạ em thật sự xin lỗi vì đã khiến bạn cảm thấy phiền lòng và bực bội ạ! 🥺 Bạn hãy uống một ngụm nước và bình tĩnh một chút nha.\n\n` +
            `Bạn đang gặp phải vướng mắc ở đơn hàng, sản phẩm hay khâu phục vụ nào, bạn cứ chia sẻ thẳng thắn, em xin lắng nghe và phối hợp ngay với bộ phận hỗ trợ cấp cao để giải quyết thỏa đáng nhất cho bạn ngay lập tức ạ!\n\n` +
            `👉 Bạn cũng có thể gọi thẳng đến Hotline khiếu nại **0842.331.606** để được Trưởng ca hỗ trợ trực tiếp không phải chờ đợi nhé!`,
        suggestions: ['Hotline hỗ trợ 0842.331.606', 'Kiểm tra đơn hàng', 'Chính sách đổi trả']
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

    const groups = [
        { name: 'store_policy', rules: STORE_POLICY_RULES },
        { name: 'objection', rules: OBJECTION_RULES },
        { name: 'hardware_and_software', rules: HARDWARE_AND_SOFTWARE_RULES },
        { name: 'comparison_and_fengshui', rules: COMPARISON_AND_FENGSHUI_RULES },
        { name: 'tech_tip', rules: TECH_TIP_RULES },
        { name: 'chit_chat', rules: CHIT_CHAT_RULES }
    ];

    for (const g of groups) {
        for (const rule of g.rules) {
            if (ruleMatches(rule)) {
                return {
                    reply: rule.reply,
                    suggestions: rule.suggestions,
                    context: { stage: g.name, currentIntent: rule.id },
                    intent: rule.id,
                    group: g.name
                };
            }
        }
    }

    return null;
}

module.exports = {
    matchSmartAnswer,
    STORE_POLICY_RULES,
    OBJECTION_RULES,
    HARDWARE_AND_SOFTWARE_RULES,
    COMPARISON_AND_FENGSHUI_RULES,
    TECH_TIP_RULES,
    CHIT_CHAT_RULES
};
