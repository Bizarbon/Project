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
        reply: `Dạ 100% giá bán hiển thị tại cửa hàng **đã bao gồm thuế VAT** đầy đủ rồi bạn nhé! 📄\n\n` +
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
        reply: `Dạ shop em đang có chương trình **'Thu Cũ Đổi Mới – Lên Đời Siêu Hời'** cực kỳ được khách hàng yêu thích luôn ạ! 🔄\n\n` +
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
        reply: `Dạ ngoài gói bảo hành chính hãng 12 - 24 tháng theo tiêu chuẩn nhà sản xuất, bên em có hỗ trợ thêm gói **BẢO HÀNH VÀNG (BẢO HÀNH VIP)** bảo vệ toàn diện:\n\n` +
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
        reply: `Dạ cửa hàng em cam kết **100% sản phẩm là máy mới nguyên seal, chính hãng phân phối chính thức tại Việt Nam (mã VN/A đối với các thiết bị Apple)** ạ! 🏆\n\n` +
            `• 📦 **Nguyên seal từ nhà máy:** Khách hàng tự tay 'bóc seal', kiểm tra tem phụ tiếng Việt và kích hoạt bảo hành điện tử chính hãng tại chỗ.\n` +
            `• ❌ **Nói không với hàng kém chất lượng:** Shop tuyệt đối không kinh doanh hàng xách tay trôi nổi, máy Lock mạng, máy trả bảo hành hay máy đã qua sửa chữa.\n` +
            `• 🛡️ **Bảo hành ủy quyền toàn quốc:** Được tiếp nhận tại tất cả các Trung tâm bảo hành chính thức (Apple Care, Samsung Service, ASUS ROG, Dell...).\n\n` +
            `👉 Nếu phát hiện sản phẩm không đúng cam kết chính hãng, bên em xin **hoàn tiền 200%** ngay lập tức để bạn yên tâm tuyệt đối nhé! 😊`,
        suggestions: ['Chính sách đổi trả 30 ngày', 'Địa chỉ Showroom xem máy', 'Tư vấn sản phẩm mới']
    },

    // 1.6 Hotline & Kênh liên hệ chính thức
    {
        id: 'contact_hotline',
        keywords: [
            'hotline', 'so dien thoai', 'sdt shop', 'so tong dai', 'tong dai', 'gap nhan vien',
            'so zalo', 'zalo shop', 'lien he', 'cskh', 'cham soc khach hang', 'so dien thoai cua hang'
        ],
        reply: `Dạ bạn có thể liên hệ trực tiếp với đội ngũ nhân viên cửa hàng qua các kênh chính thức sau nhé:\n\n` +
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
        reply: `Dạ hoàn toàn được bạn nhé! Cửa hàng hỗ trợ **Đặt giữ hàng tại Showroom trong 24 giờ hoàn toàn miễn phí** (không cần đặt cọc trước) ạ! 🏬\n\n` +
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
        reply: `Dạ cửa hàng áp dụng chính sách **1 ĐỔI 1 TRONG 30 NGÀY ĐẦU TIÊN** cực kỳ an tâm cho khách hàng luôn ạ! 🔄\n\n` +
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
        reply: `Dạ thời gian giao hàng và chính sách kiểm hàng tại cửa hàng rất nhanh chóng và minh bạch ạ! 🚚📦\n\n` +
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
        reply: `Dạ em xin gửi bạn các hình thức thanh toán linh hoạt, tiện lợi và an toàn tuyệt đối tại cửa hàng bên em ạ: 💳✨\n\n` +
            `1. 💵 **Thanh toán tiền mặt khi nhận hàng (COD):** Áp dụng toàn quốc sau khi bạn đã đồng kiểm hàng ưng ý.\n` +
            `2. 📱 **Quét mã QR / Chuyển khoản ngân hàng 24/7:** Quét mã VietQR tự động xác nhận đơn tức thì trong 3 giây.\n` +
            `3. 💳 **Quẹt thẻ tại Showroom hoặc tại nhà:** Chấp nhận thẻ ATM nội địa Napas, Visa, Mastercard, JCB... **HOÀN TOÀN MIỄN PHÍ CÀ THẺ** (shop chịu 100% phí cà thẻ cho bạn).\n` +
            `4. 🎁 **Ví điện tử & Cổng VNPAY-QR / MoMo:** Thường xuyên có chương trình nhập mã giảm thêm trực tiếp **300.000đ – 500.000đ** vào hóa đơn.\n` +
            `5. 📄 **Trả góp:** Hỗ trợ Trả góp 0% qua thẻ tín dụng và Trả góp qua CCCD gắn chip xét duyệt 15 phút.\n\n` +
            `👉 Bạn dự kiến thanh toán bằng hình thức nào để em hướng dẫn nhận ưu đãi tốt nhất nhé! 😊`,
        suggestions: ['Tư vấn Trả góp 0%', 'Săn mã giảm giá VNPAY', 'Hotline 0842.331.606']
    },

    // 1.12 Kiểm tra hàng & Đồng kiểm khi nhận hàng (Inspection Policy)
    {
        id: 'policy_check_package_inspection',
        patterns: [
            /(kiem tra hang|dong kiem|xem hang|mo hop|boc seal).*(truoc khi|khi nhan|thanh toan|duoc khong)/i,
            /(co duoc|co cho).*(kiem tra hang|dong kiem|xem may|mo hop|thu may)/i
        ],
        keywords: [
            'co duoc kiem tra hang khong', 'cho xem hang khong', 'dong kiem', 'mo hop kiem tra',
            'co cho kiem hang khong', 'kiem tra truoc khi thanh toan', 'kiem tra may truoc',
            'shipper co cho xem hang khong', 'nhan hang co duoc kiem tra khong'
        ],
        reply: `Dạ bạn hoàn toàn yên tâm 100% nha! Cửa hàng em áp dụng chính sách **ĐỒNG KIỂM MINH BẠCH** với tất cả đơn hàng toàn quốc: 📦✨\n\n` +
            `• 🔍 **Quyền lợi khi nhận hàng:** Shipper giao tới, bạn được quyền **mở kiện hàng bên ngoài để kiểm tra đúng model, màu sắc, tình trạng nguyên hộp niêm phong, phụ kiện và quà tặng đi kèm** trước khi thanh toán tiền.\n` +
            `• 🛡️ **Bảo vệ người mua:** Nếu sản phẩm có bất kỳ dấu hiệu cấn móp vỏ hộp hoặc không đúng đơn bạn đã đặt, bạn có quyền từ chối nhận hàng ngay lập tức mà **hoàn toàn không tốn bất kỳ chi phí nào**.\n` +
            `• ⚡ **Sau khi kích hoạt máy:** Bạn vẫn được bảo vệ tối đa với chính sách **1 đổi 1 trong 30 ngày đầu tiên** nếu máy phát sinh lỗi từ nhà sản xuất!\n\n` +
            `👉 Bạn có thể hoàn toàn yên tâm đặt hàng trực tiếp trên website để nhận máy sớm nhất nhé! 😊`,
        suggestions: ['Chính sách đổi trả 30 ngày', 'Giao hàng hỏa tốc 2 giờ', 'Hotline 0842.331.606']
    },

    // 1.13 Hỗ trợ dán cường lực & chuyển dữ liệu miễn phí
    {
        id: 'policy_free_setup_and_transfer',
        patterns: [
            /(ho tro|co).*(chuyen du lieu|cai dat|dan cuong luc|dan man hinh|tang op)/i,
            /(chuyen du lieu).*(tu may cu|sang may moi)/i
        ],
        keywords: [
            'chuyen du lieu', 'chuyen du lieu may cu', 'co ho tro chuyen du lieu khong',
            'dan cuong luc mien phi', 'cai dat phan mem mien phi', 'cai office mien phi',
            'tang kem gi', 'qua tang kem', 'co dan man hinh khong'
        ],
        reply: `Dạ khi mua điện thoại hoặc laptop tại cửa hàng bên em, bạn sẽ được nhận trọn bộ **DỊCH VỤ CHĂM SÓC TOÀN DIỆN MIỄN PHÍ 100%** ạ: 🎁📱\n\n` +
            `• 🔄 **Chuyển dữ liệu 1-1 chuyên nghiệp:** Kỹ thuật viên hỗ trợ chuyển toàn bộ hình ảnh, video, danh bạ, tin nhắn, tài khoản Zalo/Viber từ máy cũ sang máy mới cực kỳ an toàn, bảo mật tuyệt đối và không lo mất dữ liệu.\n` +
            `• 📱 **Dán màn hình & Tặng ốp lưng:** Tặng kèm dán cường lực chống trầy cao cấp và ốp lưng bảo vệ máy.\n` +
            `• 💻 **Cài đặt trọn gói cho Laptop:** Hỗ trợ cài đặt Windows bản quyền, bộ ứng dụng văn phòng Office (Word, Excel, PowerPoint), phần mềm đồ họa cơ bản và dọn dẹp tối ưu máy hoàn toàn miễn phí.\n\n` +
            `👉 Nếu bạn mua online, kỹ thuật viên có thể gọi video call hướng dẫn bạn chuyển dữ liệu chỉ trong 10 phút cực kỳ đơn giản nhé! 😊`,
        suggestions: ['Tư vấn iPhone chính hãng', 'Tư vấn Laptop sinh viên', 'Hotline 0842.331.606']
    },

    // 1.14 Mã giảm giá, Voucher bí mật & Xin bớt giá
    {
        id: 'policy_voucher_secret_discount',
        patterns: [
            /(co|xin|cho|lay).*(ma giam gia|voucher|khuyen mai|ma uu dai|coupon)/i,
            /(giam gia|bot gia|bot them|giam them).*(duoc khong|nua khong|chut nao khong)/i
        ],
        keywords: [
            'ma giam gia', 'xin ma giam gia', 'co ma giam gia khong', 'voucher hom nay',
            'bot gia chut duoc khong', 'giam them duoc khong', 'ma khuyen mai', 'co voucher khong',
            'xin voucher', 'san deal', 'co duoc giam gia nua khong'
        ],
        reply: `Dạ hihi, mua sắm là phải có quà và săn deal hời mới thích đúng không nè! 🎁✨\n\n` +
            `Em xin bật mí ngay các **MÃ GIẢM GIÁ ĐỘC QUYỀN** bạn có thể áp dụng trực tiếp ở giỏ hàng hôm nay nha:\n` +
            `• 🔥 Mã **TECHWELCOME**: Giảm ngay **200.000 đ** cho khách hàng lần đầu mua sắm tại cửa hàng.\n` +
            `• 🎓 Mã **TECHSTUDENT**: Trợ giá thêm **500.000 đ** cho Học sinh, Sinh viên khi mua Laptop & Tablet.\n` +
            `• ⚡ **Flash Sale Giá Sốc:** Giảm thẳng đến **30% - 50%** với số lượng giới hạn ở ngay đầu trang chủ.\n` +
            `• 💳 **Thanh toán qua VNPAY / Quét QR:** Giảm thêm đến **300.000 đ** khi nhập mã khuyến mãi tại cổng thanh toán.\n\n` +
            `👉 Bạn đang ưng ý mẫu sản phẩm nào để em chỉ bạn cách gộp voucher nhận mức giá tốt nhất nhé! 😊`,
        suggestions: ['Xem Flash Sale giá sốc', 'Ưu đãi Sinh viên', 'Hotline 0842.331.606']
    },

    // 1.15 Trung tâm bảo hành chính hãng ở đâu?
    {
        id: 'policy_official_warranty_center',
        patterns: [
            /(bao hanh).*(o dau|tai dau|hang hay shop|trung tam nao|dia chi bao hanh)/i,
            /(co duoc bao hanh).*(tai hang|apple|samsung|asus)/i
        ],
        keywords: [
            'bao hanh o dau', 'trung tam bao hanh apple', 'bao hanh chinh hang o dau',
            'bao hanh tai hang hay shop', 'trung tam bao hanh samsung', 'gui may bao hanh the nao',
            'dia chi trung tam bao hanh'
        ],
        reply: `Dạ 100% sản phẩm tại cửa hàng bên em là **hàng chính hãng phân phối chính thức (mã VN/A cho Apple)** nên bạn có hai lựa chọn bảo hành cực kỳ tiện lợi ạ: 🛡️🏢\n\n` +
            `1. 🏛️ **Bảo hành trực tiếp tại Hãng:** Bạn có thể mang máy tới bất kỳ Trung tâm bảo hành ủy quyền chính thức nào trên toàn quốc:\n` +
            `   • **Apple:** Thakral One, CareS, TopCare, AASP trên toàn quốc.\n` +
            `   • **Samsung:** Tất cả Trung tâm chăm sóc khách hàng Samsung Service Center trên 63 tỉnh thành.\n` +
            `   • **Laptop Asus, Dell, Acer, Lenovo:** Các trung tâm bảo hành ủy quyền chính hãng tại Hà Nội, TP.HCM, Đà Nẵng, Cần Thơ...\n` +
            `2. 🏪 **Gửi qua cửa hàng bên em:** Nếu bạn bận rộn, chỉ cần mang máy đến Showroom shop hoặc gửi qua bưu điện, shop sẽ tiếp nhận và gửi hãng thẩm định, theo dõi tiến độ và giao tận tay bạn hoàn toàn miễn phí!\n\n` +
            `👉 Mọi thắc mắc về tình trạng bảo hành, bạn có thể gọi hotline kỹ thuật **0842.331.606** để được hỗ trợ tức thì nhé!`,
        suggestions: ['Chính sách bảo hành vàng', 'Hotline hỗ trợ 0842.331.606', 'Địa chỉ Showroom']
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
            `Em xin phép **Lưu lại thông tin tư vấn** và ưu đãi ngày hôm nay (voucher giảm giá + combo quà tặng) trên hệ thống cho bạn. Khi nào bạn sẵn sàng rinh máy, chỉ cần nhắn lại cho em hoặc ghé cửa hàng là được áp dụng ngay mức giá ưu đãi nhất nhé!\n\n` +
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
        reply: `Dạ em rất cảm ơn bạn đã so sánh và góp ý thẳng thắn ạ! Giá niêm yết tại các hệ thống bán lẻ đôi lúc có sự chênh lệch nhẹ do chính sách quà tặng và gói dịch vụ hậu mãi đi kèm. Em xin chia sẻ 5 quyền lợi vượt trội chỉ có tại cửa hàng bên em để bạn dễ cân nhắc nha:\n\n` +
            `1. 📄 **Giá đã bao gồm 100% thuế VAT:** Nhiều nơi để giá chưa VAT, khi xuất hóa đơn công ty sẽ bị tính phụ thu thêm 8% - 10%.\n` +
            `2. 🏆 **Hàng chính hãng mới nguyên seal 100%:** Cam kết xuất xứ phân phối chính thức tại VN (mã VN/A cho Apple), bảo hành tại tất cả TTBH ủy quyền toàn quốc. Phát hiện hàng xách tay/đã active đền tiền 200%.\n` +
            `3. 🔄 **Đặc quyền 1 ĐỔI 1 TRONG 30 NGÀY:** Thời gian bao test lỗi nhà sản xuất dài gấp đôi so với chuẩn 15 ngày thông thường.\n` +
            `4. 🎁 **Ưu đãi thanh toán độc quyền:** Giảm thêm 300.000đ – 500.000đ khi quét VNPAY-QR hoặc MoMo + Miễn phí vệ sinh dán máy trọn đời.\n` +
            `5. 🤝 **Hỗ trợ cân đối giá:** Nếu bên bạn thấy là hàng chính hãng mới 100% cùng phiên bản, bạn cứ gửi link cho em, bên em luôn có chính sách trợ giá tốt nhất để bạn không bị thiệt thòi nhé! 😊`,
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
            `💡 **Cửa hàng có nhiều giải pháp giúp bạn nhẹ ví hơn:**\n` +
            `• Gói **Trả góp 0% lãi suất** chia nhỏ thanh toán mỗi tháng chỉ từ vài trăm nghìn đồng.\n` +
            `• Chương trình **Thu cũ đổi mới trợ giá thêm đến 2.000.000 đ** từ máy cũ của bạn.\n` +
            `• Hoặc em có thể tư vấn các mẫu đời trước hoặc phân khúc lân cận cấu hình tương đương với mức giá mềm hơn 20% - 30% nè!\n\n` +
            `👉 Bạn có muốn em tìm mẫu máy cấu hình ngon mà giá mềm hơn trong tầm này cho bạn không ạ? 😊`,
        suggestions: ['Xem dòng máy giá mềm hơn', 'Tư vấn Trả góp 0%', 'Thu cũ đổi mới trợ giá 2tr', 'Mã giảm giá hôm nay']
    }
];

