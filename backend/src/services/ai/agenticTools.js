/**
 * agenticTools.js
 * Bộ công cụ Function Calling (Tool Use) cho kiến trúc LLM-First Agentic.
 * Thay vì khóa chặt AI bằng kịch bản regex hay Hard-RAG, LLM chủ động gọi các công cụ này
 * khi và chỉ khi cần dữ liệu thật từ MongoDB (sản phẩm, giá, tồn kho, so sánh, trả góp, voucher, đơn hàng, chính sách).
 */

const axios = require('axios');
const Product = require('../../models/Product');
const Coupon = require('../../models/Coupon');
const Order = require('../../models/Order');
const ragService = require('./ragService');
const {
    normalizeText,
    filterHeadphoneCandidates,
    calculateMatchScore
} = require('./consultationCoordinator');

const STATUS_LABELS = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    processing: 'Đang đóng gói & kiểm hàng',
    ready_to_ship: 'Sẵn sàng giao cho shipper',
    shipping: 'Đang giao hàng',
    completed: 'Giao hàng thành công',
    cancelled: 'Đã hủy',
    delivery_failed: 'Giao hàng không thành công',
    returned: 'Đã chuyển hoàn',
    boom: 'Giao hàng không thành công',
    return_requested: 'Yêu cầu đổi/trả'
};

const CANONICAL_CATEGORIES = [
    { canonical: 'Điện thoại', aliases: ['dien thoai', 'smartphone', 'iphone', 'phone', 'di dong', 'dt'] },
    { canonical: 'Laptop', aliases: ['laptop', 'macbook', 'may tinh xach tay', 'ultrabook', 'notebook'] },
    { canonical: 'Tablet', aliases: ['tablet', 'may tinh bang', 'ipad', 'matepad', 'galaxy tab'] },
    { canonical: 'Tai nghe', aliases: ['tai nghe', 'headphone', 'headset', 'earbuds', 'airpods', 'loa', 'am thanh'] },
    { canonical: 'Đồng hồ thông minh', aliases: ['dong ho', 'smartwatch', 'apple watch', 'garmin', 'galaxy watch', 'vong deo tay'] },
    { canonical: 'Máy chơi game', aliases: ['may choi game', 'console', 'ps5', 'playstation', 'switch', 'switch lite', 'switch oled', 'nintendo', 'pokemon', 'handheld', 'rog ally', 'steam deck', 'claw', 'legion go', 'ps portal', 'tay cam'] },
    { canonical: 'Phụ kiện', aliases: ['phu kien', 'chuot', 'ban phim', 'cu sac', 'sac du phong', 'pin du phong', 'hub', 'gimbal', 'micro', 'but cam ung', 'cap sac'] }
];

