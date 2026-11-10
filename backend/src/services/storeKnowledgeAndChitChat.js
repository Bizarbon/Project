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
            /(thu cu|trade[\s-]?in|doi may cu).*(moi|cu|khong|gia|the nao)/i,
            /(co|nhan|ho tro).*(thu cu|trade[\s-]?in|thu lai)/i,
            /(chuong trinh|chinh sach).*(thu cu|len doi)/i
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
            /(bao hanh|chinh sach bao hanh).*(roi vo|vao nuoc|be man hinh|roi rot)/i,
            /bao hanh vang/i
        ],
        keywords: [
            'bao hanh vang', 'bao hanh vao nuoc', 'bao hanh roi vo', 'co bao hanh vao nuoc khong',
            'co bao hanh roi vo khong', 'bao hanh roi rot', 'bao hanh be man hinh', 'bao hanh vip', 'bao hanh mo rong'
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
            `👉 Địa chỉ Showroom duy nhất của cửa hàng tại: **78 Nguyễn Văn Khối, Quận Gò Vấp, Thành phố Hồ Chí Minh**. Bạn muốn đặt giữ mẫu máy nào để em báo nhân viên chuẩn bị sẵn đón tiếp bạn chu đáo nhé! 😊`,
        suggestions: ['Showroom 78 Nguyễn Văn Khối Gò Vấp', 'Đặt giữ hàng 24h tại Showroom', 'Hotline 0842.331.606']
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
    },

    // 1.16 Mua số lượng lớn cho công ty / doanh nghiệp (B2B)
    {
        id: 'policy_b2b_corporate_bulk',
        patterns: [
            /(mua|lay|dat).*(so luong lon|cho cong ty|cho doanh nghiep|b2b|du an|van phong)/i,
            /(chiet khau|bao gia).*(cong ty|doanh nghiep|so luong lon)/i
        ],
        keywords: [
            'mua so luong lon', 'mua cho cong ty', 'chiet khau doanh nghiep', 'chiet khau b2b',
            'mua may cho van phong', 'bao gia cong ty', 'mua laptop cho cong ty', 'hop dong cong ty'
        ],
        reply: `Dạ cửa hàng bên em có **chính sách ưu đãi và chiết khấu B2B đặc quyền dành riêng cho khách hàng Doanh nghiệp, Công ty & Trường học** ạ! 🏢💼\n\n` +
            `• 💰 **Mức chiết khấu hấp dẫn:** Giảm thêm trực tiếp từ **3% đến 8%** trên tổng giá trị đơn hàng tùy theo số lượng máy.\n` +
            `• 📄 **Hóa đơn & Hợp đồng đầy đủ:** Xuất hóa đơn VAT điện tử hợp pháp ngay trong ngày, ký kết hợp đồng kinh tế và cung cấp chứng nhận xuất xứ (CO/CQ) theo yêu cầu.\n` +
            `• 🚚 **Giao hàng & Lắp đặt tận nơi:** Miễn phí giao hàng hỏa tốc tận văn phòng, kỹ thuật viên hỗ trợ bóc seal, cài đặt phần mềm và chuyển dữ liệu trọn gói.\n` +
            `• 💳 **Chính sách công nợ linh hoạt:** Hỗ trợ thanh toán chuyển khoản doanh nghiệp hoặc bảo lãnh ngân hàng tiện lợi.\n\n` +
            `👉 Quý công ty cần nhận bảng báo giá chi tiết, xin vui lòng gọi ngay chuyên viên B2B qua hotline: **0842.331.606** hoặc gửi danh sách qua email: **support@techecommerce.vn** để được phục vụ chu đáo nhất nhé! 😊`,
        suggestions: ['Hotline B2B 0842.331.606', 'Tư vấn Laptop công ty', 'Chính sách xuất hóa đơn VAT']
    },

    // 1.17 Quẹt thẻ mPOS tại nhà khi nhận hàng
    {
        id: 'policy_pos_payment_at_home',
        patterns: [
            /(quet the|mpos|pos|ca the).*(tai nha|khi nhan hang|tan noi)/i,
            /(nhan hang|giao hang).*(quet the|ca the|mpos)/i
        ],
        keywords: [
            'quet the tai nha', 'co quet the tan noi khong', 'thanh toan quet the khi nhan hang',
            'mang may pos den nha', 'ca the tai nha', 'co mang may quet the khong'
        ],
        reply: `Dạ có ạ! Cửa hàng bên em hỗ trợ **QUẸT THẺ mPOS TẬN NƠI TẠI NHÀ** khi giao hàng cực kỳ tiện lợi và an toàn nhé! 💳🏠\n\n` +
            `• 🚚 **Nhân viên mang máy POS đến tận nơi:** Khi shipper giao máy, bạn được quyền kiểm tra máy nguyên seal, mở hộp đồng kiểm, sau đó nhân viên sẽ quẹt thẻ thanh toán tại chỗ.\n` +
            `• 💳 **Hỗ trợ mọi loại thẻ:** Chấp nhận tất cả thẻ ATM nội địa (NAPAS), thẻ tín dụng/ghi nợ quốc tế (Visa, MasterCard, JCB) và thanh toán chạm Apple Pay / Google Pay.\n` +
            `• ⚡ **Cách đặt dịch vụ:** Khi đặt hàng trên website hoặc nhắn tư vấn viên, bạn chỉ cần chọn hoặc ghi chú *"Thanh toán quẹt thẻ mPOS tại nhà"* là shipper sẽ chuẩn bị sẵn máy quẹt thẻ mang theo nhé!\n\n` +
            `👉 Bạn đang quan tâm đến sản phẩm nào để em hỗ trợ lên đơn giữ hàng cho bạn nha! 😊`,
        suggestions: ['Kiểm tra hàng trước thanh toán', 'Tư vấn trả góp 0%', 'Hotline 0842.331.606']
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
    },

    // 2.4 Khách bảo: "Sợ vợ mắng", "Vợ không cho mua", "Về xin phép vợ"
    {
        id: 'objection_wife_afraid',
        patterns: [
            /(vo|ba xa|noc nha).*(khong cho|chui|mang|so vo|hoi vo|xin phep)/i,
            /(so|hoi y kien).*(vo|ba xa|noc nha)/i
        ],
        keywords: [
            'vo khong cho mua', 'so vo mang', 'de hoi vo da', 'so noc nha',
            've xin phep vo', 'vo khong dong y', 'so vo biet', 'so ba xa mang'
        ],
        reply: `Dạ em thấu hiểu tâm lý của các anh 'yêu vợ, thương gia đình' lắm luôn ạ! 🤭 Người đàn ông có trách nhiệm lúc nào cũng nghĩ đến gia đình đầu tiên nè!\n\n` +
            `Tuy nhiên, em xin mách nhỏ anh mấy 'chiêu' cực kỳ tâm lý đảm bảo chị nhà duyệt ngay trong 1 nốt nhạc nha: ✨\n\n` +
            `1. 💼 **'Đầu tư phục vụ công việc & học tập':** Anh có thể chia sẻ máy mới này giúp anh làm việc nhanh gấp đôi, kiếm thêm thu nhập cho gia đình và để các con học tiếng Anh/học online cực kỳ hiệu quả.\n` +
            `2. 💳 **Chọn gói Trả góp 0% chia nhỏ chi phí:** Mỗi tháng chỉ trích ra vài trăm nghìn đồng tiền cà phê là đã có máy xịn dùng ngay, quỹ sinh hoạt gia đình hoàn toàn không bị ảnh hưởng.\n` +
            `3. 🎁 **Chọn màu sắc chị thích:** Chọn máy màu Hồng hoặc Titan Sa Mạc sang trọng, thỉnh thoảng đưa máy cho chị chụp ảnh selfie/sống ảo siêu đẹp là chị khen anh tâm lý hết lời luôn đó ạ!\n\n` +
            `👉 Anh đang ngắm chiếc máy nào, em tư vấn thêm ưu đãi và phương án thanh toán êm đẹp nhất cho anh nhé! 😊`,
        suggestions: ['Tư vấn Trả góp 0%', 'Thu cũ đổi mới trợ giá 2tr', 'Xem sản phẩm hot trend', 'Hotline 0842.331.606']
    },

    // 2.5 Khách bảo: "Chờ lương về", "Đầu tháng sau mới mua"
    {
        id: 'objection_wait_for_salary',
        patterns: [
            /(cho|doi|bao gio).*(co luong|luong ve|dau thang|linh luong).*(mua|moi mua)/i,
            /(dau thang sau|cuoi thang).*(co luong|linh luong)/i
        ],
        keywords: [
            'cho luong ve', 'dau thang co luong mua', 'doi linh luong da',
            'cho lanh luong', 'dau thang sau mua', 'khi nao co luong thi mua', 'cho co tien moi mua'
        ],
        reply: `Dạ em chúc anh/chị tháng này lãnh lương thưởng thật rực rỡ và trọn vẹn niềm vui nha! 🍀💵\n\n` +
            `Để tránh việc sang đầu tháng sau các chương trình khuyến mãi, voucher trợ giá hay quà tặng kèm bị hết số lượng:\n` +
            `• 🔒 **Shop hỗ trợ GIỮ MÃ GIẢM GIÁ & GIÁ ƯU ĐÃI TRƯỚC HOÀN TOÀN MIỄN PHÍ:** Bạn không cần phải đặt cọc trước bất kỳ đồng nào đâu ạ!\n` +
            `• ⚡ **Lương về là máy tới ngay:** Bạn chỉ cần để lại thông tin và mẫu máy ưng ý, khi nào tiền ting ting về tài khoản, bạn chỉ cần bấm xác nhận là máy được giao hỏa tốc đến tận tay bạn trong ngày luôn nhé!\n\n` +
            `👉 Bạn đang ưng ý mẫu máy hoặc cấu hình nào nhất để em giữ deal hời này cho bạn trước nha! 😊`,
        suggestions: ['Đặt giữ hàng 24h miễn phí', 'Săn voucher giảm giá', 'Tư vấn sản phẩm hot', 'Hotline 0842.331.606']
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

    // 3.1b Máy tính bảng tặng kèm bút là sao / Bút cảm ứng trong hộp
    {
        id: 'tablet_bundled_stylus_pen',
        patterns: [
            /(tang kem but|kem but|tang but|kem theo but|co but khong|co kem but|co but cam ung).*(la sao|la gi|the nao|nhu the nao|nghia la|ra sao)/i,
            /(may tinh bang|tablet).*(tang kem but|kem but|tang but|co kem but|co but)/i,
            /^(tang kem but la sao|kem but la sao|tang but la sao|may tinh bang tang kem but la sao|tablet tang kem but la sao)$/i
        ],
        keywords: [
            'tang kem but la sao', 'kem but la sao', 'tang but la sao', 'may tinh bang tang kem but la sao',
            'tablet tang kem but', 'but cam ung kem theo la gi', 'but trong hop la sao', 'tablet nao kem but',
            'may tinh bang co kem but khong', 'lenovo tab m11 kem but la sao', 'tang kem but la nhu the nao'
        ],
        reply: `Dạ "Tặng kèm bút" (hoặc Kèm bút) đối với máy tính bảng nghĩa là bên trong hộp máy nguyên seal khi xuất xưởng **ĐÃ CÓ SẴN CÂY BÚT CẢM ỨNG CHÍNH HÃNG** đi kèm theo máy, bạn mở hộp ra là dùng được ngay mà **KHÔNG CẦN CHI THÊM TIỀN** mua riêng bút ngoài ạ! ✍️📦\n\n` +
            `✨ **LỢI ÍCH VƯỢT TRỘI KHI CHỌN TABLET TẶNG KÈM BÚT:**\n` +
            `• 💰 **Tiết kiệm từ 1.500.000 ₫ – 3.500.000 ₫:** Khác với dòng máy không kèm bút (như Apple iPad), bạn tiết kiệm được khoản chi phí phụ kiện rất lớn.\n` +
            `• 📝 **Học tập & Ghi chép tức thì:** Hỗ trợ chống tì đè lòng bàn tay (Palm Rejection) giúp tì tay lên màn hình viết vẽ tự nhiên như trên giấy thật, ghi chú trực tiếp vào tài liệu PDF / Word.\n` +
            `• 🎨 **Phác thảo & Vẽ đồ họa:** Cảm ứng lực nhạy bén, nét vẽ đậm nhạt chuẩn xác theo lực tay.\n\n` +
            `🏆 **CÁC DÒNG TABLET TẠI TECHECOMMERCE:**\n` +
            `1. 🌟 **Dòng ĐÃ KÈM SẴN BÚT trong hộp (Mở hộp dùng ngay, siêu tiết kiệm):**\n` +
            `   • 📝 **Lenovo Tab M11 Kèm Bút (4.290.000 ₫):** Tặng sẵn bút Lenovo Tab Pen, màn hình 11 inch 90Hz, 4 loa Dolby Atmos to rõ, kinh tế nhất cho học sinh - sinh viên.\n` +
            `   • 💎 **Samsung Galaxy Tab S9 Ultra (25.990.000 ₫):** Tặng sẵn bút S-Pen cao cấp trong hộp, kháng nước IP68, độ trễ 2.8ms siêu nhạy, không cần sạc pin cho bút.\n` +
            `2. ⚠️ **Dòng KHÔNG KÈM BÚT trong hộp (Dòng Apple iPad):**\n` +
            `   • 🍎 **iPad Gen 10 (8.990.000 ₫), iPad Air M2, iPad Pro M4:** Trong hộp chỉ có máy và củ/cáp sạc. Nếu muốn viết vẽ, bạn cần mua riêng bút **Apple Pencil chính hãng** (từ 1.890.000 ₫ – 3.490.000 ₫).\n\n` +
            `👉 Bạn dự kiến dùng máy chủ yếu để học tập hay vẽ đồ họa, và ngân sách khoảng bao nhiêu triệu để em tư vấn mẫu phù hợp nhất nhé! 😊`,
        suggestions: ['Xem Lenovo Tab M11 Kèm Bút', 'Xem Galaxy Tab S9 Ultra', 'So sánh iPad vs Samsung Tab', 'Tư vấn Tablet học tập']
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
    },

    // 3.7 Đang dùng iPhone cũ (11, 12, 13, 14) có nên lên đời iPhone 16 không?
    {
        id: 'advice_iphone_upgrade_decision',
        patterns: [
            /(iphone 11|iphone 12|iphone 13|iphone 14).*(co nen len|co nen doi|len doi|khac gi).*(iphone 16|16 pro|16 pro max)/i,
            /(dang dung|dang sai).*(iphone 11|iphone 12|iphone 13).*(co nen mua|co nen len)/i
        ],
        keywords: [
            'iphone 11 co nen len 16', 'iphone 12 len 16 khac gi', 'iphone 13 co nen len iphone 16 khong',
            'tu 11 len 16 co nen khong', 'dang dung 12 co nen len 16', 'co nen doi tu iphone 13 len 16'
        ],
        reply: `Dạ nếu bạn đang dùng các đời iPhone 11, 12 hoặc 13 thì việc nâng cấp lên **iPhone 16 Series** sẽ là một bước nhảy vọt toàn diện 'đáng đồng tiền bát gạo' nhất đấy ạ! 🍏🚀\n\n` +
            `✨ **Những bước chuyển mình khác biệt một trời một vực:**\n` +
            `• 🔌 **Cổng sạc Type-C đa năng:** Thay thế hoàn toàn cổng Lightning cũ, giờ đây bạn dùng chung 1 sợi cáp sạc cho cả iPhone, MacBook, iPad và tai nghe.\n` +
            `• 🏝️ **Màn hình Dynamic Island:** Loại bỏ tai thỏ thô kệch, hiển thị thông báo cuộc gọi, Grab, đồng hồ đếm giờ cực kỳ thông minh.\n` +
            `• 📸 **Camera 48MP siêu nét & Nút Camera Control:** Bắt nét tức thì, chụp đêm sáng rõ không nhiễu hạt, zoom quang học sắc nét vượt trội.\n` +
            `• 🔋 **Pin trâu hơn từ 4 - 6 tiếng:** Nếu máy cũ của bạn pin đã chai dưới 80% hoặc hay nóng ran khi dùng, iPhone 16 với chip A18 3nm sẽ mát rượi và onscreen cả ngày dài.\n\n` +
            `💡 **Chính sách Thu cũ đổi mới:** Cửa hàng bên em hỗ trợ định giá máy cũ lên đến 85% và **trợ giá thêm 2.000.000đ** khi lên đời iPhone 16. Bạn có muốn em hỗ trợ định giá máy cũ của mình không nè? 😊`,
        suggestions: ['Thu cũ đổi mới trợ giá 2tr', 'Xem iPhone 16 chính hãng', 'Xem iPhone 16 Pro Max', 'Hotline 0842.331.606']
    },

    // 3.8 Đang dùng MacBook chip Intel có nên đổi sang chip M (M2 / M3 / M4) không?
    {
        id: 'advice_macbook_intel_to_m_series',
        patterns: [
            /(macbook|mac).*(intel).*(m1|m2|m3|m4|apple silicon|co nen doi|co nen len)/i,
            /(tu chip intel|macbook intel).*(sang chip m|sang macbook m)/i
        ],
        keywords: [
            'macbook intel co nen len chip m', 'mac intel co nen doi macbook m2 khong',
            'tu macbook intel sang m3', 'macbook intel cham qua co nen doi'
        ],
        reply: `Dạ em khuyên bạn chân thành: **NÊN ĐỔI NGAY VÀ LUÔN, KHÔNG CẦN PHẢI ĐẮN ĐO MỘT GIÂY NÀO NỮA Ạ!** 🍏⚡\n\n` +
            `Sự khác biệt giữa MacBook chip Intel và MacBook chip Apple Silicon (M2 / M3 / M4) được xem là cuộc cách mạng lớn nhất lịch sử máy tính cá nhân:\n` +
            `• ❄️ **Nhiệt độ mát rượi:** MacBook Intel đời cũ nổi tiếng là chiếc 'lò sưởi' nóng rát tay và quạt hú ầm ĩ. Sang dòng chip M, máy vận hành êm ru tuyệt đối và luôn mát lạnh dù mở hàng chục ứng dụng.\n` +
            `• 🔋 **Thời lượng pin gấp 3 lần:** Từ 4 - 5 tiếng trên máy Intel tăng vọt lên **15 – 18 tiếng liên tục** trên chip M. Bạn có thể mang máy đi làm cả ngày mà không cần đem theo củ sạc.\n` +
            `• 🚀 **Khởi động tức thì (Instant On):** Mở nắp máy là màn hình sáng lên làm việc ngay trong 0.5 giây như iPhone, không còn hiện tượng con trỏ cầu vồng xoay vòng vòng ức chế.\n\n` +
            `👉 Cửa hàng em có sẵn **MacBook Air M2 và MacBook Air M3** chính hãng với mức giá cực tốt, bạn cần bản 13 inch nhỏ gọn hay 15 inch màn hình lớn để em tư vấn nhé! 😊`,
        suggestions: ['Xem MacBook Air M2 chính hãng', 'Xem MacBook Air M3', 'Thu cũ đổi mới máy tính', 'Hotline 0842.331.606']
    },

    // 3.9 Màn hình 60Hz và 120Hz (ProMotion / 144Hz) khác biệt gì, có đáng tiền không?
    {
        id: 'advice_screen_60hz_vs_120hz',
        patterns: [
            /(60hz|120hz|144hz).*(khac gi|so sanh|co khac|co dang tien|nen mua)/i,
            /(man hinh 120hz|promotion).*(co khac 60hz|co ngon khong)/i
        ],
        keywords: [
            'man hinh 60hz va 120hz khac gi', 'co nen mua man hinh 120hz',
            'man 120hz co ton pin khong', 'so sanh 60hz va 120hz', 'promotion 120hz co ngon khong'
        ],
        reply: `Dạ sự khác biệt giữa 60Hz và 120Hz (ProMotion / 144Hz) là một trải nghiệm **'đã mắt' đến mức một khi bạn đã dùng quen thì sẽ không bao giờ muốn quay lại 60Hz nữa đâu ạ!** ✨📱\n\n` +
            `• 🧈 **Độ mượt mà 'như bôi bơ':** Màn hình 120Hz quét hình ảnh 120 lần mỗi giây (gấp đôi 60Hz). Mọi thao tác cuộn trang Facebook, lướt web, mở đóng ứng dụng hay vuốt ảnh đều mượt mà trơn tru, không hề có vệt bóng mờ.\n` +
            `• 🎯 **Lợi thế lớn khi chơi game:** Trong các tựa game bắn súng FPS (Valorant, CS2, PUBG) hay MOBA, 120Hz/144Hz giúp bạn nhìn thấy đối phương sớm hơn vài mili-giây, phản xạ nhanh và chuẩn xác hơn rõ rệt.\n` +
            `• 🔋 **Có tốn pin hơn không?** Các dòng máy cao cấp (iPhone Pro, iPad Pro, Galaxy S25 Ultra) đều dùng công nghệ **LTPO thông minh**, tự động hạ tần số quét xuống 1Hz - 10Hz khi xem ảnh tĩnh và chỉ tăng vọt lên 120Hz khi ngón tay bạn vuốt chạm, nên cực kỳ tiết kiệm pin!\n\n` +
            `👉 Bạn đang quan tâm đến điện thoại hay laptop màn hình 120Hz để em gợi ý model phù hợp ngân sách nhất cho bạn nhé! 😊`,
        suggestions: ['Xem iPhone màn hình 120Hz', 'Xem Laptop Gaming 144Hz', 'Tư vấn Samsung Galaxy S25']
    },

    // 3.10 Nên mua iPad bản Wi-Fi hay 4G/5G Cellular?
    {
        id: 'advice_ipad_wifi_vs_cellular',
        patterns: [
            /(ipad).*(wifi hay 4g|wifi hay cellular|4g hay wifi|cellular hay wifi|co nen mua ban 4g)/i,
            /(nen mua ipad).*(wifi hay 4g|wifi hay cellular)/i
        ],
        keywords: [
            'nen mua ipad wifi hay 4g', 'ipad wifi hay cellular tot hon',
            'ipad cellular co can thiet khong', 'ipad wifi dung o ngoai the nao', 'so sanh ipad wifi va 4g'
        ],
        reply: `Dạ đây là câu hỏi mà 90% khách hàng mua iPad đều băn khoăn nè! Em xin phân tích kinh tế và thực tế sử dụng để bạn tiết kiệm chi phí nha: 📲💡\n\n` +
            `• 💰 **Chênh lệch chi phí lớn:** Bản Cellular (4G/5G) thường đắt hơn bản Wi-Fi từ **3.000.000 đ – 4.500.000 đ**, chưa kể bạn phải tốn thêm tiền nạp gói data 4G/5G hàng tháng.\n` +
            `• ☕ **Thực tế sử dụng:** Hầu hết mọi người dùng iPad ở nhà, công ty, trường học hay quán cà phê — những nơi này đều có sẵn Wi-Fi tốc độ cao miễn phí.\n` +
            `• ⚡ **Tính năng chia sẻ mạng 1 chạm (Instant Hotspot):** Khi đi ra ngoài công viên hay trên xe, nếu bạn dùng iPhone hoặc điện thoại Android, bạn chỉ cần bấm mở phát Wi-Fi là iPad tự động kết nối trong 1 giây mà không cần bấm mật khẩu, tiện lợi hệt như máy 4G!\n\n` +
            `💡 **Lời khuyên chân thành từ em:** Bạn nên chọn **bản Wi-Fi**! Khoản tiền 3 - 4 triệu tiết kiệm được, bạn có thể sắm ngay một chiếc **Bút Apple Pencil** để ghi chép vẽ vời hoặc bao da bàn phím cao cấp nhé! 😊`,
        suggestions: ['Xem iPad Gen 10 Wi-Fi', 'Xem iPad Air M2 Wi-Fi', 'Xem bút Apple Pencil', 'Hotline 0842.331.606']
    },

    // 3.11 Nên chọn bộ nhớ dung lượng 128GB, 256GB hay 512GB?
    {
        id: 'advice_storage_128gb_vs_256gb',
        patterns: [
            /(nen mua|chon|so sanh).*(128gb hay 256gb|256gb hay 128gb|128 hay 256|256 hay 512)/i,
            /(128gb).*(co du dung|du dung khong|co it qua khong)/i
        ],
        keywords: [
            'nen mua 128gb hay 256gb', '128gb co du dung khong', 'dien thoai 128gb co it khong',
            'nen chon bo nho bao nhieu gb', 'dung luong 128 hay 256'
        ],
        reply: `Dạ em xin tư vấn theo đúng thói quen dùng máy hàng ngày để bạn chọn dung lượng chuẩn xác, không bị lãng phí nha: 💾📱\n\n` +
            `• 📦 **Bản 128GB (Vừa vặn cho nhu cầu cơ bản):**\n` +
            `  - Phù hợp với: Dân văn phòng, phụ huynh, người chỉ dùng các ứng dụng mạng xã hội (Facebook, Zalo, TikTok), xem phim YouTube/Netflix và chụp ảnh gia đình thường nhật.\n` +
            `  - Lưu ý: Sau 2 - 3 năm, bạn nên dọn dẹp bộ nhớ đệm app Zalo/Telegram định kỳ để máy không bị đầy.\n\n` +
            `• 🚀 **Bản 256GB (LỰA CHỌN VÀNG KHUYÊN DÙNG NHẤT):**\n` +
            `  - Phù hợp với: Hầu hết mọi người! Bạn có thể thoải mái quay video 4K khi đi du lịch, cài đặt nhiều tựa game nặng (Genshin Impact, Liên Quân, PUBG) và dùng bền bỉ 4 – 5 năm mà không bao giờ phải bận tâm đến thông báo 'Bộ nhớ đầy'.\n\n` +
            `• 🎬 **Bản 512GB – 1TB:** Dành riêng cho dân làm nội dung, TikToker, Vlogger thường xuyên quay video 4K 60fps/120fps định dạng ProRes chuyên nghiệp.\n\n` +
            `👉 Bạn thường chụp ảnh quay phim nhiều hay chơi game nặng không để em chọn phiên bản hợp lý nhất cho bạn nhé! 😊`,
        suggestions: ['Xem điện thoại 256GB bán chạy', 'Xem iPhone 16 128GB', 'Tư vấn trả góp 0%']
    },

    // 3.12 Củ sạc nhanh 65W/100W GaN có an toàn khi sạc cho iPhone, điện thoại nhỏ không?
    {
        id: 'advice_gan_charger_safety',
        patterns: [
            /(cu sac|sac).*(65w|100w|140w|gan|cong suat lon).*(sac duoc|sac cho|an toan|co no|so no|hai pin|chai pin)/i,
            /(dung sac laptop|sac macbook).*(sac dien thoai|sac tai nghe).*(duoc khong|co sao khong)/i
        ],
        keywords: [
            'cu sac 100w sac cho iphone duoc khong', 'cu sac 65w co sac duoc dien thoai khong',
            'dung sac macbook sac cho iphone co sao khong', 'cu sac cong suat lon co hai pin khong',
            'sac gan 100w an toan khong', 'cu sac 100w gan sac cho iphone'
        ],
        reply: `Dạ bạn hoàn toàn có thể an tâm 100%: **CỰC KỲ AN TOÀN VÀ HOÀN TOÀN KHÔNG LO NỔ HAY HẠI PIN ĐÂU Ạ!** 🔌🛡️\n\n` +
            `Lý do đến từ công nghệ sạc thông minh hiện đại ngày nay:\n` +
            `• 🤝 **Giao thức bắt tay Power Delivery (PD):** Củ sạc và thiết bị (iPhone, tai nghe, iPad) có chip vi xử lý giao tiếp với nhau. Thiết bị cần nhận tối đa bao nhiêu Watt thì củ sạc chỉ cấp chính xác bấy nhiêu (Ví dụ: cắm tai nghe củ sạc chỉ cấp 2.5W - 5W, cắm iPhone cấp 20W - 27W, cắm MacBook mới cấp đủ 65W - 100W).\n` +
            `• ⚡ **Công nghệ GaN (Gallium Nitride):** Giúp củ sạc nhỏ gọn chỉ bằng nắm tay, tỏa nhiệt cực thấp và tích hợp cảm biến kiểm soát nhiệt độ chống quá dòng, quá áp 24/7.\n` +
            `• 🎒 **Tiện lợi tối đa khi đi du lịch:** Bạn chỉ cần mang **DUY NHẤT 1 củ sạc Anker / Baseus 65W hoặc 100W có 3 cổng** là sạc cùng lúc được cho cả Laptop, Điện thoại và Tai nghe!\n\n` +
            `👉 Cửa hàng em có sẵn củ sạc nhanh Anker GaN chính hãng bảo hành 18 tháng lỗi 1 đổi 1, bạn có muốn xem thử các mẫu sạc này không nè? 😊`,
        suggestions: ['Xem củ sạc Anker GaN 65W', 'Xem củ sạc Anker 100W 3 cổng', 'Xem cáp sạc nhanh Type-C']
    },

    // 3.13 Chuẩn chống nước IP68 / 5ATM có mang đi bơi, tắm biển, xông hơi được không?
    {
        id: 'advice_waterproof_ip68_swimming',
        patterns: [
            /(ip68|chong nuoc|5atm).*(di boi|tam bien|tam ho|xong hoi|ngam nuoc)/i,
            /(co dem|co mang).*(dien thoai|dong ho).*(di boi|tam bien|xong hoi)/i
        ],
        keywords: [
            'dien thoai ip68 co di boi duoc khong', 'dong ho 5atm co tam bien duoc khong',
            'mang dien thoai vao phong xong hoi duoc khong', 'chong nuoc ip68 mang di boi', 'dien thoai chong nuoc co vao nuoc khong'
        ],
        reply: `Dạ đây là lưu ý sống còn mà rất nhiều người dùng hiểu lầm nè! Em xin giải thích thực tế để bảo vệ chiếc máy yêu quý của bạn nha: 🌊⚠️\n\n` +
            `• 🏊 **Chuẩn IP68 trên điện thoại:** Được thử nghiệm trong điều kiện **nước ngọt tĩnh** ở phòng lab. Trong thực tế, nước hồ bơi có hóa chất clo và nước biển có muối ăn mòn cực mạnh màng loa và cổng sạc kim loại. Đặc biệt, **nước nóng và phòng xông hơi** có hơi nước siêu mịn làm nở gioăng cao su ngấm thẳng vào bo mạch.\n` +
            `• ⌚ **Đối với Smartwatch chuẩn 5ATM / 50 mét:** Được thiết kế để bơi lội trong hồ bơi nước ngọt. Sau khi bơi, bạn nên dùng tính năng *Đẩy nước khỏi màng loa (Water Eject)* và tráng lại bằng nước sạch.\n\n` +
            `💡 **Lời khuyên chuẩn mực từ em:** Khả năng kháng nước sinh ra là để **'cứu sinh mạng' cho chiếc máy** khi vô tình gặp mưa to, đổ ly nước hay rơi vào bồn nước. Bạn **TUYỆT ĐỐI KHÔNG NÊN cố ý mang điện thoại đi lặn biển hay chụp ảnh dưới đáy hồ bơi** vì nếu vào nước, tất cả các hãng đều từ chối bảo hành theo quy định toàn cầu nhé!`,
        suggestions: ['Xem đồng hồ thể thao bơi lội', 'Chính sách bảo hành vàng rơi vỡ vào nước', 'Hotline 0842.331.606']
    },

    // 3.14 Tư vấn Combo thiết bị cho dân làm TikToker, YouTuber, Vlogger, Livestream bán hàng
    {
        id: 'advice_creator_vlogger_setup',
        patterns: [
            /(tiktoker|vlogger|youtuber|quay vlog|livestream|sang tao noi dung|quay video).*(nen mua may gi|combo gi|thiet bi gi|can nhung gi)/i,
            /(muon lam|hoc lam).*(tiktok|youtube|vlog).*(mua may gi|tu van thiet bi)/i
        ],
        keywords: [
            'muon lam tiktoker nen mua may gi', 'thiet bi quay vlog youtube', 'combo quay video livestream',
            'tu van thiet bi quay tiktok', 'may quay cho content creator', 'combo quay phim di dong'
        ],
        reply: `Dạ chào bạn, thế giới Sáng tạo nội dung (Content Creator, TikTok, YouTube, Reels) đang cực kỳ bùng nổ luôn nè! 🎬✨ Để có những thước phim triệu view triệu tim chuyên nghiệp, em xin gợi ý **Combo thiết bị chuẩn phòng thu di động** đang được các Top Creator tin dùng nhất hiện nay:\n\n` +
            `1. 📹 **Camera Gimbal bỏ túi số 1: DJI Osmo Pocket 3 Creator Combo**\n` +
            `   • Cảm biến 1 inch đỉnh chóp, quay 4K/120fps siêu nét, chống rung 3 trục cơ học đi bộ chạy nhảy thước phim vẫn êm ru như phim điện ảnh.\n` +
            `   • Màn hình xoay ngang dọc 2 inch trực quan, tự động bám nét khuôn mặt thông minh.\n\n` +
            `2. 📱 **Smartphone quay chụp Flagship: iPhone 16 Pro Max**\n` +
            `   • Quay phim chuẩn điện ảnh 4K 120fps Dolby Vision, nút Camera Control chụp quay tức thì và 4 mic thu âm chuẩn studio lọc tiếng gió chuyên sâu.\n\n` +
            `3. 🎙️ **Micro thu âm không dây: DJI Mic 2 (2 TX + 1 RX)**\n` +
            `   • Thu âm trong vắt, tích hợp tính năng lọc ồn AI cực đỉnh dù bạn đứng quay giữa phố đông đúc hay quán cafe ồn ào.\n\n` +
            `👉 Bạn đang dự định làm kênh về chủ đề gì (du lịch, ẩm thực, làm đẹp hay bán hàng livestream) và tầm ngân sách bao nhiêu để em chọn combo tối ưu nhất nhé! 😊`,
        suggestions: ['Xem DJI Osmo Pocket 3', 'Xem Micro DJI Mic 2', 'Xem iPhone 16 Pro Max', 'Tư vấn Gimbal chống rung']
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
    },

    // 4.7 So sánh Máy chơi game: PS5 Slim vs Nintendo Switch OLED vs Steam Deck OLED
    {
        id: 'compare_ps5_vs_switch_vs_steamdeck',
        patterns: [
            /(so sanh|nen mua).*(ps5.*switch|switch.*ps5|ps5.*steam deck|steam deck.*switch|may choi game nao)/i,
            /(nen mua may choi game).*(ps5 hay nintendo|nintendo hay steam deck)/i
        ],
        keywords: [
            'nen mua ps5 hay nintendo switch', 'so sanh ps5 va nintendo switch',
            'nen mua switch hay steam deck', 'may choi game nao dang mua nhat', 'ps5 va steam deck nen mua con nao'
        ],
        reply: `Dạ đây là 3 'ông vua' của 3 thế giới chơi game hoàn toàn khác nhau nè! Em xin so sánh thực tế để bạn chọn đúng phong cách giải trí của mình nha: 🎮✨\n\n` +
            `• 🏰 **Sony PlayStation 5 Slim (PS5) — Đồ họa 4K đỉnh nóc tại phòng khách:**\n` +
            `  - Dành cho bạn thích cắm TV màn hình lớn 55 - 75 inch trong phòng khách.\n` +
            `  - Chiến các siêu phẩm đồ họa bom tấn mãn nhãn: Black Myth: Wukong, God of War, Spider-Man 2, GTA V, đá FIFA/FC 25 cùng bạn bè.\n` +
            `  - Tay cầm DualSense rung phản hồi xúc giác chân thực từng bước chân.\n\n` +
            `• 🍄 **Nintendo Switch OLED — Niềm vui gia đình & Tiệc tùng di động:**\n` +
            `  - Dành cho gia đình, cặp đôi hoặc bạn bè thích chơi chung với các tựa game độc quyền siêu vui: Mario Kart, Zelda, Pokemon, Overcooked.\n` +
            `  - Tháo 2 tay cầm Joy-Con chia cho 2 người chơi mọi lúc mọi nơi, mang đi du lịch máy bay cực kỳ nhỏ gọn.\n\n` +
            `• 💻 **Steam Deck OLED — Cỗ máy PC cầm tay cho game thủ:**\n` +
            `  - Dành cho bạn đã có sẵn thư viện game bản quyền trên Steam (PC), muốn nằm trên giường hoặc ra quán cà phê cày game PC mượt mà.\n\n` +
            `👉 Bạn thích chơi game bom tấn cắm TV lớn hay thích máy cầm tay mang đi lại tiện lợi để em tư vấn chi tiết nhé! 😊`,
        suggestions: ['Xem PlayStation 5 Slim', 'Xem Nintendo Switch OLED', 'Xem Steam Deck OLED', 'Hotline 0842.331.606']
    },

    // 4.8 Mua máy chơi game có kèm sẵn game chơi luôn không?
    {
        id: 'console_games_included_or_not',
        patterns: [
            /(may choi game|ps5|nintendo switch|steam deck).*(co san game|kem game|co dia game|cai san game|tang game)/i,
            /(mua ps5|mua switch).*(co game choi luon khong|phai mua dia khong)/i
        ],
        keywords: [
            'mua ps5 co san game khong', 'nintendo switch co cai san game khong',
            'mua may choi game co can mua dia khong', 'may choi game co tang game khong', 'mua dia game o dau'
        ],
        reply: `Dạ về game đi kèm máy, em xin thông tin chi tiết và minh bạch để bạn chuẩn bị sẵn sàng giải trí ngay khi nhận máy nhé! 🎮📦\n\n` +
            `• 📦 **Trọn bộ máy mới 100% nguyên seal:** Bao gồm thân máy, tay cầm điều khiển zin, dây nguồn, dây HDMI tốc độ cao và sách hướng dẫn.\n` +
            `• 🎮 **Có game chơi được ngay không?**\n` +
            `  - Trên **PS5:** Có cài sẵn tựa game độc quyền *Astro's Playroom* cực hay để bạn trải nghiệm tay cầm DualSense, cùng hàng chục tựa game online miễn phí đỉnh cao tải về chơi ngay như *Fortnite, eFootball, Rocket League, Genshin Impact*.\n` +
            `  - Trên **Nintendo Switch & Steam Deck:** Bạn có thể tải các tựa game Free-to-play trực tiếp trên cửa hàng số eShop / Steam.\n\n` +
            `💡 **Cách chơi các game bom tấn có phí:**\n` +
            `1. Mua **Đĩa game / Thẻ game vật lý** (ưu điểm: chơi xong có thể bán lại hoặc trao đổi cùng bạn bè).\n` +
            `2. Hoặc đăng ký gói **PlayStation Plus / Nintendo Switch Online** chia nhỏ chỉ từ vài chục nghìn/tháng để truy cập kho hàng trăm game bản quyền đỉnh cao!\n\n` +
            `👉 Bạn đang tính tậu cỗ máy nào để em tư vấn các tựa game hot nhất cho bạn cùng trải nghiệm nha! 😊`,
        suggestions: ['Xem PlayStation 5 Slim', 'Xem Nintendo Switch OLED', 'Tư vấn gói PlayStation Plus']
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
    },

    // 5.12 Hướng dẫn cấp cứu khi điện thoại, laptop bị rơi vào nước
    {
        id: 'tip_water_damage_emergency',
        patterns: [
            /(roi vao nuoc|vao nuoc|dinh nuoc|do nuoc|roi xuong nuoc|ngam nuoc).*(phai lam sao|cap cuu|xu ly the nao|bi tat nguon)/i,
            /(laptop|dien thoai|may).*(bi uot|bi do nuoc|bi ngap)/i
        ],
        keywords: [
            'dien thoai roi vao nuoc phai lam sao', 'laptop bi do nuoc len ban phim', 'cap cuu dien thoai vao nuoc',
            'may roi xuong nuoc co bo thung gao khong', 'dien thoai bi vao nuoc'
        ],
        reply: `Dạ em xin gửi bạn **HƯỚNG DẪN CẤP CỨU KHẨN CẤP KHI THIẾT BỊ RƠI VÀO NƯỚC!** 🚨\n\n` +
            `Bạn hãy bình tĩnh và làm ngay theo các bước chuẩn kỹ thuật dưới đây cùng em để cứu sống máy của bạn nha: ⚡📱\n\n` +
            `❌ **3 ĐIỀU TUYỆT ĐỐI CẤM LÀM:**\n` +
            `1. **CẤM cắm sạc pin ngay lập tức** (chập cháy nổ IC nguồn và hỏng bo mạch vĩnh viễn).\n` +
            `2. **CẤM dùng máy sấy tóc thổi nóng** (nhiệt độ cao làm chảy keo chống nước và đẩy giọt nước đi sâu hơn vào bên trong linh kiện).\n` +
            `3. **CẤM vùi máy vào thùng gạo** (bụi cám gạo gặp nước sẽ biến thành keo bết dính làm tắc nghẽn cổng sạc và màng loa).\n\n` +
            `✅ **4 BƯỚC CỨU MÁY CHUẨN KỸ THUẬT:**\n` +
            `• **Bước 1:** Tắt nguồn máy ngay lập tức (nếu máy còn đang sáng màn hình).\n` +
            `• **Bước 2:** Tháo ốp lưng, tháo khay SIM và lau thật khô toàn bộ bề mặt bên ngoài bằng khăn vải mềm.\n` +
            `• **Bước 3:** Dựng đứng máy thẳng đứng, hướng cổng sạc xuống dưới trước luồng gió quạt máy mát để nước tự thoát ra ngoài.\n` +
            `• **Bước 4:** Mang máy ngay tới cửa hàng hoặc trung tâm bảo hành gần nhất để kỹ thuật viên mở máy vệ sinh và sấy hút ẩm chuyên dụng.\n\n` +
            `👉 Cần kỹ thuật viên hỗ trợ hướng dẫn từ xa, bạn gọi ngay hotline kỹ thuật: **0842.331.606** nhé!`,
        suggestions: ['Hotline kỹ thuật 0842.331.606', 'Địa chỉ Showroom gần nhất', 'Chính sách bảo hành']
    },

    // 5.13 Cách vệ sinh màn hình điện thoại, laptop, bàn phím đúng chuẩn
    {
        id: 'tip_screen_keyboard_cleaning',
        patterns: [
            /(ve sinh|lau|chui).*(man hinh|ban phim|macbook|laptop|dien thoai).*(bang con|bang gi|the nao|dung cach)/i,
            /(co duoc dung con|dung nuoc xit kinh).*(lau man hinh)/i
        ],
        keywords: [
            'cach ve sinh man hinh laptop', 've sinh man hinh macbook bang gi',
            'co duoc dung con lau man hinh khong', 'dung nuoc xit kinh lau man hinh duoc khong', 'cach lau ban phim laptop'
        ],
        reply: `Dạ đây là kiến thức bảo quản cực kỳ quan trọng giúp bảo vệ lớp màn hình đắt tiền của bạn nè! 🧼💻\n\n` +
            `⚠️ **CẢNH BÁO NGUY HIỂM:**\n` +
            `• **TUYỆT ĐỐI KHÔNG dùng cồn y tế (cồn 70° - 90°) hay nước xịt kính thông thường** để lau màn hình MacBook, iPad hay màn hình điện thoại. Cồn và hóa chất tẩy rửa mạnh sẽ **phá hủy lớp phủ chống lóa (Anti-Reflective Coating)** và làm bong tróc lớp nano chống bám vân tay, để lại những vệt ố loang lổ vĩnh viễn không thể khắc phục!\n\n` +
            `✨ **CÁCH VỆ SINH ĐÚNG CHUẨN CHUYÊN GIA:**\n` +
            `1. **Chuẩn bị:** Dùng khăn vải vi sợi (Microfiber) loại mềm mịn chuyên dụng lau kính hoặc ống kính máy ảnh.\n` +
            `2. **Lau màn hình:** Làm ẩm nhẹ một góc khăn bằng **nước cất hoặc dung dịch vệ sinh màn hình chuyên dụng không chứa cồn**. Lau xoay tròn nhẹ nhàng, sau đó dùng góc khăn khô lau lại một lần nữa.\n` +
            `3. **Vệ sinh bàn phím:** Dùng bóng thổi bụi hoặc cọ quét lông mềm để quét sạch bụi cát dăm dưới khe phím trước khi lau bề mặt phím.\n\n` +
            `💡 Khách hàng ghé Showroom cửa hàng em luôn được các bạn kỹ thuật viên **vệ sinh máy và thổi bụi miễn phí 100%** trọn đời đó ạ! 😊`,
        suggestions: ['Địa chỉ Showroom miễn phí vệ sinh', 'Xem phụ kiện công nghệ', 'Hotline 0842.331.606']
    },

    // 5.14 Tai nghe không dây một bên bị nhỏ tiếng hoặc không kết nối được
    {
        id: 'tip_earphone_one_side_issue',
        patterns: [
            /(tai nghe).*(mot ben|1 ben|ben to ben nho|mat tieng|khong nghe duoc|khong ket noi duoc|khong len)/i,
            /(airpods|tai nghe bluetooth).*(bi nho tieng|bi tit)/i
        ],
        keywords: [
            'tai nghe airpods 1 ben khong nghe duoc', 'tai nghe mot ben to mot ben nho',
            'tai nghe bluetooth mat ket noi 1 ben', 'tai nghe bi tit mot ben', 'cach reset tai nghe airpods'
        ],
        reply: `Dạ hiện tượng tai nghe không dây bị nhỏ tiếng hoặc một bên không kết nối rất hay gặp và có thể xử lý tại nhà trong 2 phút với 3 bước sau nè: 🎧🔧\n\n` +
            `1. 🧹 **Vệ sinh màng lưới tai nghe (90% do nguyên nhân này):** Bụi bẩn và ráy tai bám chặt lâu ngày vào màng lưới kim loại làm âm thanh bị nghẹt. Bạn lấy tăm bông khô hoặc bàn chải lông mềm khô chà nhẹ nhàng lên màng loa và các lỗ thoát khí phụ xung quanh.\n` +
            `2. 🔋 **Lau sạch chân tiếp xúc sạc kim loại:** Ở dưới đáy chuôi tai nghe và sâu trong đáy hộp sạc có 2 chân kim loại dẫn điện. Nếu bị bám bụi, tai nghe bên đó sẽ không sạc được pin dẫn đến mất kết nối.\n` +
            `3. 🔄 **Reset lại tai nghe về trạng thái xuất xưởng:**\n` +
            `   • Với **AirPods:** Đặt cả 2 tai vào hộp sạc, mở nắp hộp $\rightarrow$ Nhấn giữ nút tròn phía sau hộp 15 giây cho đến khi đèn chuyển từ màu cam nhấp nháy sang màu trắng $\rightarrow$ Đưa lại gần iPhone kết nối lại từ đầu.\n` +
            `   • Với các dòng tai nghe khác: Nhấn giữ cảm ứng cả 2 bên tai trong 10 - 15 giây.\n\n` +
            `👉 Nếu sau khi thử mà tai nghe vẫn không lên tiếng, bạn mang qua cửa hàng bên em để kỹ thuật viên kiểm tra bảo hành đổi mới cho bạn nhé! 😊`,
        suggestions: ['Xem tai nghe AirPods Pro 2', 'Chính sách bảo hành đổi mới', 'Hotline 0842.331.606']
    }
];

