/**
 * ragService.js
 * Hệ thống Retrieval-Augmented Generation (RAG) đa nguồn cho TechEcommerce:
 * 1. Auto-seed & quản lý Cơ sở tri thức KnowledgeArticle (24 bài hướng dẫn, chính sách, tương thích).
 * 2. Mở rộng ngữ nghĩa câu truy vấn tiếng Việt (Semantic Query Expansion).
 * 3. Truy xuất đa nguồn kết hợp chấm điểm Hybrid BM25-TF trên:
 *    - Product Catalog (tên, thông số CPU/GPU/RAM/SSD/pin/màn hình/camera, tags, đánh giá, tồn kho)
 *    - KnowledgeArticle (chính sách, FAQ, hướng dẫn chọn máy, ma trận tương thích hệ sinh thái)
 *    - Verified Reviews (trích dẫn nhận xét thực tế của khách mua trước)
 *    - Active Coupons (mã giảm giá còn hiệu lực khớp tầm ngân sách)
 */

const Product = require('../models/Product');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const KnowledgeArticle = require('../models/KnowledgeArticle');

let seedPromise = null;
let seededCheckedAt = 0;

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

const CURATED_KNOWLEDGE_ARTICLES = [
    {
        title: 'Chính sách bảo hành chính hãng 12-24 tháng & Lỗi 1 đổi 1 trong 30 ngày',
        slug: 'chinh-sach-bao-hanh-1-doi-1',
        type: 'policy',
        category: 'all',
        keywords: ['bao hanh', '1 doi 1', 'doi tra', '30 ngay', 'loi phan cung', 'bao hanh dien tu'],
        answer: 'Toàn bộ sản phẩm đều là hàng mới chính hãng nguyên seal, bảo hành 12–24 tháng tại trung tâm ủy quyền toàn quốc (Apple, Samsung, ASUS, Dell, HP, Lenovo...). Riêng 30 ngày đầu được LỖI 1 ĐỔI 1 thân máy mới nếu lỗi phần cứng từ NSX; hỗ trợ ship nhận bảo hành 2 chiều miễn phí cho khách ở xa.'
    },
    {
        title: 'Trả góp 0% lãi suất qua Thẻ tín dụng hoặc CCCD gắn chip không cần thẻ',
        slug: 'tra-gop-0-phan-tram-cccd',
        type: 'policy',
        category: 'all',
        keywords: ['tra gop', '0%', 'khong can the', 'cccd', 'sinh vien tra gop', 'duyet ho so', 'tra truoc 30%'],
        answer: 'Hỗ trợ trả góp 0% lãi suất qua thẻ tín dụng hơn 25 ngân hàng hoặc trả góp qua CCCD gắn chip duyệt online trong 15 phút (trả trước từ 30%, kỳ hạn 3/6/9/12 tháng). Nếu dưới 18 tuổi chưa đủ tuổi đứng tên tài chính, phụ huynh/người thân trên 18 tuổi có thể đứng tên hồ sơ giúp rất nhanh.'
    },
    {
        title: 'Cam kết hàng chính hãng VN/A, nguyên seal chưa kích hoạt & Kiểm tra IMEI',
        slug: 'kiem-tra-chinh-hang-vna-imei-seal',
        type: 'faq',
        category: 'all',
        keywords: ['chinh hang', 'vna', 'vn/a', 'nguyen seal', 'imei', 'check seal', 'xach tay', 'hang gia', 'chua active'],
        answer: '100% thiết bị Apple tại cửa hàng là mã VN/A phân phối chính thức tại Việt Nam; mọi sản phẩm đều nguyên seal niêm phong hộp, chưa kích hoạt (Check IMEI/Serial trên trang chủ Apple/Samsung/ASUS trùng khớp hộp và hóa đơn VAT điện tử).'
    },
    {
        title: 'Giao hàng hỏa tốc 2 giờ nội thành & Đồng kiểm mở hộp trước khi thanh toán (COD)',
        slug: 'giao-hoa-toc-2h-va-dong-kiem-cod',
        type: 'policy',
        category: 'all',
        keywords: ['giao hang', 'hoa toc', '2h', 'dong kiem', 'mo hop', 'kiem tra hang', 'cod', 'freeship'],
        answer: 'Giao hỏa tốc nội thành TP.HCM chỉ 2 giờ (hẹn giờ linh hoạt). Miễn phí vận chuyển toàn quốc cho đơn từ 500.000đ. Đặc biệt được ĐỒNG KIỂM 100%: mở hộp kiểm tra ngoại quan, seal, phụ kiện trước khi trả tiền COD; sai mẫu hoặc trầy xước được từ chối không mất phí.'
    },
    {
        title: 'Chương trình Thu cũ đổi mới (Trade-in) lên đời trợ giá đến 2.000.000đ',
        slug: 'thu-cu-doi-moi-tro-gia-2-trieu',
        type: 'policy',
        category: 'all',
        keywords: ['thu cu', 'doi moi', 'trade in', 'len doi', 'ban may cu', 'tro gia'],
        answer: 'Cửa hàng hỗ trợ Thu cũ đổi mới cho iPhone, Samsung Galaxy, MacBook, iPad, Apple Watch với quy trình định giá minh bạch trong 5 phút tại showroom 78 Nguyễn Văn Khối, Gò Vấp, trợ giá lên đời thêm tối đa 2.000.000đ và hỗ trợ chuyển toàn bộ dữ liệu sang máy mới miễn phí.'
    },
    {
        title: 'Xuất hóa đơn đỏ VAT điện tử cho doanh nghiệp & Mua số lượng B2B',
        slug: 'xuat-hoa-don-vat-doanh-nghiep',
        type: 'policy',
        category: 'all',
        keywords: ['vat', 'hoa don do', 'hoa don dien tu', 'cong ty', 'doanh nghiep', 'b2b', 'mua so luong'],
        answer: 'Tất cả đơn hàng đều xuất hóa đơn VAT điện tử đầy đủ theo MST và tên công ty ngay trong ngày (không phát sinh phụ phí). Khách doanh nghiệp đặt từ 3–5 máy trở lên vui lòng liên hệ hotline/Zalo 0842.331.606 để nhận báo giá chiết khấu B2B và hợp đồng trọn gói.'
    },
    {
        title: 'Đặt giữ hàng tại Showroom 78 Nguyễn Văn Khối Gò Vấp tối đa 24 giờ',
        slug: 'dat-giu-hang-tai-showroom-24h',
        type: 'faq',
        category: 'all',
        keywords: ['showroom', 'dia chi', 'go vap', 'dat giu', 'giu may', 'xem truc tiep', 'nguyen van khoi'],
        answer: 'Showroom duy nhất tại 78 Nguyễn Văn Khối, Quận Gò Vấp, TP.HCM (mở cửa 08:30 – 21:30 hàng ngày). Khách hàng được đặt giữ model & màu sắc yêu thích tại showroom trong 24 giờ không cần đặt cọc để đến trải nghiệm trực tiếp.'
    },
    {
        title: 'Hướng dẫn chọn Laptop học CNTT, Lập trình, AI & Kỹ thuật phần mềm',
        slug: 'huong-dan-chon-laptop-cntt-lap-trinh-ai',
        type: 'guide',
        category: 'Laptop',
        keywords: ['it', 'cntt', 'lap trinh', 'code', 'docker', 'ai', 'machine learning', 'macos hay windows'],
        answer: 'Sinh viên IT/Lập trình cần tối thiểu RAM 16GB (32GB nếu chạy Docker, máy ảo, Android Studio) và SSD 512GB+. Nếu làm Web/Mobile iOS ưu tiên MacBook Air/Pro chip M-series (pin bền, màn sắc nét, hệ Unix chuẩn); nếu học AI/CUDA hoặc chạy phần mềm Windows chuyên ngành nên chọn Laptop Windows có CPU đa nhân + GPU NVIDIA RTX 4050/4060.'
    },
    {
        title: 'Hướng dẫn chọn Laptop Thiết kế đồ họa, Dựng phim & Kiến trúc (3D/CAD)',
        slug: 'huong-dan-chon-laptop-do-hoa-render-mau',
        type: 'guide',
        category: 'Laptop',
        keywords: ['do hoa', 'thiet ke', 'designer', 'photoshop', 'premiere', 'after effects', 'autocad', '3d', 'render', 'chuan mau'],
        answer: 'Đồ họa 2D/UI-UX cần màn hình độ phủ màu >=100% sRGB hoặc Retina/Liquid Retina XDR, RAM 16GB+. Dựng video 4K, AutoCAD, Blender 3D cần GPU rời NVIDIA RTX 4050/4060/4070 hoặc MacBook Pro chip Pro/Max để render nhanh và tản nhiệt ổn định lâu dài.'
    },
    {
        title: 'Hướng dẫn chọn Laptop Kế toán, Tài chính & Văn phòng có phím số Numpad',
        slug: 'huong-dan-chon-laptop-ke-toan-van-phong',
        type: 'guide',
        category: 'Laptop',
        keywords: ['ke toan', 'tai chinh', 'excel', 'misa', 'numpad', 'phim so', 'van phong', '15.6 inch'],
        answer: 'Dân Kế toán, Tài chính nhập liệu Excel/MISA liên tục nên ưu tiên màn hình rộng 15.6 inch chống chói có cụm bàn phím số Numpad riêng (như Acer Aspire, HP 15s, ASUS Vivobook, Dell Vostro/Inspiron) kết hợp RAM 16GB để mở nhiều file bảng tính nặng không giật lag.'
    },
    {
        title: 'So sánh MacBook vs Laptop Windows cho sinh viên & người mới đi làm',
        slug: 'so-sanh-macbook-vs-windows-sinh-vien',
        type: 'guide',
        category: 'Laptop',
        keywords: ['macbook hay windows', 'nen mua macbook', 'mac hay win', 'tuong thich phan mem', 'office macbook'],
        answer: 'MacBook (Air/Pro chip Apple Silicon) nổi bật ở sự mỏng nhẹ, không tiếng ồn quạt, pin 10-14h thực tế và giữ giá lâu; Word/Excel/PowerPoint chạy tốt nhưng một số phần mềm chuyên ngành kỹ thuật, kế toán MISA chỉ có bản Windows. Laptop Windows đa dạng cổng kết nối HDMI/USB-A, dễ nâng cấp, tương thích 100% mọi phần mềm Việt Nam và chơi game mạnh.'
    },
    {
        title: 'Nên chọn iPad kèm Apple Pencil hay Laptop cho việc học & ghi chú?',
        slug: 'chon-ipad-apple-pencil-vs-laptop-hoc-tap',
        type: 'guide',
        category: 'Tablet',
        keywords: ['ipad hay laptop', 'magic keyboard', 'apple pencil', 'ghi chu', 'y khoa', 've', 'on thi'],
        answer: 'iPad (Gen 10 / Air / Pro) + Apple Pencil lý tưởng để đọc file PDF dày hàng nghìn trang, vẽ giải phẫu Y khoa, ghi chú bài giảng trực tiếp lên slide. Tuy nhiên nếu phải làm luận văn Word/Excel nâng cao hoặc chạy phần mềm lập trình/kế toán chuyên dụng, Laptop vẫn không thể thay thế hoàn toàn.'
    },
    {
        title: 'Chọn màn hình bảo vệ mắt chống nhấp nháy PWM cho người cận thị nặng',
        slug: 'man-hinh-chong-moi-mat-pwm-cho-nguoi-can',
        type: 'guide',
        category: 'Điện thoại',
        keywords: ['can thi', 'moi mat', 'dau mat', 'pwm', 'oled hay ips', 'bao ve mat', '120hz', 'chong choi'],
        answer: 'Người bị cận thị hoặc hay đọc ban đêm dễ mỏi mắt với màn OLED tần số PWM thấp (240Hz-480Hz). Nên ưu tiên smartphone có High-Frequency PWM Dimming (1920Hz–3840Hz như OPPO, HONOR, Xiaomi cao cấp), bật True Tone / Eye Comfort giảm ánh sáng xanh, hoặc tablet màn LCD IPS dịu mắt.'
    },
    {
        title: 'Tương thích hệ sinh thái Apple: iPhone + Apple Watch + AirPods + MacBook',
        slug: 'tuong-thich-he-sinh-thai-apple-airpods-watch',
        type: 'compatibility',
        category: 'all',
        keywords: ['he sinh thai', 'apple', 'dong bo', 'airdrop', 'icloud', 'handoff', 'apple watch android'],
        answer: 'Apple Watch yêu cầu kết nối với iPhone (iOS), không ghép đôi trực tiếp được với điện thoại Android. Khi dùng chung iPhone + MacBook + iPad + AirPods, bạn có tính năng Copy-Paste chung (Universal Clipboard), AirDrop truyền file 4K tức thì và tự chuyển âm thanh AirPods mượt mà giữa các máy.'
    },
    {
        title: 'Chọn Củ sạc nhanh GaN PD & Hub chuyển đổi USB-C đúng công suất chuẩn',
        slug: 'tuong-thich-hub-usb-c-sac-gan-pd-powerbank',
        type: 'compatibility',
        category: 'Phụ kiện',
        keywords: ['cu sac', 'sac nhanh', 'gan', 'pd', 'watt', 'hub', 'type c', 'ugreen', 'anker', 'baseus', 'cap sac'],
        answer: 'Chọn củ sạc GaN Anker/Baseus nên theo chuẩn Power Delivery (PD): Điện thoại iPhone/Samsung cần từ 20W–45W; MacBook Air cần 35W–65W; MacBook Pro cần 65W–100W trở lên. Khi mua Hub Type-C Ugreen cần chọn loại có cổng Power Delivery Pass-Through >= 65W nếu vừa xuất hình HDMI vừa sạc qua 1 cổng duy nhất.'
    },
    {
        title: 'Quy định mang Pin sạc dự phòng lên máy bay (Giới hạn 100Wh IATA)',
        slug: 'quy-dinh-pin-sac-du-phong-tren-may-bay',
        type: 'faq',
        category: 'Phụ kiện',
        keywords: ['mang len may bay', 'sac du phong', '100wh', '20000mah', '25000mah', 'hang khong', 'hanh ly xach tay'],
        answer: 'Theo quy định hàng không quốc tế (IATA), pin sạc dự phòng có dung lượng năng lượng <= 100Wh (tương đương tối đa ~27.000mAh ở mức 3.7V, ví dụ 10.000mAh, 20.000mAh hay Anker 25.000mAh ~90Wh) được phép mang trong HÀNH LÝ XÁCH TAY lên máy bay; tuyệt đối không bỏ vào hành lý ký gửi.'
    },
    {
        title: 'Mẹo bảo quản Pin Lithium-ion & Có nên sạc điện thoại/laptop qua đêm?',
        slug: 'meo-bao-quan-pin-lithium-sac-qua-dem',
        type: 'guide',
        category: 'all',
        keywords: ['sac qua dem', 'chai pin', 'bao quan pin', '80%', 'pin lithium', 'vua sac vua dung'],
        answer: 'Smartphone và Laptop hiện đại đều có chip IC ngắt/giữ dòng thông minh và tính năng Sạc tối ưu hóa 80% nên sạc qua đêm an toàn khi dùng củ/cáp chính hãng (chú ý đặt nơi thoáng mát, tránh đặt dưới gối gây ủ nhiệt). Tránh vừa sạc nhanh vừa chơi game 3D nặng khiến pin nóng trên 42°C dễ giảm tuổi thọ cell pin.'
    },
    {
        title: 'Quạt tản nhiệt Laptop Gaming ồn & cách bật chế độ yên tĩnh khi vào thư viện',
        slug: 'laptop-gaming-nhiet-do-va-che-do-im-lang',
        type: 'guide',
        category: 'Laptop',
        keywords: ['quat on', 'keu to', 'laptop gaming', 'thu vien', 'van phong', 'silent mode', 'nong may'],
        answer: 'Laptop Gaming khi chơi game nặng nhiệt độ CPU/GPU 75–90°C quạt quay nhanh là bình thường để bảo vệ linh kiện. Khi mang vào thư viện, lớp học hay phòng họp, chỉ cần nhấn phím tắt chuyển sang Silent / Quiet Mode (trên ASUS Armoury Crate, Acer NitroSense, Lenovo Vantage) để quạt chạy êm gần như tắt tiếng và tiết kiệm pin.'
    },
    {
        title: 'Chọn Tai nghe chống ồn đi máy bay, làm việc tập trung: Over-ear vs In-ear',
        slug: 'tai-nghe-anc-over-ear-vs-in-ear-di-may-bay',
        type: 'guide',
        category: 'Tai nghe',
        keywords: ['anc', 'chong on', 'may bay', 'over ear', 'in ear', 'sony xm5', 'airpods pro', 'di chuyen'],
        answer: 'Chống ồn chụp tai Over-ear (Sony WH-1000XM5) triệt tiêu tiếng ù động cơ máy bay tốt hơn nhờ đệm mút trùm kín và pin 30 giờ; có dây 3.5mm cắm màn hình ghế bay. Tai nghe In-ear (AirPods Pro 2, Galaxy Buds 3 Pro) gọn bỏ túi áo, không nóng tai khi đeo lâu và có xuyên âm nghe thông báo tiếp viên rõ ràng.'
    },
    {
        title: 'So sánh Đồng hồ thông minh Garmin vs Apple Watch vs Samsung Galaxy Watch',
        slug: 'dong-ho-garmin-gps-vs-apple-watch-vs-galaxy',
        type: 'compatibility',
        category: 'Đồng hồ thông minh',
        keywords: ['garmin', 'apple watch', 'galaxy watch', 'chay bo', 'the thao', 'pin lau', 'do huyet ap'],
        answer: 'Apple Watch Series 10/SE tích hợp hệ sinh thái iPhone, nghe gọi eSIM và tính năng phát hiện té ngã; pin 1–2 ngày. Samsung Galaxy Watch hỗ trợ tốt điện thoại Android (đo thành phần cơ thể BIA). Garmin Forerunner/Venu dùng được cả iOS & Android với GPS đa băng tần chuẩn xác và pin trâu 7–14 ngày cho người tập thể thao.'
    },
    {
        title: 'Tư vấn Máy chơi game: PS5 Slim vs Nintendo Switch OLED vs Handheld PC',
        slug: 'may-choi-game-ps5-vs-switch-oled-vs-rog-ally',
        type: 'guide',
        category: 'Máy chơi game',
        keywords: ['ps5', 'nintendo switch', 'rog ally', 'steam deck', 'msi claw', 'choi game', 'gia dinh'],
        answer: 'PlayStation 5 Slim xuất hình TV 4K/120fps đồ họa AAA đỉnh cao. Nintendo Switch OLED nổi bật với game gia đình/nhóm bạn (Mario, Zelda) và chơi cầm tay/cắm TV cực vui cho trẻ em & cặp đôi. ROG Ally / Steam Deck OLED / MSI Claw là PC Gaming thu nhỏ chơi trọn kho game Steam mọi lúc mọi nơi.'
    },
    {
        title: 'Công cụ Setup Builder tự phối góc làm việc & nhận ưu đãi Combo',
        slug: 'setup-builder-phoi-goc-lam-viec-cong-thai-hoc',
        type: 'faq',
        category: 'all',
        keywords: ['setup builder', 'goc lam viec', 'phoi combo', 'cong thai hoc', 'chuot ban phim'],
        answer: 'Cửa hàng tích hợp công cụ Setup Builder (trên thanh danh mục) giúp khách tự phối Laptop + Chuột công thái học + Bàn phím cơ + Tai nghe + Hub/Sạc theo tông màu và ngân sách, tự động kiểm tra tương thích cổng kết nối và áp dụng giảm giá combo.'
    },
    {
        title: 'Dịch vụ gói quà tặng sinh nhật, thiệp chúc & giao đúng giờ hẹn',
        slug: 'goi-qua-sinh-nhat-va-giao-hen-gio',
        type: 'policy',
        category: 'all',
        keywords: ['tang qua', 'sinh nhat', 'goi qua', 'thiep chuc', 'giao dung gio', 'nguoi yeu'],
        answer: 'Khi đặt làm quà tặng (sinh nhật, kỷ niệm, tặng người thân), khách hàng chỉ cần ghi chú ở bước Thanh toán hoặc nhắn hotline: cửa hàng hỗ trợ gói quà cao cấp miễn phí, viết thiệp chúc tay lịch sự và giao hỏa tốc đúng khung giờ yêu cầu trong nội thành TP.HCM.'
    },
    {
        title: 'Chính sách bảo hành rơi vỡ, vào nước & lưu ý chuẩn kháng nước IP68',
        slug: 'bao-hanh-roi-vo-va-chong-nuoc-ip68',
        type: 'policy',
        category: 'all',
        keywords: ['roi vo', 'vao nuoc', 'ip68', 'ip67', 'khang nuoc', 'apple care', 'bao hanh vang'],
        answer: 'Bảo hành tiêu chuẩn NSX xử lý lỗi kỹ thuật phần cứng (không gồm rơi vỡ vật lý/ngấm nước). Chuẩn IP68 giúp chống tia nước mưa/rơi nước ngọt ngắn hạn nhưng không khuyến khích đi bơi biển/xông hơi vì muối và hơi nóng làm hỏng ron cao su. Với iPhone/MacBook đắt tiền có thể đăng ký thêm gói AppleCare+ để yên tâm cả rủi ro rơi vỡ.'
    },
    {
        title: 'Miễn phí chuyển dữ liệu Zalo, ảnh, danh bạ & cài đặt trọn bộ ứng dụng khi mua máy',
        slug: 'cai-dat-chuyen-du-lieu-mien-phi',
        type: 'policy',
        category: 'all',
        keywords: ['chuyen du lieu', 'zalo', 'danh ba', 'move to ios', 'cai app', 'cai office', 'esim', 'icloud', 'khong mat du lieu'],
        answer: 'Cửa hàng hỗ trợ 100% MIỄN PHÍ sao lưu & chuyển toàn bộ dữ liệu (tin nhắn Zalo, ảnh/video, danh bạ, app ngân hàng) từ máy cũ sang máy mới bằng công cụ chính thống (iPhone -> iPhone, Android <-> iPhone qua Move to iOS), đồng thời kích hoạt eSIM, cài đặt Office, bộ gõ, cỡ chữ to cho phụ huynh trước khi bạn rời quầy.'
    },
    {
        title: 'Nhận máy gấp trong 10 phút tại Showroom hoặc Giao hỏa tốc 2H khẩn cấp',
        slug: 'lay-ngay-tai-quay-va-ship-hoa-toc-gap',
        type: 'policy',
        category: 'all',
        keywords: ['can gap', 'lay ngay', 'hom nay', 'hoa toc', 'chuyen bay', 'di cong tac', 'ship nhanh'],
        answer: 'Nếu bạn cần máy gấp trước giờ họp hay chuyến bay: đặt qua web chọn Giao hỏa tốc 2H trong nội thành TP.HCM (ưu tiên xử lý sau 15 phút) hoặc gọi hotline 0842.331.606 để nhân viên kiểm máy trước, bạn ghé 78 Nguyễn Văn Khối Gò Vấp nhận ngay chỉ trong 10 phút.'
    },
    {
        title: 'Chính sách đổi quà tặng linh hoạt trong 30 ngày nếu người nhận chưa khui seal',
        slug: 'doi-qua-tang-linh-hoat-khi-nguoi-nhan-chua-khui',
        type: 'policy',
        category: 'all',
        keywords: ['doi qua', 'khong hop mau', 'tang nguoi yeu', 'qua sep', 'chua khui seal', 'doi dung luong'],
        answer: 'Khi mua tặng sếp, đối tác, bạn gái hoặc người thân: nếu máy còn nguyên seal hộp chưa kích hoạt trong vòng 30 ngày và còn hóa đơn, cửa hàng hỗ trợ ĐỔI MÀU / ĐỔI DUNG LƯỢNG / ĐỔI MODEL KHÁC hoàn toàn linh hoạt ngang hoặc bù chênh lệch (không thu phí khấu hao), kèm gói quà & thiệp chúc miễn phí.'
    },
    {
        title: 'Cam kết 100% máy mới nguyên seal chính hãng (Không bán hàng dựng/trưng bày)',
        slug: 'cam-ket-chi-ban-may-moi-nguyen-seal-khong-hang-dung',
        type: 'faq',
        category: 'all',
        keywords: ['may cu', 'likenew', 'hang trung bay', 'may 99', 'refurbished', 're hon shopee', 'cho khac re'],
        answer: 'Cửa hàng KHÔNG bán máy cũ 99%, hàng trưng bày hay máy dựng thay vỏ trôi nổi để tránh rủi ro chai pin/sửa main cho khách. Mọi sản phẩm đều mới 100% nguyên seal chính hãng, xuất VAT đầy đủ, lỗi 1 đổi 1 30 ngày. Để tiết kiệm chi phí hơn, bạn có thể áp mã giảm giá (TECHVIP/DEALHOT500) kết hợp Trả góp 0% nhẹ ví.'
    },
    {
        title: 'Chọn Laptop đầy đủ cổng HDMI, USB-A cho thuyết trình & công việc văn phòng',
        slug: 'laptop-nhieu-cong-ket-noi-hdmi-thuyet-trinh',
        type: 'guide',
        category: 'Laptop',
        keywords: ['cong hdmi', 'may chieu', 'thuyet trinh', 'usb a', 'it cong', 'hub', 'giao vien', 'giang vien'],
        answer: 'Giảng viên, nhân viên văn phòng hay trình chiếu máy chiếu phòng họp nên chọn laptop tích hợp sẵn HDMI full-size và USB-A (như ASUS Vivobook, HP 15s, Acer Aspire, Lenovo IdeaPad/Legion, Dell Vostro) để cắm trực tiếp không lo quên cáp. Nếu chọn MacBook Air mỏng nhẹ ít cổng, chỉ cần thêm 1 Hub USB-C Ugreen 5-in-1 là dùng đủ HDMI 4K + USB.'
    },
    {
        title: 'Dịch vụ vệ sinh laptop, kiểm tra pin & hỗ trợ kỹ thuật TeamViewer trọn đời',
        slug: 'ho-tro-ky-thuat-ve-sinh-may-tron-doi',
        type: 'policy',
        category: 'all',
        keywords: ['ve sinh may', 'tra keo tan nhiet', 'teamviewer', 'ultraviewer', 'ho tro tu xa', 'hau mai', 'kiem tra pin'],
        answer: 'Mọi khách hàng mua máy tại shop đều được hỗ trợ kỹ thuật phần mềm trọn đời miễn phí (hỗ trợ trực tiếp hoặc qua UltraViewer/TeamViewer khi gặp lỗi Windows, macOS, driver), kèm miễn phí kiểm tra sức khỏe pin & vệ sinh bụi ngoài cơ bản tại Showroom 78 Nguyễn Văn Khối.'
    },
    {
        title: 'Nên mua dòng đời mới nhất hay chọn đời trước tiết kiệm vài triệu?',
        slug: 'nen-mua-doi-moi-hay-doi-truoc-tiet-kiem',
        type: 'guide',
        category: 'all',
        keywords: ['iphone 15 hay 16', 'macbook m2 hay m3', 's24 hay s25', 'doi cu hay doi moi', 'dang tien', 'tiet kiem'],
        answer: 'Đời mới hơn (iPhone 16/17 Pro, S25, MacBook M3) nổi bật ở chip xử lý mạnh hơn ~15-20%, tính năng AI tích hợp sâu, pin tối ưu hơn và vòng đời cập nhật OS dài hơn 1 năm. Nếu nhu cầu chủ yếu làm việc/chụp ảnh phổ thông và muốn tiết kiệm ngay 3–6 triệu, dòng tiền nhiệm (iPhone 15, Galaxy S24, MacBook Air M2) có tỷ lệ hiệu năng/giá vẫn rất hời.'
    },
    {
        title: 'Chọn Cáp & Củ sạc chuẩn MFi Apple, Samsung Super Fast Charging bảo vệ tuổi thọ pin',
        slug: 'chon-sac-cap-chuan-mfi-pps-chong-chai-pin',
        type: 'compatibility',
        category: 'Phụ kiện',
        keywords: ['mfi', 'chay no', 'chong chai pin', 'pps', 'super fast charging', 'anker', 'baseus', 'ugreen'],
        answer: 'Sử dụng củ sạc có chip điều chỉnh dòng GaN chuẩn USB-PD / PPS (Anker, Baseus, Ugreen, Apple) giúp máy sạc nhanh 50% trong ~25–30 phút mà vẫn kiểm soát nhiệt dưới ngưỡng an toàn, không gây loạn cảm ứng hay phồng pin như sạc trôi nổi không rõ nguồn gốc.'
    },
    {
        title: 'Độ bền con lăn chuột, số lần nhấn Switch & thông số Logitech G502 Hero',
        slug: 'do-ben-con-lan-switch-chuot-gaming-logitech-g502-hero',
        type: 'guide',
        category: 'Phụ kiện',
        keywords: ['con lan', 'banh xe', 'scroll', 'vong quay', 'lan duoc', 'switch', 'omron', 'trieu lan nhan', 'g502', 'logitech', 'chuot gaming', 'feet', 'dpi'],
        answer: 'Với chuột gaming Logitech (đặc biệt Logitech G502 Hero) và đa số chuột chính hãng khác, nhà sản xuất KHÔNG công bố định mức con số "bao nhiêu vòng quay" cố định cho con lăn. Riêng G502 Hero sử dụng con lăn kim loại 2 chế độ (Hyper-fast Scroll Wheel: cuộn từng nấc chính xác và mở khóa cuộn trơn vô cực rất bền). Hãng công bố chính thức độ bền phím bấm chính Omron lên tới ~50 triệu lần nhấn, độ bền feet PTFE lướt >250 km, cảm biến HERO 25.600 DPI (>400 IPS, phản hồi 1ms/1000Hz). Dùng thực tế thường bền 4–5 năm, và tại cửa hàng có bảo hành chính hãng 12 tháng (1 đổi 1 30 ngày).'
    },
    {
        title: 'Giải đáp tuổi thọ linh kiện: Switch bàn phím cơ, chu kỳ sạc pin & chuẩn kháng nước',
        slug: 'thong-so-do-ben-linh-kien-ban-phim-tai-nghe-dong-ho',
        type: 'guide',
        category: 'all',
        keywords: ['tuoi tho', 'do ben', 'su dung duoc bao lau', 'chu ky sac', 'switch ban phim', 'hot swap', 'ipx4', 'ipx5', '5 atm', '100m'],
        answer: 'Các thông số độ bền hãng thường công bố gồm: Switch bàn phím cơ bền 50–100 triệu lần gõ (loại có hot-swap dễ thay lẻ 1 nút nếu hỏng); pin Lithium-ion giữ >80% dung lượng sau khoảng 500–800 chu kỳ sạc đầy; đồng hồ 5 ATM dùng bơi nông/mưa thoải mái còn tai nghe IPX4/IPX5 chống mồ hôi chạy bộ/gym (không ngâm nước). Những chi tiết cơ học phụ như vòng quay con lăn hay số lần gập cổng thường không có định mức vòng cố định từ NSX.'
    },
    {
        title: 'Sony PlayStation Portal có chơi độc lập được không vs PS5 Slim (ổ đĩa Blu-ray)',
        slug: 'ps-portal-co-can-ps5-khong-va-ps5-slim-o-dia',
        type: 'compatibility',
        category: 'Máy chơi game',
        keywords: ['ps portal', 'playstation portal', 'remote play', 'ps5 slim', 'o dia', 'blu ray', '2 tay cam', 'choi doc lap'],
        answer: 'Sony PlayStation Portal (6.990.000đ) là thiết bị stream Remote Play qua Wi-Fi, BẮT BUỘC phải có máy PS5 ở nhà bật/chế độ Rest Mode thì mới chơi được — KHÔNG tự chạy game độc lập như Switch OLED, ROG Ally X hay MSI Claw 8. Còn Sony PS5 Slim Standard (13.490.000đ, combo 2 tay cầm DualSense 14.990.000đ) tích hợp sẵn ổ đĩa Ultra HD Blu-ray để chơi đĩa game hoặc mua game digital trên SSD 1TB.'
    },
    {
        title: 'So sánh Handheld Gaming: Switch OLED/Lite vs ROG Ally Z1E/Ally X vs Legion Go 2 vs MSI Claw 8',
        slug: 'so-sanh-may-choi-game-cam-tay-handheld-rog-claw-legion-switch',
        type: 'guide',
        category: 'Máy chơi game',
        keywords: ['switch oled', 'switch lite', 'rog ally', 'rog ally x', 'legion go', 'msi claw', 'pin may choi game', 'thao tay cam', 'xuat tv'],
        answer: 'Switch Lite (4.49M, 275g) chỉ chơi cầm tay, không tháo Joy-Con & không xuất TV; Switch OLED (7.99M) màn OLED 7" tháo 2 tay cầm & cắm dock xuất TV chơi gia đình. Muốn cày game PC Steam/Wukong/FC25: ROG Ally Z1 Extreme (14.99M) gọn nhẹ màn 120Hz; MSI Claw 8 AI+ (16.99M, RAM 32GB, pin 80Wh) & ROG Ally X (22.99M, RAM 24GB, pin 80Wh) cho pin gấp đôi ~3–4h chơi nặng; Lenovo Legion Go 2 (19.49M) màn lớn 8.8" QHD+ 144Hz & tháo tay cầm làm chuột FPS.'
    },
    {
        title: 'Pin sạc dự phòng mang máy bay & Sạc Laptop Type-C: Anker A1695, Baseus Blade, Ugreen 130W',
        slug: 'pin-du-phong-sac-laptop-va-quy-dinh-may-bay-anker-baseus-ugreen',
        type: 'compatibility',
        category: 'Phụ kiện',
        keywords: ['anker a1695', 'baseus blade', 'baseus bipow', 'ugreen pb721', '165w', '130w', '100w', '25000mah', '20000mah', 'may bay', 'sac macbook', 'sac laptop'],
        answer: 'Tất cả pin dự phòng đang bán tại shop đều đạt chuẩn an toàn hàng không <100Wh (Baseus Bipow 20W, Baseus Blade HD 100W & Ugreen Nexode 130W mức ~74Wh; Anker A1695 25.000mAh 165W mức ~90–92.5Wh) nên ĐƯỢC mang trong hành lý xách tay lên máy bay (tuyệt đối KHÔNG ký gửi). Nếu cần sạc cho MacBook/Dell/ThinkPad Type-C, hãy chọn Baseus Blade HD 100W (siêu mỏng 18mm), Ugreen PB721 130W hoặc Anker A1695 165W; Baseus Bipow 20W chỉ phù hợp điện thoại/tablet.'
    },
    {
        title: 'Củ sạc GaN Anker Prime 100W vs Tháp sạc Baseus PowerCombo 65W & cơ chế chia điện',
        slug: 'cu-sac-gan-anker-prime-100w-va-thap-sac-baseus-powercombo',
        type: 'guide',
        category: 'Phụ kiện',
        keywords: ['anker prime 100w', 'a2688', 'powercombo', 'tram sac', 'thap sac', 'gan', 'chia cong suat', 'chong set'],
        answer: 'Anker Prime 100W GaN 3 cổng (1.69M, 2 USB-C + 1 USB-A) cực kỳ nhỏ gọn bỏ túi, sạc đơn 100W cho MacBook hoặc chia thông minh ~65W+30W khi cắm cùng lúc laptop và iPhone. Baseus PowerCombo Tower 65W 6-in-1 (1.89M) đặt cố định trên bàn làm việc vừa có 2 Type-C 65W + 2 USB-A vừa có 2 ổ cắm AC 2500W tích hợp chip chống sét lan truyền và màn LED cảm ứng rất an toàn.'
    },
    {
        title: 'Tương thích Apple Pencil Pro & Bút cảm ứng trên các đời iPad, Samsung Tab S9 Ultra, Lenovo Tab M11',
        slug: 'tuong-thich-apple-pencil-pro-va-but-cam-ung-tablet',
        type: 'compatibility',
        category: 'Phụ kiện',
        keywords: ['apple pencil pro', 'pencil pro', 'ipad gen 10', 'ipad air m2', 'ipad pro m4', 's pen', 'tab m11', 'ngoai but', 'tuong thich but'],
        answer: 'Apple Pencil Pro (3.29M) có bóp thân bút, xoay trục & rung haptic: chỉ hít nam châm, sạc không dây và tương thích trực tiếp với iPad Air M2 (11 inch) & iPad Pro M4 (11 inch); KHÔNG sạc hít nam châm hay tương thích Apple Pencil Pro trên iPad Gen 10 (iPad Gen 10 dùng Apple Pencil USB-C/thế hệ 1). Ngược lại, Samsung Tab S9 Ultra (tặng sẵn S Pen IP68) và Lenovo Tab M11 (4.29M, tặng kèm bút Lenovo Tab Pen) không cần mua thêm bút rời.'
    },
    {
        title: 'Chuột & Bàn phím Logitech/Microsoft: G304 pin AA, MX Master 3S/Keys S nối 3 máy, Arc Mouse, G413 SE',
        slug: 'huong-dan-chuot-ban-phim-g304-mx-master-3s-mx-keys-arc-mouse-g413',
        type: 'guide',
        category: 'Phụ kiện',
        keywords: ['g304', 'mx master 3s', 'mx keys s', 'g413 se', 'arc mouse', 'easy switch', '3 thiet bi', 'magspeed', 'pin aa', 'pin aaa', 'macbook'],
        answer: 'Logitech MX Master 3S (2.19M) & MX Keys S (2.79M) kết nối tối đa 3 thiết bị cùng lúc (Easy-Switch qua Bluetooth hoặc Logi Bolt, chuyển mượt giữa MacBook và Windows), Master 3S có con lăn điện từ MagSpeed & nút Quiet Clicks êm ái. Logitech G304 Lightspeed (790k) dùng 1 pin AA cho thời lượng ~250 giờ; G413 SE (1.59M) switch cơ tactile & keycap PBT dây bọc dù 1.8m; Microsoft Arc Mouse (1.89M) dùng 2 pin AAA ~6 tháng, bẻ cong để bật và duỗi phẳng 82g bỏ túi.'
    },
    {
        title: 'Thiết bị quay Vlog & Streamer: DJI Osmo Pocket 3 vs Osmo Mobile 6, DJI Mic 2 & Hub Ugreen 5-in-1',
        slug: 'quay-vlog-dji-osmo-pocket-3-mobile-6-dji-mic-2-va-hub-ugreen',
        type: 'guide',
        category: 'Phụ kiện',
        keywords: ['osmo pocket 3', 'osmo mobile 6', 'dji mic 2', 'hub ugreen', 'cm478', 'vlog', '32 bit float', '4k 120fps', 'cam bien 1 inch', 'hdmi 4k'],
        answer: 'DJI Osmo Pocket 3 Creator Combo (11.281M) dùng cảm biến 1 inch thực thụ + gimbal cơ 3 trục + quay 4K/120fps và sạc nhanh 80% trong 16 phút (kèm mic không dây trong bản Creator). Nếu quay bằng iPhone/Android có sẵn, DJI Osmo Mobile 6 (3.29M) có kẹp MagSafe & thanh kéo dài. DJI Mic 2 (7.99M) ghi âm nội bộ 32-bit Float chống rè/vỡ tiếng, gắn được cả Lightning, Type-C, jack 3.5mm & Bluetooth. Hub Ugreen CM478 5-in-1 (280k) xuất HDMI 4K@30Hz tiện cho MacBook & Ultrabook.'
    },
    {
        title: 'Tay cầm chơi game Sony PS5 DualSense & Dareu H101X kết nối PC/Laptop/Console',
        slug: 'tay-cam-choi-game-dualsense-va-dareu-h101x-ket-noi-pc',
        type: 'compatibility',
        category: 'Phụ kiện',
        keywords: ['dualsense', 'tay cam ps5', 'dareu h101x', 'haptic feedback', 'choi pc', 'steam', 'ket noi tay cam'],
        answer: 'Sony DualSense (1.89M) tương thích PS5 (bật full rung xúc giác Haptic Feedback & cò Adaptive Triggers) và chơi mượt trên PC/Steam/MacBook/iPhone qua Bluetooth 5.1 hoặc dây USB-C. Dareu H101X (1.59M) hỗ trợ nhận XInput chuẩn Xbox ngay lập tức (Xbox Wireless, Bluetooth, USB-C) rất dễ cắm-là-chạy trên mọi game PC/Windows mà không cần phần mềm trung gian.'
    },
    {
        title: 'Lưu ý Tai nghe & Loa JBL/Marshall/Sony: Cổng EarPods Lightning, Pin 100h, Chống nước Flip 6 vs Charge 5',
        slug: 'tuong-thich-earpods-lightning-va-chon-loa-tai-nghe-jbl-marshall-sony',
        type: 'compatibility',
        category: 'Tai nghe',
        keywords: ['earpods', 'lightning', 'iphone 15', 'iphone 16', 'iphone 17', 'jbl flip 6', 'jbl charge 5', 'major 5', 'minor iv', 'ult900n', 'inzone h3', 'tour pro 2', 'sac nguoc'],
        answer: 'CẢNH BÁO CỔNG CẮM: Apple EarPods Lightning (499k) CHỈ cắm trực tiếp được vào iPhone 14 trở xuống dùng chân Lightning (KHÔNG cắm vừa iPhone 15/16/17 vốn dùng USB-C). Với loa: JBL Flip 6 (2.49M) nhỏ gọn 550g IP67 ngâm nước 12h; JBL Charge 5 (3.49M) công suất lớn hơn 40W, pin 20h và có cổng USB sạc ngược điện thoại khi đi cắm trại. Tai nghe Marshall Major 5 pin kỷ lục >100h; Sony WH-ULT900N có nút kích bass ULT; Sony Inzone H3 (1.79M) là tai gaming có dây 360 Spatial Sound không độ trễ.'
    },
    {
        title: 'Đồng hồ thông minh tương thích iPhone/Android & chọn màn MIP Garmin vs AMOLED Watch 7 / Fit 3',
        slug: 'tuong-thich-dong-ho-thong-minh-ios-android-garmin-watch-band',
        type: 'compatibility',
        category: 'Đồng hồ thông minh',
        keywords: ['apple watch', 'galaxy watch 7', 'galaxy watch 6', 'forerunner 55', 'forerunner 165', 'watch fit 3', 'smart band 9', 'ket noi iphone', 'ket noi android', 'mip', 'huyet ap'],
        answer: 'QUY TẮC TƯƠNG THÍCH BẮT BUỘC: Apple Watch SE/Series 10 CHỈ ghép được với iPhone; Samsung Galaxy Watch 6/7 CHỈ hỗ trợ Android (và cần điện thoại Samsung để mở đầy đủ đo huyết áp/ECG). Garmin Forerunner 55 (chống chói MIP ngoài nắng pin 14 ngày, 37g), Forerunner 165 (AMOLED pin 11 ngày), Huawei Watch Fit 3 (pin 10 ngày) & Xiaomi Band 9 (pin 21 ngày) dùng tốt cho CẢ iPhone và Android.'
    },
    {
        title: 'Chọn Tablet đặc thù: Huawei MatePad 11.5 S PaperMatte (GBox), Surface Pro 9 Windows vs iPad / Xiaomi',
        slug: 'tablet-huawei-matepad-papermatte-gbox-va-surface-pro-9-windows',
        type: 'guide',
        category: 'Tablet',
        keywords: ['matepad', 'papermatte', 'huawei google', 'gbox', 'surface pro 9', 'ipad gen 10', 'ipad air m2', 'ipad pro m4', 'poco pad', 'pad 8 pro', 'honor pad 10'],
        answer: 'Huawei MatePad 11.5 S (13.49M, kèm bàn phím & màn 144Hz PaperMatte chống chói như trang giấy) chạy HarmonyOS nên mặc định KHÔNG có CH Play gốc, cần cài qua GBox để dùng YouTube/Drive/Meet (trung thực tư vấn rõ với khách). Microsoft Surface Pro 9 (22.99M, 879g, SSD tháo rời) chạy full Windows 11 cài được Excel macro, MISA, phần mềm PC. Muốn mượt & nhiều app học/vẽ sẵn nhất: iPad Gen 10 (8.99M), Xiaomi Poco Pad (6.49M, pin 10.000mAh) hoặc iPad Air M2 / Pro M4.'
    },
    {
        title: 'Khả năng nâng cấp RAM/SSD Laptop & Xuất nhiều màn hình trên MacBook Air M2 vs M3',
        slug: 'nang-cap-ram-ssd-laptop-va-xuat-man-hinh-macbook-air-m2-m3',
        type: 'guide',
        category: 'Laptop',
        keywords: ['nang cap ram', 'nang cap ssd', 'han chet', 'lpddr5', 'xuat 2 man hinh', 'macbook m2', 'macbook m3', 'thinkpad', 'nitro', 'legion', 'zenbook'],
        answer: 'Các dòng Ultrabook mỏng nhẹ dùng RAM LPDDR5/Unified như MacBook Air M2/M3, Zenbook 14 OLED, XPS 13, Swift Go 14 đều hàn RAM trên bo mạch không nâng được sau này (rất may đa số đã sẵn 16GB/32GB). Các laptop dùng khe DDR4/DDR5 như Acer Nitro V 15, ASUS TUF A16, Lenovo LOQ/Legion 5, HP Victus 15, Vivobook 15 nâng cấp được SSD NVMe và RAM dễ dàng. MacBook Air M2 hỗ trợ xuất 1 màn hình ngoài (tới 6K), còn MacBook Air M3 xuất tối đa 2 màn hình ngoài khi gập nắp.'
    },
    {
        title: 'Điện thoại màn gập Galaxy Z Fold7 & Siêu flagship Camera Zoom (S24/S25 Ultra, Find X8 Pro, Magic7 Pro, Xiaomi 14 Ultra)',
        slug: 'dien-thoai-gap-z-fold7-va-camera-zoom-flagship-hasselblad-leica',
        type: 'guide',
        category: 'Điện thoại',
        keywords: ['z fold7', 'flexhinge', 'gap khong nep', 's24 ultra', 's25 ultra', 'find x8 pro', 'magic7 pro', 'xiaomi 14 ultra', 'leica', 'hasselblad', 'telescopic', 'tiem vong'],
        answer: 'Samsung Galaxy Z Fold7 5G 512GB (43.99M, 226g) dùng bản lề FlexHinge hạn chế nếp gấp, mở màn hình 8.0 inch đa nhiệm 3 cửa sổ như tablet nhỏ & camera 200MP. Nếu thích chụp chân dung/zoom nghệ thuật: Galaxy S24/S25 Ultra (bút S Pen & zoom 200MP), OPPO Find X8/Find X8 Pro (Hasselblad + 2 kính tiềm vọng 3x & 6x, pin tới 5.910mAh), HONOR Magic7 Pro (200MP tele AI + kính NanoCrystal Shield siêu bền), Xiaomi 14 Ultra (cảm biến 1 inch Leica Summilux).'
    }
];