function resolveCanonicalCategory(rawCat = '') {
    const norm = normalizeText(rawCat);
    if (!norm) return '';
    for (const item of CANONICAL_CATEGORIES) {
        if (normalizeText(item.canonical) === norm) return item.canonical;
        if (item.aliases.some(a => norm.includes(a))) return item.canonical;
    }
    return '';
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarizeProductForTool(p) {
    const price = Number(p.price || 0);
    const compareAt = Number(p.compareAtPrice || 0);
    return {
        id: p._id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price,
        compareAtPrice: compareAt > price ? compareAt : null,
        stock: Number(p.stock || 0),
        rating: Number(p.rating || 5),
        soldCount: Number(p.soldCount || 0),
        warranty: p.warranty || 'Chính hãng 12 tháng (1 đổi 1 trong 30 ngày)',
        specs: p.specs || {},
        description: String(p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360),
        installment0Percent: {
            downPayment30Percent: Math.round(price * 0.3),
            monthly12Months: Math.round((price * 0.7) / 12)
        }
    };
}

/**
 * Khai báo JSON Schema cho Gemini Native Function Calling
 */
const TOOL_DECLARATIONS = [
    {
        name: 'search_products',
        description: 'Tìm kiếm sản phẩm chính hãng đang sẵn hàng trong kho MongoDB của cửa hàng theo từ khóa, danh mục, thương hiệu, khoảng giá, kiểu kết nối (có dây/không dây), kiểu dáng (chụp tai/nhét tai) hoặc tính năng. GỌI KHI khách hỏi tìm mua, xem giá, lọc máy, tư vấn sản phẩm của cửa hàng.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: {
                    type: 'STRING',
                    description: 'Từ khóa mô tả sản phẩm hoặc nhu cầu (ví dụ: "tai nghe có dây 3.5mm gaming", "laptop mỏng nhẹ sinh viên", "chuột gaming logitech", "pin sạc dự phòng máy bay").'
                },
                category: {
                    type: 'STRING',
                    description: 'Một trong 7 danh mục chuẩn nếu rõ: Điện thoại, Laptop, Tablet, Tai nghe, Đồng hồ thông minh, Máy chơi game, Phụ kiện.'
                },
                brand: {
                    type: 'STRING',
                    description: 'Tên thương hiệu khách ưu tiên (ví dụ: Apple, Samsung, Sony, ASUS, Logitech, Marshall, JBL, Garmin, Lenovo, Anker...).'
                },
                minPrice: {
                    type: 'NUMBER',
                    description: 'Giá tối thiểu tính bằng VND (ví dụ 10000000 cho 10 triệu).'
                },
                maxPrice: {
                    type: 'NUMBER',
                    description: 'Ngân sách tối đa tính bằng VND (ví dụ 2000000 cho 2 triệu, 15000000 cho 15 triệu).'
                },
                connectionType: {
                    type: 'STRING',
                    description: 'Nếu là tai nghe/chuột/bàn phím: "wired" (có dây / jack 3.5mm / Lightning / USB) hoặc "wireless" (không dây / Bluetooth).'
                },
                formFactor: {
                    type: 'STRING',
                    description: 'Nếu là tai nghe: "over_ear" (chụp tai) hoặc "in_ear" (nhét tai / earbuds).'
                },
                features: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Danh sách tính năng cần lọc (ví dụ: ["3.5mm", "chống ồn ANC", "chống nước", "mỏng nhẹ", "RTX", "bàn phím số"]).'
                },
                excludeBrands: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Các thương hiệu khách không muốn mua.'
                },
                limit: {
                    type: 'NUMBER',
                    description: 'Số lượng sản phẩm cần lấy (mặc định 3, tối đa 4).'
                }
            }
        }
    },
    {
        name: 'get_product_detail',
        description: 'Tra cứu đầy đủ thông số kỹ thuật, giá bán niêm yết, tồn kho và bảo hành của một sản phẩm cụ thể trong cửa hàng theo tên hoặc ID. GỌI KHI khách hỏi chi tiết 1 mẫu máy cụ thể.',
        parameters: {
            type: 'OBJECT',
            properties: {
                productId: {
                    type: 'NUMBER',
                    description: 'ID số của sản phẩm nếu đã biết.'
                },
                productName: {
                    type: 'STRING',
                    description: 'Tên hoặc cụm từ nhận diện sản phẩm (ví dụ: "Logitech G502 Hero", "Sony Inzone H3", "iPhone 16 Pro Max").'
                }
            }
        }
    },
    {
        name: 'compare_products',
        description: 'Lấy thông số kỹ thuật và giá thật của 2 đến 3 sản phẩm trong cửa hàng để so sánh khách quan. GỌI KHI khách muốn so sánh 2 mẫu máy/tai nghe/phụ kiện cụ thể.',
        parameters: {
            type: 'OBJECT',
            properties: {
                productNames: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Danh sách tên 2-3 sản phẩm cần so sánh (ví dụ: ["Sony WH-1000XM5", "Apple AirPods Pro 2"]).'
                },
                productIds: {
                    type: 'ARRAY',
                    items: { type: 'NUMBER' },
                    description: 'Danh sách ID sản phẩm nếu đã có sẵn từ ngữ cảnh.'
                }
            }
        }
    },
    {
        name: 'calculate_installment',
        description: 'Tính bảng trả góp 0% lãi suất (trả trước, góp hàng tháng 6/9/12 tháng) theo giá sản phẩm thật hoặc số tiền dự kiến.',
        parameters: {
            type: 'OBJECT',
            properties: {
                productName: {
                    type: 'STRING',
                    description: 'Tên sản phẩm cần tính trả góp (nếu có).'
                },
                amountVnd: {
                    type: 'NUMBER',
                    description: 'Số tiền tính bằng VND nếu khách chỉ nêu mức giá.'
                },
                downPaymentPercent: {
                    type: 'NUMBER',
                    description: 'Phần trăm trả trước (mặc định 30).'
                }
            }
        }
    },
    {
        name: 'get_active_coupons',
        description: 'Lấy danh sách mã giảm giá / voucher chính hãng đang có hiệu lực hôm nay tại cửa hàng kèm điều kiện áp dụng.',
        parameters: {
            type: 'OBJECT',
            properties: {
                orderAmountVnd: {
                    type: 'NUMBER',
                    description: 'Giá trị đơn dự kiến (VND) để gợi ý mã giảm tối ưu nhất nếu khách đã nêu.'
                }
            }
        }
    },
    {
        name: 'lookup_order',
        description: 'Tra cứu trạng thái xử lý & giao hàng của đơn hàng trong hệ thống theo mã đơn hoặc số điện thoại đặt hàng.',
        parameters: {
            type: 'OBJECT',
            properties: {
                orderId: {
                    type: 'STRING',
                    description: 'Mã đơn hàng (ví dụ: "54" hoặc "#54").'
                },
                phone: {
                    type: 'STRING',
                    description: 'Số điện thoại đặt hàng (nếu khách cung cấp).'
                }
            }
        }
    },
    {
        name: 'search_store_knowledge',
        description: 'Tra cứu kho tri thức & chính sách nội bộ của cửa hàng (bảo hành, 1 đổi 1 30 ngày, thu cũ đổi mới, giao hỏa tốc 2H, địa chỉ showroom, chuyển dữ liệu Zalo, quy định mang pin lên máy bay, mẹo tương thích thiết bị). GỌI KHI cần trích xuất chính sách hoặc hướng dẫn chuyên sâu của cửa hàng.',
        parameters: {
            type: 'OBJECT',
            properties: {
                topic: {
                    type: 'STRING',
                    description: 'Chủ đề hoặc câu hỏi cần tra cứu trong kho tri thức cửa hàng.'
                },
                category: {
                    type: 'STRING',
                    description: 'Danh mục liên quan nếu có.'
                }
            },
            required: ['topic']
        }
    },
    {
        name: 'add_to_cart',
        description: 'THÊM 1 HOẶC NHIỀU SẢN PHẨM CÙNG LÚC trực tiếp vào giỏ hàng của khách hàng trên website ngay từ khung chat. BẮT BUỘC GỌI NGAY khi khách nói "thêm vào giỏ", "thêm vô giỏ", "bỏ vào giỏ", "cho vào giỏ", "đặt mua", "mua ngay", "lấy cho tôi máy X và máy Y". Hệ thống giỏ hàng ĐÃ tích hợp đồng bộ 100% với khung chat!',
        parameters: {
            type: 'OBJECT',
            properties: {
                items: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            productName: {
                                type: 'STRING',
                                description: 'Tên sản phẩm cần thêm vào giỏ (ví dụ: "Nintendo Switch Lite", "iPhone 17 Pro", "Sony Inzone H3").'
                            },
                            productId: {
                                type: 'NUMBER',
                                description: 'ID sản phẩm nếu đã biết.'
                            },
                            quantity: {
                                type: 'NUMBER',
                                description: 'Số lượng cần thêm (mặc định 1).'
                            }
                        }
                    },
                    description: 'Danh sách 1 hoặc nhiều sản phẩm cần thêm vào giỏ hàng.'
                },
                openCartAfter: {
                    type: 'BOOLEAN',
                    description: 'Đặt true nếu khách muốn mở giỏ hàng / thanh toán ngay lập tức.'
                }
            },
            required: ['items']
        }
    },
    {
        name: 'web_search',
        description: 'Tra cứu tin tức, sự kiện, sản phẩm công nghệ/game/điện thoại mới ra mắt gần đây và thông tin cập nhật thời gian thực trên Internet (Google News tiếng Việt, Quốc tế & Wikipedia). BẮT BUỘC GỌI khi khách hỏi về sản phẩm mới ra mắt (như iPhone Duo, iPhone 18, Galaxy Z Fold8, GTA 6, PS6, chip mới...), sự kiện 2025-2026, tin tức hôm nay, hoặc bất kỳ tên sản phẩm/sự kiện nào bạn không chắc 100%.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: {
                    type: 'STRING',
                    description: 'Từ khóa ngắn gọn, rõ nghĩa để tìm tin mới nhất (ví dụ: "iPhone Duo Apple", "GTA 6 release date", "Samsung Galaxy S26 Ultra").'
                },
                lang: {
                    type: 'STRING',
                    description: 'Ngôn ngữ ưu tiên: "both" (mặc định — tra cả tiếng Việt & Quốc tế), "vi" hoặc "en".'
                }
            },
            required: ['query']
        }
    }
];