// -------------------------------------------------------------
// 3. TƯ VẤN MUA HÀNG THEO NGÂN SÁCH & ĐỐI TƯỢNG (BUDGET & PERSONA)
// -------------------------------------------------------------

const BUDGET_AND_CONSULTATION_RULES = [
    // 3.1 Điện thoại dưới 5 triệu (Phổ thông, Pin trâu, Học sinh & Người lớn tuổi)
    {
        id: 'budget_phone_under_5m',
        patterns: [
            /(dien thoai|may).*(duoi 5 trieu|duoi 5tr|tam 3|tam 4|tam 5 trieu|gia re|hoc sinh)/i,
            /(3 trieu|4 trieu|5 trieu).*(mua dien thoai gi|nen mua may nao)/i
        ],
        keywords: [
            'dien thoai duoi 5 trieu', 'dien thoai duoi 5tr', 'tam 3 den 5 trieu nen mua gi',
            'dien thoai gia re pin trau', 'mua dien thoai cho bo me', 'dien thoai cho hoc sinh cap 3',
            'dien thoai tam 4 trieu', 'dien thoai tam 3 trieu'
        ],
        reply: `Dạ trong tầm giá **dưới 5 triệu**, tiêu chí quan trọng nhất là **Pin trâu, màn hình to rõ và phần mềm ổn định mượt mà** nè! 📱🔋\n\n` +
            `Em xin gợi ý các 'ứng cử viên' số 1 trong tầm giá này tại shop:\n` +
            `• 👑 **Samsung Galaxy A15 / A05s (Từ 3.490.000 đ – 4.290.000 đ):** Điểm mạnh thương hiệu lớn, màn hình sắc nét 90Hz, pin 5.000mAh dùng 1.5 ngày thoải mái, giao diện One UI cực kỳ thân thiện với người lớn tuổi và học sinh.\n` +
            `• 🚀 **Xiaomi Redmi Note 13 (Tầm 4.490.000 đ):** Vua cấu hình tầm giá rẻ! Màn hình AMOLED 120Hz viền siêu mỏng, camera 108MP sắc nét và sạc nhanh 33W đi kèm sẵn củ sạc trong hộp.\n` +
            `• 🛡️ 100% máy mới nguyên seal, bảo hành chính hãng 12 – 18 tháng tận nhà.\n\n` +
            `👉 Bạn dự định mua máy cho bản thân hay mua tặng phụ huynh / học sinh để em tư vấn màu sắc và gói cài đặt sẵn phù hợp nhất nhé! 😊`,
        suggestions: ['Xem Samsung Galaxy A15', 'Xem Xiaomi Redmi Note 13', 'Tư vấn Trả góp 0%', 'Hotline 0842.331.606']
    },

    // 3.2 Điện thoại tầm trung 7 - 10 triệu (Phân khúc 'quốc dân' đáng mua nhất)
    {
        id: 'budget_phone_7_to_10m',
        patterns: [
            /(tam 7|tam 8|tam 9|tam 10|7 den 10|7-10|duoi 10).*(trieu|tr)/i,
            /(7 trieu|8 trieu|9 trieu|10 trieu).*(mua|dien thoai|may|chup anh|choi game)/i,
            /(dien thoai|may).*(tam 7|tam 8|tam 9|tam 10|7 den 10|7-10|duoi 10).*(trieu|tr)/i
        ],
        keywords: [
            'dien thoai tam 7 den 10 trieu', 'dien thoai tam 8 trieu', 'dien thoai tam 10 trieu',
            '10 trieu nen mua dien thoai gi', 'dien thoai tam trung chup anh dep', 'tam 8tr mua may gi',
            'duoi 10 trieu nen mua dien thoai gi'
        ],
        reply: `Dạ tầm giá **7 – 10 triệu** là phân khúc 'vàng' được khách hàng săn đón nhiều nhất vì máy sở hữu trải nghiệm gần như Flagship cao cấp luôn ạ! 🌟📱\n\n` +
            `✨ **Top lựa chọn xuất sắc nhất hiện nay:**\n` +
            `1. 🏆 **Samsung Galaxy A55 5G:** Khung viền kim loại sang trọng nguyên khối, màn hình Super AMOLED 120Hz rực rỡ, kháng nước kháng bụi chuẩn IP67 an toàn khi đi mưa và hỗ trợ cập nhật phần mềm 4-5 năm.\n` +
            `2. ⚡ **Xiaomi 13T / Redmi Note 13 Pro+:** Cấu hình cực khủng, ống kính hợp tác Leica chuyên nghiệp, sạc siêu tốc 67W - 120W cắm 20 phút đầy pin, màn hình 1.5K sắc nét.\n` +
            `3. 🍏 **iPhone 12 / iPhone 13 Like New 99%:** Dành cho bạn thích hệ điều hành iOS mượt mà, camera quay video TikTok / Reels chân thực và giữ giá cực tốt.\n\n` +
            `👉 Bạn ưu tiên chụp ảnh, chơi game hay pin trâu để em chọn chiếc máy chuẩn xác nhất cho bạn nha! 😊`,
        suggestions: ['Xem Samsung Galaxy A55 5G', 'Xem Xiaomi 13T', 'Xem iPhone 13 chính hãng', 'Tư vấn Trả góp 0%']
    },

    // 3.3 Điện thoại Flagship cao cấp trên 20 - 30 triệu (Đỉnh cao công nghệ)
    {
        id: 'budget_phone_flagship_above_20m',
        patterns: [
            /(tren 20|tren 25|tren 30|30 trieu|20 trieu|25 trieu).*(mua|dien thoai|may|flagship|cao cap)/i,
            /(dien thoai|may).*(tren 20|tren 25|tren 30|cao cap|flagship|tot nhat|dinh nhat).*(trieu|tr)/i,
            /(co 20 trieu|co 25 trieu|co 30 trieu).*(mua|dien thoai|may)/i
        ],
        keywords: [
            'dien thoai tren 20 trieu', 'dien thoai cao cap nhat', 'flagship tot nhat hien nay',
            'co 30 trieu nen mua dien thoai nao', 'iphone dinh nhat', 'samsung ultra',
            'dien thoai dat nhat', 'top dien thoai cao cap'
        ],
        reply: `Dạ ở phân khúc **Flagship cao cấp trên 20 – 30 triệu**, bạn sẽ được sở hữu những tinh hoa công nghệ hiện đại nhất hành tinh: 💎👑\n\n` +
            `• 🍏 **iPhone 16 Pro Max:** Khung viền Titan sa mạc đẳng cấp, viền màn hình mỏng nhất lịch sử Apple, chip A18 Pro 3nm mạnh vô đối, nút Camera Control thế hệ mới và tính năng Apple Intelligence thông minh vượt trội.\n` +
            `• 🤖 **Samsung Galaxy S25 Ultra:** 'Quái vật' camera mắt thần bóng đêm zoom quang 100x, bút S-Pen ghi chú tiện lợi, màn hình chống chói Dynamic AMOLED 2X và trí tuệ nhân tạo Galaxy AI phiên dịch trực tiếp cuộc gọi.\n` +
            `• 💼 **Samsung Galaxy Z Fold7 5G:** Kiệt tác công nghệ màn hình gập mỏng nhẹ thời thượng, mở ra thành máy tính bảng đa nhiệm làm việc văn phòng và giải trí đỉnh cao.\n\n` +
            `🎁 Cả 3 dòng máy đều được shop trợ giá **Thu cũ đổi mới thêm 2.000.000đ** và tặng gói **Bảo hành VIP rơi vỡ** kèm theo ạ! Bạn đang nghiêng về iPhone hay Samsung để em chuẩn bị quà nhé? 😊`,
        suggestions: ['Xem iPhone 16 Pro Max', 'Xem Galaxy S25 Ultra', 'Xem Galaxy Z Fold7 5G', 'Hotline 0842.331.606']
    },

    // 3.4 Laptop Học tập, Sinh viên, Văn phòng dưới 15 triệu
    {
        id: 'budget_laptop_student_under_15m',
        patterns: [
            /(laptop|may tinh).*(duoi 15|duoi 12|tam 10|tam 12|tam 15|sinh vien|van phong).*(trieu|tr)/i,
            /(sinh vien kinh te|van phong).*(mua laptop gi|laptop nao hop)/i
        ],
        keywords: [
            'laptop duoi 15 trieu', 'laptop sinh vien duoi 15tr', 'laptop van phong gia re',
            'laptop hoc tap gia tot', 'laptop cho sinh vien kinh te', 'laptop mong nhe gia re'
        ],
        reply: `Dạ đối với học tập và làm việc văn phòng trong tầm giá **10 – 15 triệu**, bạn hoàn toàn có thể chọn được một chiếc laptop **Mỏng nhẹ, sang trọng, pin 7 - 9 tiếng và ổ cứng SSD cực nhanh** ạ: 💻✨\n\n` +
            `✨ **Tiêu chuẩn cấu hình vàng em khuyên chọn:**\n` +
            `• **CPU:** Intel Core i5 thế hệ 12/13 hoặc AMD Ryzen 5 thế hệ 7000-series (mở hàng chục tab không giật lag).\n` +
            `• **RAM:** Tối thiểu 16GB (để chạy mượt mà nhiều ứng dụng cùng lúc suốt 4 năm học).\n` +
            `• **Ổ cứng:** SSD NVMe 512GB tốc độ cao (khởi động máy trong 5 giây).\n` +
            `• **Gợi ý model xuất sắc:** ASUS Vivobook 14/15, Lenovo IdeaPad Slim 3, Dell Inspiron 3520 (màn hình 120Hz mượt mà).\n\n` +
            `🎁 **Ưu đãi sinh viên:** Nhập mã **TECHSTUDENT** giảm thêm **500.000đ** + Tặng kèm Balo chống sốc & Chuột không dây cao cấp nha! 😊`,
        suggestions: ['Xem ASUS Vivobook 14', 'Xem Lenovo IdeaPad Slim', 'Ưu đãi Sinh viên', 'Hotline 0842.331.606']
    }
];