async function ensureKnowledgeBaseSeeded() {
    if (seededCheckedAt && (Date.now() - seededCheckedAt < 5 * 60 * 1000)) {
        return;
    }
    if (seedPromise) return seedPromise;

    seedPromise = (async () => {
        try {
            const existing = await KnowledgeArticle.find({}, 'slug').lean();
            const existingSlugs = new Set(existing.map(a => a.slug));
            const missing = CURATED_KNOWLEDGE_ARTICLES.filter(a => !existingSlugs.has(a.slug));

            if (missing.length > 0) {
                await KnowledgeArticle.insertMany(
                    missing.map(item => ({ ...item, active: true, source: 'rag_curated_seed' })),
                    { ordered: false }
                ).catch(() => {});
            }
            seededCheckedAt = Date.now();
        } catch (err) {
            console.warn('[ragService] Seed knowledge warning:', err.message);
        } finally {
            seedPromise = null;
        }
    })();

    return seedPromise;
}

const RAG_STOPWORDS = new Set([
    'cho', 'cua', 'khong', 'co', 'khach', 'hang', 'may', 'nay', 'kia', 'bao', 'gia',
    'voi', 'nhu', 'lam', 'sao', 'duoc', 'nhung', 'cac', 'mot', 'hai', 'minh', 'ban',
    'shop', 'em', 'anh', 'chi', 'toi', 'mua', 'can', 'tim', 'tu', 'van', 'giup',
    'xem', 'hoi', 'gi', 'nao', 'dau', 'the', 've', 'va', 'hay', 'hoac', 'tren',
    'duoi', 'tam', 'thu', 'nhieu', 'con', 'khac', 'loai', 'thich', 'trieu', 'vnd'
]);