const TOOL_STATUS_LABELS = {
    search_products: '🔍 Đang tra kho sản phẩm chính hãng...',
    get_product_detail: '📋 Đang kiểm tra thông số chi tiết từ kho...',
    compare_products: '⚖️ Đang đối chiếu thông số thực tế giữa các mẫu...',
    calculate_installment: '💳 Đang tính toán bảng trả góp 0%...',
    get_active_coupons: '🎟️ Đang kiểm tra mã giảm giá đang mở hôm nay...',
    lookup_order: '📦 Đang tra cứu trạng thái đơn hàng...',
    search_store_knowledge: '📚 Đang kiểm tra chính sách & hướng dẫn cửa hàng...',
    add_to_cart: '🛒 Đang kiểm tra kho và thêm sản phẩm vào giỏ hàng...',
    web_search: '🌐 Đang tra cứu thông tin mới nhất trên Internet...'
};

async function findSingleProduct({ productId, productName }) {
    if (productId !== undefined && productId !== null && String(productId).trim() !== '') {
        const numId = Number(productId);
        if (Number.isFinite(numId)) {
            const byId = await Product.findOne({ _id: numId, active: { $ne: false } }).lean();
            if (byId) return byId;
        }
    }
    const q = String(productName || '').trim();
    if (!q) return null;

    const normQ = normalizeText(q);
    const tokens = normQ
        .split(/\s+/)
        .filter(t => t.length >= 2 && !['dien', 'thoai', 'laptop', 'tai', 'nghe', 'may', 'choi', 'game', 'chuot', 'ban', 'phim', 'dong', 'ho', 'chinh', 'hang', 'chiec', 'cai', 'con', 'mau'].includes(t));

    const all = await Product.find({ active: { $ne: false } }).lean();
    const qHasMax = /\bmax\b/.test(normQ);
    const qHasPlus = /\bplus\b/.test(normQ);
    const qHasUltra = /\bultra\b/.test(normQ);
    const qHasOled = /\boled\b/.test(normQ);
    const qHasLite = /\blite\b/.test(normQ);
    const qHasPro = /\bpro\b/.test(normQ);

    let best = null;
    let bestScore = -999;
    for (const p of all) {
        const pName = normalizeText(p.name || '');
        const pText = normalizeText(`${p.name} ${p.brand} ${(p.tags || []).join(' ')}`);
        let score = 0;
        let hitAll = tokens.length > 0;
        for (const t of tokens) {
            if (pName.includes(t)) score += t.length >= 4 ? 10 : 8;
            else if (pText.includes(t)) score += 4;
            else hitAll = false;
        }
        if (score <= 0) continue;
        if (hitAll) score += 18;
        if (pName.includes(normQ)) score += 15;

        // Phân biệt chính xác biến thể: "iPhone 17 Pro" không bị nhầm sang "iPhone 17 Pro Max", "Switch Lite" không nhầm "Switch OLED"
        if (!qHasMax && /\bmax\b/.test(pName)) score -= 14;
        if (!qHasPlus && /\bplus\b/.test(pName)) score -= 12;
        if (!qHasUltra && /\bultra\b/.test(pName)) score -= 12;
        if (!qHasOled && /\boled\b/.test(pName)) score -= 14;
        if (qHasLite && /\blite\b/.test(pName)) score += 14;
        if (qHasOled && /\boled\b/.test(pName)) score += 14;
        if (qHasPro && /\bpro\b/.test(pName) && !qHasMax && !/\bmax\b/.test(pName)) score += 10;

        // Ưu tiên tên gọn sát nhất khi bằng điểm & còn hàng
        if (p.stock > 0) score += 2;
        score -= pName.length * 0.02;

        if (score > bestScore) {
            bestScore = score;
            best = p;
        }
    }
    return bestScore >= 12 ? best : null;
}

