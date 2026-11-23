/**
 * memoryService.js
 * Hệ thống Trí nhớ Hội thoại 3 Tầng (3-Tier Conversational Memory) cho AI Chatbot:
 * - Tầng 1 (Working Memory): Cửa sổ 20 lượt hội thoại gần nhất (Multi-turn History).
 * - Tầng 2 (Rolling Summary): Tóm tắt nén tự động các lượt cũ khi hội thoại vượt ngưỡng dài.
 * - Tầng 3 (Semantic User Profile): Lưu sở thích thương hiệu, hãng loại trừ, thiết bị đang sở hữu,
 *   nghề nghiệp, ngân sách, các thiết bị nhận diện từ ảnh (Visual Search) & sản phẩm đã xem.
 */

const ChatSession = require('../../models/ChatSession');
const { MAX_HISTORY_TURNS } = require('./aiModelService');

const HEALTH_SENSITIVE_RE = /(nghe kem|kho nghe|nghenh ng[aã]ng|suy gi[aả]m th[iị]nh l[uự]c|điếc|diec|b[eệ]nh|ch[aẩ]n đo[aá]n|d[iị]u tr[iị]|thu[oố]c|b[aệ]nh l[yý])/i;

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function sanitizeStoredChatText(value) {
    const text = String(value || '');
    return HEALTH_SENSITIVE_RE.test(text) ? '[Nội dung sức khỏe đã được ẩn để bảo vệ riêng tư]' : text.slice(0, 1400);
}