/**
 * Mở rộng từ khóa tiếng Việt theo ngữ nghĩa để tăng recall của RAG
 */
function expandVietnameseQueryTerms(rawQuery) {
    const norm = normalizeText(rawQuery);
    const tokens = norm.split(/[^a-z0-9]+/i).filter(t => t.length >= 2 && !RAG_STOPWORDS.has(t));
    const expanded = new Set(tokens);

    const semanticExpansions = [
        [/pin|sac du phong|may bay|wh|mah|chai pin/, ['pin', 'sac', 'du phong', 'battery', '100wh', 'gan', 'anker', 'baseus', 'ugreen']],
        [/mat|can thi|moi mat|oled|pwm|ips|nhuc mat|papermatte/, ['man hinh', 'screen', 'oled', 'ips', 'pwm', 'hz', 'eye', 'papermatte']],
        [/code|lap trinh|it|cntt|docker|ai|machine|xuat man hinh|2 man hinh/, ['ram', '16gb', '32gb', 'cpu', 'macbook', 'rog', 'tuf', 'nitro', 'thinkpad', 'hub']],
        [/do hoa|render|photoshop|premiere|3d|cad|thiet ke|vlog|tiktok|quay phim|mic/, ['gpu', 'rtx', 'man hinh', 'macbook', 'rog', 'screen', 'dji', 'osmo', 'mic']],
        [/ke toan|excel|misa|numpad|van phong|windows|surface/, ['ram', '16gb', 'inspiron', 'vostro', 'aspire', 'ideapad', 'surface', 'windows']],
        [/mong nhe|di chuyen|di hoc|cafe|cong tac|cop xe|vision|balo|bo tui/, ['air', 'mong', 'nhe', '14 inch', '13 inch', 'zenbook', 'macbook', 'arc']],
        [/grab|shipper|ngoai troi|troi nang|pin trau|ben bi|loa to/, ['5000mah', 'amoled', 'oled', 'samsung', 'xiaomi', 'poco', 'ip68', 'oppo', '4000 nits']],
        [/bo me|ba me|ong ba|nguoi gia|nguoi lon|chu to/, ['galaxy', 'ipad', 'samsung', 'man hinh lon', '6.7']],
        [/chong on|anc|on ao|tap trung|loa|bass|nhac/, ['tai nghe', 'anc', 'sony', 'wh-1000xm5', 'airpods', 'buds', 'jbl', 'marshall', 'ult']],
        [/the thao|chay bo|tap luyen|gps|boi|gym|khang nuoc|chong nuoc/, ['garmin', 'watch', 'apple watch', 'galaxy watch', 'gps', 'ip68', 'ip67', 'ip54', 'buds', 'wave']],
        [/choi game|tay cam|ps5|switch|handheld|portal|cam tay|o dia/, ['ps5', 'switch', 'rog ally', 'claw', 'legion go', 'dualsense', 'dareu', 'portal']],
        [/but cam ung|pencil|chuot|ban phim|easy switch|3 may|da thiet bi|con lan|switch|keycap/, ['pencil', 'tab m11', 's pen', 'g502', 'g304', 'mx master', 'mx keys', 'g413', 'arc mouse']],
        [/tang qua|sinh nhat|nguoi yeu|goi qua|doi qua|sep|doi tac/, ['goi qua', 'hoa toc', 'showroom', 'voucher', 'doi qua']],
        [/chuyen du lieu|zalo|move to ios|cai app|ve sinh|teamviewer/, ['chuyen du lieu', 'zalo', 've sinh', 'cai app', 'mien phi']],
        [/cong ty|doanh nghiep|hoa don|vat|b2b/, ['vat', 'hoa don', 'doanh nghiep', 'b2b']],
        [/tra gop|thieu tien|cccd|lai suat|0%/, ['tra gop', '0%', 'cccd', 'the tin dung']],
        [/bao hanh|1 doi 1|chinh hang|seal|imei|vna|likenew|re hon|shopee/, ['bao hanh', '1 doi 1', 'chinh hang', 'vna', 'imei', 'nguyen seal']],
        [/thu cu|doi moi|ban lai|may cu/, ['thu cu', 'doi moi', 'tro gia']],
        [/giao hang|ship|cod|dong kiem|hoa toc|can gap|lay ngay/, ['giao hang', 'hoa toc', 'dong kiem', 'cod', 'showroom']],
        [/\bip\b|\bip\s?\d{2}/, ['iphone', 'apple']],
        [/\bmac\b/, ['macbook', 'apple']],
        [/\blap\b/, ['laptop']],
        [/\bcu\b|\bcu ruoi\b/, ['trieu']]
    ];

    semanticExpansions.forEach(([regex, additions]) => {
        if (regex.test(norm)) {
            additions.forEach(a => expanded.add(a));
        }
    });

    return Array.from(expanded);
}