async function execSearchProducts(args = {}, runtimeCtx = {}) {
    const queryStr = String(args.query || runtimeCtx.userMessage || '').trim();
    const category = resolveCanonicalCategory(args.category || '') || resolveCanonicalCategory(queryStr);
    const brand = String(args.brand || '').trim();
    const minPrice = Number(args.minPrice || 0);
    const maxPrice = Number(args.maxPrice || 0);
    const connectionType = String(args.connectionType || '').toLowerCase();
    const formFactor = String(args.formFactor || '').toLowerCase();
    const features = Array.isArray(args.features) ? args.features.map(String) : [];
    const excludeBrands = Array.isArray(args.excludeBrands) ? args.excludeBrands.map(b => normalizeText(b)) : [];
    const limit = Math.min(Math.max(Number(args.limit || 3), 1), 4);

    const mongoFilter = { active: { $ne: false }, stock: { $gt: 0 } };
    if (category) mongoFilter.category = category;
    if (brand) mongoFilter.brand = new RegExp(escapeRegex(brand), 'i');

    let pool = await Product.find(mongoFilter).lean();
    if (!pool.length && brand) {
        delete mongoFilter.brand;
        pool = await Product.find(mongoFilter).lean();
    }
    if (!pool.length && category) {
        pool = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } }).lean();
    }

    if (excludeBrands.length > 0) {
        const filteredEx = pool.filter(p => !excludeBrands.includes(normalizeText(p.brand || '')));
        if (filteredEx.length > 0) pool = filteredEx;
    }

    // Lọc khoảng giá (nới biên mềm nếu quá khắt khe và báo rõ trong metadata)
    let budgetRelaxed = false;
    if (minPrice > 0 || maxPrice > 0) {
        const priceMatched = pool.filter(p => {
            const pr = Number(p.price || 0);
            if (minPrice > 0 && pr < minPrice) return false;
            if (maxPrice > 0 && pr > maxPrice) return false;
            return true;
        });
        if (priceMatched.length > 0) {
            pool = priceMatched;
        } else {
            budgetRelaxed = true;
            const target = maxPrice || minPrice;
            pool.sort((a, b) => Math.abs((a.price || 0) - target) - Math.abs((b.price || 0) - target));
            pool = pool.slice(0, 6);
        }
    }

    const syntheticSignal = [
        queryStr,
        features.join(' '),
        connectionType === 'wired' ? 'có dây jack 3.5mm' : (connectionType === 'wireless' ? 'không dây bluetooth' : ''),
        formFactor === 'over_ear' ? 'chụp tai over-ear' : (formFactor === 'in_ear' ? 'nhét tai in-ear' : '')
    ].filter(Boolean).join(' ');

    const effectiveProfile = {
        ...(runtimeCtx.memoryProfile || {}),
        ...(connectionType ? { connectionPreference: connectionType } : {}),
        ...(formFactor ? { formFactorPreference: formFactor } : {})
    };

    const looksLikeHeadphoneQuery = category === 'Tai nghe'
        || /\b(tai nghe|earpods|airpods|inzone|chup tai|nhet tai|headphone|headset)\b/i.test(normalizeText(syntheticSignal));

    if (looksLikeHeadphoneQuery) {
        const hpOnly = pool.filter(p => p.category === 'Tai nghe');
        if (hpOnly.length > 0) {
            pool = filterHeadphoneCandidates(hpOnly, syntheticSignal, syntheticSignal, effectiveProfile);
            const normSig = normalizeText(syntheticSignal);
            if (/\b(3\.5mm|jack 3\.?5|cong 3\.?5|laptop|pc|ps5|fps|gaming)\b/i.test(normSig) && !/\b(lightning|iphone 1[1-4])\b/i.test(normSig)) {
                const nonLightning = pool.filter(p => !/earpods.*lightning/i.test(p.name || ''));
                if (nonLightning.length > 0) pool = nonLightning;
            }
        }
    }

    // Chấm điểm tổng hợp từ khóa + ngữ nghĩa + thông số
    const queryTokens = normalizeText(syntheticSignal)
        .split(/\s+/)
        .filter(t => t.length >= 2 && !['cho', 'toi', 'minh', 'tim', 'mua', 'xem', 'gia', 'duoi', 'tren', 'trieu', 'cu', 'mau', 'loai', 'san', 'pham', 'nao', 'tot', 'nhat'].includes(t));

    const scored = pool.map(p => {
        let score = calculateMatchScore(p, {
            useCase: queryStr,
            preference: syntheticSignal,
            brand
        });
        const haystack = normalizeText(`${p.name} ${p.brand} ${p.category} ${(p.tags || []).join(' ')} ${JSON.stringify(p.specs || {})} ${p.description || ''}`);
        const nameNorm = normalizeText(p.name || '');

        let kwScore = 0;
        let nameHitCount = 0;
        for (const tok of queryTokens) {
            if (nameNorm.includes(tok)) {
                kwScore += 16;
                nameHitCount += 1;
            } else if (haystack.includes(tok)) {
                kwScore += 7;
            }
        }
        score += kwScore;
        if (category && p.category === category) score += 20;
        if (connectionType === 'wired') {
            if (/earpods|inzone h3|co day/.test(haystack) && !/bluetooth|khong day/.test(haystack)) score += 60;
            else if (/3\.5mm|jack 3\.5|lightning|usb audio/.test(haystack)) score += 25;
            else score -= 60;
        } else if (connectionType === 'wireless') {
            if (/bluetooth|khong day|true wireless|tws/.test(haystack)) score += 25;
            else score -= 45;
        }
        if (maxPrice > 0 && !budgetRelaxed) {
            const closeness = 1 - Math.min(Math.abs((p.price || 0) - maxPrice) / Math.max(maxPrice, 1), 1);
            score += closeness * 12;
        }
        return { product: p, score, kwScore, nameHitCount };
    });

    scored.sort((a, b) => (b.score - a.score) || (b.kwScore - a.kwScore) || ((b.product.rating || 0) - (a.product.rating || 0)));

    // Khóa đồng nhất danh mục theo kết quả khớp từ khóa mạnh nhất (tuyệt đối không để Điện thoại lọt vào kết quả Máy chơi game / Tai nghe!)
    let filteredScored = scored;
    if (filteredScored.length > 0) {
        const primaryCat = category || (filteredScored[0].kwScore >= 14 ? filteredScored[0].product.category : '');
        if (primaryCat) {
            const sameCat = filteredScored.filter(item => item.product.category === primaryCat);
            if (sameCat.length > 0) filteredScored = sameCat;
        }
        // Khi khách hỏi tên model/dòng cụ thể (VD: "switch lite") đã có >= 1 kết quả khớp tên trực tiếp,
        // chỉ giữ các sản phẩm thực sự có khớp từ khóa (kwScore > 0) — không đệm thêm sản phẩm không liên quan cho đủ limit!
        const strongNameMatches = filteredScored.filter(item => item.nameHitCount > 0);
        if (strongNameMatches.length > 0 && queryTokens.length > 0) {
            const relatedKwMatches = filteredScored.filter(item => item.kwScore > 0);
            if (relatedKwMatches.length > 0) {
                filteredScored = relatedKwMatches;
            }
        }
    }

    // Kiểm tra xem sản phẩm top đầu có thực sự khớp từ khóa riêng biệt của model khách hỏi không (tránh nhầm "iPhone Duo" -> "iPhone 17" hay "GTA 6" -> "EarPods")
    const distinctTokens = queryTokens.filter(t => !['iphone', 'samsung', 'galaxy', 'xiaomi', 'sony', 'apple', 'asus', 'laptop', 'dien', 'thoai', 'tai', 'nghe', 'dong', 'ho', 'may', 'game', 'moi', 'ra', 'mat', 'gan', 'day', 'chinh', 'hang', 'shop', 'ban', 'chua', 'khong', 'co'].includes(t));
    const exactMatchCount = distinctTokens.length > 0
        ? filteredScored.filter(({ product }) => {
            const nameHay = normalizeText(`${product.name} ${(product.tags || []).join(' ')}`);
            return distinctTokens.every(tok => nameHay.includes(tok));
        }).length
        : filteredScored.length;
    const exactModelFound = exactMatchCount > 0;

    // Nếu không khớp đích danh và cũng không có từ khóa/danh mục/thương hiệu liên quan (VD: tìm đĩa game "GTA 6"),
    // tuyệt đối không đính kèm sản phẩm ngẫu nhiên không liên quan lên giao diện!
    const hasRelevantMatch = exactModelFound
        || Boolean(brand)
        || (Boolean(category) && (!distinctTokens.length || filteredScored.some(({ product }) => {
            const hay = normalizeText(`${product.name} ${product.brand} ${product.category} ${(product.tags || []).join(' ')}`);
            return queryTokens.some(tok => tok.length >= 3 && hay.includes(tok));
        })))
        || filteredScored.slice(0, limit).some(({ product, kwScore }) => {
            if (kwScore >= 14) return true;
            const hay = normalizeText(`${product.name} ${product.brand} ${(product.tags || []).join(' ')}`);
            return queryTokens.some(tok => tok.length >= 3 && !['moi', 'choi', 'game', 'ban', 'shop'].includes(tok) && hay.includes(tok));
        });

    const topProducts = hasRelevantMatch ? filteredScored.slice(0, limit).map(item => item.product) : [];

    if (Array.isArray(runtimeCtx.collectedProducts) && topProducts.length > 0) {
        topProducts.forEach(p => {
            if (!runtimeCtx.collectedProducts.some(x => String(x._id) === String(p._id))) {
                runtimeCtx.collectedProducts.push(p);
            }
        });
    }

    return {
        foundCount: topProducts.length,
        exactModelFound,
        budgetRelaxed,
        note: !hasRelevantMatch
            ? `Kho cửa hàng KHÔNG kinh doanh mặt hàng "${queryStr}" (cửa hàng chỉ bán thiết bị phần cứng công nghệ chính hãng: Điện thoại, Laptop, Tablet, Tai nghe, Đồng hồ thông minh, Máy chơi game console, Phụ kiện).`
            : (!exactModelFound
                ? `Kho cửa hàng hiện CHƯA có sẵn mẫu khớp đích danh với "${queryStr}". Dưới đây chỉ là các sản phẩm liên quan/thay thế gần nhất đang sẵn hàng tại kho.`
                : (budgetRelaxed
                    ? 'Không có sản phẩm chính hãng khớp chính xác mức giá yêu cầu; dưới đây là các mẫu chính hãng giá gần nhất hiện có sẵn tại kho.'
                    : (topProducts.length === 0 ? 'Không tìm thấy sản phẩm khớp trong kho hiện tại.' : 'Các sản phẩm chính hãng đang sẵn hàng tại kho.'))),
        products: topProducts.map(summarizeProductForTool)
    };
}