function resolveSessionKey(req) {
    const user = req.user;
    const rawSid = String(req.body?.sessionId || req.body?.context?.sessionKey || req.query?.sessionId || '').trim();
    const cleaned = rawSid.replace(/[^a-zA-Z0-9_:-]/g, '');

    if (user?._id) {
        const ownKey = `user_${user._id}`;
        // Logged-in users can only access their own user_* key or an explicit non-user session key
        if (cleaned && cleaned.length >= 4 && cleaned.length <= 120) {
            if (/^user_/i.test(cleaned)) {
                return cleaned === ownKey ? ownKey : ownKey;
            }
            return cleaned;
        }
        return ownKey;
    }

    // Guests may NEVER access another member's user_* session key (prevents IDOR)
    if (cleaned && cleaned.length >= 4 && cleaned.length <= 120 && !/^user_/i.test(cleaned)) {
        return cleaned;
    }
    return `guest_${String(req.headers['x-forwarded-for'] || req.ip || 'session').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
}

function uniquePush(list = [], items = [], maxLen = 10) {
    const set = new Set((Array.isArray(list) ? list : []).filter(Boolean));
    (Array.isArray(items) ? items : [items]).forEach(item => {
        if (item && String(item).trim()) set.add(String(item).trim());
    });
    return Array.from(set).slice(-maxLen);
}

/**
 * Tự động bóc tách tín hiệu trí nhớ dài hạn từ câu hỏi & ngữ cảnh tư vấn
 */
function extractMemorySignals(message = '', context = {}, response = null) {
    const norm = normalizeText(message);
    const prevProfile = context.memoryProfile || {};

    let occupationOrRole = prevProfile.occupationOrRole || '';
    const roleMap = [
        [/ke toan|tai chinh|kiem toan|excel|misa/, 'Kế toán / Tài chính'],
        [/\b(lap trinh vien|hoc lap trinh|nganh lap trinh|developer|coder|viet code|cntt|ky su phan mem|nganh phan mem|phat trien phan mem|ky su it|machine learning|data science)\b/, 'Lập trình viên / Sinh viên CNTT'],
        [/giao vien|giang vien|day hoc|giao an|thuyet trinh/, 'Giáo viên / Giảng viên'],
        [/bac si|y khoa|duoc si|benh vien|giai phau/, 'Bác sĩ / Sinh viên Y khoa'],
        [/sales|bat dong san|moi gioi|nhan vien kinh doanh|di gap khach/, 'Kinh doanh / Bất động sản'],
        [/thiet ke|designer|do hoa|photoshop|render|kien truc|dung phim/, 'Thiết kế đồ họa / Sáng tạo nội dung'],
        [/streamer|youtuber|livestream|gamer|esports/, 'Streamer / Game thủ'],
        [/sinh vien|hoc sinh|tan sinh vien|giang duong/, 'Học sinh / Sinh viên']
    ];
    for (const [rx, label] of roleMap) {
        if (rx.test(norm)) {
            occupationOrRole = label;
            break;
        }
    }

    // Đối tượng mua / Người sử dụng cuối (Quà tặng, bố mẹ, con cái, công ty...)
    const llmMem = response?.context?.memoryProfile || {};
    let buyingFor = llmMem.buyingFor || prevProfile.buyingFor || '';
    const buyingForMap = [
        [/\b(bo me|ba me|ong ba|phu huynh|nguoi gia|nguoi lon tuoi|me toi|bo toi|ba tui|ma tui)\b/, 'Bố mẹ / Người lớn tuổi'],
        [/\b(con gai|con trai|cho be|cho con|tre em|hoc sinh tieu hoc|cap 1|cap 2)\b/, 'Con cái / Học sinh nhỏ'],
        [/\b(nguoi yeu|ban gai|ban trai|vo|chong|ky niem|valentine|8\/3|20\/10)\b/, 'Vợ / Chồng / Người yêu (Quà tặng)'],
        [/\b(tang sep|doi tac|khach hang|khai truong|qua tang)\b/, 'Quà tặng đối tác / Cấp trên'],
        [/\b(cong ty|doanh nghiep|nhan vien|b2b|van phong cong ty)\b/, 'Doanh nghiệp / Công ty (B2B)']
    ];
    for (const [rx, label] of buyingForMap) {
        if (rx.test(norm)) {
            buyingFor = label;
            break;
        }
    }

    // Hình thức thanh toán / tài chính ưu tiên
    let preferredPaymentMethod = llmMem.preferredPaymentMethod || prevProfile.preferredPaymentMethod || '';
    if (/\b(cccd|can cuoc|khong can the|tai chinh|fe credit|home credit)\b/.test(norm)) {
        preferredPaymentMethod = 'Trả góp CCCD gắn chip';
    } else if (/\b(tra gop|gop 0|the tin dung|credit card)\b/.test(norm)) {
        preferredPaymentMethod = 'Trả góp 0% thẻ tín dụng';
    } else if (/\b(hoa don do|vat|mst|chuyen khoan cong ty)\b/.test(norm)) {
        preferredPaymentMethod = 'Xuất hóa đơn VAT điện tử';
    } else if (/\b(cod|dong kiem|nhan hang tra tien)\b/.test(norm)) {
        preferredPaymentMethod = 'COD đồng kiểm mở hộp';
    }

    // Rào cản / Băn khoăn khách đã nêu để tư vấn viên ghi nhớ giải tỏa khéo léo
    const objectionMap = [
        [/\b(hoi vo|hoi chong|hoi ba me|hoi gia dinh|suy nghi them|can nhac)\b/, 'Cần hỏi ý kiến gia đình / suy nghĩ thêm'],
        [/\b(dat qua|cao qua|vuot ngan sach|ngai gia|re hon|cho khac re)\b/, 'Nhạy cảm giá / So sánh giá nơi khác'],
        [/\b(so loi|so chai pin|nong may|bao hanh kho|so hang dung)\b/, 'Lo ngại độ bền / bảo hành / nguồn gốc'],
        [/\b(can gap|giao ngay|hom nay|bay gio|ship gap|chuyen bay)\b/, 'Cần nhận máy gấp trong ngày'],
        [/\b(chuyen du lieu|zalo|danh ba|cai dat san|khong ranh cai)\b/, 'Cần hỗ trợ cài đặt & chuyển dữ liệu']
    ];
    const detectedObjections = [];
    objectionMap.forEach(([rx, label]) => {
        if (rx.test(norm)) detectedObjections.push(label);
    });

    // Tâm lý chung hiện tại của khách
    let customerMood = prevProfile.customerMood || '';
    if (/\b(cam on|tuyet voi|gioi qua|nhiet tinh|hay qua|ưng qua|de thuong)\b/.test(norm)) customerMood = 'happy';
    else if (/\b(gap|nhanh|ngay|lien)\b/.test(norm)) customerMood = 'urgent';
    else if (/\b(phan van|chua chac|so|ngai|ban khoan|khong biet)\b/.test(norm)) customerMood = 'hesitant';
    else if (/\b(dat|re|bot|giam|sv|sinh vien|tiet kiem)\b/.test(norm)) customerMood = 'price_sensitive';

    // Thiết bị khách đã đang sở hữu (quan trọng để tư vấn đồng bộ hệ sinh thái)
    const ownedDetected = [];
    const ownedPatterns = [
        [/(?:dang dung|co san|xai|dang xai|dung chung voi|hien tai minh dung).*?\b(iphone|macbook|ipad|android|samsung|windows|laptop windows)\b/, 1],
        [/\b(iphone|macbook|ipad|android|samsung)\b.*?(?:roi|san roi|co roi)/, 1]
    ];
    for (const [rx, groupIdx] of ownedPatterns) {
        const m = norm.match(rx);
        if (m && m[groupIdx]) {
            const dev = m[groupIdx].toUpperCase() === 'IPHONE' ? 'iPhone'
                : m[groupIdx].includes('macbook') ? 'MacBook'
                    : m[groupIdx].includes('ipad') ? 'iPad'
                        : m[groupIdx].includes('samsung') ? 'Samsung Galaxy'
                            : m[groupIdx].includes('android') ? 'Android'
                                : 'Laptop Windows';
            ownedDetected.push(dev);
        }
    }

    // Tiêu chí ưu tiên xuyên suốt
    const priorityMap = [
        [/mong nhe|nho gon|mang di|du lich|cong tac/, 'Mỏng nhẹ di động'],
        [/pin trau|pin lau|ca ngay|du phong/, 'Pin bền bỉ'],
        [/chong on|anc|may bay|yen tinh/, 'Chống ồn chủ động ANC'],
        [/chup anh|camera|quay phim|vlog|tiktok/, 'Camera quay chụp đẹp'],
        [/choi game|fps|rtx|120hz|144hz|genshin|valorant|nghe buoc chan/, 'Gaming hiệu năng cao'],
        [/bao ve mat|can thi|chong moi mat|pwm|papermatte/, 'Màn hình dịu mắt'],
        [/numpad|phim so|excel/, 'Bàn phím số Numpad'],
        [/chong nuoc|khang nuoc|ip54|ip67|ip68|tap gym|chay bo/, 'Kháng nước / Thể thao'],
        [/am bass|extra bass|rock|edm|hi-?res|ldac/, 'Âm thanh chất lượng / Bass mạnh'],
        [/micro|dam thoai|hop online|hoc tieng anh|ielts|zoom/, 'Micro thoại & họp rõ nét'],
        [/co day|cam day|jack 3\.5|3\.5mm|do tre thap|khong can sac/, 'Kết nối có dây ổn định']
    ];
    const detectedPriorities = [];
    priorityMap.forEach(([rx, label]) => {
        if (rx.test(norm)) detectedPriorities.push(label);
    });

    // Sở thích kết nối (có dây vs không dây) - xử lý phủ định trước khi gán sở thích
    let connectionPreference = llmMem.connectionPreference || prevProfile.connectionPreference || '';
    const rejectsWired = /(khong thich|khong muon|so|tranh|ngai|ghet|bo qua).{0,20}\b(co day|cam day|day ruom ra|vuong day)\b/.test(norm);
    const rejectsWireless = /(khong thich|khong muon|so|tranh|ngai|ghet|bo qua).{0,20}\b(khong day|bluetooth|sac pin)\b/.test(norm);
    const asksWired = !rejectsWired && /\b(co day|cam day|day cam|wired|jack 3\.5|3\.5mm)\b/.test(norm) && !/\b(khong day|bluetooth|true wireless|tws)\b/.test(norm);
    const asksWireless = !rejectsWireless && /\b(khong day|bluetooth|true wireless|tws|wireless)\b/.test(norm) && !/\b(co day|cam day)\b/.test(norm);
    if (asksWired || rejectsWireless) connectionPreference = 'wired';
    else if (asksWireless || rejectsWired) connectionPreference = 'wireless';

    // Kiểu dáng / Form factor ưa thích (chụp tai, nhét tai, gọn nhẹ, màn hình lớn) - không gán nhầm câu phủ định
    let formFactorPreference = llmMem.formFactorPreference || prevProfile.formFactorPreference || '';
    const rejectsInEar = /(khong thich|khong muon|so|tranh|ngai|ghet|bo qua).{0,20}\b(nhet tai|in ear|in-ear|nut cao su|bi tai)\b/.test(norm);
    const rejectsOverEar = /(khong thich|khong muon|so|tranh|ngai|ghet|bo qua).{0,20}\b(chup tai|trum tai|over ear|over-ear|on ear|on-ear)\b/.test(norm);
    if (!rejectsOverEar && /\b(chup tai|trum tai|over ear|over-ear|on ear|on-ear|headset)\b/.test(norm)) {
        formFactorPreference = 'over_ear';
    } else if (rejectsInEar && !rejectsOverEar) {
        formFactorPreference = 'over_ear';
    } else if (!rejectsInEar && /\b(nhet tai|in ear|in-ear|earbud|earbuds|true wireless|tws)\b/.test(norm)) {
        formFactorPreference = 'in_ear';
    } else if (rejectsOverEar && !rejectsInEar) {
        formFactorPreference = 'in_ear';
    } else if (/\b(13 inch|14 inch|mong nhe|nho gon|gon tay|6\.1 inch|6\.3 inch)\b/.test(norm)) {
        formFactorPreference = 'compact';
    } else if (/\b(man hinh lon|man to|16 inch|15\.6 inch|6\.7 inch|6\.8 inch|6\.9 inch)\b/.test(norm)) {
        formFactorPreference = 'large_screen';
    }

    // Yêu cầu cổng kết nối (rất quan trọng khi tư vấn tai nghe có dây, hub, củ sạc)
    const detectedPorts = [];
    if (/\b(lightning|iphone 14|iphone 13|iphone 12|iphone 11)\b/.test(norm)) detectedPorts.push('Lightning');
    if (/\b(type c|type-c|usb c|usb-c|iphone 15|iphone 16|iphone 17)\b/.test(norm)) detectedPorts.push('USB-C');
    if (/\b(3\.5mm|jack 3\.5|cong 3\.5|lo 3\.5|3\.5)\b/.test(norm)) detectedPorts.push('Jack 3.5mm');
    if (/\b(hdmi|may chieu|man hinh ngoai|man hinh roi)\b/.test(norm)) detectedPorts.push('HDMI');
    if (/\b(usb a|usb-a|cong usb|dau thu usb)\b/.test(norm)) detectedPorts.push('USB-A');

    // Tính năng khách không thích / muốn tránh (Negative Memory)
    const detectedRejectedFeatures = [];
    const rejectFeatureMap = [
        [/(khong thich|so|tranh|ngai|ghet).*(nhet tai|bi tai|dau tai|nut cao su)/, 'Không thích nhét tai gây bí/đau tai'],
        [/(khong thich|khong muon|ngai|ghet).*(co day|vuong day|day ruom ra|day nho)/, 'Không muốn dây vướng víu'],
        [/(khong thich|khong muon|ngai|ghet).*(sac pin|sac nhieu|nhanh het pin|khong day)/, 'Ngại sạc pin / ưu tiên ổn định không lo hết pin'],
        [/(khong thich|khong muon|ngai|so).*(nang|to qua|cong kenh|day)/, 'Không muốn máy nặng hoặc cồng kềnh'],
        [/(khong thich|khong muon|ngai|so).*(nong may|on|quat keu)/, 'Không muốn máy nóng hoặc ồn']
    ];
    rejectFeatureMap.forEach(([rx, label]) => {
        if (rx.test(norm)) detectedRejectedFeatures.push(label);
    });

    // Màu sắc ưa thích
    let preferredColor = llmMem.preferredColor || prevProfile.preferredColor || '';
    const colorMap = [
        [/\b(mau den|den nham|den titan|midnight|jet black)\b/, 'Đen'],
        [/\b(mau trang|trang bac|starlight|silver|mau bac)\b/, 'Trắng / Bạc'],
        [/\b(titan tu nhien|titan sa mac|mau titan)\b/, 'Titan'],
        [/\b(mau xanh|xanh duong|xanh la|xanh reu|ultramarine|teal)\b/, 'Xanh'],
        [/\b(mau hong|vang hong|rose gold|pink)\b/, 'Hồng / Vàng hồng'],
        [/\b(mau tim|purple|lavender)\b/, 'Tím'],
        [/\b(mau xam|space gray|graphite)\b/, 'Xám']
    ];
    for (const [rx, label] of colorMap) {
        if (rx.test(norm)) {
            preferredColor = label;
            break;
        }
    }

    // Chủ đề / danh mục đã trao đổi gần đây
    const activeTopic = response?.context?.category || context.category || '';
    const recentTopics = uniquePush(
        prevProfile.recentTopics,
        [activeTopic && activeTopic !== 'all' ? activeTopic : ''].filter(Boolean),
        5
    );

    const preferredBrands = uniquePush(
        prevProfile.preferredBrands,
        [context.brand, response?.context?.brand].filter(b => b && b !== 'all' && b !== 'Tất cả thương hiệu'),
        6
    );
    // Phát hiện thương hiệu khách từ chối / không thích ngay trong câu nói tự nhiên
    const rawDislikeBrands = [];
    const dislikeRx = /(?:khong thich|khong muon|loai|bo qua|tru|tranh|dung lay|khong lay|ghet)\s+(?:hang\s+|thuong hieu\s+|dong\s+)?(apple|asus|dell|acer|hp|lenovo|msi|samsung|sony|lg|huawei|xiaomi|oppo|garmin|logitech|microsoft|anker|nintendo)\b/gi;
    let dm;
    while ((dm = dislikeRx.exec(norm)) !== null) {
        const b = dm[1];
        const canonical = b === 'asus' ? 'ASUS' : b === 'hp' ? 'HP' : b === 'msi' ? 'MSI' : b === 'lg' ? 'LG' : b.charAt(0).toUpperCase() + b.slice(1);
        rawDislikeBrands.push(canonical);
    }

    const dislikedBrands = uniquePush(
        prevProfile.dislikedBrands,
        [...(context.eliminatedBrands || []), ...(response?.context?.eliminatedBrands || []), ...rawDislikeBrands],
        6
    );

    const budgetVal = Number(response?.context?.budget || context.budget || 0);
    const budgetMin = Number(response?.context?.budgetMin || context.budgetMin || prevProfile.budgetMin || 0);
    const budgetMax = budgetVal || Number(response?.context?.budgetMax || context.budgetMax || prevProfile.budgetMax || 0);
    const budgetStrict = Boolean(response?.context?.budgetType === 'hard' || context.budgetType === 'hard' || prevProfile.budgetStrict);

    // Sản phẩm đã thảo luận
    const newProducts = Array.isArray(response?.products) ? response.products : [];
    const existingDiscussed = Array.isArray(prevProfile.discussedProducts) ? prevProfile.discussedProducts : [];
    const mergedDiscussed = [...existingDiscussed];
    newProducts.slice(0, 4).forEach(p => {
        if (!p || !p.name) return;
        const pid = String(p._id || p.id || '');
        if (!mergedDiscussed.some(ex => String(ex.productId || '') === pid || ex.name === p.name)) {
            mergedDiscussed.push({
                productId: pid,
                name: p.name,
                category: p.category || '',
                price: Number(p.price || 0)
            });
        }
    });

    // Sản phẩm khách từng khen / chọn đưa vào danh sách cân nhắc (shortlist)
    const existingShortlisted = Array.isArray(prevProfile.shortlistedProducts) ? prevProfile.shortlistedProducts : [];
    const mergedShortlisted = [...existingShortlisted];
    const isShortlistSignal = /\b(ung|thich|chot|chon con nay|lay con nay|khá ok|on ap|ok ne|duoc day|xem ky con)\b/i.test(norm);
    const contextFocusedProduct = Array.isArray(context.lastProducts) && context.lastProducts[0] ? context.lastProducts[0] : null;
    const candidateShortlist = newProducts[0] || contextFocusedProduct;
    if (isShortlistSignal && candidateShortlist && candidateShortlist.name) {
        const pid = String(candidateShortlist._id || candidateShortlist.id || '');
        if (!mergedShortlisted.some(item => String(item.productId || '') === pid || item.name === candidateShortlist.name)) {
            mergedShortlisted.push({
                productId: pid,
                name: candidateShortlist.name,
                price: Number(candidateShortlist.price || 0)
            });
        }
    }

    const lastVisualDevices = Array.isArray(response?.detectedDevices) && response.detectedDevices.length > 0
        ? response.detectedDevices.map(d => ({ name: d.name, category: d.category, brand: d.brand }))
        : (Array.isArray(context.lastVisualDevices) ? context.lastVisualDevices : (prevProfile.lastVisualDevices || []));

    return {
        preferredBrands,
        dislikedBrands,
        ownedDevices: uniquePush(prevProfile.ownedDevices, ownedDetected, 6),
        occupationOrRole,
        buyingFor,
        preferredPaymentMethod,
        customerMood: llmMem.customerMood || customerMood,
        objectionsRaised: uniquePush(prevProfile.objectionsRaised, [...detectedObjections, ...(Array.isArray(llmMem.objectionsRaised) ? llmMem.objectionsRaised : [])], 6),
        keyPriorities: uniquePush(prevProfile.keyPriorities, [...detectedPriorities, ...(Array.isArray(llmMem.keyPriorities) ? llmMem.keyPriorities : [])], 10),
        connectionPreference,
        formFactorPreference,
        portRequirements: uniquePush(prevProfile.portRequirements, [...detectedPorts, ...(Array.isArray(llmMem.portRequirements) ? llmMem.portRequirements : [])], 6),
        rejectedFeatures: uniquePush(prevProfile.rejectedFeatures, [...detectedRejectedFeatures, ...(Array.isArray(llmMem.rejectedFeatures) ? llmMem.rejectedFeatures : [])], 6),
        preferredColor,
        recentTopics,
        shortlistedProducts: mergedShortlisted.slice(-5),
        budgetMin,
        budgetMax,
        budgetStrict,
        lastVisualDevices,
        discussedProducts: mergedDiscussed.slice(-12),
        turnCount: Number(prevProfile.turnCount || 0) + 1,
        recurringVisitCount: Number(prevProfile.recurringVisitCount || 1)
    };
}

/**
 * Nén các lượt hội thoại cũ thành bản tóm tắt gọn nhẹ (Tier 2 Rolling Summary)
 */
function buildRollingSummary(existingSummary = '', archivedMessages = [], profile = {}) {
    if ((!Array.isArray(archivedMessages) || archivedMessages.length === 0) && !profile.occupationOrRole && !profile.buyingFor && !profile.connectionPreference) {
        return existingSummary || '';
    }
    const highlights = [];
    (archivedMessages || []).forEach(msg => {
        if (msg.sender === 'user' && msg.text && !msg.text.startsWith('[Nội dung')) {
            const clean = String(msg.text).replace(/\s+/g, ' ').trim().slice(0, 110);
            highlights.push(`Khách hỏi: "${clean}"`);
        }
        if (msg.sender === 'assistant' && Array.isArray(msg.products) && msg.products.length > 0) {
            highlights.push(`Đã gợi ý: ${msg.products.map(p => p.name).filter(Boolean).slice(0, 2).join(', ')}`);
        }
    });

    const factTags = [
        profile.occupationOrRole ? `Đối tượng: ${profile.occupationOrRole}` : '',
        profile.buyingFor ? `Mua cho: ${profile.buyingFor}` : '',
        profile.connectionPreference ? `Kết nối: ${profile.connectionPreference === 'wired' ? 'Ưu tiên có dây' : 'Ưu tiên không dây'}` : '',
        profile.formFactorPreference ? `Kiểu dáng: ${profile.formFactorPreference}` : '',
        Array.isArray(profile.portRequirements) && profile.portRequirements.length ? `Cổng cần: ${profile.portRequirements.join(', ')}` : '',
        Array.isArray(profile.rejectedFeatures) && profile.rejectedFeatures.length ? `Tránh: ${profile.rejectedFeatures.join(', ')}` : '',
        profile.preferredColor ? `Màu thích: ${profile.preferredColor}` : '',
        profile.budgetMax ? `Ngân sách tối đa: ${Number(profile.budgetMax).toLocaleString('vi-VN')}đ` : '',
        profile.preferredPaymentMethod ? `Thanh toán: ${profile.preferredPaymentMethod}` : '',
        Array.isArray(profile.objectionsRaised) && profile.objectionsRaised.length ? `Băn khoăn: ${profile.objectionsRaised.join(', ')}` : ''
    ].filter(Boolean).join('. ');

    const body = highlights.slice(-6).join(' | ');
    const merged = [factTags, existingSummary, body].filter(Boolean).join(' | ');
    return merged.slice(-1200).trim();
}

/**
 * Tải Trí nhớ phiên chat từ MongoDB và trộn thông minh với context client gửi lên
 */
async function hydrateContextWithSessionMemory(req, incomingContext = {}) {
    const sessionKey = resolveSessionKey(req);
    const baseCtx = { ...(incomingContext || {}), sessionKey };

    try {
        const session = await ChatSession.findOne({ sessionKey }).lean();
        if (!session) {
            // Nếu là thành viên đã đăng nhập mở phiên chat mới, tự động kế thừa hồ sơ dài hạn từ phiên trước đó
            if (req.user?._id) {
                const priorSession = await ChatSession.findOne({
                    customerId: req.user._id,
                    sessionKey: { $ne: sessionKey }
                }).sort({ updatedAt: -1 }).lean();
                if (priorSession?.memoryProfile) {
                    const inheritedProfile = {
                        preferredBrands: priorSession.memoryProfile.preferredBrands || [],
                        dislikedBrands: priorSession.memoryProfile.dislikedBrands || [],
                        ownedDevices: priorSession.memoryProfile.ownedDevices || [],
                        occupationOrRole: priorSession.memoryProfile.occupationOrRole || '',
                        buyingFor: priorSession.memoryProfile.buyingFor || '',
                        preferredPaymentMethod: priorSession.memoryProfile.preferredPaymentMethod || '',
                        keyPriorities: priorSession.memoryProfile.keyPriorities || [],
                        connectionPreference: priorSession.memoryProfile.connectionPreference || '',
                        formFactorPreference: priorSession.memoryProfile.formFactorPreference || '',
                        portRequirements: priorSession.memoryProfile.portRequirements || [],
                        rejectedFeatures: priorSession.memoryProfile.rejectedFeatures || [],
                        preferredColor: priorSession.memoryProfile.preferredColor || '',
                        recentTopics: priorSession.memoryProfile.recentTopics || [],
                        shortlistedProducts: priorSession.memoryProfile.shortlistedProducts || [],
                        recurringVisitCount: Number(priorSession.memoryProfile.recurringVisitCount || 1) + 1
                    };
                    baseCtx.memoryProfile = extractMemorySignals(req.body?.message || '', {
                        ...baseCtx,
                        memoryProfile: { ...inheritedProfile, ...(baseCtx.memoryProfile || {}) }
                    });
                    if (priorSession.rollingSummary && !baseCtx.rollingSummary) {
                        baseCtx.rollingSummary = priorSession.rollingSummary;
                    }
                    return baseCtx;
                }
            }
            baseCtx.memoryProfile = extractMemorySignals(req.body?.message || '', baseCtx);
            return baseCtx;
        }

        const dbMessages = Array.isArray(session.messages) ? session.messages : [];
        const dbHistory = dbMessages
            .slice(-MAX_HISTORY_TURNS)
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                text: String(m.text || '').slice(0, 900)
            }))
            .filter(item => item.text);

        // Nếu client gửi conversationHistory dài hơn hoặc có lượt mới chưa lưu, ưu tiên bản đầy đủ hơn
        const clientHistory = Array.isArray(baseCtx.conversationHistory) ? baseCtx.conversationHistory : [];
        const mergedHistory = clientHistory.length >= dbHistory.length
            ? clientHistory.slice(-MAX_HISTORY_TURNS)
            : dbHistory;

        const mergedProfile = {
            ...(session.memoryProfile || {}),
            ...(baseCtx.memoryProfile || {}),
            preferredBrands: uniquePush(session.memoryProfile?.preferredBrands, baseCtx.memoryProfile?.preferredBrands, 6),
            dislikedBrands: uniquePush(session.memoryProfile?.dislikedBrands, baseCtx.memoryProfile?.dislikedBrands, 6),
            ownedDevices: uniquePush(session.memoryProfile?.ownedDevices, baseCtx.memoryProfile?.ownedDevices, 6),
            objectionsRaised: uniquePush(session.memoryProfile?.objectionsRaised, baseCtx.memoryProfile?.objectionsRaised, 6),
            keyPriorities: uniquePush(session.memoryProfile?.keyPriorities, baseCtx.memoryProfile?.keyPriorities, 10),
            portRequirements: uniquePush(session.memoryProfile?.portRequirements, baseCtx.memoryProfile?.portRequirements, 6),
            rejectedFeatures: uniquePush(session.memoryProfile?.rejectedFeatures, baseCtx.memoryProfile?.rejectedFeatures, 6),
            recentTopics: uniquePush(session.memoryProfile?.recentTopics, baseCtx.memoryProfile?.recentTopics, 5)
        };

        baseCtx.conversationHistory = mergedHistory;
        baseCtx.rollingSummary = session.rollingSummary || baseCtx.rollingSummary || '';
        baseCtx.memoryProfile = extractMemorySignals(req.body?.message || '', { ...baseCtx, memoryProfile: mergedProfile });

        const requestedMode = String(req.body?.mode || incomingContext?.chatMode || session.chatMode || '').trim().toLowerCase();
        baseCtx.chatMode = requestedMode === 'open_ai' ? 'open_ai' : 'tech_advisor';

        // Hydrate active lastProducts & category from persisted ChatSession if caller did not pass them
        const hasExplicitSession = Boolean(req.body?.sessionId || req.body?.context?.sessionKey || req.user?._id);
        const isExplicitClear = incomingContext?.consultationTrigger === 'toolbar_pick_device'
            || incomingContext?.stage === 'qualifying_needs'
            || incomingContext?.stage === 'store_overview';
        const isOpenAiMode = baseCtx.chatMode === 'open_ai';
        if (hasExplicitSession && !isExplicitClear && (!Array.isArray(baseCtx.lastProducts) || baseCtx.lastProducts.length === 0)) {
            let recoveredProducts = [];
            for (let i = dbMessages.length - 1; i >= 0; i--) {
                const m = dbMessages[i];
                if (m && m.sender === 'assistant' && Array.isArray(m.products) && m.products.length > 0) {
                    recoveredProducts = m.products.slice(0, 5);
                    break;
                }
            }
            if (recoveredProducts.length === 0 && Array.isArray(mergedProfile.discussedProducts) && mergedProfile.discussedProducts.length > 0) {
                recoveredProducts = mergedProfile.discussedProducts.slice(-4).map(d => ({
                    _id: Number(d.productId) || d.productId,
                    name: d.name,
                    category: d.category || '',
                    price: Number(d.price || 0)
                }));
            }
            if (recoveredProducts.length > 0) {
                baseCtx.lastProducts = recoveredProducts;
            }
        }
        if (hasExplicitSession && !isExplicitClear && !isOpenAiMode && !baseCtx.category && !baseCtx.pageCategory && session.interestedCategory && session.interestedCategory !== 'all' && incomingContext?.selectedCategory !== 'all') {
            baseCtx.category = session.interestedCategory;
        }
        if (hasExplicitSession && !isExplicitClear && !isOpenAiMode && !baseCtx.budget && Number(mergedProfile.budgetMax || 0) > 0) {
            baseCtx.budget = Number(mergedProfile.budgetMax);
        }

        if (!baseCtx.lastVisualDevices && Array.isArray(mergedProfile.lastVisualDevices) && mergedProfile.lastVisualDevices.length > 0) {
            baseCtx.lastVisualDevices = mergedProfile.lastVisualDevices;
        }
        const lastDbMsg = dbMessages[dbMessages.length - 1];
        if (lastDbMsg && lastDbMsg.sender === 'assistant' && lastDbMsg.intent === 'visual_not_in_catalog' && !baseCtx.stage && !baseCtx.pendingBrandSuggestion) {
            const lastDev = Array.isArray(mergedProfile.lastVisualDevices) ? mergedProfile.lastVisualDevices[0] : null;
            if (lastDev) {
                baseCtx.stage = 'visual_not_in_catalog';
                baseCtx.pendingBrandSuggestion = {
                    brand: lastDev.brand || '',
                    category: lastDev.category || '',
                    missingNames: mergedProfile.lastVisualDevices.map(d => d.name).filter(Boolean).join(', '),
                    hasSameBrand: Boolean(lastDev.brand)
                };
            }
        }
    } catch (err) {
        console.warn('[memoryService] hydrateSessionMemory skipped:', err.message);
    }

    return baseCtx;
}

/**
 * Lưu lượt trò chuyện + cập nhật 3 tầng Memory xuống MongoDB
 */
async function persistConversationTurn(req, userMessage, assistantResponse, hydratedContext = {}, extra = {}) {
    try {
        const user = req.user;
        const sessionKey = hydratedContext.sessionKey || resolveSessionKey(req);

        let session = await ChatSession.findOne({ sessionKey });
        if (!session) {
            session = new ChatSession({
                sessionKey,
                customerId: user ? user._id : undefined,
                customerName: user ? (user.name || user.email || 'Khách hàng') : (req.body?.customerName || `Khách vãng lai #${sessionKey.slice(-4)}`),
                customerPhone: user ? (user.phone || '') : (req.body?.customerPhone || ''),
                customerEmail: user ? (user.email || '') : '',
                isMember: Boolean(user),
                messages: []
            });
        } else if (user && !session.customerId) {
            session.customerId = user._id;
            session.customerName = user.name || session.customerName;
            session.customerPhone = user.phone || session.customerPhone;
            session.customerEmail = user.email || session.customerEmail;
            session.isMember = true;
        }

        session.messages.push({
            sender: 'user',
            text: sanitizeStoredChatText(userMessage),
            timestamp: new Date(),
            isImage: Boolean(extra.isImage),
            imageUrl: extra.imageUrl || ''
        });

        session.messages.push({
            sender: 'assistant',
            text: String(assistantResponse?.reply || assistantResponse?.message || '').slice(0, 3500),
            timestamp: new Date(),
            products: Array.isArray(assistantResponse?.products) ? assistantResponse.products.slice(0, 5) : [],
            visualDevices: Array.isArray(assistantResponse?.detectedDevices) ? assistantResponse.detectedDevices : [],
            ragSources: Array.isArray(assistantResponse?.meta?.ragSources) ? assistantResponse.meta.ragSources : [],
            intent: assistantResponse?.status || assistantResponse?.context?.currentIntent || extra.intent || ''
        });

        // Cập nhật Semantic Profile
        const nextProfile = extractMemorySignals(userMessage, hydratedContext, assistantResponse);
        session.memoryProfile = nextProfile;

        // Cập nhật Rolling Summary sớm ngay khi phiên vượt 10 tin nhắn (5 lượt) và nén khi vượt 30 tin
        if (session.messages.length > 30) {
            const overflowCount = session.messages.length - 26;
            const archived = session.messages.slice(0, overflowCount);
            session.rollingSummary = buildRollingSummary(session.rollingSummary, archived, nextProfile);
            // Giữ tối đa 80 tin nhắn gần nhất trong document để tăng chiều sâu trí nhớ hội thoại
            if (session.messages.length > 80) {
                session.messages = session.messages.slice(-80);
            }
        } else if (session.messages.length >= 10 && !session.rollingSummary) {
            session.rollingSummary = buildRollingSummary('', session.messages.slice(0, -4), nextProfile);
        }

        const cat = assistantResponse?.context?.category || extra.category || hydratedContext.category;
        const bgt = assistantResponse?.context?.budget || extra.budget || hydratedContext.budget;
        const modeToSave = assistantResponse?.context?.chatMode || extra.chatMode || req.body?.mode || hydratedContext.chatMode;
        if (modeToSave === 'open_ai' || modeToSave === 'tech_advisor') {
            session.chatMode = modeToSave;
        }
        if (cat) session.interestedCategory = String(cat);
        if (bgt) session.budgetRange = String(bgt);

        const safeSummary = String(extra.summary || assistantResponse?.context?.currentIntent || '').replace(/[\r\n]+/g, ' ').trim();
        session.intentSummary = HEALTH_SENSITIVE_RE.test(userMessage)
            ? (cat ? `Quan tâm ${cat}` : 'Quan tâm sản phẩm công nghệ')
            : (safeSummary || [cat && `Quan tâm ${cat}`, nextProfile.occupationOrRole].filter(Boolean).join(' · ') || 'Tư vấn sản phẩm công nghệ').slice(0, 160);

        session.updatedAt = new Date();
        if (!session.isMember) session.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await session.save();

        return nextProfile;
    } catch (err) {
        console.warn('[memoryService] persistConversationTurn warning:', err.message);
        return hydratedContext.memoryProfile || {};
    }
}

module.exports = {
    resolveSessionKey,
    sanitizeStoredChatText,
    extractMemorySignals,
    hydrateContextWithSessionMemory,
    persistConversationTurn
};