// -------------------------------------------------------------
// 6. ĐỐI ĐÁP NGẪU HỨNG ĐỜI THƯỜNG (CHIT-CHAT, HUMOR, EMPATHY)
// -------------------------------------------------------------

const CHIT_CHAT_RULES = [
    // 6.0 Khách gọi thử / Chào hỏi / Kiểm tra hiện diện ("alo", "alo alo", "alo shop", "ê shop", "shop ơi", "có ai không"...)
    {
        id: 'chit_chat_greeting_presence',
        patterns: [
            /^alo(\s+alo)*(\s+(em|shop|ad|admin|ban|ban\s+oi|shop\s+oi|em\s+oi|oi))?[!.?\s]*$/i,
            /^(e\s+shop|shop\s+oi|em\s+oi|ad\s+oi|admin\s+oi|bot\s+oi|ai\s+oi|ban\s+oi|bac\s+oi)[!.?\s]*$/i,
            /^(co\s+ai\s+(khong|o\s+day\s+khong|truc\s+khong|online\s+khong|rep\s+khong|khong\s+a))[!.?\s]*$/i,
            /^(test|alo\s+test|test\s+bot|test\s+mic|123|test\s+123)[!.?\s]*$/i,
            /^(hi|hello|hey|chao|chao\s+ban|chao\s+shop|chao\s+em|xin\s+chao|hi\s+shop|hello\s+shop)[!.?\s]*$/i
        ],
        keywords: [
            'alo', 'alo alo', 'alo shop', 'alo em', 'alo ban oi', 'alo shop oi', 'alo em oi',
            'e shop', 'shop oi', 'em oi', 'ad oi', 'admin oi', 'co ai khong', 'co ai o day khong',
            'co ai truc khong', 'test', 'alo test', 'chao shop', 'chao ban', 'hello shop', 'hi shop'
        ],
        reply: `Dạ em nghe ạ! Em là Trợ lý AI của TechEcommerce, luôn túc trực 24/7 để hỗ trợ bạn đây ạ 😊\n\n` +
            `Bạn đang quan tâm đến sản phẩm nào, cần tư vấn cấu hình, so sánh máy, săn mã giảm giá hay kiểm tra đơn hàng cứ nhắn em hỗ trợ ngay nhé! 🚀`,
        suggestions: ['Tư vấn Điện thoại', 'Tư vấn Laptop', 'Tư vấn Máy tính bảng', 'Săn mã giảm giá', 'Tra cứu đơn hàng']
    },

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
    },

    // 6.16 Khách hỏi hoặc trêu chú Mèo Đại diện của cửa hàng (Mèo Tom Quản gia)
    {
        id: 'chit_chat_cat_mascot',
        patterns: [
            /(con meo|chu meo|meo gi|meo tom|avatar con meo|hinh con meo).*(la ai|la gi|the|de thuong|dang yeu|mac vest)/i,
            /(sao lai co|logo).*(con meo)/i
        ],
        keywords: [
            'con meo nay la gi', 'meo tom cua shop', 'avatar con meo de thuong the',
            'sao shop dung con meo', 'meo mac vest', 'chu meo de thuong qua'
        ],
        reply: `Meo meo! Em xin tự giới thiệu, em là **chú Mèo Quản gia Công nghệ** kiêm Trợ lý Mua sắm thông minh siêu tận tâm của cửa hàng đây ạ! 🐱🎩✨\n\n` +
            `Bộ vest lịch lãm em mặc là để thể hiện tinh thần phục vụ chuyên nghiệp, chu đáo và minh bạch 100% dành cho bạn đó nè! Tuy là mèo nhưng em có 'siêu năng lực' cực đỉnh:\n` +
            `• 🔍 So sánh cấu hình, giải thích đánh đổi chi tiết từng mili-mét.\n` +
            `• 🎁 Săn lùng mã giảm giá hời nhất và canh giữ kho hàng 24/7.\n` +
            `• 🍀 Luôn sẵn sàng tâm sự, đối đáp vui vẻ và mang lại nụ cười thoải mái cho bạn mỗi khi ghé thăm shop!\n\n` +
            `Hôm nay bạn cần chú mèo quản gia này tư vấn thiết bị công nghệ nào hay săn deal giảm giá gì, cứ bảo em một tiếng nha! 🥰`,
        suggestions: ['Săn mã giảm giá hôm nay', 'Tư vấn Laptop mỏng nhẹ', 'Tư vấn Điện thoại mới', 'Kể chuyện cười đi em']
    },

    // 6.17 Tư vấn mua điện thoại / máy tính bảng tặng Bố Mẹ, Ông Bà, Người lớn tuổi
    {
        id: 'chit_chat_gift_parents_seniors',
        patterns: [
            /(mua|tang).*(bo me|ba me|ong ba|phu huynh|nguoi lon tuoi|nguoi gia).*(may gi|dien thoai gi|tablet nao)/i,
            /(dien thoai|may tinh bang).*(cho nguoi gia|cho bo me|cho nguoi lon)/i
        ],
        keywords: [
            'mua dien thoai cho bo me', 'tang may gi cho bo me', 'dien thoai cho nguoi gia',
            'may tinh bang cho nguoi lon tuoi doc bao', 'mua qua cong nghe cho bo me'
        ],
        reply: `Dạ bạn là một người con/cháu vô cùng hiếu thảo và tâm lý luôn nè! 💖 Chọn đồ công nghệ tặng bố mẹ hay ông bà thì tiêu chí cốt lõi phải là: **Màn hình to sắc nét, Loa ngoài to rõ, Pin trâu và Giao diện cực kỳ dễ dùng** ạ:\n\n` +
            `✨ **Top gợi ý yêu thương nhất dành cho phụ huynh:**\n` +
            `1. 📱 **Điện thoại Samsung Galaxy A-Series (Màn hình 6.7 inch to rõ):** Có chế độ *Giao diện dễ dàng (Easy Mode)* phóng to chữ và biểu tượng cực kỳ rõ nét, pin 5.000mAh dùng 2 ngày, loa đàm thoại to rõ không sợ bố mẹ nghe không rõ.\n` +
            `2. 📲 **Máy tính bảng iPad Gen 10 10.9 inch:** 'Món quà vàng' cho bố mẹ đọc báo buổi sáng, xem YouTube nấu ăn/thời sự và gọi video call cho con cháu màn hình rộng thênh thang cực nét.\n` +
            `3. ⌚ **Vòng đeo tay / Đồng hồ sức khỏe:** Theo dõi nhịp tim 24/7, đo nồng độ oxy trong máu SpO2, đếm bước chân và theo dõi giấc ngủ để con cháu an tâm từ xa.\n\n` +
            `💡 Cửa hàng bên em hỗ trợ **Cài đặt sẵn cỡ chữ to, tài khoản và ứng dụng xem phim/đọc báo hoàn toàn miễn phí** trước khi giao hàng tận nhà nha! Bạn dự kiến tầm ngân sách bao nhiêu để em chọn mẫu phù hợp nhất ạ? 😊`,
        suggestions: ['Xem Samsung Galaxy màn to', 'Xem iPad Gen 10 màn lớn', 'Xem vòng đeo tay sức khỏe', 'Hotline 0842.331.606']
    },

    // 6.18 Tư vấn máy tính bảng cho con em học tiếng Anh, học sinh tiểu học học online
    {
        id: 'chit_chat_gift_kids_students',
        patterns: [
            /(mua|tang).*(cho con|cho be|tre em|hoc sinh tieu hoc|lop 1|lop 2|lop 3|lop 4|lop 5).*(hoc tieng anh|hoc online|may gi)/i,
            /(may tinh bang|tablet|ipad).*(cho be|cho tre em|hoc tieng anh)/i
        ],
        keywords: [
            'mua may tinh bang cho con hoc tieng anh', 'tablet cho be', 'may cho tre em hoc online',
            'ipad cho con hoc', 'mua may cho hoc sinh tieu hoc'
        ],
        reply: `Dạ đầu tư cho việc học tập và phát triển tư duy của các bé là quyết định tuyệt vời nhất của các bậc phụ huynh luôn ạ! 📚✨\n\n` +
            `✨ **Tiêu chí vàng khi chọn máy cho bé học:**\n` +
            `• 🛡️ **Bảo vệ thị lực của bé:** Màn hình phải có chứng nhận bảo vệ mắt (Eye Comfort / Lọc ánh sáng xanh) để bé không bị mỏi mắt hay cận thị khi học lâu.\n` +
            `• 🔒 **Chế độ kiểm soát phụ huynh (Parental Controls):** Giúp ba mẹ dễ dàng giới hạn thời gian sử dụng mỗi ngày và chặn hoàn toàn các nội dung không lành mạnh trên mạng.\n` +
            `• ✏️ **Hỗ trợ bút vẽ cảm ứng:** Bé thỏa sức tập viết chữ, học toán và tô màu sáng tạo.\n\n` +
            `🏆 **Top máy tính bảng học tập được phụ huynh chọn nhiều nhất:**\n` +
            `• **iPad Gen 10 10.9 inch:** Kho ứng dụng giáo dục học tiếng Anh (Duolingo, Monkey Junior, Khan Academy) phong phú và tối ưu mượt mà nhất.\n` +
            `• **Samsung Galaxy Tab / Xiaomi Pad:** Mức giá cực mềm chỉ từ 4 - 7 triệu, có sẵn không gian an toàn cho trẻ em *Samsung Kids*.\n\n` +
            `👉 Bé nhà mình đang học lớp mấy và bạn cần máy trong tầm giá nào để em tư vấn mẫu bền bỉ kèm bao da chống va đập cho bé nhé! 😊`,
        suggestions: ['Xem iPad Gen 10 học tập', 'Xem Galaxy Tab giá tốt', 'Tư vấn bút cảm ứng cho bé']
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