async function execGetProductDetail(args = {}, runtimeCtx = {}) {
    const prod = await findSingleProduct(args);
    if (!prod) {
        return { found: false, message: 'Không tìm thấy mẫu sản phẩm này trong kho hàng hiện tại của cửa hàng.' };
    }
    if (Array.isArray(runtimeCtx.collectedProducts) && !runtimeCtx.collectedProducts.some(x => String(x._id) === String(prod._id))) {
        runtimeCtx.collectedProducts.push(prod);
    }
    return { found: true, product: summarizeProductForTool(prod) };
}

async function execCompareProducts(args = {}, runtimeCtx = {}) {
    const names = Array.isArray(args.productNames) ? args.productNames : [];
    const ids = Array.isArray(args.productIds) ? args.productIds : [];
    const found = [];

    for (const id of ids.slice(0, 3)) {
        const p = await findSingleProduct({ productId: id });
        if (p && !found.some(x => String(x._id) === String(p._id))) found.push(p);
    }
    for (const name of names.slice(0, 3)) {
        const p = await findSingleProduct({ productName: name });
        if (p && !found.some(x => String(x._id) === String(p._id))) found.push(p);
    }

    // Nếu khách nói "so sánh 2 máy vừa rồi", lấy từ lastProducts trong context
    if (found.length < 2 && Array.isArray(runtimeCtx.lastProducts)) {
        for (const lp of runtimeCtx.lastProducts.slice(0, 3)) {
            const p = await findSingleProduct({ productId: lp._id || lp.id, productName: lp.name });
            if (p && !found.some(x => String(x._id) === String(p._id))) found.push(p);
            if (found.length >= 2) break;
        }
    }

    if (Array.isArray(runtimeCtx.collectedProducts)) {
        found.forEach(p => {
            if (!runtimeCtx.collectedProducts.some(x => String(x._id) === String(p._id))) {
                runtimeCtx.collectedProducts.push(p);
            }
        });
    }

    return {
        comparedCount: found.length,
        products: found.map(summarizeProductForTool)
    };
}

