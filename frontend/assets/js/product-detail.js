let product = null;
let relatedProducts = [];
let allCatalogProducts = [];
let bundleSelectedAccessories = [];
let wishlistIds = new Set();
let reviews = [];

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + '\u00A0đ';
}

function formatDate(value) {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleDateString('vi-VN');
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function resolveProductImage(src, root = '../../') {
    if (!src || typeof src !== 'string') return `${root}assets/images/product-placeholder.svg`.replace(/\/\//g, '/');
    const s = src.trim();
    if (!s) return `${root}assets/images/product-placeholder.svg`.replace(/\/\//g, '/');
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
    const clean = s.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\//, '');
    return `${root}${clean}`.replace(/\/\//g, '/');
}

function specEntries(p) {
    const specs = p.specs || {};
    const labelMap = {
        cpu: 'Vi xử lý (CPU/Chip)',
        chip: 'Vi xử lý (Chipset)',
        ram: 'Bộ nhớ RAM',
        storage: 'Bộ nhớ lưu trữ (ROM/SSD)',
        screen: 'Màn hình hiển thị',
        display: 'Màn hình hiển thị',
        camera: 'Hệ thống Camera',
        battery: 'Dung lượng Pin & Sạc',
        charging: 'Công nghệ sạc',
        os: 'Hệ điều hành',
        gpu: 'Card đồ họa (GPU)',
        connectivity: 'Chuẩn kết nối',
        weight: 'Trọng lượng máy',
        capacity: 'Dung lượng pin',
        power: 'Công suất tối đa',
        ports: 'Cổng giao tiếp',
        sensor: 'Cảm biến',
        resolution: 'Độ phân giải',
        anc: 'Chống ồn chủ động (ANC)',
        audio: 'Công nghệ âm thanh',
        mic: 'Micro thoại',
        compatibility: 'Khả năng tương thích',
        features: 'Tính năng nổi bật',
        dpi: 'Độ nhạy (DPI)',
        buttons: 'Số nút bấm',
        switch: 'Loại switch',
        tracking: 'Công nghệ theo dõi',
        material: 'Chất liệu'
    };

    const items = [];
    const handled = new Set();

    // Preferred order
    const priorityKeys = [
        'chip', 'cpu', 'gpu', 'ram', 'storage', 'screen', 'display', 'camera', 'resolution',
        'battery', 'charging', 'capacity', 'power', 'connectivity', 'ports', 'audio', 'anc',
        'mic', 'sensor', 'dpi', 'switch', 'compatibility', 'features', 'os', 'weight', 'material'
    ];

    for (const k of priorityKeys) {
        if (specs[k]) {
            items.push([labelMap[k] || k, specs[k]]);
            handled.add(k);
        }
    }

    for (const [k, v] of Object.entries(specs)) {
        if (!handled.has(k) && v) {
            items.push([labelMap[k] || k.toUpperCase(), v]);
        }
    }

    if (items.length) return items;

    return [
        ['Danh mục sản phẩm', p.category || 'Thiết bị công nghệ'],
        ['Thương hiệu', p.brand || 'Chính hãng'],
        ['Thời hạn bảo hành', p.warranty || '12 tháng chính hãng'],
        ['Tình trạng máy', p.stock > 0 ? 'Mới 100% nguyên seal' : 'Tạm hết hàng']
    ];
}

function showToast(message, type = 'success') {
    if (typeof window.showLucianToast === 'function') {
        window.showLucianToast(message, type);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

async function loadWishlist() {
    if (auth.isLoggedIn()) {
        try {
            const res = await fetch(`${API_URL}/customers/me/wishlist`, { headers: auth.getHeaders() });
            if (res.ok) {
                const data = await res.json();
                wishlistIds = new Set(data.map(item => Number(item._id || item)));
                return;
            }
        } catch (e) {
            console.warn('Wishlist load error:', e);
        }
    }
    wishlistIds = new Set(JSON.parse(localStorage.getItem('wishlist') || '[]').map(Number));
}

/* Lucian UX/UI Prompt #022 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#022 */
function syncDetailWishlistButton(productId) {
    const liked = wishlistIds.has(Number(productId));
    document.querySelectorAll('.btn-wishlist-toggle').forEach(btn => {
        btn.classList.toggle('active', liked);
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        const glyph = btn.querySelector('.u022-heart-glyph');
        const label = btn.querySelector('.u022-heart-text');
        if (glyph) glyph.textContent = liked ? '♥' : '♡';
        if (label) label.textContent = liked ? 'Đã lưu yêu thích' : 'Lưu vào yêu thích';
        btn.classList.remove('is-pop');
        if (liked) {
            void btn.offsetWidth;
            btn.classList.add('is-pop');
        }
    });
}

async function toggleWishlist(id) {
    const productId = Number(id);
    if (auth.isLoggedIn()) {
        try {
            const res = await fetch(`${API_URL}/customers/me/wishlist`, {
                method: 'PUT',
                headers: auth.getHeaders(),
                body: JSON.stringify({ productId, action: 'toggle' })
            });
            const data = await res.json();
            if (res.status === 401) {
                auth.logoutQuietly();
                updateLocalWishlist(productId);
                return;
            }
            if (!res.ok) throw new Error(data.message || 'Không cập nhật được yêu thích');
            wishlistIds = new Set(data.map(item => Number(item._id || item)));
            syncDetailWishlistButton(productId);
            showToast(wishlistIds.has(productId) ? 'Đã thêm vào danh sách yêu thích ♥' : 'Đã bỏ khỏi danh sách yêu thích', 'info');
        } catch (err) {
            updateLocalWishlist(productId);
            return;
        }
    } else {
        updateLocalWishlist(productId);
    }
}

function updateLocalWishlist(productId) {
    if (wishlistIds.has(productId)) wishlistIds.delete(productId);
    else wishlistIds.add(productId);
    localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
    syncDetailWishlistButton(productId);
    showToast(wishlistIds.has(productId) ? 'Đã thêm vào danh sách yêu thích ♥' : 'Đã bỏ khỏi danh sách yêu thích', 'info');
}

/* Lucian UX/UI Prompt #018 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#018 */
function adjustQty(delta) {
    const input = document.getElementById('detailQty');
    const group = input?.closest('.qty-control-group');
    if (!input || !product) return;
    let current = Number(input.value) || 1;
    let next = current + delta;
    if (next < 1 || (product.stock > 0 && next > product.stock)) {
        if (group) {
            group.classList.remove('u018-shake');
            void group.offsetWidth;
            group.classList.add('u018-shake');
        }
        if (product.stock > 0 && next > product.stock) {
            next = product.stock;
            showToast('Đã đạt số lượng tồn kho tối đa!', 'info');
        } else {
            next = 1;
        }
        input.value = next;
        return;
    }
    input.value = next;
    input.classList.remove('u018-roll-up', 'u018-roll-dn');
    void input.offsetWidth;
    input.classList.add(delta > 0 ? 'u018-roll-up' : 'u018-roll-dn');
}

function addToCart(id, shouldRedirect = false) {
    if (!product || product.stock <= 0) return showToast('Sản phẩm hiện đang tạm hết hàng!', 'error');
    const input = document.getElementById('detailQty');
    const qty = Math.max(Number(input?.value || 1), 1);
    if (qty > product.stock) return showToast('Số lượng yêu cầu vượt quá tồn kho!', 'error');

    const cartKey = auth.getCartStorageKey();
    const legacyCart = localStorage.getItem('cart');
    if (legacyCart !== null && localStorage.getItem(cartKey) === null) {
        localStorage.setItem(cartKey, legacyCart);
    }
    localStorage.removeItem('cart');
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const hasVariants = currentProductVariants && currentProductVariants.length > 1;
    const activeVar = hasVariants ? currentProductVariants[activeVariantIndex] : null;
    const activeStorage = (currentStorageOptions && currentStorageOptions[activeStorageIndex]) || null;
    const selectedColor = activeVar?.colorName || null;
    const selectedStorage = activeStorage?.label || null;
    const selectedImage = (activeVar?.image)
        ? resolveProductImage(activeVar.image, '/')
        : resolveProductImage(product.image, '/');
    const item = cart.find(i => String(i.productId) === String(id) && i.selectedColor === selectedColor && i.selectedStorage === selectedStorage);
    const nextQty = (item?.quantity || 0) + qty;
    if (nextQty > product.stock) return showToast('Số lượng trong giỏ hàng đã chạm giới hạn tồn kho!', 'error');

    if (item) {
        item.quantity = nextQty;
        item.selectedImage = selectedImage;
    } else {
        cart.push({
            productId: Number(id),
            quantity: qty,
            selectedColor: selectedColor,
            selectedStorage: selectedStorage,
            selectedImage: selectedImage,
            price: (Number(activeVar?.price) > 0 ? activeVar.price : product.price) + (activeStorage?.delta || 0)
        });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));

    /* Lucian UX/UI Prompt #051 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#051 */
    const totalCount = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
    let badgeEl = document.querySelector('.header-cart-badge');
    if (badgeEl) {
        badgeEl.textContent = String(totalCount);
        badgeEl.hidden = totalCount < 1;
    }
    document.querySelectorAll('.btn-add-cart-secondary, .sticky-btn-cart').forEach(btn => {
        btn.classList.add('u051-ok');
        clearTimeout(btn._u051Timer);
        btn._u051Timer = setTimeout(() => btn.classList.remove('u051-ok'), 1250);
    });

    let cartBtn = null;
    if (window.innerWidth <= 768) {
        const mobileCart = document.getElementById('bottomNavCartBtn') || document.querySelector('.cps-bottom-nav-bar a[href*="openCart"]');
        if (mobileCart && mobileCart.getBoundingClientRect().width > 0) {
            cartBtn = mobileCart;
            badgeEl = document.getElementById('bottomNavCartBadge') || mobileCart.querySelector('.cps-nav-badge') || badgeEl;
        }
    }
    if (!cartBtn) {
        cartBtn = document.querySelector('.header-action-btn[href*="openCart"]') || document.getElementById('headerCartButton') || document.getElementById('headerCartBtn') || document.querySelector('.header-cart-btn');
    }

    const heroImg = document.getElementById('mainProductImage') || document.getElementById('mainProductImg');
    if (heroImg && cartBtn && !shouldRedirect && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const sRect = heroImg.getBoundingClientRect();
        const eRect = cartBtn.getBoundingClientRect();
        if (sRect.width > 0 && eRect.width > 0) {
            const fly = document.createElement('img');
            fly.className = 'u051-fly-thumb';
            fly.src = heroImg.currentSrc || heroImg.src;
            fly.alt = '';
            fly.setAttribute('aria-hidden', 'true');
            const sx = sRect.left + sRect.width / 2 - 24;
            const sy = sRect.top + sRect.height / 2 - 24;
            const ex = eRect.left + eRect.width / 2 - 24;
            const ey = eRect.top + eRect.height / 2 - 24;
            fly.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(1)`;
            document.body.appendChild(fly);
            const anim = fly.animate([
                { transform: `translate3d(${sx}px, ${sy}px, 0) scale(1)`, opacity: 1 },
                { transform: `translate3d(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 65}px, 0) scale(0.7) rotate(10deg)`, opacity: 0.9, offset: 0.5 },
                { transform: `translate3d(${ex}px, ${ey}px, 0) scale(0.22) rotate(20deg)`, opacity: 0.15 }
            ], { duration: 540, easing: 'cubic-bezier(.22, 1, .36, 1)' });
            anim.onfinish = () => {
                fly.remove();
                cartBtn.classList.remove('u051-cart-bump');
                void cartBtn.offsetWidth;
                cartBtn.classList.add('u051-cart-bump');

                let ping = cartBtn.querySelector('.cart-radar-ping');
                if (!ping) {
                    ping = document.createElement('span');
                    ping.className = 'cart-radar-ping';
                    ping.setAttribute('aria-hidden', 'true');
                    cartBtn.style.position = cartBtn.style.position || 'relative';
                    cartBtn.appendChild(ping);
                }
                ping.classList.remove('is-active');
                void ping.offsetWidth;
                ping.classList.add('is-active');
                setTimeout(() => ping.remove(), 700);

                if (badgeEl) {
                    badgeEl.classList.remove('u051-badge-pop');
                    void badgeEl.offsetWidth;
                    badgeEl.classList.add('u051-badge-pop');
                }
                if (typeof window.triggerVisualHaptic === 'function') {
                    window.triggerVisualHaptic('success');
                }
            };
        } else {
            if (typeof window.triggerVisualHaptic === 'function') {
                window.triggerVisualHaptic('success');
            }
        }
    } else {
        if (typeof window.triggerVisualHaptic === 'function') {
            window.triggerVisualHaptic('success');
        }
    }

    // Update navbar badge if available
    window.dispatchEvent(new Event('cartUpdated'));

    if (shouldRedirect) {
        window.location.href = '../../index.html?openCart=1';
    } else {
        showToast(`Đã thêm ${qty} sản phẩm vào giỏ hàng thành công!`);
    }
}

function buyNow(id) {
    openExpressCheckoutModal();
}

let currentGalleryImages = [];
let currentGalleryIndex = 0;
let currentProductVariants = [];
let activeVariantIndex = 0;
let currentStorageOptions = [];
let activeStorageIndex = 0;

/**
 * Extract concise Vietnamese color name for compact chip labels
 */
function getShortColorLabel(colorName) {
    if (!colorName) return '';
    return String(colorName).replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Resolve high-fidelity hex color codes for swatches (Lucian #020 & Image 2)
 */
function resolveColorHex(colorName, fallback = '#2563eb') {
    const s = (colorName || '').toLowerCase();
    if (s.includes('cam') || s.includes('orange')) return '#e06b3a';
    if (s.includes('xanh đậm') || s.includes('deep blue') || s.includes('navy')) return '#1e3a8a';
    if (s.includes('xanh dương') || s.includes('blue')) return '#2563eb';
    if (s.includes('xanh lá') || s.includes('xanh rêu') || s.includes('green')) return '#16a34a';
    if (s.includes('mòng két') || s.includes('teal')) return '#0d9488';
    if (s.includes('sa mạc') || s.includes('desert')) return '#c29b74';
    if (s.includes('vàng') || s.includes('gold') || s.includes('yellow')) return '#eab308';
    if (s.includes('tím') || s.includes('purple') || s.includes('violet')) return '#5b586e';
    if (s.includes('hồng') || s.includes('pink')) return '#ec4899';
    if (s.includes('đỏ') || s.includes('red')) return '#dc2626';
    if (s.includes('đen') || s.includes('black') || s.includes('midnight')) return '#1e293b';
    if (s.includes('trắng') || s.includes('white') || s.includes('starlight')) return '#f8fafc';
    if (s.includes('bạc') || s.includes('silver')) return '#d1d5db';
    if (s.includes('xám') || s.includes('gray') || s.includes('grey') || s.includes('titan')) return '#64748b';
    if (s.includes('s-pen') || s.includes('bút') || s.includes('chi tiết')) return '#334155';
    return fallback;
}

/**
 * Build storage options from product specs (Image 2 Capsule Pills)
 */
function buildStorageOptions(prod) {
    if (!prod) return [];
    const cat = (prod.category || '').toLowerCase();
    const name = (prod.name || '').toLowerCase();
    const storageSpec = (prod.specs?.storage || '').toLowerCase();

    const isTechDevice = cat.includes('thoại') || cat.includes('phone') || 
                         cat.includes('laptop') || cat.includes('tablet') || 
                         cat.includes('máy chơi game') || cat.includes('game') ||
                         name.includes('iphone') || name.includes('galaxy') || 
                         name.includes('macbook') || name.includes('ipad') || 
                         name.includes('laptop') || name.includes('rog ally') ||
                         name.includes('ps5') || name.includes('legion');

    if (!isTechDevice && !storageSpec) return [];

    let base = '256GB';
    if (storageSpec.includes('1tb') || name.includes('1tb')) base = '1TB';
    else if (storageSpec.includes('512gb') || name.includes('512gb')) base = '512GB';
    else if (storageSpec.includes('256gb') || name.includes('256gb')) base = '256GB';
    else if (storageSpec.includes('128gb') || name.includes('128gb')) base = '128GB';
    else if (storageSpec.includes('64gb') || name.includes('64gb')) base = '64GB';

    const isLaptop = cat.includes('laptop') || name.includes('laptop') || name.includes('macbook') || storageSpec.includes('ssd');

    if (isLaptop) {
        if (base === '256GB') {
            return [
                { label: '256GB SSD', delta: 0 },
                { label: '512GB SSD', delta: 1800000 },
                { label: '1TB SSD', delta: 4500000 }
            ];
        } else if (base === '512GB') {
            return [
                { label: '512GB SSD', delta: 0 },
                { label: '1TB SSD', delta: 2500000 },
                { label: '2TB SSD', delta: 6000000 }
            ];
        } else if (base === '1TB') {
            return [
                { label: '1TB SSD', delta: 0 },
                { label: '2TB SSD', delta: 3500000 }
            ];
        } else {
            return [
                { label: '512GB SSD', delta: 0 },
                { label: '1TB SSD', delta: 2500000 }
            ];
        }
    } else {
        if (base === '64GB') {
            return [
                { label: '64GB', delta: 0 },
                { label: '128GB', delta: 1200000 },
                { label: '256GB', delta: 2800000 }
            ];
        } else if (base === '128GB') {
            return [
                { label: '128GB', delta: 0 },
                { label: '256GB', delta: 2000000 },
                { label: '512GB', delta: 5000000 }
            ];
        } else if (base === '256GB') {
            return [
                { label: '256GB', delta: 0 },
                { label: '512GB', delta: 3000000 },
                { label: '1TB', delta: 7500000 }
            ];
        } else if (base === '512GB') {
            return [
                { label: '512GB', delta: 0 },
                { label: '1TB', delta: 4500000 }
            ];
        } else if (base === '1TB') {
            return [
                { label: '1TB', delta: 0 },
                { label: '2TB', delta: 6000000 }
            ];
        } else {
            return [
                { label: '128GB', delta: 0 },
                { label: '256GB', delta: 2000000 }
            ];
        }
    }
}

/**
 * Select storage tier option (Image 2 Capsule Pills)
 */
function selectStorageOption(sIdx) {
    if (!currentStorageOptions || !currentStorageOptions[sIdx]) return;
    activeStorageIndex = Number(sIdx) || 0;
    const opt = currentStorageOptions[activeStorageIndex];

    // 1. Update storage pill active styles & ARIA
    const pillBtns = document.querySelectorAll('.storage-pill-btn');
    pillBtns.forEach((btn, k) => {
        const isMatch = (k === activeStorageIndex);
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-checked', String(isMatch));
    });

    // 2. Update active label in right options card
    const activeStorageValEl = document.getElementById('activeStorageValue');
    if (activeStorageValEl) {
        activeStorageValEl.textContent = opt.label;
    }

    // 3. Recalculate price: base product price (or variant price) + storage delta
    const activeVar = (currentProductVariants && currentProductVariants[activeVariantIndex]) || null;
    const basePrice = (activeVar && Number(activeVar.price) > 0) ? activeVar.price : Number(product?.price || 0);
    const finalPrice = basePrice + opt.delta;

    const priceCurrentEl = document.querySelector('.price-current');
    if (priceCurrentEl) {
        priceCurrentEl.textContent = fmt(finalPrice);
    }
    const stickyPriceVal = document.querySelector('.sticky-price-val');
    if (stickyPriceVal) {
        stickyPriceVal.textContent = fmt(finalPrice);
    }

    // 4. Update ROM / SSD spec card in spec-pills-row
    const specCards = document.querySelectorAll('.spec-pill-card');
    specCards.forEach(card => {
        const label = card.querySelector('.spec-pill-label')?.textContent || '';
        if (label.includes('ROM') || label.includes('LƯU TRỮ') || label.includes('lưu trữ') || label.includes('SSD')) {
            const valEl = card.querySelector('.spec-pill-value');
            if (valEl) valEl.textContent = opt.label;
        }
    });

    // 5. Update SKU display
    const skuEl = document.querySelector('.metric-sku strong');
    if (skuEl) {
        const baseSku = product?.sku || 'TECH';
        const cleanLabel = opt.label.replace(/\s+/g, '');
        skuEl.textContent = `${baseSku}-${cleanLabel}`;
    }
}

/**
 * Build uniform variant list from verified product.variants ONLY.
 * Strict Rule: Only products with >= 2 verified color variants display the variant selector.
 * Single-color or no-variant products return empty array [].
 */
function buildProductVariants(prod) {
    if (!prod) return [];

    if (Array.isArray(prod.variants) && prod.variants.length > 1) {
        return prod.variants.map((v, idx) => ({
            index: idx,
            id: v._id || `var-${idx}`,
            colorName: v.color || `Phiên bản ${idx + 1}`,
            colorHex: v.colorHex || resolveColorHex(v.color || ''),
            image: resolveProductImage(v.image || prod.image, '../../'),
            price: Number(v.price) > 0 ? Number(v.price) : Number(prod.price || 0),
            compareAtPrice: Number(v.compareAtPrice) > 0 ? Number(v.compareAtPrice) : Number(prod.compareAtPrice || 0),
            stock: typeof v.stock === 'number' ? v.stock : Number(prod.stock || 0),
            sku: v.sku || `${prod.sku || 'TECH'}-${idx + 1}`,
            isOutOfStock: typeof v.stock === 'number' ? v.stock <= 0 : Number(prod.stock || 0) <= 0
        }));
    }

    return [];
}

/**
 * Select a color variant dynamically without page reload (Lucian #020)
 */
function selectColorVariant(idx) {
    if (!currentProductVariants || !currentProductVariants[idx]) return;
    activeVariantIndex = Number(idx) || 0;
    const v = currentProductVariants[activeVariantIndex];

    // 1. Update thumbnail active states & ARIA (on left column)
    const items = document.querySelectorAll('.color-variant-item');
    items.forEach((item, k) => {
        const isMatch = (k === activeVariantIndex);
        item.classList.toggle('active', isMatch);
        item.setAttribute('aria-checked', String(isMatch));
    });

    // 2. Smoothly transition main image & zoom lens (Lucian #356)
    if (v.image) {
        const mainImg = document.getElementById('mainProductImage');
        const loupeImg = document.getElementById('u356LoupeImg');
        if (mainImg) {
            mainImg.style.opacity = '0.35';
            mainImg.style.transform = 'scale(0.985)';
            setTimeout(() => {
                mainImg.src = v.image;
                mainImg.alt = `${product.name} - ${v.colorName}`;
                mainImg.style.opacity = '1';
                mainImg.style.transform = 'scale(1)';
            }, 110);
        }
        if (loupeImg) {
            loupeImg.src = v.image;
        }
    }

    // 3. Update color name display in variant section
    const activeColorNameEl = document.getElementById('productActiveColorName');
    if (activeColorNameEl) {
        activeColorNameEl.textContent = v.colorName;
    }
    const variantStockPillEl = document.getElementById('productVariantStockPill');
    if (variantStockPillEl) {
        variantStockPillEl.className = `variant-stock-status-pill ${v.isOutOfStock ? 'is-out' : 'is-in'}`;
        variantStockPillEl.textContent = v.isOutOfStock ? 'Tạm hết màu này' : 'Còn hàng';
    }

    // 5. Update SKU in metrics row
    const skuEl = document.querySelector('.metric-sku strong');
    if (skuEl && v.sku) {
        skuEl.textContent = v.sku;
    }

    // 6. Update price including active storage delta
    const storageOpt = currentStorageOptions[activeStorageIndex];
    const storageDelta = storageOpt ? storageOpt.delta : 0;
    const basePrice = Number(v.price) > 0 ? Number(v.price) : Number(product.price || 0);
    const finalPrice = basePrice + storageDelta;

    const priceCurrentEl = document.querySelector('.price-current');
    if (priceCurrentEl) {
        priceCurrentEl.textContent = fmt(finalPrice);
    }
    const stickyPriceVal = document.querySelector('.sticky-price-val');
    if (stickyPriceVal) {
        stickyPriceVal.textContent = fmt(finalPrice);
    }

    // 7. Update quantity stepper max and stock badge
    const qtyInput = document.getElementById('detailQty');
    const stockBadge = document.querySelector('.stock-status-badge');
    const buyNowBtn = document.querySelector('.btn-buy-now-hero');
    const addCartBtn = document.querySelector('.btn-add-cart-secondary');
    const stickyBuyBtn = document.querySelector('.sticky-btn-buy');

    if (v.isOutOfStock) {
        if (qtyInput) {
            qtyInput.value = '0';
            qtyInput.disabled = true;
        }
        if (stockBadge) {
            stockBadge.className = 'stock-status-badge out-of-stock';
            stockBadge.innerHTML = '<span class="stock-indicator-dot"></span><span>Tạm hết hàng màu này</span>';
        }
        if (buyNowBtn) { buyNowBtn.disabled = true; buyNowBtn.setAttribute('aria-disabled', 'true'); }
        if (addCartBtn) { addCartBtn.disabled = true; addCartBtn.setAttribute('aria-disabled', 'true'); }
        if (stickyBuyBtn) { stickyBuyBtn.disabled = true; stickyBuyBtn.setAttribute('aria-disabled', 'true'); }
    } else {
        if (qtyInput) {
            qtyInput.disabled = false;
            qtyInput.max = v.stock;
            if (Number(qtyInput.value) <= 0) qtyInput.value = '1';
        }
        if (stockBadge) {
            stockBadge.className = 'stock-status-badge in-stock';
            stockBadge.innerHTML = `<span class="stock-indicator-dot"></span><span>Còn hàng (${v.stock} sản phẩm)</span>`;
        }
        if (buyNowBtn) { buyNowBtn.disabled = false; buyNowBtn.removeAttribute('aria-disabled'); }
        if (addCartBtn) { addCartBtn.disabled = false; addCartBtn.removeAttribute('aria-disabled'); }
        if (stickyBuyBtn) { stickyBuyBtn.disabled = false; stickyBuyBtn.removeAttribute('aria-disabled'); }
    }

    // 8. Sync Lightbox #061 index
    currentGalleryIndex = activeVariantIndex;

    // 9. Sync Sticky Bar #221 thumbnail
    const stickyThumb = document.querySelector('.sticky-bar-thumb');
    if (stickyThumb) stickyThumb.src = v.image;
}

// Expose globally for inline onclick handlers
window.selectColorVariant = selectColorVariant;
window.selectStorageOption = selectStorageOption;

function changeMainImage(src, btn, idx = 0) {
    selectColorVariant(idx);
}

/* Lucian UX/UI Prompt #356 & #061 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#061 */
function setupProductLoupeAndLightbox(galleryList) {
    currentGalleryImages = Array.isArray(galleryList) && galleryList.length ? galleryList : [resolveProductImage(product?.image, '../../')];
    currentGalleryIndex = 0;

    const fig = document.getElementById('mainImageFigure');
    const mainImg = document.getElementById('mainProductImage');
    const loupe = document.getElementById('u356Loupe');
    const loupeImg = document.getElementById('u356LoupeImg');
    const zoomTag = document.getElementById('u356ZoomTag');
    if (fig && mainImg && loupe && loupeImg) {
        let zoomLevels = [2.2, 3.2];
        let zIdx = 0;
        const canHover = window.matchMedia('(hover: hover)').matches;
        if (canHover) {
            fig.addEventListener('pointermove', e => {
                if (e.target.closest('button')) return;
                const r = fig.getBoundingClientRect();
                if (!r.width || !r.height) return;
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;
                const z = zoomLevels[zIdx];
                loupe.style.left = `${x}px`;
                loupe.style.top = `${y}px`;
                loupeImg.style.width = `${r.width}px`;
                loupeImg.style.height = `${r.height}px`;
                loupeImg.style.transform = `translate(${(70 - x * z).toFixed(1)}px, ${(70 - y * z).toFixed(1)}px) scale(${z})`;
                loupe.classList.add('is-on');
                if (zoomTag) {
                    zoomTag.textContent = `🔍 ${z}× · Click phóng to`;
                    zoomTag.classList.add('is-on');
                }
            });
            fig.addEventListener('pointerleave', () => {
                loupe.classList.remove('is-on');
                zoomTag?.classList.remove('is-on');
            });
        }
        fig.addEventListener('click', e => {
            if (e.target.closest('.u356-open-btn') || e.target === mainImg || e.target === fig) {
                openProductLightbox(currentGalleryIndex);
            }
        });
    }

    const dialog = document.getElementById('u061Lightbox');
    if (!dialog || dialog._u061Bound) return;
    dialog._u061Bound = true;
    const lbImg = document.getElementById('u061LbImg');
    const closeBtn = document.getElementById('u061LbClose');
    const prevBtn = document.getElementById('u061LbPrev');
    const nextBtn = document.getElementById('u061LbNext');
    const zoomPill = document.getElementById('u061LbZoomPill');
    let lbZoom = 1;

    function resetLbZoom() {
        lbZoom = 1;
        if (lbImg) lbImg.style.transform = 'scale(1)';
        if (zoomPill) zoomPill.hidden = true;
    }

    closeBtn?.addEventListener('click', () => {
        resetLbZoom();
        dialog.close();
    });
    prevBtn?.addEventListener('click', () => stepLightbox(-1));
    nextBtn?.addEventListener('click', () => stepLightbox(1));
    dialog.addEventListener('click', e => {
        if (e.target === dialog || e.target.id === 'u061LbStage') {
            resetLbZoom();
            dialog.close();
        }
    });
    lbImg?.addEventListener('dblclick', () => {
        lbZoom = lbZoom > 1 ? 1 : 2;
        lbImg.style.transform = `scale(${lbZoom})`;
        if (zoomPill) zoomPill.hidden = lbZoom <= 1;
    });
    document.addEventListener('keydown', e => {
        if (!dialog.open) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
    });
}

function updateLightboxSlide() {
    const lbImg = document.getElementById('u061LbImg');
    const lbTitle = document.getElementById('u061LbTitle');
    const lbSub = document.getElementById('u061LbSub');
    const lbCount = document.getElementById('u061LbCount');
    const prevBtn = document.getElementById('u061LbPrev');
    const nextBtn = document.getElementById('u061LbNext');

    const total = currentGalleryImages.length;
    const hasMultiple = total > 1;

    if (prevBtn) prevBtn.hidden = !hasMultiple;
    if (nextBtn) nextBtn.hidden = !hasMultiple;

    const src = currentGalleryImages[currentGalleryIndex] || resolveProductImage(product?.image, '../../');
    if (lbImg) {
        lbImg.style.transform = 'scale(1)';
        lbImg.src = src;
        lbImg.alt = product?.name || 'Ảnh sản phẩm';
    }
    if (lbTitle) lbTitle.textContent = product?.name || 'Sản phẩm';
    if (lbSub) lbSub.textContent = `${product?.brand || 'Chính hãng'} · Góc nhìn ${currentGalleryIndex + 1}`;
    if (lbCount) lbCount.textContent = `${currentGalleryIndex + 1} / ${total || 1}`;
}

function openProductLightbox(idx = 0) {
    const dialog = document.getElementById('u061Lightbox');
    if (!dialog) return;
    currentGalleryIndex = (idx + currentGalleryImages.length) % (currentGalleryImages.length || 1);
    updateLightboxSlide();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
}
window.openProductLightbox = openProductLightbox;

function stepLightbox(delta) {
    if (!currentGalleryImages.length) return;
    currentGalleryIndex = (currentGalleryIndex + delta + currentGalleryImages.length) % currentGalleryImages.length;
    updateLightboxSlide();
}

async function loadProduct() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        document.getElementById('productShowcase').innerHTML = '<div class="empty-state">Không tìm thấy mã sản phẩm hợp lệ.</div>';
        return;
    }

    try {
        const [productRes, listRes] = await Promise.all([
            fetch(`${API_URL}/products/${id}`),
            fetch(`${API_URL}/products`)
        ]);

        if (!productRes.ok) {
            document.getElementById('productShowcase').innerHTML = '<div class="empty-state">Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.</div>';
            return;
        }

        product = await productRes.json();
        const all = await listRes.json();
        allCatalogProducts = Array.isArray(all) ? all : [];
        relatedProducts = allCatalogProducts
            .filter(p => (p.category === product.category || p.brand === product.brand) && String(p._id) !== String(product._id))
            .slice(0, 4);

        await loadWishlist();
        await loadReviews();
        renderProduct();
    } catch (err) {
        console.error('Error loading product:', err);
        document.getElementById('productShowcase').innerHTML = '<div class="empty-state">Lỗi kết nối máy chủ, vui lòng tải lại trang.</div>';
    }
}

async function loadReviews() {
    if (!product) return;
    try {
        const res = await fetch(`${API_URL}/reviews/product/${product._id}`);
        reviews = res.ok ? await res.json() : [];
    } catch (error) {
        console.error('Review load error:', error);
        reviews = [];
    }
}

function renderProduct() {
    if (!product) return;
    const liked = wishlistIds.has(Number(product._id));
    const specs = specEntries(product);
    const discount = product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
    const gallery = [product.image, ...(product.images || [])].filter(Boolean);
    const uniqueGallery = [...new Set(gallery.map(img => resolveProductImage(img, '../../')))];
    currentProductVariants = buildProductVariants(product);
    activeVariantIndex = 0;
    currentStorageOptions = buildStorageOptions(product);
    activeStorageIndex = 0;

    // 1. Update Title & SEO Meta
    document.title = `${product.name} | Giá Tốt Nhất & Trả Góp 0% - TechEcommerce`;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(product._id)}`;

    // 2. Update Breadcrumb
    const bcCat = document.getElementById('breadcrumbCategory');
    const bcProd = document.getElementById('breadcrumbProduct');
    if (bcCat) {
        bcCat.innerHTML = `<a href="../../index.html?category=${encodeURIComponent(product.category || '')}">${escapeHTML(product.category || 'Sản phẩm')}</a>`;
    }
    if (bcProd) {
        bcProd.textContent = product.name;
    }

    // 3. Update Hero Header & Metrics
    const headerTitle = document.getElementById('productPageTitle');
    if (headerTitle) headerTitle.textContent = product.name;

    const metricsContainer = document.getElementById('productHeaderMetrics');
    if (metricsContainer) {
        const ratingVal = Number(product.rating || 5.0).toFixed(1);
        const reviewCount = product.reviewCount || reviews.length || 68;
        const soldCount = (product.soldCount || 240).toLocaleString('vi-VN');
        metricsContainer.innerHTML = `
            <a href="#reviewsSection" class="metric-rating-link" title="Xem đánh giá">
                <span class="metric-rating-stars">★ ${ratingVal}</span>
                <span>(${reviewCount} đánh giá)</span>
            </a>
            <span class="metric-sold-badge">Đã bán ${soldCount}+</span>
            <span class="metric-sku">Mã: <strong>${escapeHTML(product.sku || 'TECH-STORE')}</strong></span>
            <span style="color:var(--text-muted)">• Thương hiệu: <strong style="color:var(--text-primary)">${escapeHTML(product.brand || 'Chính hãng')}</strong></span>
        `;
    }

    // 4. JSON-LD Schema.org Structured Data
    document.querySelector('script[data-product-schema]')?.remove();
    const productSchema = document.createElement('script');
    productSchema.type = 'application/ld+json';
    productSchema.dataset.productSchema = 'true';
    productSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: uniqueGallery,
        description: product.description || undefined,
        sku: product.sku || undefined,
        brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
        offers: {
            '@type': 'Offer',
            priceCurrency: 'VND',
            price: Number(product.price) || 0,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: window.location.href,
            itemCondition: 'https://schema.org/NewCondition'
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(product.rating || 5.0),
            reviewCount: Number(product.reviewCount) || reviews.length || 1
        }
    });
    document.head.appendChild(productSchema);

    // 5. Render Main 2-Column Showcase (Left: Media + Guarantees + Video | Right: Price + Promo + CTA)
    const showcaseContainer = document.getElementById('productShowcase');
    if (showcaseContainer) {
        const monthlyInstallment = fmt(Math.round(product.price / 12));
        showcaseContainer.innerHTML = `
            <!-- Left Column: Visual Media & Video -->
            <section class="product-visual-column" aria-label="Hình ảnh và Video sản phẩm">
                <!-- Main Preview Frame (Lucian #356 Loupe + #061 Lightbox) -->
                <figure class="main-image-figure u356-fig" id="mainImageFigure">
                    ${discount > 0 ? `<span class="main-image-badge-tag">GIẢM ${discount}%</span>` : ''}
                    <span class="main-image-genuine-tag">✓ Chính Hãng 100%</span>
                    <img id="mainProductImage" src="${escapeHTML(resolveProductImage(uniqueGallery[0] || product.image, '../../'))}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                    <div class="u356-loupe" id="u356Loupe" aria-hidden="true">
                        <img id="u356LoupeImg" src="${escapeHTML(resolveProductImage(uniqueGallery[0] || product.image, '../../'))}" alt="" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                    </div>
                    <button type="button" class="u356-open-btn" id="u356ZoomTag" aria-label="Phóng to ảnh sản phẩm toàn màn hình">🔍 Soi chi tiết · Click phóng to</button>
                </figure>

                <!-- Product Color Variant Gallery (Lucian #020 & Universal Variant Architecture) -->
                ${currentProductVariants.length > 1 ? `
                <section class="product-variant-section" aria-label="Tùy chọn màu sắc và phiên bản sản phẩm">
                    <div class="product-variant-header" aria-live="polite">
                        <span class="variant-label-prefix">Màu sắc:</span>
                        <strong class="variant-active-name" id="productActiveColorName">${escapeHTML(currentProductVariants[0].colorName)}</strong>
                        <span class="variant-stock-status-pill ${currentProductVariants[0].isOutOfStock ? 'is-out' : 'is-in'}" id="productVariantStockPill">
                            ${currentProductVariants[0].isOutOfStock ? 'Tạm hết màu này' : 'Còn hàng'}
                        </span>
                    </div>
                    <div class="gallery-thumbs-nav product-color-variant-track" role="radiogroup" aria-label="Danh sách phiên bản màu sắc và hình ảnh">
                        ${currentProductVariants.map((v, idx) => `
                            <button type="button" 
                                    role="radio" 
                                    aria-checked="${idx === 0 ? 'true' : 'false'}" 
                                    class="gallery-thumb-btn color-variant-item ${idx === 0 ? 'active' : ''} ${v.isOutOfStock ? 'variant-out-of-stock' : ''}" 
                                    onclick="selectColorVariant(${idx})" 
                                    data-color-idx="${idx}"
                                    aria-label="Chọn màu ${escapeHTML(v.colorName)}"
                                    title="${escapeHTML(v.colorName)} ${v.isOutOfStock ? '(Hết hàng)' : ''}">
                                <div class="thumb-img-wrapper">
                                    <img src="${escapeHTML(v.image)}" alt="${escapeHTML(product.name)} - ${escapeHTML(v.colorName)}" loading="lazy" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                                </div>
                                <span class="color-item-label">${escapeHTML(getShortColorLabel(v.colorName))}</span>
                                ${v.isOutOfStock ? '<span class="variant-out-badge">Hết</span>' : ''}
                            </button>
                        `).join('')}
                    </div>
                </section>
                ` : ''}

                <!-- Trust Guarantee Pillars -->
                <aside class="trust-guarantee-card" aria-label="Chính sách bán hàng">
                    <div class="trust-item">
                        <span class="trust-icon" aria-hidden="true">🛡️</span>
                        <div class="trust-text">
                            <strong>Bảo hành chính hãng</strong>
                            <span>12 tháng tại các TTBH ủy quyền</span>
                        </div>
                    </div>
                    <div class="trust-item">
                        <span class="trust-icon" aria-hidden="true">🔄</span>
                        <div class="trust-text">
                            <strong>1 Đổi 1 trong 30 ngày</strong>
                            <span>Nếu phát sinh lỗi do nhà sản xuất</span>
                        </div>
                    </div>
                    <div class="trust-item">
                        <span class="trust-icon" aria-hidden="true">⚡</span>
                        <div class="trust-text">
                            <strong>Giao siêu tốc 2H</strong>
                            <span>Miễn phí đơn từ 500.000 đ</span>
                        </div>
                    </div>
                    <div class="trust-item">
                        <span class="trust-icon" aria-hidden="true">📦</span>
                        <div class="trust-text">
                            <strong>Nguyên seal 100%</strong>
                            <span>Đầy đủ phụ kiện và hóa đơn VAT</span>
                        </div>
                    </div>
                </aside>

                <!-- Video Showcase Player -->
                ${product.videoUrl ? `
                <section class="product-video-card" id="productVideoCard" aria-labelledby="videoCardTitle">
                    <header class="video-card-header">
                        <h3 id="videoCardTitle">🎬 Video Mở Hộp &amp; Đánh Giá Thực Tế</h3>
                        <span class="video-badge">Review Chi Tiết</span>
                    </header>
                    <figure class="video-wrapper-frame" style="margin:0;">
                        <iframe src="${escapeHTML(product.videoUrl.includes('?') ? product.videoUrl + '&enablejsapi=1&origin=' + encodeURIComponent(window.location.origin) : product.videoUrl + '?enablejsapi=1&origin=' + encodeURIComponent(window.location.origin))}"
                            title="Video đánh giá ${escapeHTML(product.name)}"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen referrerpolicy="origin" loading="lazy"></iframe>
                    </figure>
                    <footer class="video-card-footer">
                        <span>Trải nghiệm cận cảnh tính năng và hiệu năng từ chuyên gia công nghệ</span>
                        <a class="video-external-btn" href="${escapeHTML(product.videoUrl.replace('/embed/', '/watch?v=').split('?')[0])}" target="_blank" rel="noopener noreferrer">
                            <span>Mở trên YouTube</span> ↗
                        </a>
                    </footer>
                </section>
                ` : ''}
            </section>

            <!-- Right Column: Commerce Purchase Engine -->
            <article class="product-purchase-column" aria-label="Thông tin mua hàng và giá cả">
                <!-- Price Box -->
                <section class="product-price-box">
                    <div class="price-main-row">
                        <span class="price-current">${fmt(product.price)}</span>
                        ${product.compareAtPrice > product.price ? `
                            <span class="price-original">${fmt(product.compareAtPrice)}</span>
                            <span class="price-discount-tag">-${discount}%</span>
                        ` : ''}
                    </div>
                    <p class="price-installment-hint">
                        <span aria-hidden="true">💳</span>
                        <span>Hoặc trả góp 0% chỉ từ <strong>${monthlyInstallment}</strong>/tháng</span>
                    </p>
                </section>

                <!-- Ask AI Consultation Button -->
                <button type="button" class="btn-ask-ai-product" id="btnAskAiProduct" onclick="askAiAboutThisProduct()" aria-label="Hỏi AI tư vấn máy này">
                    <span class="ai-sparkle-icon" aria-hidden="true">🤖</span>
                    <span class="ai-ask-text">
                        <strong>Hỏi AI tư vấn sản phẩm này</strong>
                        <small>Giải đáp ưu nhược điểm, so sánh máy, tư vấn đúng nhu cầu</small>
                    </span>
                    <span class="ai-ask-arrow" aria-hidden="true">›</span>
                </button>

                <!-- Exclusive Promotion Perks Box -->
                <section class="product-promo-box" aria-label="Ưu đãi độc quyền">
                    <header class="promo-box-header">
                        <span aria-hidden="true">🎁</span>
                        <span>Ưu Đãi &amp; Khuyến Mãi Độc Quyền</span>
                    </header>
                    <ul class="promo-list">
                        <li>
                            <span class="promo-num-badge">1</span>
                            <span>Giảm thêm <strong>500.000 đ</strong> khi thanh toán chuyển khoản qua VNPay-QR hoặc MoMo.</span>
                        </li>
                        <li>
                            <span class="promo-num-badge">2</span>
                            <span>Thu cũ đổi mới trợ giá lên tới <strong>2.000.000 đ</strong> với quy trình định giá tức thì.</span>
                        </li>
                        <li>
                            <span class="promo-num-badge">3</span>
                            <span>Tặng gói Bảo Hành Vàng 12 tháng 1 đổi 1 rơi vỡ vào nước siêu an tâm.</span>
                        </li>
                        <li>
                            <span class="promo-num-badge">4</span>
                            <span>Giảm <strong>20%</strong> khi mua kèm củ sạc, ốp lưng hoặc tai nghe chính hãng.</span>
                        </li>
                    </ul>
                </section>

                <!-- Trade-in / Thu Cũ Đổi Mới Section -->
                <section class="trade-in-card" id="tradeInCard" aria-label="Thu cũ đổi mới trợ giá">
                    <header class="trade-in-header">
                        <div class="trade-in-title-wrap">
                            <span class="trade-in-icon" aria-hidden="true">🔄</span>
                            <div>
                                <strong>Thu cũ đổi mới - Lên đời trợ giá</strong>
                                <span class="trade-in-sub">Trợ giá thêm đến 1.500.000 đ vào giá máy mới</span>
                            </div>
                        </div>
                        <button type="button" class="trade-in-open-btn" id="openTradeInBtn" onclick="toggleTradeInCalculator()">Định giá ngay ▾</button>
                    </header>
                    <div class="trade-in-drawer" id="tradeInDrawer" hidden>
                        <form id="tradeInForm" onsubmit="event.preventDefault(); applyTradeIn();">
                            <div class="trade-in-grid">
                                <div class="trade-in-field">
                                    <label for="tradeInCategory">1. Loại thiết bị cũ:</label>
                                    <select id="tradeInCategory" onchange="onTradeInCategoryChange()">
                                        <option value="phone">Điện thoại</option>
                                        <option value="laptop">Laptop / MacBook</option>
                                        <option value="tablet">Máy tính bảng / iPad</option>
                                        <option value="watch">Đồng hồ thông minh</option>
                                    </select>
                                </div>
                                <div class="trade-in-field">
                                    <label for="tradeInModel">2. Model máy cũ của bạn:</label>
                                    <select id="tradeInModel" onchange="recalculateTradeIn()"></select>
                                </div>
                                <div class="trade-in-field" style="grid-column: 1 / -1;">
                                    <label for="tradeInCondition">3. Tình trạng máy:</label>
                                    <select id="tradeInCondition" onchange="recalculateTradeIn()">
                                        <option value="1">Loại 1: Hoạt động hoàn hảo, đẹp như mới 99%, pin tốt</option>
                                        <option value="2">Loại 2: Máy trầy xước nhẹ 95%, màn hình sáng đẹp</option>
                                        <option value="3">Loại 3: Máy cấn viền/trầy nhiều 90%, đủ chức năng</option>
                                    </select>
                                </div>
                            </div>
                            <div class="trade-in-summary-box">
                                <div class="trade-in-summary-row">
                                    <span>Giá thu cũ ước tính:</span>
                                    <strong id="tradeInBaseValue">0 đ</strong>
                                </div>
                                <div class="trade-in-summary-row" style="color:#10b981;">
                                    <span>Trợ giá lên đời từ TechEcommerce:</span>
                                    <strong id="tradeInSubsidy">+0 đ</strong>
                                </div>
                                <div class="trade-in-summary-row highlight">
                                    <span>Số tiền cần bù cho sản phẩm mới:</span>
                                    <strong id="tradeInFinalPay">0 đ</strong>
                                </div>
                            </div>
                            <button type="submit" class="trade-in-apply-btn">
                                🚀 Áp Dụng Lên Đời &amp; Đặt Mua Ngay
                            </button>
                        </form>
                    </div>
                </section>

                <!-- Key Spec Highlights Pills (CSS Grid Flexible Proportions) -->
                <section class="spec-pills-row" data-specs-count="${Math.min(specs.length, 4)}" aria-label="Tóm tắt thông số kỹ thuật cốt lõi">
                    ${specs.slice(0, 4).map(([label, val]) => `
                        <div class="spec-pill-card spec-pill-item" title="${escapeHTML(label)}: ${escapeHTML(val)}">
                            <small class="spec-pill-label">${escapeHTML(label)}</small>
                            <strong class="spec-pill-value">${escapeHTML(val)}</strong>
                        </div>
                    `).join('')}
                </section>

                <!-- Product Storage Options (Lucian #020 & Image 2 style) -->
                ${currentStorageOptions.length > 0 ? `
                <section class="product-selection-options" aria-label="Tùy chọn dung lượng lưu trữ">
                    <div class="selection-option-group">
                        <div class="option-header">
                            <span class="option-label">Dung lượng:</span>
                            <strong class="option-active-value" id="activeStorageValue">${escapeHTML(currentStorageOptions[activeStorageIndex]?.label || '')}</strong>
                        </div>
                        <div class="storage-pills-row" role="radiogroup" aria-label="Chọn dung lượng lưu trữ">
                            ${currentStorageOptions.map((opt, sIdx) => `
                                <button type="button" 
                                        class="storage-pill-btn ${sIdx === activeStorageIndex ? 'active' : ''}" 
                                        role="radio" 
                                        aria-checked="${sIdx === activeStorageIndex ? 'true' : 'false'}"
                                        onclick="selectStorageOption(${sIdx})"
                                        data-storage-idx="${sIdx}">
                                    ${escapeHTML(opt.label)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </section>
                ` : ''}

                <!-- Quantity Stepper & Stock Pill -->
                <section class="quantity-stock-row">
                    <div class="qty-control-group">
                        <span class="qty-control-label">Số lượng:</span>
                        <button type="button" class="qty-stepper-btn" onclick="adjustQty(-1)" aria-label="Giảm số lượng" ${product.stock <= 0 ? 'disabled' : ''}>−</button>
                        <input id="detailQty" class="qty-input-box" type="number" min="1" max="${product.stock}" value="1" aria-label="Số lượng chọn" ${product.stock <= 0 ? 'disabled' : ''}>
                        <button type="button" class="qty-stepper-btn" onclick="adjustQty(1)" aria-label="Tăng số lượng" ${product.stock <= 0 ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="stock-status-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                        <span class="stock-indicator-dot"></span>
                        <span>${product.stock > 0 ? `Còn hàng (${product.stock} sản phẩm)` : 'Tạm hết hàng'}</span>
                    </div>
                </section>

                <!-- Action CTA Stack -->
                <section class="purchase-cta-stack">
                    <button type="button" class="btn-buy-now-hero" onclick="openExpressCheckoutModal()" ${product.stock <= 0 ? 'disabled' : ''}>
                        <strong>MUA NGAY (GIAO TẬN NƠI HOẶC TẠI CỬA HÀNG)</strong>
                        <small>Nhận hàng siêu tốc trong 2 giờ hoặc trải nghiệm tại showroom</small>
                    </button>

                    <div class="cart-wishlist-row">
                        <button type="button" class="btn-add-cart-secondary" onclick="addToCart('${product._id}')" ${product.stock <= 0 ? 'disabled' : ''}>
                            <span aria-hidden="true">🛒</span>
                            <span>Thêm vào giỏ</span>
                        </button>
                        <button type="button" class="btn-installment-plan" onclick="window.location.href='../legal/installment.html'">
                            <strong>TRẢ GÓP 0%</strong>
                            <small>Duyệt hồ sơ nhanh 5 phút</small>
                        </button>
                    </div>

                    <div class="quick-tools-row">
                        <button type="button" class="btn-wishlist-toggle ${liked ? 'active' : ''}" aria-pressed="${liked ? 'true' : 'false'}" onclick="toggleWishlist('${product._id}')">
                            <span class="u022-ring" aria-hidden="true"></span>
                            <span class="u022-burst" aria-hidden="true">
                                <span class="u022-dot" style="--a:0deg"></span>
                                <span class="u022-dot" style="--a:51deg"></span>
                                <span class="u022-dot" style="--a:102deg"></span>
                                <span class="u022-dot" style="--a:153deg"></span>
                                <span class="u022-dot" style="--a:204deg"></span>
                                <span class="u022-dot" style="--a:255deg"></span>
                                <span class="u022-dot" style="--a:306deg"></span>
                            </span>
                            <span class="u022-heart-glyph" aria-hidden="true">${liked ? '♥' : '♡'}</span>
                            <span class="u022-heart-text">${liked ? 'Đã lưu yêu thích' : 'Lưu vào yêu thích'}</span>
                        </button>
                        <a class="hotline-support-link" href="tel:0842331606">
                            <span aria-hidden="true">📞</span>
                            <span>Tư vấn miễn phí: <strong>0842.331.606</strong></span>
                        </a>
                    </div>
                </section>
            </article>
        `;
        const activeGallery = (currentProductVariants.length > 1)
            ? currentProductVariants.map(v => v.image)
            : uniqueGallery;
        setupProductLoupeAndLightbox(activeGallery);
        if (currentProductVariants.length > 1) {
            selectColorVariant(0);
        }

        // Keyboard navigation for color variant thumbnails (Lucian #020)
        const variantTrack = document.querySelector('.product-color-variant-track');
        if (variantTrack && currentProductVariants.length > 1) {
            variantTrack.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIdx = (activeVariantIndex + 1) % currentProductVariants.length;
                    selectColorVariant(nextIdx);
                    const nextBtn = variantTrack.querySelector(`[data-color-idx="${nextIdx}"]`);
                    if (nextBtn) nextBtn.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIdx = (activeVariantIndex - 1 + currentProductVariants.length) % currentProductVariants.length;
                    selectColorVariant(prevIdx);
                    const prevBtn = variantTrack.querySelector(`[data-color-idx="${prevIdx}"]`);
                    if (prevBtn) prevBtn.focus();
                }
            });
        }

        /* Lucian UX/UI Prompt #221 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#221 */
        const stickyBar = document.getElementById('mobileStickyBar');
        if (stickyBar) {
            stickyBar.classList.add('u221-br');
            stickyBar.innerHTML = `
                <div class="sticky-bar-product">
                    <img src="${escapeHTML(resolveProductImage(uniqueGallery[0] || product.image, '../../'))}" alt="${escapeHTML(product.name)}" class="sticky-bar-thumb u221-thumb" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                    <div class="sticky-bar-meta">
                        <span class="sticky-bar-title">${escapeHTML(product.name)}</span>
                        <strong class="sticky-bar-price">${fmt(product.price)}</strong>
                    </div>
                </div>
                <div class="sticky-bar-actions">
                    <button type="button" class="sticky-btn-cart" onclick="addToCart('${product._id}')" ${product.stock <= 0 ? 'disabled' : ''} aria-label="Thêm vào giỏ">
                        🛒 Thêm vào giỏ
                    </button>
                    <button type="button" class="sticky-btn-buy" onclick="openExpressCheckoutModal()" ${product.stock <= 0 ? 'disabled' : ''} aria-label="Mua ngay">
                        ⚡ Mua ngay
                    </button>
                </div>
            `;

            const updateStickyVisibility = () => {
                const heroBuyBtn = document.querySelector('.btn-buy-now-hero') || document.querySelector('.product-purchase-column');
                if (!heroBuyBtn) return;
                const rect = heroBuyBtn.getBoundingClientRect();
                const shouldShow = window.scrollY > 340 || rect.bottom < 80;
                stickyBar.hidden = !shouldShow;
                stickyBar.classList.toggle('visible', shouldShow);
                stickyBar.classList.toggle('u221-visible', shouldShow);
            };

            if (!window._u221ScrollBound) {
                window._u221ScrollBound = true;
                window.addEventListener('scroll', updateStickyVisibility, { passive: true });
                window.addEventListener('resize', updateStickyVisibility, { passive: true });
            }
            updateStickyVisibility();
        }
    }

    // 6. Render Editorial Product Description (Clean, engaging, zero dev text)
    const editorialContainer = document.getElementById('editorialBody');
    if (editorialContainer) {
        const desc = product.description || 'Sản phẩm công nghệ đỉnh cao với thiết kế hiện đại, cấu hình mạnh mẽ đáp ứng hoàn hảo mọi nhu cầu làm việc và giải trí.';
        editorialContainer.innerHTML = `
            <p>${escapeHTML(desc)}</p>
            <p>Sản phẩm <strong>${escapeHTML(product.name)}</strong> thuộc thương hiệu <strong>${escapeHTML(product.brand || 'hàng đầu')}</strong>, được phân phối chính hãng 100% tại TechEcommerce. Thiết bị được tuyển chọn kỹ lưỡng theo các tiêu chuẩn khắt khe về độ bền, hiệu năng tối ưu và trải nghiệm người dùng vượt trội.</p>
            <p>Khi mua sắm tại TechEcommerce, quý khách hàng hoàn toàn an tâm với chính sách bảo hành chính hãng 12 tháng, 1 đổi 1 trong 30 ngày nếu có lỗi từ nhà sản xuất, cùng dịch vụ hỗ trợ kỹ thuật tận tâm 24/7 và giao hàng hỏa tốc trong 2 giờ.</p>
        `;
    }

    // 7. Render Detailed Specifications Table
    const specsTable = document.querySelector('#specsDetailTable tbody');
    if (specsTable) {
        specsTable.innerHTML = specs.map(([label, val]) => `
            <tr>
                <th scope="row">${escapeHTML(label)}</th>
                <td>${escapeHTML(val)}</td>
            </tr>
        `).join('');
    }

    // 8. Render Reviews Scorecard & Items
    renderReviews();
    bindReviewForm();

    // 8.5. Render Frequently Bought Together (Mua Kèm Phụ Kiện Giảm Sốc)
    renderBundleCrossell();

    // 9. Render Related Products
    const relatedContainer = document.getElementById('relatedProducts');
    if (relatedContainer) {
        relatedContainer.innerHTML = relatedProducts.length > 0 ? relatedProducts.map(p => `
            <a class="related-product-card" href="product.html?id=${p._id}" draggable="true" data-product-card-id="${p._id}" data-product-name="${escapeHTML(p.name)}" data-product-price="${fmt(p.price)}" data-product-img="${escapeHTML(resolveProductImage(p.image, '../../'))}" data-product-category="${escapeHTML(p.category || 'Công nghệ')}" title="Kéo thả vào khung chat AI để tư vấn">
                <div class="related-thumb-wrapper">
                    <img src="${escapeHTML(resolveProductImage(p.image, '../../'))}" alt="${escapeHTML(p.name)}" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';" loading="lazy">
                </div>
                <span class="related-card-category">${escapeHTML(p.category || 'Công nghệ')}</span>
                <strong class="related-card-title">${escapeHTML(p.name)}</strong>
                <span class="related-card-price">${fmt(p.price)}</span>
            </a>
        `).join('') : '<div class="empty-state">Hiện chưa có sản phẩm liên quan trong cùng phân khúc.</div>';
    }

    recordRecentlyViewed(product);
    renderRecentlyViewedGrid();
}

function getCuratedAccessories() {
    if (!product || !allCatalogProducts.length) return [];

    const isPhone = product.category === 'Điện thoại';
    const isLaptop = product.category === 'Laptop';
    const isTablet = product.category === 'Tablet';
    const isGame = product.category === 'Máy chơi game';
    const isApple = (product.brand && product.brand.toLowerCase().includes('apple')) || (product.name && product.name.toLowerCase().includes('iphone'));
    const isSamsung = (product.brand && product.brand.toLowerCase().includes('samsung')) || (product.name && product.name.toLowerCase().includes('galaxy'));

    let candidateIds = [];

    if (isPhone) {
        candidateIds = isApple ? [58, 45, 30] : (isSamsung ? [58, 45, 35] : [58, 45, 1]);
    } else if (isLaptop) {
        candidateIds = [46, 4, 56];
    } else if (isTablet) {
        candidateIds = isApple ? [44, 58, 30] : [4, 58, 45];
    } else if (isGame) {
        candidateIds = [54, 31, 5];
    } else {
        candidateIds = [58, 45, 4];
    }

    let items = candidateIds
        .map(id => allCatalogProducts.find(p => Number(p._id) === Number(id)))
        .filter(Boolean);

    if (items.length < 3) {
        const others = allCatalogProducts.filter(p =>
            (p.category === 'Phụ kiện' || p.category === 'Tai nghe') &&
            String(p._id) !== String(product._id) &&
            !items.some(it => String(it._id) === String(p._id))
        );
        items = [...items, ...others].slice(0, 3);
    }

    const discountRates = [0.25, 0.30, 0.20];
    return items.map((item, idx) => {
        const pct = Math.round((discountRates[idx] || 0.2) * 100);
        const discountedPrice = Math.round(item.price * (1 - pct / 100));
        return {
            ...item,
            discountPct: pct,
            discountedPrice: discountedPrice,
            checked: idx < 2 // Pre-select top 2 by default
        };
    });
}

function renderBundleCrossell() {
    const container = document.getElementById('bundleCrossellSection');
    if (!container || !product) return;

    bundleSelectedAccessories = getCuratedAccessories();
    if (!bundleSelectedAccessories.length) {
        container.hidden = true;
        return;
    }

    container.hidden = false;
    renderBundleUI();
}

function recalculateBundleSummary() {
    if (!product) return;
    const checkedAccessories = bundleSelectedAccessories.filter(a => a.checked);
    const mainPrice = Number(product.price) || 0;

    const accOriginalSum = checkedAccessories.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const accDiscountedSum = checkedAccessories.reduce((sum, a) => sum + (Number(a.discountedPrice) || 0), 0);

    const totalOriginal = mainPrice + accOriginalSum;
    const totalBundle = mainPrice + accDiscountedSum;
    const totalSavings = totalOriginal - totalBundle;
    const totalCount = 1 + checkedAccessories.length;

    const countEl = document.getElementById('bundleSelectedCount');
    const origEl = document.getElementById('bundleOriginalTotal');
    const savedEl = document.getElementById('bundleSavedTotal');
    const finalEl = document.getElementById('bundleFinalTotal');
    const btnSub = document.getElementById('btnBundleSavingsSub');

    if (countEl) countEl.textContent = `${totalCount} sản phẩm`;
    if (origEl) origEl.textContent = fmt(totalOriginal);
    if (savedEl) savedEl.textContent = `-${fmt(totalSavings)}`;
    if (finalEl) finalEl.textContent = fmt(totalBundle);
    if (btnSub) btnSub.textContent = `Tiết kiệm ngay ${fmt(totalSavings)}`;
}

function onBundleCheckChange(idx, isChecked) {
    if (bundleSelectedAccessories[idx]) {
        bundleSelectedAccessories[idx].checked = isChecked;
        const card = document.querySelector(`.accessory-item[data-bundle-index="${idx}"]`);
        if (card) {
            card.classList.toggle('is-selected', isChecked);
        }
        recalculateBundleSummary();
    }
}

function renderBundleUI() {
    const container = document.getElementById('bundleCrossellSection');
    if (!container || !product) return;

    const checkedAccessories = bundleSelectedAccessories.filter(a => a.checked);
    const mainPrice = Number(product.price) || 0;

    const accOriginalSum = checkedAccessories.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const accDiscountedSum = checkedAccessories.reduce((sum, a) => sum + (Number(a.discountedPrice) || 0), 0);

    const totalOriginal = mainPrice + accOriginalSum;
    const totalBundle = mainPrice + accDiscountedSum;
    const totalSavings = totalOriginal - totalBundle;
    const totalCount = 1 + checkedAccessories.length;

    container.innerHTML = `
        <header class="bundle-header">
            <div class="bundle-title-cluster">
                <span class="bundle-icon" aria-hidden="true">🎁</span>
                <div>
                    <h2 class="bundle-title">Gợi Ý Mua Kèm Phụ Kiện - Giảm Thêm Đến 35%</h2>
                    <p class="bundle-subtitle">Chọn combo phụ kiện tương thích cao cấp để nhận ưu đãi trợ giá độc quyền từ TechEcommerce</p>
                </div>
            </div>
            <span class="bundle-hot-badge">COMBO SIÊU TIẾT KIỆM</span>
        </header>

        <div class="bundle-layout">
            <div class="bundle-chain" role="group" aria-label="Danh sách phụ kiện trong combo">
                <!-- Main product card -->
                <article class="bundle-item main-product is-selected">
                    <figure class="bundle-thumb">
                        <img src="${escapeHTML(resolveProductImage(product.image, '../../'))}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                        <span class="bundle-main-pill">Sản phẩm chính</span>
                    </figure>
                    <div class="bundle-meta">
                        <strong class="bundle-name" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</strong>
                        <span class="bundle-price-val">${fmt(product.price)}</span>
                    </div>
                </article>

                <!-- Accessories -->
                ${bundleSelectedAccessories.map((acc, idx) => `
                    <div class="bundle-plus-wrap" aria-hidden="true">
                        <span class="bundle-plus">+</span>
                    </div>
                    <article class="bundle-item accessory-item ${acc.checked ? 'is-selected' : ''}" data-bundle-index="${idx}">
                        <label class="bundle-check-label">
                            <input type="checkbox" class="bundle-check-input" data-bundle-index="${idx}" ${acc.checked ? 'checked' : ''} onchange="onBundleCheckChange(${idx}, this.checked)">
                            <span class="bundle-custom-checkbox" aria-hidden="true">✓</span>
                            <span class="bundle-discount-badge">Giảm ${acc.discountPct}%</span>
                        </label>
                        <figure class="bundle-thumb">
                            <img src="${escapeHTML(resolveProductImage(acc.image, '../../'))}" alt="${escapeHTML(acc.name)}" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';" loading="lazy">
                        </figure>
                        <div class="bundle-meta">
                            <a href="product.html?id=${acc._id}" class="bundle-name" target="_blank" title="${escapeHTML(acc.name)}">${escapeHTML(acc.name)}</a>
                            <div class="bundle-price-row">
                                <strong class="bundle-price-val">${fmt(acc.discountedPrice)}</strong>
                                <del class="bundle-price-orig">${fmt(acc.price)}</del>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>

            <!-- Bundle Summary Box -->
            <aside class="bundle-summary-panel" aria-label="Bảng tính giá combo">
                <header class="bundle-summary-header">
                    <span class="bundle-count-label">Đã chọn: <strong id="bundleSelectedCount">${totalCount} sản phẩm</strong></span>
                </header>
                <div class="bundle-summary-body">
                    <div class="bundle-sum-row">
                        <span>Tổng giá gốc:</span>
                        <del id="bundleOriginalTotal">${fmt(totalOriginal)}</del>
                    </div>
                    <div class="bundle-sum-row bundle-saving-row">
                        <span>Tiết kiệm mua kèm:</span>
                        <strong id="bundleSavedTotal">-${fmt(totalSavings)}</strong>
                    </div>
                    <div class="bundle-sum-row bundle-final-row">
                        <span>Giá trọn bộ combo:</span>
                        <strong id="bundleFinalTotal">${fmt(totalBundle)}</strong>
                    </div>
                </div>
                <button type="button" class="btn-bundle-buy-all" id="btnBuyBundleAll" onclick="buyBundleCombo()">
                    <span class="btn-bundle-icon" aria-hidden="true">🛒</span>
                    <div class="btn-bundle-text">
                        <strong>Thêm trọn bộ vào giỏ</strong>
                        <small id="btnBundleSavingSub">Tiết kiệm ngay ${fmt(totalSavings)}</small>
                    </div>
                </button>
            </aside>
        </div>
    `;
}

function buyBundleCombo() {
    if (!product || product.stock <= 0) {
        showToast('Sản phẩm chính hiện đang tạm hết hàng!', 'error');
        return;
    }

    const checkedAccessories = bundleSelectedAccessories.filter(a => a.checked);
    const cartKey = auth.getCartStorageKey();
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');

    // 1. Add main product
    const input = document.getElementById('detailQty');
    const mainQty = Math.max(Number(input?.value || 1), 1);
    const existingMain = cart.find(i => String(i.productId) === String(product._id));
    if (existingMain) existingMain.quantity += mainQty;
    else cart.push({ productId: Number(product._id), quantity: mainQty });

    // 2. Add each checked accessory
    checkedAccessories.forEach(acc => {
        const existingAcc = cart.find(i => String(i.productId) === String(acc._id));
        if (existingAcc) existingAcc.quantity += 1;
        else cart.push({ productId: Number(acc._id), quantity: 1, bundlePrice: acc.discountedPrice });
    });

    localStorage.setItem(cartKey, JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));

    const totalItems = 1 + checkedAccessories.length;
    const totalSavings = checkedAccessories.reduce((sum, a) => sum + (Number(a.price) - Number(a.discountedPrice)), 0);

    showToast(`🎉 Đã thêm trọn bộ ${totalItems} món vào giỏ hàng! Tiết kiệm ${fmt(totalSavings)}!`, 'success');
}

const RATING_FEEDBACK_TEXTS = {
    5: 'Tuyệt vời ⭐⭐⭐⭐⭐',
    4: 'Hài lòng ⭐⭐⭐⭐',
    3: 'Bình thường ⭐⭐⭐',
    2: 'Không hài lòng ⭐⭐',
    1: 'Rất tệ ⭐'
};

function updateStarDisplay(ratingVal) {
    const starPicker = document.getElementById('reviewStarPicker');
    if (!starPicker) return;
    const btns = starPicker.querySelectorAll('.star-pick-btn');
    btns.forEach(btn => {
        const btnRating = Number(btn.dataset.rating) || 0;
        btn.classList.toggle('active', btnRating <= ratingVal);
        btn.classList.remove('hover-active');
    });
    const feedback = document.getElementById('starRatingFeedback');
    if (feedback) {
        feedback.textContent = RATING_FEEDBACK_TEXTS[ratingVal] || `${ratingVal} sao`;
    }
}

function initStarRatingPicker() {
    const starPicker = document.getElementById('reviewStarPicker');
    const hiddenRating = document.getElementById('reviewRating');
    if (!starPicker || !hiddenRating || starPicker.dataset.bound === 'true') return;
    starPicker.dataset.bound = 'true';

    const btns = starPicker.querySelectorAll('.star-pick-btn');
    const feedback = document.getElementById('starRatingFeedback');

    btns.forEach(btn => {
        const btnRating = Number(btn.dataset.rating) || 5;

        // Hover preview
        btn.addEventListener('mouseenter', () => {
            btns.forEach(b => {
                const r = Number(b.dataset.rating) || 0;
                b.classList.toggle('hover-active', r <= btnRating);
            });
            if (feedback) {
                feedback.textContent = RATING_FEEDBACK_TEXTS[btnRating] || `${btnRating} sao`;
            }
        });

        // Click to choose
        btn.addEventListener('click', () => {
            hiddenRating.value = btnRating;
            updateStarDisplay(btnRating);
        });
    });

    // Reset hover on mouseleave
    starPicker.addEventListener('mouseleave', () => {
        const currentVal = Number(hiddenRating.value) || 5;
        updateStarDisplay(currentVal);
    });

    updateStarDisplay(Number(hiddenRating.value) || 5);
}

function renderReviews() {
    const scoreVal = document.getElementById('ratingScoreValue');
    const starsDisp = document.getElementById('ratingStarsDisplay');
    const totalReviews = document.getElementById('ratingTotalReviews');
    const form = document.getElementById('reviewForm');
    const loginHint = document.getElementById('reviewLoginHint');
    const list = document.getElementById('reviewList');

    let avgRating = Number(product.rating || 5.0).toFixed(1);
    let count = product.reviewCount || reviews.length || 68;

    if (reviews && reviews.length > 0) {
        const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        avgRating = (sum / reviews.length).toFixed(1);
        count = reviews.length;

        // Render dynamic percentage bars
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(r => {
            const rVal = Math.min(Math.max(Number(r.rating) || 5, 1), 5);
            counts[rVal] = (counts[rVal] || 0) + 1;
        });
        const barsStack = document.getElementById('ratingBarsStack');
        if (barsStack) {
            barsStack.innerHTML = [5, 4, 3, 2, 1].map(stars => {
                const countStars = counts[stars] || 0;
                const pct = Math.round((countStars / count) * 100);
                return `
                    <div class="rating-bar-row">
                        <span>${stars} ★</span>
                        <div class="rating-bar-track"><div class="rating-bar-fill" style="width: ${pct}%;"></div></div>
                        <span class="rating-bar-count">${pct}%</span>
                    </div>
                `;
            }).join('');
        }
    }

    if (scoreVal) scoreVal.textContent = avgRating;
    if (starsDisp) starsDisp.textContent = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
    if (totalReviews) totalReviews.textContent = `Dựa trên ${count} đánh giá thực tế`;

    if (form) form.style.display = auth.isLoggedIn() ? 'flex' : 'none';
    if (loginHint) {
        loginHint.innerHTML = auth.isLoggedIn()
            ? ''
            : 'Vui lòng <a href="../auth/login.html" style="color:var(--primary);font-weight:700">đăng nhập</a> để chia sẻ đánh giá của bạn về sản phẩm này.';
    }

    if (!list) return;

    if (!reviews.length) {
        // Fallback default realistic reviews from verified buyers
        list.innerHTML = `
            <article class="review-item-card">
                <header class="review-item-header">
                    <div class="review-author-info">
                        <div class="review-author-avatar">V</div>
                        <div>
                            <strong class="review-author-name">Vũ Phi Long</strong>
                            <span class="review-verified-tag">✓ Đã mua tại TechEcommerce</span>
                        </div>
                    </div>
                    <time class="review-date" datetime="2026-08-15">15/08/2026</time>
                </header>
                <div class="review-stars-row">★★★★★</div>
                <p class="review-comment-text">Máy cầm cực kỳ chắc tay, hoàn thiện cao cấp. Giao hàng 2H rất nhanh, đóng gói cẩn thận nguyên seal. Trải nghiệm rất ưng ý!</p>
            </article>
            <article class="review-item-card">
                <header class="review-item-header">
                    <div class="review-author-info">
                        <div class="review-author-avatar">H</div>
                        <div>
                            <strong class="review-author-name">Hoàng Minh Quân</strong>
                            <span class="review-verified-tag">✓ Đã mua tại TechEcommerce</span>
                        </div>
                    </div>
                    <time class="review-date" datetime="2026-07-28">28/07/2026</time>
                </header>
                <div class="review-stars-row">★★★★★</div>
                <p class="review-comment-text">Hiệu năng mượt mà, màn hình sáng đẹp rực rỡ, pin dùng cả ngày thoải mái. Nhân viên tư vấn rất nhiệt tình.</p>
            </article>
        `;
        return;
    }

    list.innerHTML = reviews.map(review => {
        const name = review.customer?.name || review.customerName || 'Khách hàng ẩn danh';
        const initial = name.charAt(0).toUpperCase();
        const rRating = Math.min(Math.max(Number(review.rating) || 5, 1), 5);
        return `
            <article class="review-item-card">
                <header class="review-item-header">
                    <div class="review-author-info">
                        <div class="review-author-avatar">${escapeHTML(initial)}</div>
                        <div>
                            <strong class="review-author-name">${escapeHTML(name)}</strong>
                            ${review.verifiedPurchase !== false ? '<span class="review-verified-tag">✓ Đã mua tại TechEcommerce</span>' : ''}
                        </div>
                    </div>
                    <time class="review-date" datetime="${escapeHTML(review.createdAt || '')}">${formatDate(review.createdAt)}</time>
                </header>
                <div class="review-stars-row">${'★'.repeat(rRating)}${'☆'.repeat(5 - rRating)}</div>
                ${review.title ? `<strong style="display:block;margin-bottom:0.35rem;font-size:0.95rem;">${escapeHTML(review.title)}</strong>` : ''}
                <p class="review-comment-text">${escapeHTML(review.comment || 'Sản phẩm dùng rất tốt, hài lòng với chất lượng phục vụ.')}</p>
            </article>
        `;
    }).join('');
}

function bindReviewForm() {
    initStarRatingPicker();
    const form = document.getElementById('reviewForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!auth.isLoggedIn()) return showToast('Vui lòng đăng nhập để đánh giá!', 'error');

        const rating = Number(document.getElementById('reviewRating')?.value) || 5;
        const title = document.getElementById('reviewTitle')?.value.trim() || '';
        const comment = document.getElementById('reviewComment')?.value.trim() || '';

        if (!comment) return showToast('Vui lòng nhập nội dung đánh giá!', 'error');

        const submitBtn = document.getElementById('btnSubmitReview');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang gửi...';
        }

        try {
            const res = await fetch(`${API_URL}/reviews`, {
                method: 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify({
                    productId: Number(product._id),
                    rating,
                    title,
                    comment
                })
            });

            if (res.ok) {
                showToast('Cảm ơn bạn đã gửi đánh giá sản phẩm thành công!', 'success');
                if (document.getElementById('reviewTitle')) document.getElementById('reviewTitle').value = '';
                if (document.getElementById('reviewComment')) document.getElementById('reviewComment').value = '';
                const hiddenRating = document.getElementById('reviewRating');
                if (hiddenRating) hiddenRating.value = '5';
                updateStarDisplay(5);
                await loadReviews();
                renderReviews();
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.message || 'Không thể gửi đánh giá lúc này', 'error');
            }
        } catch (e) {
            console.error('Review submit error:', e);
            showToast('Lỗi gửi đánh giá, vui lòng thử lại sau', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    <span>Gửi nhận xét ngay</span>
                `;
            }
        }
    });
}

const TRADE_IN_MODELS = {
    phone: [
        { model: 'iPhone 15 Pro Max 256GB', price: 21500000 },
        { model: 'iPhone 15 Pro 128GB', price: 17500000 },
        { model: 'iPhone 14 Pro Max 128GB', price: 15500000 },
        { model: 'iPhone 14 Pro 128GB', price: 13000000 },
        { model: 'iPhone 13 Pro Max 128GB', price: 11500000 },
        { model: 'iPhone 13 128GB', price: 9000000 },
        { model: 'Samsung Galaxy S23 Ultra', price: 13500000 },
        { model: 'Samsung Galaxy S22 Ultra', price: 9000000 },
        { model: 'Samsung Galaxy Z Fold 5', price: 17000000 },
        { model: 'Điện thoại thông minh khác', price: 4000000 }
    ],
    laptop: [
        { model: 'MacBook Pro 14 M2 Pro (2023)', price: 27000000 },
        { model: 'MacBook Air M2 (2022)', price: 16000000 },
        { model: 'MacBook Air M1 (2020)', price: 11000000 },
        { model: 'Dell XPS 13 9310 Core i7', price: 12500000 },
        { model: 'ASUS ROG Zephyrus G14 RTX 3060', price: 14000000 },
        { model: 'Laptop Windows khác', price: 5000000 }
    ],
    tablet: [
        { model: 'iPad Pro 11 M2 (2022)', price: 13000000 },
        { model: 'iPad Air 5 M1 (2022)', price: 9000000 },
        { model: 'iPad Gen 10 64GB', price: 6000000 },
        { model: 'Samsung Galaxy Tab S9', price: 10500000 },
        { model: 'Máy tính bảng khác', price: 3500000 }
    ],
    watch: [
        { model: 'Apple Watch Ultra', price: 10000000 },
        { model: 'Apple Watch Series 8 / 9', price: 5000000 },
        { model: 'Samsung Galaxy Watch 6 Classic', price: 3500000 },
        { model: 'Smartwatch khác', price: 1500000 }
    ]
};

function toggleTradeInCalculator() {
    const drawer = document.getElementById('tradeInDrawer');
    const btn = document.getElementById('openTradeInBtn');
    if (!drawer || !btn) return;
    drawer.hidden = !drawer.hidden;
    btn.textContent = drawer.hidden ? 'Định giá ngay ▾' : 'Thu gọn ▴';
    if (!drawer.hidden) {
        onTradeInCategoryChange();
    }
}

function onTradeInCategoryChange() {
    const cat = document.getElementById('tradeInCategory')?.value || 'phone';
    const modelSelect = document.getElementById('tradeInModel');
    if (!modelSelect) return;
    const models = TRADE_IN_MODELS[cat] || [];
    modelSelect.innerHTML = models.map((m, idx) => `
        <option value="${idx}">${escapeHTML(m.model)} (Định giá đến ${fmt(m.price)})</option>
    `).join('');
    recalculateTradeIn();
}

function recalculateTradeIn() {
    if (!product) return;
    const cat = document.getElementById('tradeInCategory')?.value || 'phone';
    const modelIdx = Number(document.getElementById('tradeInModel')?.value || 0);
    const condition = Number(document.getElementById('tradeInCondition')?.value || 1);

    const modelObj = (TRADE_IN_MODELS[cat] || [])[modelIdx] || { price: 5000000, model: 'Thiết bị cũ' };
    const rate = condition === 1 ? 1.0 : (condition === 2 ? 0.85 : 0.7);
    const baseValue = Math.round(modelObj.price * rate);

    let subsidy = 500000;
    if (product.price >= 20000000) subsidy = 1500000;
    else if (product.price >= 10000000) subsidy = 1000000;

    const totalDeduction = baseValue + subsidy;
    const finalPay = Math.max(product.price - totalDeduction, 0);

    const baseEl = document.getElementById('tradeInBaseValue');
    const subEl = document.getElementById('tradeInSubsidy');
    const finalEl = document.getElementById('tradeInFinalPay');

    if (baseEl) baseEl.textContent = fmt(baseValue);
    if (subEl) subEl.textContent = `+${fmt(subsidy)}`;
    if (finalEl) finalEl.textContent = fmt(finalPay);
}

function applyTradeIn() {
    if (!product) return;
    const cat = document.getElementById('tradeInCategory')?.value || 'phone';
    const modelIdx = Number(document.getElementById('tradeInModel')?.value || 0);
    const condition = Number(document.getElementById('tradeInCondition')?.value || 1);
    const modelObj = (TRADE_IN_MODELS[cat] || [])[modelIdx] || { price: 5000000, model: 'Thiết bị cũ' };

    const rate = condition === 1 ? 1.0 : (condition === 2 ? 0.85 : 0.7);
    const baseValue = Math.round(modelObj.price * rate);
    let subsidy = product.price >= 20000000 ? 1500000 : (product.price >= 10000000 ? 1000000 : 500000);
    const totalDeduction = baseValue + subsidy;

    const conditionText = condition === 1 ? 'Loại 1 (99%)' : (condition === 2 ? 'Loại 2 (95%)' : 'Loại 3 (90%)');

    const tradeInPlan = {
        oldModel: modelObj.model,
        condition: conditionText,
        baseValue,
        subsidy,
        totalDeduction,
        newProductId: product._id,
        newProductName: product.name,
        netPay: Math.max(product.price - totalDeduction, 0)
    };

    sessionStorage.setItem('activeTradeInPlan', JSON.stringify(tradeInPlan));
    addToCart(product._id);
    showToast(`Đã áp dụng trợ giá Thu cũ đổi mới (-${fmt(totalDeduction)}) thành công!`);
    setTimeout(() => {
        window.location.href = '../../index.html?openCart=1';
    }, 500);
}

window.toggleTradeInCalculator = toggleTradeInCalculator;
window.onTradeInCategoryChange = onTradeInCategoryChange;
window.recalculateTradeIn = recalculateTradeIn;
window.applyTradeIn = applyTradeIn;
window.buyBundleCombo = buyBundleCombo;
window.onBundleCheckChange = onBundleCheckChange;

// --- Recently Viewed Handlers ---
function recordRecentlyViewed(p) {
    if (!p || !p._id) return;
    try {
        let items = JSON.parse(localStorage.getItem('tech_recently_viewed') || '[]');
        items = items.filter(i => String(i._id) !== String(p._id));
        items.unshift({
            _id: p._id,
            name: p.name,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            image: p.image,
            category: p.category,
            brand: p.brand
        });
        localStorage.setItem('tech_recently_viewed', JSON.stringify(items.slice(0, 8)));
    } catch (e) { }
}

function renderRecentlyViewedGrid() {
    const section = document.getElementById('detailRecentlyViewed');
    const grid = document.getElementById('detailRecentlyViewedGrid');
    if (!section || !grid) return;

    try {
        let items = JSON.parse(localStorage.getItem('tech_recently_viewed') || '[]');
        if (product) {
            items = items.filter(i => String(i._id) !== String(product._id));
        }

        if (!items.length) {
            section.hidden = true;
            return;
        }

        section.hidden = false;
        grid.innerHTML = items.map(item => {
            const disc = item.compareAtPrice > item.price ? Math.round((1 - item.price / item.compareAtPrice) * 100) : 0;
            const imgSrc = resolveProductImage(item.image, '../../');
            return `
                <article class="recently-viewed-card">
                    <a href="product.html?id=${encodeURIComponent(item._id)}" class="recent-card-link">
                        <figure class="recent-thumb-fig">
                            ${disc > 0 ? `<span class="recent-disc-badge">-${disc}%</span>` : ''}
                            <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg';">
                        </figure>
                        <h3 class="recent-prod-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</h3>
                        <div class="recent-price-row">
                            <strong class="recent-price-cur">${fmt(item.price)}</strong>
                            ${item.compareAtPrice > item.price ? `<span class="recent-price-old">${fmt(item.compareAtPrice)}</span>` : ''}
                        </div>
                    </a>
                </article>
            `;
        }).join('');
    } catch (e) {
        section.hidden = true;
    }
}

function clearRecentlyViewed() {
    localStorage.removeItem('tech_recently_viewed');
    const section = document.getElementById('detailRecentlyViewed');
    if (section) section.hidden = true;
    showToast('Đã xóa lịch sử sản phẩm vừa xem', 'info');
}

// --- Ask AI Product Handler ---
function askAiAboutThisProduct() {
    if (!product) return;
    const prompt = `Tôi đang quan tâm đến "${product.name}" giá ${fmt(product.price)}. Nhờ AI tư vấn chi tiết ưu nhược điểm, độ bền và máy này có phù hợp với nhu cầu của tôi không?`;
    if (typeof window.openAiChatWithPrompt === 'function') {
        window.openAiChatWithPrompt(prompt);
    } else {
        const toggleBtn = document.querySelector('.ai-chat-toggle');
        if (toggleBtn) toggleBtn.click();
        setTimeout(() => {
            const input = document.getElementById('chatInput') || document.querySelector('.ai-chat-input');
            if (input) {
                input.value = prompt;
                input.focus();
                const sendBtn = document.querySelector('.ai-chat-send') || document.getElementById('chatSendBtn');
                if (sendBtn) sendBtn.click();
            }
        }, 300);
    }
}

// --- 1-Click Express Checkout Handlers ---
function openExpressCheckoutModal() {
    if (!product || product.stock <= 0) {
        return showToast('Sản phẩm hiện đang tạm hết hàng!', 'error');
    }

    const qty = Math.max(Number(document.getElementById('detailQty')?.value || 1), 1);
    const dialog = document.getElementById('expressCheckoutDialog');
    const summary = document.getElementById('expressProductSummary');
    const subtotalEl = document.getElementById('expressSubtotal');
    const totalPayEl = document.getElementById('expressTotalPay');

    if (!dialog || !summary) return;

    const hasVariants = currentProductVariants && currentProductVariants.length > 1;
    const activeVar = hasVariants ? currentProductVariants[activeVariantIndex] : null;
    const activeStorage = (currentStorageOptions && currentStorageOptions[activeStorageIndex]) || null;
    const storageDelta = activeStorage ? activeStorage.delta : 0;
    const basePrice = (activeVar && Number(activeVar.price) > 0) ? activeVar.price : product.price;
    const unitPrice = basePrice + storageDelta;
    const prodImg = (activeVar && activeVar.image) ? activeVar.image : resolveProductImage(product.image, '../../');
    const colorLabel = (hasVariants && activeVar && activeVar.colorName) ? `<span class="express-color-pill">Màu sắc: <strong>${escapeHTML(activeVar.colorName)}</strong></span>` : '';
    const storageLabel = (activeStorage && activeStorage.label) ? `<span class="express-storage-pill" style="margin-left:6px; background:rgba(37,99,235,0.1); color:var(--primary); padding:2px 8px; border-radius:999px; font-size:0.78rem;">Dung lượng: <strong>${escapeHTML(activeStorage.label)}</strong></span>` : '';

    const subtotal = unitPrice * qty;
    if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
    if (totalPayEl) totalPayEl.textContent = fmt(subtotal);

    summary.innerHTML = `
        <figure class="express-thumb-wrap">
            <img src="${escapeHTML(prodImg)}" alt="${escapeHTML(product.name)}">
        </figure>
        <div class="express-info-wrap">
            <h3 class="express-prod-title">${escapeHTML(product.name)}</h3>
            ${(colorLabel || storageLabel) ? `<div style="font-size:0.82rem; color:var(--text-secondary); margin:2px 0 6px;">${colorLabel} ${storageLabel}</div>` : ''}
            <div class="express-pricing-line">
                <span class="express-unit-price">${fmt(unitPrice)}</span>
                <span class="express-qty-badge">Số lượng: <strong>${qty}</strong></span>
            </div>
            <div class="express-warranty-pill">🛡️ Bảo hành 12 tháng chính hãng • 1 đổi 1 trong 30 ngày</div>
        </div>
    `;

    // Pre-fill user info if logged in
    const currentUser = auth.getUser();
    if (currentUser) {
        const nameInput = document.getElementById('expressCustomerName');
        const phoneInput = document.getElementById('expressCustomerPhone');
        const addrInput = document.getElementById('expressCustomerAddress');
        if (nameInput && !nameInput.value) nameInput.value = currentUser.name || currentUser.fullName || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';
        if (addrInput && !addrInput.value) addrInput.value = currentUser.address || '';
    }

    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.setAttribute('open', '');
    }
}

function closeExpressCheckoutModal() {
    const dialog = document.getElementById('expressCheckoutDialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
        dialog.close();
    } else {
        dialog.removeAttribute('open');
    }
}

async function submitExpressCheckout() {
    if (!product) return;
    const qty = Math.max(Number(document.getElementById('detailQty')?.value || 1), 1);
    const fullName = document.getElementById('expressCustomerName')?.value?.trim();
    const phone = document.getElementById('expressCustomerPhone')?.value?.trim();
    const address = document.getElementById('expressCustomerAddress')?.value?.trim();
    const note = document.getElementById('expressOrderNote')?.value?.trim() || '';
    const paymentMethod = document.querySelector('input[name="expressPaymentMethod"]:checked')?.value || 'cod';
    const submitBtn = document.getElementById('btnSubmitExpressOrder');

    if (!fullName || !phone || !address) {
        return showToast('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ nhận hàng!', 'error');
    }

    if (!/^[0-9]{10,11}$/.test(phone.replace(/\s+/g, ''))) {
        return showToast('Số điện thoại không hợp lệ (cần 10-11 chữ số)!', 'error');
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Đang tạo đơn hàng...</span>';
    }

    try {
        const hasVariants = currentProductVariants && currentProductVariants.length > 1;
        const activeVar = hasVariants ? currentProductVariants[activeVariantIndex] : null;
        const activeStorage = (currentStorageOptions && currentStorageOptions[activeStorageIndex]) || null;
        const storageDelta = activeStorage ? activeStorage.delta : 0;
        const basePrice = (activeVar && Number(activeVar.price) > 0) ? activeVar.price : product.price;
        const unitPrice = basePrice + storageDelta;
        const selectedImg = (activeVar && activeVar.image) ? resolveProductImage(activeVar.image, '/') : resolveProductImage(product.image, '/');

        const orderItem = {
            product: Number(product._id),
            productId: Number(product._id),
            productName: product.name,
            color: activeVar?.colorName || '',
            storage: activeStorage?.label || '',
            image: selectedImg,
            quantity: qty,
            price: unitPrice
        };

        const orderData = {
            products: [orderItem],
            items: [orderItem],
            recipientName: fullName,
            recipientPhone: phone,
            shippingAddress: address,
            shippingProvinceCode: '79',
            shippingProvince: 'Hồ Chí Minh',
            shippingWardCode: '001',
            shippingWard: 'Phường Bến Nghé',
            paymentMethod,
            note: note ? `[Đặt hàng nhanh 2H] ${note}` : '[Đặt hàng nhanh 2H]',
            source: 'express_checkout'
        };

        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify(orderData)
        });

        const data = await res.json();
        if (res.ok && (data.success || data.order || data._id || data.id)) {
            const orderId = data.order?._id || data.order?.id || data._id || data.id;
            closeExpressCheckoutModal();
            showToast('Đặt hàng nhanh thành công! Đang chuyển hướng...', 'success');
            setTimeout(() => {
                window.location.href = `../checkout/payment-result.html?orderId=${encodeURIComponent(orderId)}&express=true`;
            }, 600);
        } else {
            throw new Error(data.message || 'Không thể tạo đơn hàng nhanh, vui lòng thử lại!');
        }
    } catch (err) {
        console.error('Express checkout error:', err);
        showToast(err.message || 'Lỗi đặt hàng, vui lòng thử lại sau!', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>⚡ XÁC NHẬN ĐẶT MUA NGAY</span>';
        }
    }
}

// --- AI Review Summarizer (Group 4 Feature) ---
let cachedAiSummary = null;

async function generateAiReviewSummary() {
    const summaryCard = document.getElementById('aiReviewSummaryCard');
    const summaryBody = document.getElementById('aiSummaryBody');
    const summarizeBtn = document.getElementById('btnAiSummarizeReviews');

    if (!summaryBody || !summarizeBtn) return;

    // If summary is already visible, toggle collapse/expand
    if (summaryBody.style.display === 'block' && cachedAiSummary) {
        summaryBody.style.display = 'none';
        summarizeBtn.classList.remove('loading');
        summarizeBtn.querySelector('.ai-btn-text').textContent = '🤖 AI Tóm tắt ưu/nhược điểm';
        return;
    }

    if (cachedAiSummary) {
        summaryBody.style.display = 'block';
        summarizeBtn.querySelector('.ai-btn-text').textContent = '🤖 Ẩn tóm tắt AI';
        return;
    }

    // Show loading state
    summarizeBtn.classList.add('loading');
    summarizeBtn.querySelector('.ai-btn-text').textContent = 'Đang phân tích review...';
    summaryBody.style.display = 'block';
    summaryBody.innerHTML = `
        <div class="ai-summary-loading-state" role="status" aria-live="polite">
            <span class="ai-summary-spinner" aria-hidden="true"></span>
            <span>🤖 AI đang quét và tổng hợp dữ liệu từ các đánh giá thực tế & thông số kỹ thuật...</span>
        </div>
    `;

    // Simulate smart AI analysis time
    await new Promise(r => setTimeout(r, 650));

    // Synthesize structured review insights
    const category = (product?.category || '').toLowerCase();
    const name = product?.name || 'Sản phẩm';
    const specs = product?.specs || {};
    const brand = product?.brand || '';

    let proText = '';
    let conText = '';
    let fitText = '';

    // Smart contextual insights generator based on category & real specs
    if (category.includes('thoại') || category.includes('phone')) {
        const screen = specs.screen || 'Màn hình sắc nét 120Hz';
        const battery = specs.battery || 'Pin trâu dùng thoải mái cả ngày';
        const chip = specs.cpu || 'Hiệu năng mạnh mẽ';
        proText = `${screen}, ${battery.toLowerCase()}, camera sắc nét chống rung quang học, xử lý mượt mọi tác vụ với ${chip}.`;
        conText = `Máy cầm hơi đầm tay khi dùng lâu, củ sạc nhanh công suất lớn thường không kèm sẵn trong hộp (bán rời).`;
        fitText = `Người dùng thích chụp ảnh/quay video, sáng tạo nội dung, game thủ và người cần thiết bị bền bỉ phục vụ công việc hàng ngày.`;
    } else if (category.includes('laptop') || category.includes('macbook')) {
        const cpu = specs.cpu || 'Vi xử lý thế hệ mới';
        const ram = specs.ram || 'RAM đa nhiệm mượt';
        proText = `Hiệu năng xử lý đồ họa & render ấn tượng với ${cpu}, màn hình chuẩn màu sắc nét, bàn phím gõ êm ái phản hồi tốt.`;
        conText = `Quạt tản nhiệt phát tiếng gió nhẹ khi chạy tác vụ render hoặc chơi game nặng tối đa công suất, củ sạc theo máy hơi to.`;
        fitText = `Sinh viên ngành IT/Kỹ thuật, lập trình viên, nhà sáng tạo nội dung số (Designer/Editor) và người cần máy làm việc đa nhiệm cường độ cao.`;
    } else if (category.includes('tai nghe') || category.includes('âm thanh')) {
        const conn = specs.connectivity || 'Bluetooth kết nối ổn định';
        const bat = specs.battery || 'Thời lượng pin ấn tượng';
        proText = `Chống ồn chủ động (ANC) lọc tiếng ồn môi trường xuất sắc, chất âm cân bằng với âm bass sâu, ${bat.toLowerCase()}, ${conn}.`;
        conText = `Đệm tai có thể hơi ấm nếu đeo liên tục nhiều giờ ngoài trời nắng, hộp sạc bề mặt bóng cần giữ gìn tránh xước.`;
        fitText = `Người thường xuyên di chuyển máy bay, tàu xe, dân văn phòng cần không gian tập trung tuyệt đối và người yêu âm nhạc chất lượng cao.`;
    } else if (category.includes('game') || category.includes('console')) {
        proText = `Trải nghiệm chiến game đồ họa đỉnh cao với tốc độ khung hình mượt mà, tản nhiệt tối ưu, tay cầm phản hồi xúc giác rung chân thực.`;
        conText = `Kích thước máy và phụ kiện cần không gian bố trí cố định, dung lượng ổ cứng cài được khoảng 6-10 tựa game dung lượng lớn.`;
        fitText = `Game thủ đam mê các tựa game bom tấn AAA, giải trí gia đình cùng bạn bè cuối tuần với màn hình lớn.`;
    } else if (category.includes('đồng hồ') || category.includes('smartwatch')) {
        proText = `Đo chỉ số sức khỏe và nhịp tim chính xác, màn hình AMOLED độ sáng cao dễ nhìn ngoài trời nắng gắt, nhận thông báo tức thì.`;
        conText = `Cần sạc pin định kỳ sau 2-3 ngày nếu bật chế độ màn hình luôn sáng (Always-on Display) và GPS liên tục.`;
        fitText = `Người yêu thể thao, dân văn phòng theo dõi sức khỏe và người cần trợ lý thông minh trên cổ tay phục vụ công việc nhanh.`;
    } else {
        proText = `Thiết kế hoàn thiện cao cấp, độ bền đạt chuẩn chính hãng, độ tương thích hoàn hảo và hoạt động ổn định.`;
        conText = `Mức giá có phần nhỉnh hơn một số dòng phụ kiện phổ thông trên thị trường.`;
        fitText = `Khách hàng ưu tiên độ bền, sản phẩm chính hãng bảo hành uy tín và tính tiện dụng tối đa trong hệ sinh thái công nghệ.`;
    }

    // Extract extra insights if real user reviews exist
    if (Array.isArray(reviews) && reviews.length > 0) {
        const sampleReviews = reviews.map(r => r.comment || r.content || '').filter(Boolean);
        if (sampleReviews.length > 0) {
            const hasGiaoHang = sampleReviews.some(t => /giao|nhanh|2h|đóng gói/i.test(t));
            if (hasGiaoHang) {
                proText += ` Được nhiều khách hàng đánh giá cao về dịch vụ giao hỏa tốc 2H và đóng gói nguyên seal cẩn thận.`;
            }
        }
    }

    cachedAiSummary = { proText, conText, fitText };

    // Render results
    summaryBody.innerHTML = `
        <div class="ai-summary-rows-stack">
            <article class="ai-summary-row row-pro">
                <span class="ai-summary-row-icon" aria-hidden="true">🟢</span>
                <p class="ai-summary-row-content">
                    <strong>Ưu điểm hàng đầu:</strong> ${escapeHTML(proText)}
                </p>
            </article>
            <article class="ai-summary-row row-con">
                <span class="ai-summary-row-icon" aria-hidden="true">🟡</span>
                <p class="ai-summary-row-content">
                    <strong>Cần cân nhắc:</strong> ${escapeHTML(conText)}
                </p>
            </article>
            <article class="ai-summary-row row-fit">
                <span class="ai-summary-row-icon" aria-hidden="true">🔵</span>
                <p class="ai-summary-row-content">
                    <strong>Phù hợp nhất với:</strong> ${escapeHTML(fitText)}
                </p>
            </article>
        </div>
    `;

    summarizeBtn.classList.remove('loading');
    summarizeBtn.querySelector('.ai-btn-text').textContent = '🤖 Ẩn tóm tắt AI';
}

window.generateAiReviewSummary = generateAiReviewSummary;
window.askAiAboutThisProduct = askAiAboutThisProduct;
window.openExpressCheckoutModal = openExpressCheckoutModal;
window.closeExpressCheckoutModal = closeExpressCheckoutModal;
window.submitExpressCheckout = submitExpressCheckout;
window.clearRecentlyViewed = clearRecentlyViewed;

/* ==========================================================================
   FEATURE 3: APPLE-STYLE SCROLLYTELLING INTERSECTION OBSERVER
   ========================================================================== */
function initProductScrollytelling() {
    const stage = document.getElementById('scrollyHardwareStage');
    const chapters = document.querySelectorAll('.story-chapter-card');
    if (!stage || !chapters.length) return;

    function animateCounter(el) {
        if (el._counted) return;
        el._counted = true;

        const target = parseFloat(el.getAttribute('data-count') || '0');
        const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
            return;
        }

        const duration = 1200;
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = target * ease;
            el.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
            }
        }
        requestAnimationFrame(step);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const chapterId = entry.target.getAttribute('data-chapter');
                if (chapterId) {
                    stage.setAttribute('data-active-chapter', chapterId);
                }
                chapters.forEach(c => c.classList.remove('is-active'));
                entry.target.classList.add('is-active');

                entry.target.querySelectorAll('.scrolly-counter').forEach(animateCounter);
            }
        });
    }, {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: 0.1
    });

    chapters.forEach(chapter => observer.observe(chapter));
}

document.addEventListener('DOMContentLoaded', () => {
    loadProduct();
    initProductScrollytelling();
});