// -------------------------------------------------------------
// 4. CHI TIẾT PHẦN CỨNG, MỞ RỘNG & PHẦN MỀM / GAME
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
            `💡 **Ưu đãi trợ giá phụ kiện tại shop em:** Khi mua kèm máy mới, bạn được mua **Củ sạc nhanh Anker GaN 30W / 65W chính hãng** giảm giá ngay 20% chỉ còn từ 250.000đ – 390.000đ (sạc siêu nhanh 30 phút đầy 50% pin và an toàn chống cháy nổ tuyệt đối). Bạn có muốn em thêm củ sạc vào đơn cho tiện không nè? 😊`,
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
            `👉 Tại Showroom cửa hàng, kỹ thuật viên hỗ trợ nâng cấp RAM/SSD lấy ngay trong 20 phút và miễn phí công lắp đặt nhé!`,
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
        reply: `Dạ em xin thông tin đến bạn: 100% các dòng smartphone và smartwatch chính hãng phân phối tại cửa hàng bên em đều hỗ trợ **2 SIM tiện lợi** bạn nhé! 📶\n\n` +
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
            /(?:màu|màu sắc)\s+(?:nào|gì)\s+(?:đẹp|bán chạy|hot|trend|sang)/i,
            /\b(?:màu\s+sắc|chọn\s+màu|thích\s+màu|lấy\s+màu|tư\s+vấn\s+màu)\b/i,
            /\bmàu\s+(?:nào|gì)\b/i,
            /\bmau\s+sac\s+(?:nao|gi)\b/i,
            /\b(?:nen\s+chon|nen\s+lay|tu\s+van)\s+mau\s+sac\b/i
        ],
        keywords: [
            'mau sac nao dep', 'mau sac nao ban chay', 'mau sac dep nhat', 'mau sac ban chay nhat',
            'mau hot trend', 'nen chon mau titan nao', 'mau sac nao nhin sang nhat'
        ],
        reply: `Dạ mỗi màu sắc đều mang một phong cách và cá tính riêng, nhưng theo dữ liệu bán chạy nhất tại hệ thống cửa hàng thì:\n\n` +
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
    },

    // 4.5 So sánh iPhone 15 Pro Max vs iPhone 16 Pro Max (Có đáng lên đời không?)
    {
        id: 'compare_iphone_15_vs_16',
        patterns: [
            /(so sanh|khac gi|nen mua|co nen len doi).*(iphone 15.*iphone 16|15 pro max.*16 pro max|16 pro max.*15 pro max)/i,
            /(iphone 16).*(khac gi|co gi moi|hon gi).*(iphone 15)/i
        ],
        keywords: [
            'so sanh iphone 15 va 16', 'iphone 15 pro max va 16 pro max khac gi nhau',
            'co nen len doi iphone 16 pro max', 'iphone 16 co gi moi', '16 pro max hon gi 15 pro max',
            'nen mua 15 pro max hay 16 pro max', 'so sanh 15 pro max va 16 pro max'
        ],
        reply: `Dạ đây là câu hỏi được rất nhiều iFan quan tâm hiện nay nè! Em xin tóm tắt **4 điểm nâng cấp đắt giá nhất trên iPhone 16 Pro Max** so với 15 Pro Max nha: 🍏✨\n\n` +
            `1. 📸 **Nút Camera Control cảm ứng lực mới:** Cho phép bạn trượt ngón tay để zoom, đổi tiêu cự và chụp ảnh/quay video tức thì chuyên nghiệp như máy ảnh cơ DSLR.\n` +
            `2. 📱 **Màn hình lớn hơn, viền mỏng kỷ lục:** Tăng kích thước từ **6.7 inch lên 6.9 inch** với viền màn hình mỏng nhất lịch sử Apple, cầm máy trên tay cảm giác như cầm cả tấm kính vô cực.\n` +
            `3. 🚀 **Chip Apple A18 Pro 3nm & Apple Intelligence:** Xử lý trí tuệ nhân tạo AI tạo sinh trực tiếp trên máy, dịch ngôn ngữ tức thì, xóa vật thể thông minh và tốc độ chơi game đồ họa Ray Tracing tăng 20%.\n` +
            `4. 🔋 **Thời lượng pin tăng thêm 4 giờ:** Sử dụng xem video liên tục lên đến 33 giờ, hỗ trợ sạc nhanh MagSafe 25W.\n\n` +
            `💡 **Lời khuyên từ em:**\n` +
            `• Nếu bạn đang dùng **iPhone 12, 13, 14 series**: Lên thẳng **iPhone 16 Pro Max** là một bước nhảy vọt toàn diện không thể tuyệt vời hơn!\n` +
            `• Nếu bạn đang dùng **iPhone 15 Pro Max**: Máy hiện tại vẫn quá mạnh mẽ. Bạn chỉ nên nâng cấp nếu mê nút Camera Control và màu Titan Sa Mạc thời thượng nhé!\n\n` +
            `👉 Cửa hàng em đang có chương trình **Thu cũ đổi mới trợ giá 2.000.000đ** cho iPhone 16 Pro Max, bạn có muốn định giá thử máy cũ của mình không nè? 😊`,
        suggestions: ['Xem iPhone 16 Pro Max', 'Thu cũ đổi mới lên đời iPhone 16', 'Hotline 0842.331.606']
    },

    // 4.6 So sánh Tai nghe chống ồn: AirPods Pro 2 vs Sony WF-1000XM5
    {
        id: 'compare_earphones_airpods_vs_sony',
        patterns: [
            /(so sanh|nen mua).*(airpods.*sony|sony.*airpods|airpods pro 2.*wf-1000xm5)/i,
            /(tai nghe chong on).*(tot nhat|nen mua cai nao)/i
        ],
        keywords: [
            'nen mua airpods pro 2 hay sony wf-1000xm5', 'so sanh airpods pro va sony',
            'tai nghe chong on nao tot nhat', 'airpods pro 2 hay sony wf 1000xm5',
            'tai nghe true wireless cao cap', 'so sanh tai nghe chong on'
        ],
        reply: `Dạ đây là cuộc đối đầu kinh điển giữa 2 chiếc tai nghe chống ồn (True Wireless ANC) đỉnh nhất hành tinh hiện nay nè! 🎧✨\n\n` +
            `• 🍏 **Nên chọn Apple AirPods Pro 2 (USB-C):**\n` +
            `  - **Hệ sinh thái:** Chân ái nếu bạn dùng iPhone, iPad, MacBook vì chuyển đổi thiết bị liền mạch 1 chạm tức thì.\n` +
            `  - **Đàm thoại:** Mic thu âm lọc tiếng gió và tiếng ồn xung quanh tốt nhất thế giới, gọi điện/họp Meet cực kỳ rõ tiếng.\n` +
            `  - **Âm thanh:** Âm thanh vòm cá nhân hóa Spatial Audio theo dõi cử động đầu sống động như rạp phim.\n\n` +
            `• 🎵 **Nên chọn Sony WF-1000XM5:**\n` +
            `  - **Chất âm Audiophile:** Màng loa Dynamic Driver X cao cấp hỗ trợ Codec Hi-Res LDAC cho dải bass sâu uy lực và độ chi tiết nhạc cụ tuyệt đỉnh.\n` +
            `  - **Chống ồn ANC đỉnh chóp:** Đệm mút bọt biển cách âm độc quyền kết hợp chip xử lý kép V2 & QN2e triệt tiêu tiếng ồn môi trường gần như tuyệt đối.\n\n` +
            `👉 Bạn đang dùng điện thoại iPhone hay Android để em chọn chiếc tai nghe đồng bộ hoàn hảo nhất cho bạn nhé! 😊`,
        suggestions: ['Xem AirPods Pro 2 USB-C', 'Xem tai nghe Sony chính hãng', 'Tư vấn phụ kiện âm thanh']
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
    },

    // 5.9 Mua MacBook 8GB RAM có đủ dùng không hay nên lấy 16GB?
    {
        id: 'advice_macbook_ram_8gb_vs_16gb',
        patterns: [
            /(macbook|mac).*(8gb.*16gb|8gb ram.*du khong|8gb.*du dung)/i,
            /(nen mua macbook).*(8gb hay 16gb|16gb hay 8gb)/i
        ],
        keywords: [
            'macbook 8gb ram co du khong', 'nen mua macbook 8gb hay 16gb',
            'macbook 8gb co yeu khong', '8gb ram macbook co thieu khong',
            'co nen mua macbook 8gb ram khong'
        ],
        reply: `Dạ đây là nỗi băn khoăn lớn nhất của hầu hết người dùng khi chọn mua MacBook nè! Em xin phân tích thẳng thắn và khách quan nha: 🍏💻\n\n` +
            `• 📂 **Khi nào 8GB RAM là đủ?** Nếu bạn chỉ làm việc văn phòng cơ bản, gõ Word/Excel, lướt web 10 – 15 tab, xem YouTube 4K, gọi họp Zoom/Meet và chỉnh sửa ảnh Canva nhẹ nhàng. Nhờ kiến trúc bộ nhớ hợp nhất (Unified Memory) và macOS tối ưu rất tốt, 8GB vẫn chạy mượt mà.\n\n` +
            `• 🚀 **KHI NÀO BẮT BUỘC NÊN LẤY 16GB RAM?**\n` +
            `  1. Bạn làm Marketing, Content Creator cần mở 30 – 50 tab trình duyệt cùng lúc kèm Photoshop, Illustrator, Premiere hoặc CapCut 4K.\n` +
            `  2. Bạn học/làm Lập trình CNTT (chạy Docker, VS Code, máy ảo iOS Simulator).\n` +
            `  3. Bạn muốn đầu tư một chiếc máy dùng bền bỉ, mượt mà **suốt 4 – 6 năm tới** mà không lo đầy RAM hay máy phải hoán đổi bộ nhớ (Swap) vào ổ SSD làm giảm tuổi thọ ổ cứng.\n\n` +
            `💡 Đặc biệt, từ dòng M3/M4, Apple đã nâng tiêu chuẩn khởi điểm lên 16GB RAM với mức giá không đổi. Bạn dự kiến dùng máy cho ngành nghề gì để em tư vấn bản tiết kiệm nhất nhé! 😊`,
        suggestions: ['Xem MacBook Air M3 16GB', 'Xem MacBook Pro M3', 'Hotline 0842.331.606']
    },

    // 5.10 Sạc nhanh 67W, 100W, 120W có làm chai pin điện thoại không?
    {
        id: 'advice_fast_charging_battery_harm',
        patterns: [
            /(sac nhanh).*(chai pin|hai pin|hai may|chay no|co sao khong)/i,
            /(sac 67w|sac 100w|sac 120w).*(co hai pin khong|co chai pin)/i
        ],
        keywords: [
            'sac nhanh co chai pin khong', 'dung sac nhanh co hai may khong',
            'sac 120w co chai pin nhanh khong', 'sac nhanh co no khong',
            'sac cong suat cao co hai pin khong'
        ],
        reply: `Dạ em xin khẳng định chuẩn kỹ thuật: **Sạc nhanh chính hãng HOÀN TOÀN KHÔNG LÀM CHAI PIN NHANH** hay gây hại cho máy đâu bạn nhé! ⚡🛡️\n\n` +
            `🔬 **Nguyên lý hoạt động thông minh:**\n` +
            `• **Chia giai đoạn sạc:** Máy chỉ sạc công suất cực đại (67W - 120W) từ **0% đến khoảng 60% - 70%** trong 15 - 20 phút đầu (khi cell pin còn rỗng và mát). Sau đó chip sạc sẽ tự động hạ dòng điện nhỏ giọt để giữ nhiệt độ pin luôn dưới ngưỡng an toàn 40°C.\n` +
            `• **Cảm biến nhiệt kép:** Các dòng điện thoại đời mới tích hợp từ 5 – 10 cảm biến nhiệt độ độc lập, nếu máy ấm lên quá mức cho phép, chip sẽ tự giảm công suất ngay lập tức.\n\n` +
            `💡 **Điều quan trọng nhất:** Hãy dùng đúng **củ cáp sạc chính hãng chuẩn PD/GaN** (như Anker, Apple, Xiaomi, Samsung) và tránh để máy trên đệm/gối bí nhiệt khi sạc nhanh là bạn có thể yên tâm dùng pin bền 3-4 năm thoải mái ạ! 😊`,
        suggestions: ['Xem củ sạc nhanh Anker GaN', 'Xem sạc dự phòng chính hãng', 'Tư vấn phụ kiện an toàn']
    },

    // 5.11 So sánh màn hình OLED / AMOLED vs IPS LCD (Có bị lưu ảnh Burn-in không?)
    {
        id: 'advice_oled_vs_ips_lcd',
        patterns: [
            /(so sanh|khac gi|nen chon).*(oled.*ips|ips.*oled|amoled.*ips)/i,
            /(man hinh oled).*(co bi burn in|co bi luu anh|co ben khong)/i
        ],
        keywords: [
            'so sanh man hinh oled va ips', 'oled va ips cai nao tot hon',
            'man hinh oled co bi luu anh khong', 'burn in tren oled',
            'co nen mua man hinh oled khong', 'man oled hay ips ben hon'
        ],
        reply: `Dạ hai công nghệ màn hình này có những đặc tính vượt trội riêng, em xin so sánh chi tiết giúp bạn dễ chọn nha: 📺✨\n\n` +
            `• 🌟 **Màn hình OLED / Dynamic AMOLED:**\n` +
            `  - **Ưu điểm:** Mỗi điểm ảnh tự phát sáng độc lập nên màu đen sâu tuyệt đối (tương phản vô cực), màu sắc rực rỡ nịnh mắt, siêu mỏng và tiết kiệm pin khi dùng chế độ Dark Mode.\n` +
            `  - **Về nỗi lo Burn-in (lưu ảnh):** Trên các dòng máy hiện đại (Super Retina XDR của Apple, Dynamic AMOLED 2X của Samsung), hãng đã tích hợp thuật toán **Pixel Shift (tự dịch chuyển điểm ảnh vi mô)** và cơ chế cân bằng điện áp, nên trong điều kiện sử dụng bình thường tỉ lệ lưu ảnh gần như bằng 0!\n\n` +
            `• 🖥️ **Màn hình IPS LCD:**\n` +
            `  - **Ưu điểm:** Dùng đèn nền LED chiếu sáng nên độ bền vật lý cực cao, màu sắc hiển thị trung thực chuẩn màu đồ họa in ấn và chi phí thay thế rất hợp lý.\n\n` +
            `💡 **Lời khuyên:** Nếu thích xem phim bom tấn, chơi game đồ họa đẹp và trải nghiệm thị giác đỉnh chóp, bạn hãy tự tin chọn **OLED** nhé! Còn nếu làm việc đồ họa in ấn chuẩn màu cả ngày thì **IPS cao cấp** là bạn đồng hành tuyệt vời! 😊`,
        suggestions: ['Xem điện thoại màn hình AMOLED 120Hz', 'Xem Laptop màn hình OLED', 'Hotline 0842.331.606']
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
            `Cảm ơn bạn đã hỏi thăm ân cần, nghe ấm lòng ghê luôn á! Còn bạn đã dùng bữa chưa nè? Nhớ ăn uống đầy đủ giữ gìn sức khỏe nha. Hôm nay bạn ghé cửa hàng ngắm nghía món đồ công nghệ nào để tự thưởng cho bản thân sau giờ làm việc không, em tư vấn nhiệt tình cho bạn nhé! 😊`,
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
            `Riêng các đơn hàng tại cửa hàng bên em thì bạn hoàn toàn yên tâm: Shipper luôn bọc gói hàng bằng **túi zip chống nước 100% chuyên dụng** và hộp carton cứng cáp, dù mưa to bão bùng cỡ nào hàng tới tay bạn vẫn khô ráo, nguyên seal vẹn nguyên nhé! Bạn đang cần em giao hỏa tốc mẫu nào không ạ?`,
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
        reply: `Dạ 'người yêu' lý tưởng của em chính là dàn siêu phẩm iPhone titan, laptop gaming và tai nghe chống ồn trong kho của shop em đó bạn ơi! 🥰\n\n` +
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
        reply: `Dạ em là **Trợ lý AI Mua sắm của cửa hàng**! 🤖✨\n\n` +
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
            `Khi nào bạn có nhu cầu sắm máy, cửa hàng bên em luôn có sẵn:\n` +
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
            `Khi nào rảnh rỗi hoặc cần hỗ trợ bất kỳ thiết bị công nghệ nào, cửa hàng bên em luôn sẵn sàng đón bạn 24/7. Hẹn sớm gặp lại bạn nè!`,
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
    },

    // 6.12 Khách yêu cầu hát một bài / trổ tài văn nghệ
    {
        id: 'chit_chat_ask_sing_song',
        patterns: [
            /(hat|ca).*(mot bai|di em|cho nghe|cho anh nghe|cho chi nghe|bai gi)/i,
            /(em biet hat khong|hat di|hat karaoke)/i
        ],
        keywords: [
            'hat di em', 'hat cho anh nghe', 'hat cho chi nghe', 'em biet hat khong',
            'hat mot bai di', 'hat karaoke', 'hat hay khong', 'ca mot bai di'
        ],
        reply: `Dạ em xin trổ tài làm ca sĩ 'cây nhà lá vườn' của cửa hàng gửi tặng bạn bài rap công nghệ vui này nha: 🎶🎤\n\n` +
            `*"Sáng ra lướt xem đồ công nghệ, ✨\n` +
            `Điện thoại xịn xò, giá lại mê!\n` +
            `MacBook, ROG hay Z Fold,\n` +
            `Chính hãng nguyên seal chẳng điểm chê!\n` +
            `Flash Sale trợ giá trao tận ngõ,\n` +
            `Bạn cười rạng rỡ, shop vui ghê!"* 🍀\n\n` +
            `Hihi, giọng rap qua từng con chữ của em có làm bạn bật cười và thư giãn hơn chút nào chưa nè? Cần em tư vấn dàn tai nghe chống ồn hay loa Bluetooth để nghe nhạc chill chill thì cứ bảo em nhé! 🥰`,
        suggestions: ['Xem tai nghe AirPods Pro', 'Xem loa Bluetooth JBL / Marshall', 'Xem ưu đãi hôm nay']
    },

    // 6.13 Tư vấn mua quà tặng Người yêu / Crush / Bạn gái / Bố mẹ
    {
        id: 'chit_chat_gift_for_crush_lover',
        patterns: [
            /(tang qua|mua qua).*(nguoi yeu|crush|ban gai|ban trai|sinh nhat ban|vo|chong|bo me)/i,
            /(sinh nhat).*(tang may gi|tang gi)/i
        ],
        keywords: [
            'tang qua nguoi yeu', 'mua qua cho crush', 'qua sinh nhat ban gai cong nghe',
            'tang gi cho ban trai', 'mua dien thoai tang me', 'mua qua sinh nhat',
            'tang qua cong nghe'
        ],
        reply: `Dạ bạn quả là một người cực kỳ tâm lý và chu đáo luôn nè! Tặng quà công nghệ vừa sang trọng, vừa mang tính ứng dụng cao hàng ngày: 🎁💖\n\n` +
            `✨ **Gợi ý quà tặng chuẩn bài theo từng đối tượng:**\n` +
            `• 🌸 **Tặng Bạn gái / Crush nữ:**\n` +
            `  - iPhone 16 / iPhone 15 màu Hồng Pastel hoặc Titan Sa Mạc xinh xắn kiêu kỳ.\n` +
            `  - Tai nghe AirPods Pro 2 hoặc Đồng hồ Apple Watch thời trang giúp theo dõi sức khỏe và giấc ngủ.\n` +
            `• 🚀 **Tặng Bạn trai / Chồng:**\n` +
            `  - Máy chơi game Nintendo Switch OLED mang lại phút giây giải trí xả stress.\n` +
            `  - Chuột không dây công thái học Logitech MX Master 3S hoặc Tai nghe Gaming chống ồn.\n` +
            `• 👵 **Tặng Bố Mẹ / Phụ huynh:**\n` +
            `  - Điện thoại Samsung Galaxy màn hình lớn 6.7 inch, loa to rõ, pin 5.000mAh dùng 2 ngày không lo hết pin.\n\n` +
            `👉 Shop có hỗ trợ **Gói quà thiệp chúc mừng miễn phí** khi giao hàng đó ạ! Bạn định tặng cho ai và ngân sách khoảng bao nhiêu để em chọn món quà ngọt ngào nhất nhé! 😊`,
        suggestions: ['Xem Apple Watch chính hãng', 'Xem AirPods Pro 2', 'Tư vấn quà tặng người yêu', 'Hotline 0842.331.606']
    },

    // 6.14 Khách xin số điện thoại, Zalo làm quen hoặc rủ đi cà phê
    {
        id: 'chit_chat_ask_phone_zalo_date',
        patterns: [
            /(xin so|cho anh xin so|cho em xin so|cho so).*(dien thoai|zalo|de lam quen)/i,
            /(di cafe|hen ho|lam quen|tra sua).*(khong em|voi anh|voi em)/i
        ],
        keywords: [
            'cho xin so dien thoai em', 'cho xin zalo lam quen', 'di cafe khong em',
            'lam ban voi anh nhe', 'em de thuong the cho xin so', 'ket ban zalo voi em',
            'xin so lam quen'
        ],
        reply: `Dạ em là Trợ lý AI công nghệ kiêm 'chuyên viên săn deal' đáng yêu của cửa hàng nè! ☕📱\n\n` +
            `Em luôn túc trực 24/7 trên màn hình để tâm tình, trò chuyện và tư vấn công nghệ cùng bạn mọi lúc mọi nơi bất kể ngày đêm luôn á! 🥰\n\n` +
            `Còn nếu bạn muốn kết bạn Zalo hoặc 'hẹn hò' qua đường dây nóng để được các bạn tư vấn viên người thật xinh xắn của shop tư vấn chuyên sâu 1-1 thì hotline Zalo chính thức của shop là **0842.331.606** nha! Em sẽ lưu tên bạn vào danh sách khách hàng VIP thân thiết liền nè! ✨`,
        suggestions: ['Hotline Zalo 0842.331.606', 'Xem ưu đãi hôm nay', 'Địa chỉ Showroom']
    },

    // 6.15 Khách mệt mỏi, áp lực deadline, cần lời động viên
    {
        id: 'chit_chat_motivation_cheerup',
        patterns: [
            /(ap luc|stress|deadline|met moi|chan qua|buon qua|nan qua|chuc mot ngay)/i,
            /(dong vien|an ui).*(anh|chi|em)/i
        ],
        keywords: [
            'hom nay met qua', 'ap luc deadline qua', 'chan nan qua em oi',
            'buon qua khong biet noi cung ai', 'an ui em di', 'met moi qua', 'stress qua em oi'
        ],
        reply: `Dạ em xin gửi bạn một cái ôm tinh thần thật ấm áp nha! 🌸🤗\n\n` +
            `Cuộc sống và công việc đôi khi thật nhiều áp lực, bài vở hay deadline dồn dập khiến mình cảm thấy kiệt sức... Nhưng bạn ơi, bạn đã rất nỗ lực và kiên cường vượt qua ngần ấy thời gian rồi đó!\n\n` +
            `Bạn hãy tạm gác lại mọi việc một lát, uống một ngụm nước mát, hít một hơi thật sâu và ăn món mình thích nha. Đừng quá khắt khe với bản thân, bạn đang làm rất tốt rồi! Sau cơn mưa cầu vồng sẽ xuất hiện rực rỡ, em luôn ở đây lắng nghe và cổ vũ bạn 100% nè! Cố lên bạn nhé! 💪✨`,
        suggestions: ['Xem sản phẩm giải trí', 'Tư vấn tai nghe chill', 'Xem ưu đãi hôm nay']
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
        if (rule.id === 'color_best_seller_trend') {
            // Guard against "mẫu nào" (which model/machine) being confused with "màu nào" (color)
            if (/\b(?:mẫu|mẫu\s+nào|mẫu\s+gì|mẫu\s+máy|mẫu\s+phù\s+hợp|con\s+nào|máy\s+nào)\b/i.test(cleanMsg) ||
                /\b(?:mau\s+nao\s+phu\s+hop|mau\s+may|con\s+nao\s+phu\s+hop|may\s+nao\s+phu\s+hop|choi\s+game|nam\s+choi|hoc\s+tap|van\s+phong|do\s+hoa)\b/i.test(unaccented)) {
                return false;
            }
        }
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
    BUDGET_AND_CONSULTATION_RULES,
    OBJECTION_RULES,
    HARDWARE_AND_SOFTWARE_RULES,
    COMPARISON_AND_FENGSHUI_RULES,
    TECH_TIP_RULES,
    CHIT_CHAT_RULES
};