async function execCalculateInstallment(args = {}, runtimeCtx = {}) {
    let price = Number(args.amountVnd || 0);
    let prod = null;
    if (args.productName) {
        prod = await findSingleProduct({ productName: args.productName });
        if (prod) price = Number(prod.price || 0);
    } else if (!price && Array.isArray(runtimeCtx.lastProducts) && runtimeCtx.lastProducts[0]) {
        prod = await findSingleProduct({
            productId: runtimeCtx.lastProducts[0]._id || runtimeCtx.lastProducts[0].id,
            productName: runtimeCtx.lastProducts[0].name
        });
        if (prod) price = Number(prod.price || 0);
    }

    if (!price || price <= 0) {
        return {
            ok: false,
            message: 'Cần biết tên sản phẩm hoặc mức giá cụ thể để tính số tiền trả góp chính xác.'
        };
    }

    if (prod && Array.isArray(runtimeCtx.collectedProducts) && !runtimeCtx.collectedProducts.some(x => String(x._id) === String(prod._id))) {
        runtimeCtx.collectedProducts.push(prod);
    }

    const downPct = Math.min(Math.max(Number(args.downPaymentPercent || 30), 0), 70);
    const downPayment = Math.round((price * downPct) / 100);
    const loanAmount = price - downPayment;

    return {
        ok: true,
        productName: prod ? prod.name : null,
        totalPrice: price,
        downPaymentPercent: downPct,
        downPaymentVnd: downPayment,
        remainingLoanVnd: loanAmount,
        plans: [
            { months: 6, monthlyVnd: Math.round(loanAmount / 6), interestRate: '0%' },
            { months: 9, monthlyVnd: Math.round(loanAmount / 9), interestRate: '0%' },
            { months: 12, monthlyVnd: Math.round(loanAmount / 12), interestRate: '0%' }
        ],
        eligibility: 'Hỗ trợ trả góp 0% qua thẻ tín dụng (trả trước từ 0đ) hoặc duyệt hồ sơ CCCD gắn chip từ đủ 18 tuổi (duyệt online 5–15 phút, không giữ giấy tờ gốc).'
    };
}

async function execGetActiveCoupons(args = {}) {
    const now = new Date();
    const coupons = await Coupon.find({
        active: { $ne: false },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
    }).sort({ discountValue: -1 }).limit(10).lean();

    const orderAmt = Number(args.orderAmountVnd || 0);
    return {
        count: coupons.length,
        coupons: coupons.map(c => ({
            code: c.code,
            description: c.description || '',
            discountType: c.discountType,
            discountValue: c.discountValue,
            minOrderValue: Number(c.minOrderValue || 0),
            maxDiscount: Number(c.maxDiscount || 0),
            applicableForOrder: orderAmt > 0 ? orderAmt >= Number(c.minOrderValue || 0) : null
        }))
    };
}