/**
 * Chấm điểm tài liệu KnowledgeArticle theo mô hình hybrid BM25-keyword + category + exact title
 */
function scoreArticle(article, queryNorm, expandedTerms, preferredCategory) {
    const titleNorm = normalizeText(article.title);
    const kwNorm = normalizeText((article.keywords || []).join(' '));
    const answerNorm = normalizeText(article.answer);

    let titleOrKwScore = 0;
    let bodyScore = 0;
    for (const term of expandedTerms) {
        if (titleNorm.includes(term)) titleOrKwScore += 5;
        if (kwNorm.includes(term)) titleOrKwScore += 4;
        if (answerNorm.includes(term)) bodyScore += 0.6;
    }

    // Bonus cho cụm keyword nhiều từ khớp chính xác
    (article.keywords || []).forEach(kw => {
        const k = normalizeText(kw);
        if (k.length >= 5 && queryNorm.includes(k)) {
            titleOrKwScore += 8;
        }
    });

    // Không cho phép bài viết lọt top nếu không khớp gì vào tiêu đề/từ khóa
    if (titleOrKwScore < 5) return 0;

    let score = titleOrKwScore + Math.min(bodyScore, 4);
    if (preferredCategory && article.category === preferredCategory) {
        score += 2.5;
    } else if (article.category === 'all') {
        score += 0.5;
    }

    return score;
}

