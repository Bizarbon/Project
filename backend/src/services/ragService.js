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
        [/pin|sac du phong|may bay|wh|mah|chai pin/, ['pin', 'sac', 'du phong', 'battery', '100wh', 'gan', 'anker']],
        [/mat|can thi|moi mat|oled|pwm|ips|nhuc mat/, ['man hinh', 'screen', 'oled', 'ips', 'pwm', 'hz', 'eye']],
        [/code|lap trinh|it|cntt|docker|ai|machine/, ['ram', '16gb', '32gb', 'cpu', 'macbook', 'rog', 'tuf', 'nitro']],
        [/do hoa|render|photoshop|premiere|3d|cad|thiet ke/, ['gpu', 'rtx', 'man hinh', 'macbook', 'rog', 'screen']],
        [/ke toan|excel|misa|numpad|van phong/, ['ram', '16gb', 'inspiron', 'vostro', 'aspire', 'ideapad']],
        [/mong nhe|di chuyen|di hoc|cafe|cong tac/, ['air', 'mong', 'nhe', '14 inch']],
        [/chong on|anc|on ao|tap trung/, ['tai nghe', 'anc', 'sony', 'wh-1000xm5', 'airpods', 'buds']],
        [/the thao|chay bo|tap luyen|gps|boi/, ['garmin', 'watch', 'apple watch', 'galaxy watch', 'gps', 'ip68']],
        [/tang qua|sinh nhat|nguoi yeu|goi qua/, ['goi qua', 'hoa toc', 'showroom', 'voucher']],
        [/cong ty|doanh nghiep|hoa don|vat|b2b/, ['vat', 'hoa don', 'doanh nghiep', 'b2b']],
        [/tra gop|thieu tien|cccd|lai suat|0%/, ['tra gop', '0%', 'cccd', 'the tin dung']],
        [/bao hanh|1 doi 1|chinh hang|seal|imei|vna/, ['bao hanh', '1 doi 1', 'chinh hang', 'vna', 'imei']],
        [/thu cu|doi moi|ban lai|may cu/, ['thu cu', 'doi moi', 'tro gia']],
        [/giao hang|ship|cod|dong kiem|hoa toc/, ['giao hang', 'hoa toc', 'dong kiem', 'cod']]
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

    // 6. Định dạng Evidence Packet gọn nhẹ, sạch sẽ cho AI Prompt
    const evidenceSections = [];
    if (scoredArticles.length > 0) {
        evidenceSections.push(
            `• Kiến thức & Chính sách cửa hàng liên quan (${scoredArticles.length} tài liệu):\n` +
            scoredArticles.map(a => `  - [${a.title}]: ${a.answer}`).join('\n')
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