async function execLookupOrder(args = {}, runtimeCtx = {}) {
    const req = runtimeCtx.req;
    const rawId = String(args.orderId || '').replace(/[^0-9]/g, '').trim();
    const rawPhone = String(args.phone || '').replace(/[^0-9]/g, '').trim();

    if (!rawId && !rawPhone && !req?.user?._id) {
        return {
            found: false,
            requiresInfo: true,
            message: 'Khách cần cung cấp mã đơn hàng (ví dụ #54) hoặc số điện thoại đặt hàng (hoặc đăng nhập tài khoản) để tra cứu đơn hàng bảo mật.'
        };
    }

    let order = null;
    if (rawId) {
        order = await Order.findOne({ _id: Number(rawId) }).lean().catch(() => null);
    } else if (rawPhone) {
        order = await Order.findOne({ phone: { $regex: escapeRegex(rawPhone.slice(-9)) } }).sort({ createdAt: -1 }).lean();
    } else if (req?.user?._id) {
        order = await Order.findOne({ customerId: req.user._id }).sort({ createdAt: -1 }).lean();
    }

    if (!order) {
        return { found: false, message: 'Chưa tìm thấy đơn hàng khớp với mã/số điện thoại đã cung cấp.' };
    }

    // Bảo vệ quyền riêng tư nếu tìm bằng mã đơn nhưng khách chưa đăng nhập trùng chủ đơn & không gửi SĐT khớp
    const userOwns = req?.user?._id && String(order.customerId) === String(req.user._id);
    const phoneMatches = rawPhone && order.phone && String(order.phone).replace(/[^0-9]/g, '').endsWith(rawPhone.slice(-8));
    if (!userOwns && !phoneMatches && req?.user?.role !== 'admin') {
        return {
            found: true,
            orderId: order._id,
            status: STATUS_LABELS[order.status] || order.status,
            createdAt: order.createdAt,
            total: order.total,
            privacyNote: 'Đã ẩn địa chỉ và số điện thoại chi tiết để bảo vệ thông tin cá nhân.'
        };
    }

    return {
        found: true,
        orderId: order._id,
        status: STATUS_LABELS[order.status] || order.status,
        paymentMethod: order.paymentMethod || 'COD',
        paymentStatus: order.paymentStatus || 'unpaid',
        total: order.total,
        createdAt: order.createdAt,
        items: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
    };
}

async function execSearchStoreKnowledge(args = {}, runtimeCtx = {}) {
    const topic = String(args.topic || runtimeCtx.userMessage || '').trim();
    const category = resolveCanonicalCategory(args.category || '');
    const rag = await ragService.retrieveRagContext({
        query: topic,
        category,
        memoryProfile: runtimeCtx.memoryProfile || {},
        limitProducts: 0,
        limitArticles: 3
    }).catch(() => ({ articles: [], coupons: [], ragSources: [], ragEvidenceText: '' }));

    if (Array.isArray(runtimeCtx.ragSources) && Array.isArray(rag.ragSources)) {
        rag.ragSources.forEach(s => {
            if (!runtimeCtx.ragSources.some(x => x.kind === s.kind && (x.slug || x.id || x.code) === (s.slug || s.id || s.code))) {
                runtimeCtx.ragSources.push(s);
            }
        });
    }

    return {
        storeInfo: {
            showroom: '78 Nguyễn Văn Khối, Quận Gò Vấp, TP.HCM (08:30 – 21:30 hàng ngày)',
            hotlineZalo: '0842.331.606',
            warrantyCore: '100% hàng mới chính hãng nguyên seal, lỗi 1 đổi 1 trong 30 ngày, bảo hành chính hãng 12–24 tháng, giao hỏa tốc 2H nội thành TP.HCM, trả góp 0%, xuất VAT điện tử.'
        },
        articles: (rag.articles || []).map(a => ({
            title: a.title,
            slug: a.slug,
            category: a.category,
            content: String(a.answer || '').slice(0, 900)
        }))
    };
}

function decodeXmlEntities(str = '') {
    return String(str)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchGoogleNewsRss(query, { hl = 'en-US', gl = 'US', ceid = 'US:en', limit = 5 } = {}) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;
    const res = await axios.get(url, {
        timeout: 4500,
        headers: { 'User-Agent': 'TechEcommerce-AI-Assistant/2.0' }
    });
    const xml = String(res.data || '');
    const items = [];
    const rx = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = rx.exec(xml)) !== null) {
        const block = m[1];
        const title = decodeXmlEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
        const pubDate = decodeXmlEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
        const source = decodeXmlEntities((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '');
        if (!title) continue;
        const parsedTime = Date.parse(pubDate) || 0;
        items.push({ title, source, publishedAt: pubDate, ts: parsedTime });
    }
    items.sort((a, b) => b.ts - a.ts);
    return items.slice(0, limit).map(({ title, source, publishedAt }) => ({ title, source, publishedAt }));
}

async function fetchWikipediaExtract(query, lang = 'en') {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&utf8=1`;
    const sr = await axios.get(searchUrl, {
        timeout: 3500,
        headers: { 'User-Agent': 'TechEcommerce-AI-Assistant/2.0' }
    });
    const top = sr.data?.query?.search?.[0];
    if (!top?.title) return null;

    const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title)}`;
    const sumRes = await axios.get(sumUrl, {
        timeout: 3500,
        headers: { 'User-Agent': 'TechEcommerce-AI-Assistant/2.0' }
    });
    const extract = String(sumRes.data?.extract || '').trim();
    if (!extract) return null;
    return {
        title: sumRes.data?.title || top.title,
        lang,
        summary: extract.slice(0, 600)
    };
}