/**
 * Chấm điểm sản phẩm catalog theo truy vấn tự nhiên + cấu hình + memoryProfile
 */
function scoreCatalogProduct(product, queryNorm, expandedTerms, options = {}) {
    const nameNorm = normalizeText(product.name);
    const brandNorm = normalizeText(product.brand);
    const catNorm = normalizeText(product.category);
    const specsText = normalizeText(Object.values(product.specs || {}).filter(Boolean).join(' '));
    const tagsText = normalizeText((product.tags || []).join(' '));
    const descText = normalizeText(product.description || '');
    const fullHaystack = `${nameNorm} ${brandNorm} ${catNorm} ${specsText} ${tagsText} ${descText}`;

    let score = 0;

    // 1. Khớp từ khóa & thông số thực tế
    for (const term of expandedTerms) {
        if (nameNorm.includes(term)) score += 10;
        else if (brandNorm.includes(term)) score += 7;
        else if (specsText.includes(term) || tagsText.includes(term)) score += 5;
        else if (descText.includes(term)) score += 2.5;
    }

    // 2. Danh mục & Thương hiệu mục tiêu
    if (options.category && catNorm === normalizeText(options.category)) {
        score += 14;
    }
    if (options.brand && brandNorm === normalizeText(options.brand)) {
        score += 12;
    }

    // 3. Tận dụng Memory Profile dài hạn (sở hữu, hãng thích, hãng loại trừ)
    const mem = options.memoryProfile || {};
    const disliked = Array.from(new Set([
        ...(options.eliminatedBrands || []),
        ...(mem.dislikedBrands || [])
    ])).map(normalizeText).filter(Boolean);
    if (disliked.some(b => brandNorm.includes(b) || nameNorm.includes(b))) {
        return -999;
    }

    const owned = (mem.ownedDevices || []).map(normalizeText);
    if (owned.some(d => d.includes('iphone') || d.includes('macbook') || d.includes('ipad'))) {
        if (brandNorm === 'apple' || /airpods|apple watch|apple pencil|magsafe|hub|anker/.test(fullHaystack)) {
            score += 6;
        }
    }
    if ((mem.preferredBrands || []).some(b => brandNorm.includes(normalizeText(b)))) {
        score += 5;
    }

    // 3b. Thưởng điểm theo hồ sơ nghề nghiệp & đối tượng người dùng trong Memory Profile
    const roleNorm = normalizeText(mem.occupationOrRole || '');
    const buyingForNorm = normalizeText(mem.buyingFor || '');
    if (roleNorm.includes('ke toan') && /15\.6|numpad|aspire|inspiron|vostro|vivobook/.test(fullHaystack)) score += 6;
    if ((roleNorm.includes('lap trinh') || roleNorm.includes('cntt')) && /16gb|32gb|macbook|loq|legion|rog|thinkpad/.test(fullHaystack)) score += 6;
    if (roleNorm.includes('do hoa') && /rtx|oled|retina|macbook pro|rog/.test(fullHaystack)) score += 6;
    if (roleNorm.includes('y khoa') && /ipad|tablet|pencil/.test(fullHaystack)) score += 6;
    if (buyingForNorm.includes('bo me') || buyingForNorm.includes('nguoi lon')) {
        if (/samsung galaxy a|ipad|6\.7|5000/.test(fullHaystack)) score += 6;
    }
    if ((mem.shortlistedProducts || []).some(s => normalizeText(s.name) === nameNorm)) {
        score += 4;
    }

    // 4. Ngân sách
    const budgetMax = Number(options.budget || mem.budgetMax || 0);
    if (budgetMax > 0) {
        if (product.price <= budgetMax) score += 8;
        else if (product.price <= budgetMax * 1.18) score += 1;
        else score -= 6;
    }

    // 5. Chất lượng kinh doanh (còn hàng, rating, độ phổ biến)
    if (Number(product.stock || 0) > 0) score += 4;
    else score -= 8;
    score += Math.min(Number(product.rating || 4.5), 5) * 0.8;
    score += Math.log10(Number(product.soldCount || 0) + 1);

    return score;
}