async function execWebSearch(args = {}, runtimeCtx = {}) {
    const query = String(args.query || runtimeCtx.userMessage || '').trim();
    const langPref = String(args.lang || 'both').toLowerCase();
    const nowStr = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'full'
    }).format(new Date());

    if (!query) {
        return { currentDate: nowStr, results: [], note: 'Thiếu từ khóa tìm kiếm.' };
    }

    // 1. Ưu tiên Tavily API nếu quản trị viên đã cấu hình TAVILY_API_KEY trong .env
    if (process.env.TAVILY_API_KEY) {
        try {
            const tv = await axios.post('https://api.tavily.com/search', {
                api_key: process.env.TAVILY_API_KEY,
                query,
                search_depth: 'basic',
                max_results: 5,
                include_answer: true
            }, { timeout: 6000 });
            if (tv.data) {
                return {
                    currentDate: nowStr,
                    provider: 'tavily',
                    answer: tv.data.answer || '',
                    results: (tv.data.results || []).map(r => ({
                        title: r.title,
                        snippet: String(r.content || '').slice(0, 400),
                        url: r.url
                    }))
                };
            }
        } catch (_) {
            // Fall through sang Google News RSS + Wikipedia miễn phí
        }
    }

    // 2. Nguồn thời gian thực miễn phí, hợp lệ: Google News RSS (VN + Quốc tế) & Wikipedia API song song
    const tasks = [];
    if (langPref === 'both' || langPref === 'vi') {
        tasks.push(fetchGoogleNewsRss(query, { hl: 'vi', gl: 'VN', ceid: 'VN:vi', limit: 5 }).then(r => ({ key: 'newsVi', data: r })));
    }
    if (langPref === 'both' || langPref === 'en') {
        tasks.push(fetchGoogleNewsRss(query, { hl: 'en-US', gl: 'US', ceid: 'US:en', limit: 6 }).then(r => ({ key: 'newsEn', data: r })));
    }
    tasks.push(fetchWikipediaExtract(query, 'en').then(r => ({ key: 'wikiEn', data: r })));
    tasks.push(fetchWikipediaExtract(query, 'vi').then(r => ({ key: 'wikiVi', data: r })));

    const settled = await Promise.allSettled(tasks);
    const out = {
        currentDate: nowStr,
        query,
        newsVi: [],
        newsEn: [],
        wikipedia: []
    };
    for (const item of settled) {
        if (item.status !== 'fulfilled' || !item.value) continue;
        const { key, data } = item.value;
        if (key === 'newsVi' && Array.isArray(data)) out.newsVi = data;
        else if (key === 'newsEn' && Array.isArray(data)) out.newsEn = data;
        else if ((key === 'wikiEn' || key === 'wikiVi') && data) out.wikipedia.push(data);
    }

    if (Array.isArray(runtimeCtx.ragSources)) {
        runtimeCtx.ragSources.push({ kind: 'web_search', query, count: out.newsVi.length + out.newsEn.length });
    }

    return out;
}

async function execAddToCart(args = {}, runtimeCtx = {}) {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    const openCartAfter = Boolean(args.openCartAfter);
    if (openCartAfter) runtimeCtx.openCartAfter = true;

    const added = [];
    const notFound = [];
    const outOfStock = [];

    for (const item of rawItems.slice(0, 8)) {
        if (!item) continue;
        const qty = Math.min(Math.max(Math.round(Number(item.quantity || 1)), 1), 10);
        const prod = await findSingleProduct({
            productId: item.productId,
            productName: item.productName || item.name || ''
        });
        if (!prod) {
            notFound.push(item.productName || item.name || `#${item.productId}`);
            continue;
        }
        if (Number(prod.stock || 0) <= 0) {
            outOfStock.push({ id: prod._id, name: prod.name });
            continue;
        }

        const safeQty = Math.min(qty, Number(prod.stock || 1));
        const cartEntry = {
            productId: prod._id,
            name: prod.name,
            price: Number(prod.price || 0),
            compareAtPrice: Number(prod.compareAtPrice || 0),
            image: prod.image || '',
            category: prod.category || '',
            brand: prod.brand || '',
            quantity: safeQty,
            stock: Number(prod.stock || 0)
        };
        added.push(cartEntry);

        if (Array.isArray(runtimeCtx.cartActions)) {
            const existing = runtimeCtx.cartActions.find(x => String(x.productId) === String(cartEntry.productId));
            if (existing) existing.quantity += safeQty;
            else runtimeCtx.cartActions.push(cartEntry);
        }
        if (Array.isArray(runtimeCtx.collectedProducts) && !runtimeCtx.collectedProducts.some(x => String(x._id) === String(prod._id))) {
            runtimeCtx.collectedProducts.push(prod);
        }
    }

    const totalAddedPriceVnd = added.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const totalQuantity = added.reduce((sum, i) => sum + i.quantity, 0);

    return {
        success: added.length > 0,
        cartSynced: true,
        openCartAfter,
        addedCount: added.length,
        totalQuantity,
        totalAddedPriceVnd,
        added,
        notFound,
        outOfStock,
        message: added.length > 0
            ? `Đã tự động thêm thành công ${totalQuantity} sản phẩm (${added.map(i => `${i.name} x${i.quantity}`).join(', ')}) trực tiếp vào giỏ hàng trên website! Tổng tạm tính các món vừa thêm: ${totalAddedPriceVnd.toLocaleString('vi-VN')} đ.`
            : 'Chưa tìm thấy sản phẩm còn hàng khớp để thêm vào giỏ.'
    };
}

async function executeAgenticTool(name, args = {}, runtimeCtx = {}) {
    switch (name) {
        case 'search_products':
            return await execSearchProducts(args, runtimeCtx);
        case 'get_product_detail':
            return await execGetProductDetail(args, runtimeCtx);
        case 'compare_products':
            return await execCompareProducts(args, runtimeCtx);
        case 'calculate_installment':
            return await execCalculateInstallment(args, runtimeCtx);
        case 'get_active_coupons':
            return await execGetActiveCoupons(args, runtimeCtx);
        case 'lookup_order':
            return await execLookupOrder(args, runtimeCtx);
        case 'search_store_knowledge':
            return await execSearchStoreKnowledge(args, runtimeCtx);
        case 'add_to_cart':
            return await execAddToCart(args, runtimeCtx);
        case 'web_search':
            return await execWebSearch(args, runtimeCtx);
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

module.exports = {
    TOOL_DECLARATIONS,
    TOOL_STATUS_LABELS,
    executeAgenticTool
};