/**
 * Truy xuất toàn diện Multi-Source RAG Context phục vụ Gemini & Deterministic Engine
 */
async function retrieveRagContext({
    query = '',
    category = '',
    brand = '',
    budget = 0,
    eliminatedBrands = [],
    memoryProfile = {},
    limitProducts = 4,
    limitArticles = 3,
    preloadedProducts = null
} = {}) {
    await ensureKnowledgeBaseSeeded();

    const queryNorm = normalizeText(query);
    const expandedTerms = expandVietnameseQueryTerms(`${query} ${category} ${brand}`);

    // 1. Truy xuất đồng thời KnowledgeArticles, Coupons và Products
    const [allArticles, activeCoupons, candidateProducts] = await Promise.all([
        KnowledgeArticle.find({ active: true }).lean(),
        Coupon.find({
            $or: [{ active: { $ne: false } }, { isActive: { $ne: false } }]
        }).sort({ minOrderValue: 1 }).lean(),
        preloadedProducts && preloadedProducts.length
            ? Promise.resolve(preloadedProducts)
            : Product.find({ active: { $ne: false } }).limit(200).lean()
    ]);

    // 2. Chấm điểm Top Knowledge Articles (yêu cầu ngưỡng cao để tránh trộn bài viết không liên quan)
    const scoredArticles = allArticles
        .map(article => ({
            article,
            score: scoreArticle(article, queryNorm, expandedTerms, category)
        }))
        .filter(item => item.score >= 7)
        .sort((a, b) => b.score - a.score)
        .slice(0, limitArticles)
        .map(item => item.article);

    // 3. Chấm điểm Top Products
    let retrievedProducts = [];
    if (preloadedProducts && preloadedProducts.length > 0) {
        retrievedProducts = preloadedProducts.slice(0, limitProducts);
    } else {
        retrievedProducts = candidateProducts
            .map(p => ({
                product: p,
                score: scoreCatalogProduct(p, queryNorm, expandedTerms, {
                    category,
                    brand,
                    budget,
                    eliminatedBrands,
                    memoryProfile
                })
            }))
            .filter(item => item.score > 4)
            .sort((a, b) => b.score - a.score)
            .slice(0, limitProducts)
            .map(item => item.product);
    }

    // 4. Truy xuất Đánh giá khách hàng thực tế (Reviews) của các sản phẩm vừa tìm được
    let verifiedReviews = [];
    if (retrievedProducts.length > 0) {
        try {
            const productIds = retrievedProducts.map(p => p._id);
            verifiedReviews = await Review.find({
                product: { $in: productIds },
                rating: { $gte: 4 }
            })
                .sort({ createdAt: -1 })
                .limit(4)
                .lean();
        } catch (_) {
            verifiedReviews = [];
        }
    }

    // 5. Lọc mã giảm giá còn hạn hợp lệ
    const now = new Date();
    const validCoupons = activeCoupons
        .filter(c => {
            const exp = c.expiresAt || c.expiryDate;
            return !exp || new Date(exp) > now;
        })
        .slice(0, 3);

    // 6. Định dạng Evidence Packet gọn nhẹ, sạch sẽ cho AI Prompt (bao gồm cả thông số sản phẩm khớp RAG & phụ kiện đồng bộ)
    const evidenceSections = [];
    if (scoredArticles.length > 0) {
        evidenceSections.push(
            `• Kiến thức & Chính sách cửa hàng liên quan (${scoredArticles.length} tài liệu):\n` +
            scoredArticles.map(a => `  - [${a.title}]: ${a.answer}`).join('\n')
        );
    }
    if (retrievedProducts.length > 0) {
        evidenceSections.push(
            `• Sản phẩm thực tế trong kho khớp ngữ cảnh RAG (${retrievedProducts.length} mẫu):\n` +
            retrievedProducts.map(p => {
                const s = p.specs || {};
                const highlights = [s.cpu, s.gpu, s.ram, s.storage, s.screen, s.camera, s.battery, s.connectivity, s.weight, s.os].filter(Boolean).slice(0, 5).join(', ');
                const shortDesc = String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 120);
                return `  - **${p.name}** (${p.category || 'Chính hãng'} · ${Number(p.price || 0).toLocaleString('vi-VN')}đ · ${Number(p.stock || 0) > 0 ? `Sẵn ${p.stock} máy` : 'Đặt trước'})${highlights ? ` [${highlights}]` : ''}${shortDesc ? ` — ${shortDesc}` : ''}`;
            }).join('\n')
        );
    }
    if (validCoupons.length > 0) {
        evidenceSections.push(
            `• Mã giảm giá đang hiệu lực hôm nay:\n` +
            validCoupons.map(c => {
                const isPct = (c.type || c.discountType) === 'percent' || (c.type || c.discountType) === 'percentage';
                const val = c.value ?? c.discountValue ?? 0;
                const valTxt = isPct ? `Giảm ${val}%` : `Giảm ${Number(val).toLocaleString('vi-VN')}đ`;
                const minTxt = c.minOrderValue > 0 ? `đơn từ ${Number(c.minOrderValue).toLocaleString('vi-VN')}đ` : 'mọi đơn';
                return `  - Mã **${c.code}**: ${valTxt} (${minTxt})`;
            }).join('\n')
        );
    }
    if (verifiedReviews.length > 0) {
        const prodMap = new Map(retrievedProducts.map(p => [String(p._id), p.name]));
        evidenceSections.push(
            `• Đánh giá xác thực từ khách hàng đã mua:\n` +
            verifiedReviews.map(r => `  - [${prodMap.get(String(r.product)) || 'Sản phẩm'} · ${r.rating}⭐]: "${String(r.comment || '').slice(0, 140)}"`).join('\n')
        );
    }

    return {
        articles: scoredArticles,
        products: retrievedProducts,
        coupons: validCoupons,
        reviews: verifiedReviews,
        ragEvidenceText: evidenceSections.join('\n\n'),
        ragSources: [
            ...scoredArticles.map(a => ({ kind: 'knowledge', slug: a.slug, title: a.title })),
            ...retrievedProducts.map(p => ({ kind: 'product', id: p._id, name: p.name })),
            ...validCoupons.map(c => ({ kind: 'coupon', code: c.code }))
        ]
    };
}

module.exports = {
    CURATED_KNOWLEDGE_ARTICLES,
    ensureKnowledgeBaseSeeded,
    expandVietnameseQueryTerms,
    retrieveRagContext
};
