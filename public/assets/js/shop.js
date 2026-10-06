let allProducts = [];
let activeCategory = new URLSearchParams(window.location.search).get('category') || 'all';
let wishlistIds = new Set();
let paymentProviders = {};
let productMeta = { categories: [], brands: [], tags: [] };
let appliedCoupon = null;

// Ensure comparison state starts 100% empty on every page load/reload per NameThatUI specifications
try {
    localStorage.removeItem('compareProducts');
    sessionStorage.removeItem('compareProducts');
} catch (e) { }

let compareProducts = new Set();
const MAX_COMPARE_PRODUCTS = 4;

const categoryLabels = {
    'Điện thoại': 'Điện thoại',
    Laptop: 'Laptop',
    Tablet: 'Tablet',
    'Tai nghe': 'Tai nghe',
    'Đồng hồ thông minh': 'Đồng hồ thông minh',
    'Phụ kiện': 'Phụ kiện',
    'Máy chơi game': 'Máy chơi game'
};

const CANONICAL_CATEGORY_ORDER = [
    'Điện thoại',
    'Laptop',
    'Tablet',
    'Tai nghe',
    'Đồng hồ thông minh',
    'Phụ kiện',
    'Máy chơi game'
];

const DELIVERY_DATA_URL = 'assets/data/vietnam-administrative-2025.json?v=20260712-1';
let deliveryAreas = [];
let deliveryAreasState = 'idle';
let deliveryAreasPromise = null;
let currentShippingQuote = null;
let currentInstallmentQuote = null;
let installmentQuoteTimer = null;
let checkoutAddressInitialized = false;

function normalizeAddressSearch(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLocaleLowerCase('vi')
        .trim();
}

function loadDeliveryAreas() {
    if (deliveryAreasPromise) return deliveryAreasPromise;

    deliveryAreasState = 'loading';
    deliveryAreasPromise = fetch(DELIVERY_DATA_URL, { cache: 'no-cache' })
        .then(response => {
            if (!response.ok) throw new Error(`Khong tai duoc du lieu dia chi (${response.status})`);
            return response.json();
        })
        .then(data => {
            const provinces = Array.isArray(data?.provinces) ? data.provinces : [];
            const wardCount = provinces.reduce((total, province) => total + (province.wards?.length || 0), 0);
            if (provinces.length !== 34 || wardCount !== 3321) {
                throw new Error(`Du lieu dia chi khong day du: ${provinces.length} tinh/thanh, ${wardCount} phuong/xa`);
            }

            deliveryAreas = provinces.map(province => {
                const aliases = Array.isArray(province.aliases) ? province.aliases : [];
                const formerAreas = aliases
                    .map(name => name.replace(/^(Thành phố|Tỉnh)\s+/u, ''))
                    .join(', ');
                return {
                    ...province,
                    aliases,
                    wards: Array.isArray(province.wards) ? province.wards : [],
                    hint: formerAreas
                        ? `${province.wards?.length || 0} phường, xã, đặc khu · Gồm khu vực cũ: ${formerAreas}`
                        : `${province.wards?.length || 0} phường, xã, đặc khu`,
                    searchText: normalizeAddressSearch([
                        province.name,
                        province.label,
                        ...aliases
                    ].join(' '))
                };
            });
            deliveryAreasState = 'ready';
            return deliveryAreas;
        })
        .catch(error => {
            deliveryAreasState = 'error';
            deliveryAreasPromise = null;
            console.error('Delivery area data error:', error);
            throw error;
        });

    return deliveryAreasPromise;
}

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

function renderPaymentMethodHint() {
    const hint = document.getElementById('paymentMethodHint');
    const select = document.getElementById('paymentMethod');
    if (!hint || !select) return;

    if (!auth.isLoggedIn() && ['cod', 'installment'].includes(select.value)) {
        hint.textContent = 'Phương thức này chỉ dành cho khách hàng đã đăng nhập tài khoản.';
        return;
    }
    hint.textContent = '';
}

function applyPaymentProviderAvailability(providers) {
    paymentProviders = providers || {};

    const select = document.getElementById('paymentMethod');
    if (!select) return;

    [...select.options].forEach(option => {
        const provider = paymentProviders[option.value];
        if (!option.dataset.baseLabel) option.dataset.baseLabel = option.textContent;

        const guestRestricted = !auth.isLoggedIn() && ['cod', 'installment'].includes(option.value);
        if (guestRestricted) {
            option.disabled = true;
            option.hidden = false;
            option.textContent = `${option.dataset.baseLabel} (cần đăng nhập)`;
        } else if (provider && provider.configured === false) {
            option.disabled = true;
            option.hidden = true;
        } else {
            option.disabled = false;
            option.hidden = false;
            option.textContent = option.dataset.baseLabel;
        }
    });

    const selected = select.options[select.selectedIndex];
    if (!selected || selected.disabled || selected.hidden) {
        const fallback = [...select.options].find(option => !option.disabled && !option.hidden);
        if (fallback) select.value = fallback.value;
    }

    renderPaymentMethodHint();
}

async function loadPaymentProviders() {
    try {
        const res = await fetch(`${API_URL}/payments/providers`);
        const data = await res.json();
        if (!res.ok) return;
        applyPaymentProviderAvailability(data.providers || {});
    } catch (error) {
        console.error('Payment provider error:', error);
    }
}

async function loadRecommendations() {
    const section = document.getElementById('productRecommendations');
    const grid = document.getElementById('recommendationGrid');
    if (!section || !grid) return;

    try {
        const response = await fetch(`${API_URL}/products/recommendations?limit=4`, {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.products) || !data.products.length) return;

        document.getElementById('recommendationTitle').textContent = data.personalized
            ? 'Gợi ý dành riêng cho bạn'
            : 'Sản phẩm đáng quan tâm';
        document.getElementById('recommendationDescription').textContent = data.personalized
            ? 'Xếp hạng từ đơn hàng, sản phẩm yêu thích và xu hướng mua sắm của bạn.'
            : 'Xếp hạng theo đánh giá, lượt mua và tình trạng còn hàng.';
        grid.innerHTML = data.products.map(productCard).join('');
        section.hidden = false;
    } catch (error) {
        console.error('Recommendation error:', error);
    }
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
            if (res.status === 401) {
                auth.logoutQuietly();
            }
        } catch (e) {
            console.error('Wishlist error:', e);
        }
    }
    const local = JSON.parse(localStorage.getItem('wishlist') || '[]');
    wishlistIds = new Set(local.map(Number));
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
                if (wishlistIds.has(productId)) wishlistIds.delete(productId);
                else wishlistIds.add(productId);
                localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
                renderProducts();
                showToast('Phiên làm việc đã hết hạn. Đã lưu yêu thích trên máy của bạn!', 'info');
                return;
            }
            if (!res.ok) throw new Error(data.message || 'Không cập nhật được yêu thích');
            wishlistIds = new Set(data.map(item => Number(item._id || item)));
        } catch (err) {
            if (err.message && (err.message.includes('token') || err.message.includes('quyền') || err.message.includes('hết hạn'))) {
                auth.logoutQuietly();
                if (wishlistIds.has(productId)) wishlistIds.delete(productId);
                else wishlistIds.add(productId);
                localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
                renderProducts();
                showToast('Phiên làm việc đã hết hạn. Đã lưu yêu thích trên máy của bạn!', 'info');
                return;
            }
            throw err;
        }
    } else {
        if (wishlistIds.has(productId)) wishlistIds.delete(productId);
        else wishlistIds.add(productId);
        localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
    }
    renderProducts();
}

const activeSpecFacets = new Map();

const FACETED_SPEC_CONFIG = {
    Laptop: [
        { key: 'ram', label: '💾 RAM', options: ['16GB', '32GB', '64GB'] },
        { key: 'cpu', label: '⚡ Vi xử lý (CPU)', options: ['Apple Silicon', 'Core i7', 'Core i9', 'Ryzen 7'] },
        { key: 'gpu', label: '🎮 Card đồ họa (GPU)', options: ['RTX 4050', 'RTX 4060', 'RTX 4070', 'Apple GPU'] }
    ],
    'Điện thoại': [
        { key: 'storage', label: '📦 Dung lượng', options: ['128GB', '256GB', '512GB', '1TB'] },
        { key: 'screen', label: '📱 Màn hình', options: ['OLED', '120Hz', 'Super Retina'] }
    ],
    Tablet: [
        { key: 'screen', label: '📐 Màn hình', options: ['11 inch', '13 inch'] },
        { key: 'storage', label: '💾 Dung lượng', options: ['128GB', '256GB', '512GB'] }
    ],
    'Tai nghe': [
        { key: 'feature', label: '🎧 Tính năng', options: ['Chống ồn ANC', 'Bluetooth 5.3', 'Pin > 30h'] }
    ],
    'Phụ kiện': [
        { key: 'type', label: '⌨️ Loại phụ kiện', options: ['Bàn phím cơ', 'Chuột không dây', 'Củ sạc nhanh 65W-100W', 'Pin dự phòng'] }
    ]
};

function productMatchesFacet(product, key, valuesSet) {
    if (!valuesSet || valuesSet.size === 0) return true;
    const nameNorm = normalizeAddressSearch(product.name || '');
    const descNorm = normalizeAddressSearch(product.description || '');
    const specs = product.specs || {};

    for (const val of valuesSet) {
        const valNorm = normalizeAddressSearch(val);
        if (key === 'ram') {
            const ramNorm = normalizeAddressSearch(specs.ram || '');
            if (ramNorm.includes(valNorm) || nameNorm.includes(valNorm) || descNorm.includes(valNorm)) return true;
        } else if (key === 'cpu') {
            const cpuNorm = normalizeAddressSearch(specs.cpu || '');
            if (val === 'Apple Silicon') {
                if (cpuNorm.includes('apple') || cpuNorm.includes('m1') || cpuNorm.includes('m2') || cpuNorm.includes('m3') || cpuNorm.includes('m4') || nameNorm.includes('m3') || nameNorm.includes('m2') || nameNorm.includes('m1')) return true;
            } else if (cpuNorm.includes(valNorm) || nameNorm.includes(valNorm) || descNorm.includes(valNorm)) {
                return true;
            }
        } else if (key === 'gpu') {
            const gpuNorm = normalizeAddressSearch(specs.gpu || '');
            if (val === 'Apple GPU') {
                if (gpuNorm.includes('apple') || nameNorm.includes('macbook') || descNorm.includes('apple gpu')) return true;
            } else if (gpuNorm.includes(valNorm) || nameNorm.includes(valNorm) || descNorm.includes(valNorm)) {
                return true;
            }
        } else if (key === 'storage') {
            const storageNorm = normalizeAddressSearch(specs.storage || '');
            if (storageNorm.includes(valNorm) || nameNorm.includes(valNorm) || descNorm.includes(valNorm)) return true;
        } else if (key === 'screen') {
            const screenNorm = normalizeAddressSearch(specs.screen || '');
            if (val === 'OLED') {
                if (screenNorm.includes('oled') || screenNorm.includes('amoled') || screenNorm.includes('retina') || descNorm.includes('oled') || descNorm.includes('super retina')) return true;
            } else if (val === '120Hz') {
                if (screenNorm.includes('120') || descNorm.includes('120hz') || descNorm.includes('promotion')) return true;
            } else if (val === 'Super Retina') {
                if (screenNorm.includes('retina') || descNorm.includes('retina')) return true;
            } else if (screenNorm.includes(valNorm) || nameNorm.includes(valNorm) || descNorm.includes(valNorm)) {
                return true;
            }
        } else if (key === 'feature') {
            if (val === 'Chống ồn ANC') {
                if (descNorm.includes('chong on') || descNorm.includes('anc') || descNorm.includes('noise') || nameNorm.includes('chong on')) return true;
            } else if (val === 'Bluetooth 5.3') {
                if (descNorm.includes('5.3') || descNorm.includes('bluetooth') || specs.os?.includes('5.3')) return true;
            } else if (val === 'Pin > 30h') {
                if (descNorm.includes('30h') || descNorm.includes('30 gio') || specs.battery?.includes('30')) return true;
            }
        } else if (key === 'type') {
            if (val === 'Bàn phím cơ') {
                if (nameNorm.includes('ban phim') || descNorm.includes('ban phim') || (product.tags || []).some(t => normalizeAddressSearch(t).includes('phim'))) return true;
            } else if (val === 'Chuột không dây') {
                if (nameNorm.includes('chuot') || descNorm.includes('chuot') || (product.tags || []).some(t => normalizeAddressSearch(t).includes('chuot'))) return true;
            } else if (val === 'Củ sạc nhanh 65W-100W') {
                if (nameNorm.includes('sac') || nameNorm.includes('cu sac') || descNorm.includes('65w') || descNorm.includes('100w')) return true;
            } else if (val === 'Pin dự phòng') {
                if (nameNorm.includes('du phong') || descNorm.includes('du phong') || (product.tags || []).some(t => normalizeAddressSearch(t).includes('du phong'))) return true;
            }
        }
    }
    return false;
}

function renderFacetedSpecBar() {
    const bar = document.getElementById('facetedSpecBar');
    if (!bar) return;

    const groups = FACETED_SPEC_CONFIG[activeCategory];
    if (!groups || !groups.length) {
        bar.hidden = true;
        bar.innerHTML = '';
        return;
    }

    let totalActive = 0;
    activeSpecFacets.forEach(set => totalActive += set.size);

    bar.innerHTML = `
        ${groups.map(group => {
            const activeSet = activeSpecFacets.get(group.key) || new Set();
            return `
                <div class="faceted-spec-group">
                    <span class="faceted-spec-label">${escapeHTML(group.label)}:</span>
                    <div class="faceted-spec-chips">
                        ${group.options.map(opt => {
                            const isSelected = activeSet.has(opt);
                            return `
                                <button type="button" class="faceted-chip ${isSelected ? 'active' : ''}"
                                    data-facet-key="${group.key}" data-facet-val="${escapeHTML(opt)}"
                                    aria-pressed="${isSelected}">
                                    ${escapeHTML(opt)}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('')}
        ${totalActive > 0 ? `
            <div style="display:flex; justify-content:flex-end; margin-top:0.25rem;">
                <button type="button" class="faceted-clear-btn" id="clearAllFacetsBtn">
                    ✕ Xóa bộ lọc thông số (${totalActive})
                </button>
            </div>
        ` : ''}
    `;

    bar.hidden = false;

    // Attach click events
    bar.querySelectorAll('.faceted-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.facetKey;
            const val = btn.dataset.facetVal;
            if (!activeSpecFacets.has(key)) {
                activeSpecFacets.set(key, new Set());
            }
            const set = activeSpecFacets.get(key);
            if (set.has(val)) {
                set.delete(val);
                if (set.size === 0) activeSpecFacets.delete(key);
            } else {
                set.add(val);
            }
            renderFacetedSpecBar();
            renderProducts();
        });
    });

    const clearBtn = bar.querySelector('#clearAllFacetsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            activeSpecFacets.clear();
            renderFacetedSpecBar();
            renderProducts();
        });
    }
}

function currentFilters() {
    return {
        search: document.getElementById('searchInput')?.value.trim().toLowerCase() || '',
        minPrice: Number(document.getElementById('minPrice')?.value || 0),
        maxPrice: Number(document.getElementById('maxPrice')?.value || 0),
        brand: document.getElementById('brandFilter')?.value || 'all',
        inStock: Boolean(document.getElementById('inStockOnly')?.checked),
        sort: document.getElementById('sortProducts')?.value || ''
    };
}

function filteredProducts() {
    const filters = currentFilters();
    let products = [...allProducts];

    if (activeCategory !== 'all') {
        const target = activeCategory.normalize('NFC').trim().toLowerCase();
        products = products.filter(p => (p.category || '').normalize('NFC').trim().toLowerCase() === target);
    }
    if (filters.brand !== 'all') products = products.filter(p => (p.brand || '') === filters.brand);
    if (filters.search) {
        const queryNorm = normalizeAddressSearch(filters.search);
        const isPromoQuery = queryNorm.includes('khuyen mai') || queryNorm.includes('giam gia') || queryNorm.includes('sale') || queryNorm.includes('deal');
        const isInstallmentQuery = queryNorm.includes('tra gop') || queryNorm.includes('installment');
        const isWirelessQuery = queryNorm.includes('khong day') || queryNorm === 'bluetooth' || queryNorm === 'wireless';
        const isWiredQuery = queryNorm.includes('co day');

        if (isPromoQuery) {
            products = products.filter(p => (p.compareAtPrice > p.price) || (p.discount > 0) || p.featured);
        } else if (isInstallmentQuery) {
            products = products.filter(p => p.price >= 3000000);
        } else if (isWirelessQuery) {
            products = products.filter(p => {
                const combined = `${p.name} ${p.description || ''} ${p.specs?.connectivity || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
                const norm = normalizeAddressSearch(combined);
                const isExplicitWired = norm.includes('earpods') || (norm.includes('inzone h3') && !norm.includes('khong day'));
                if (isExplicitWired) return false;
                return norm.includes('khong day') || norm.includes('bluetooth') || norm.includes('true wireless') || norm.includes('tws') || norm.includes('wireless') || norm.includes('airpods') || norm.includes('buds');
            });
        } else if (isWiredQuery) {
            products = products.filter(p => {
                const combined = `${p.name} ${p.description || ''} ${p.specs?.connectivity || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
                const norm = normalizeAddressSearch(combined);
                return norm.includes('co day') || norm.includes('earpods') || norm.includes('inzone h3') || norm.includes('lightning') || norm.includes('jack 3.5');
            });
        } else {
            products = products.filter(p =>
                `${p.name} ${p.description || ''} ${p.category || ''} ${p.brand || ''} ${p.sku || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(filters.search)
            );
        }
    }
    if (filters.minPrice) products = products.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) products = products.filter(p => p.price <= filters.maxPrice);
    if (filters.inStock) products = products.filter(p => p.stock > 0);

    // Apply Faceted Spec Filters
    if (activeSpecFacets.size > 0) {
        for (const [key, valuesSet] of activeSpecFacets.entries()) {
            if (valuesSet.size > 0) {
                products = products.filter(p => productMatchesFacet(p, key, valuesSet));
            }
        }
    }

    const sorters = {
        price_asc: (a, b) => a.price - b.price,
        price_desc: (a, b) => b.price - a.price,
        stock_desc: (a, b) => b.stock - a.stock,
        newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0),
        best_seller: (a, b) => (b.soldCount || 0) - (a.soldCount || 0),
        name: (a, b) => a.name.localeCompare(b.name, 'vi')
    };
    if (sorters[filters.sort]) products.sort(sorters[filters.sort]);
    return products;
}

async function loadProductMeta() {
    try {
        const res = await fetch(`${API_URL}/products/meta/options`);
        if (!res.ok) return;
        productMeta = await res.json();
        renderBrandFilter();
    } catch (err) {
        console.error('Product metadata error:', err);
    }
}

function renderBrandFilter() {
    const select = document.getElementById('brandFilter');
    if (!select) return;

    const normalizedCategory = String(activeCategory || 'all').normalize('NFC').trim().toLowerCase();
    const productsInCategory = normalizedCategory === 'all'
        ? allProducts
        : allProducts.filter(product =>
            String(product.category || '').normalize('NFC').trim().toLowerCase() === normalizedCategory
        );
    const brands = [...new Set(productsInCategory.map(product => product.brand).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'));
    const current = select.value || 'all';
    const categoryName = activeCategory && activeCategory !== 'all' ? ` ${activeCategory.toLowerCase()}` : '';
    select.innerHTML = `<option value="all">Tất cả hãng${escapeHTML(categoryName)}</option>` +
        brands.map(brand => `<option value="${escapeHTML(brand)}">${escapeHTML(brandIconText(brand))} ${escapeHTML(brand)}</option>`).join('');
    select.value = brands.includes(current) ? current : 'all';
}

function brandIconText(brand) {
    const normalized = String(brand || '').trim().toLowerCase();
    const icons = {
        apple: '●', samsung: 'S', xiaomi: 'Mi', poco: 'P', oppo: 'O', honor: 'H',
        asus: 'A', acer: 'A', dell: 'D', hp: 'HP', lenovo: 'L', msi: 'MSI', microsoft: 'M',
        sony: 'S', jbl: 'JBL', marshall: 'M', logitech: 'G', anker: 'A', ugreen: 'U',
        baseus: 'B', dareu: 'D', dji: 'DJI', garmin: 'G', huawei: 'H', nintendo: 'N'
    };
    return icons[normalized] || String(brand || '?').trim().slice(0, 2).toUpperCase();
}

function brandIconMarkup(brand) {
    const label = brand || 'TechStore Select';
    const key = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<span class="brand-icon brand-icon-${escapeHTML(key)}" aria-hidden="true">${escapeHTML(brandIconText(label))}</span>`;
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        allProducts = await res.json();
        renderBrandFilter();
        renderCategoryNav();
        renderFacetedSpecBar();
        renderProducts();
        renderCart();
        if (auth.isAdmin()) loadStats();
    } catch (err) {
        console.error('Products error:', err);
        showToast('Lỗi kết nối server', 'error');
    }
}

function renderCategoryNav() {
    updateHeaderCategoryState();
    const rawCategories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const categories = rawCategories.sort((a, b) => {
        const idxA = CANONICAL_CATEGORY_ORDER.indexOf(a);
        const idxB = CANONICAL_CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, 'vi');
    });
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    const categoryCount = category => allProducts.filter(product => product.category === category).length;
    nav.innerHTML = `
        <button class="category-btn ${activeCategory === 'all' ? 'active' : ''}" type="button" data-category="all" aria-pressed="${activeCategory === 'all'}">
            <span>Tất cả sản phẩm</span>
            <strong>${allProducts.length}</strong>
        </button>
        ${categories.map(cat => `
            <button class="category-btn ${activeCategory === cat ? 'active' : ''}" type="button" data-category="${escapeHTML(cat)}" aria-pressed="${activeCategory === cat}">
                <span>${escapeHTML(categoryLabels[cat] || cat)}</span>
                <strong>${categoryCount(cat)}</strong>
            </button>`).join('')}
    `;

    nav.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', () => setCategory(button.dataset.category));
    });
}

function updateHeaderCategoryState() {
    const rawActive = activeCategory || new URLSearchParams(window.location.search).get('category') || 'all';
    const normalizedActive = String(rawActive).trim().toLowerCase();

    document.querySelectorAll('.header-categories [data-header-category]').forEach(button => {
        const cat = String(button.dataset.headerCategory || '').trim().toLowerCase();
        const isActive = cat === normalizedActive || (cat === 'all' && (normalizedActive === 'all' || !normalizedActive));
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

function setCategory(category, options = {}) {
    activeCategory = category || 'all';
    activeSpecFacets.clear();

    // Tự động xóa bộ lọc tìm kiếm, thương hiệu và khoảng giá cũ khi chuyển danh mục
    // trừ khi caller yêu cầu giữ lại (options.preserveFilters)
    if (!options.preserveFilters) {
        const searchInput = document.getElementById('searchInput');
        const headerSearchInput = document.getElementById('headerSearchInput');
        const minPriceInput = document.getElementById('minPrice');
        const maxPriceInput = document.getElementById('maxPrice');
        const brandFilterSelect = document.getElementById('brandFilter');

        if (searchInput) searchInput.value = '';
        if (headerSearchInput) headerSearchInput.value = '';
        if (minPriceInput) minPriceInput.value = '';
        if (maxPriceInput) maxPriceInput.value = '';
        if (brandFilterSelect) brandFilterSelect.value = 'all';
    }

    const url = new URL(window.location.href);
    if (!category || category === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', category);
    window.history.replaceState({}, '', url);
    updateHeaderCategoryState();
    renderCategoryNav();
    renderBrandFilter();
    renderFacetedSpecBar();
    renderProducts();

    if (options.scroll !== false) {
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.setCategory = setCategory;

function setBrandFilter(brand, options = {}) {
    const select = document.getElementById('brandFilter');
    if (select) {
        const targetBrand = String(brand || '').toLowerCase().trim();
        let foundVal = 'all';
        for (const opt of select.options) {
            if (opt.value.toLowerCase().trim() === targetBrand) {
                foundVal = opt.value;
                break;
            }
        }
        select.value = foundVal;
    }
    renderProducts();
    if (options.scroll !== false) {
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.setBrandFilter = setBrandFilter;

function setShopSearch(searchTerm, options = {}) {
    const catalogSearch = document.getElementById('searchInput');
    const headerSearch = document.getElementById('headerSearchInput');
    if (catalogSearch) catalogSearch.value = searchTerm || '';
    if (headerSearch) headerSearch.value = searchTerm || '';
    renderProducts();
    if (options.scroll !== false) {
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.setShopSearch = setShopSearch;

function setShopPrice(maxPrice, options = {}) {
    const minEl = document.getElementById('minPrice');
    const maxEl = document.getElementById('maxPrice');
    if (minEl && !options.preserveMinPrice) minEl.value = '';
    if (maxEl) maxEl.value = maxPrice || '';
    renderProducts();
    if (options.scroll !== false) {
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.setShopPrice = setShopPrice;

function setupPromoCarousel() {
    const carousel = document.getElementById('promoCarousel');
    if (!carousel) return;

    const slides = [...carousel.querySelectorAll('.hero-slide')];
    const dots = [...carousel.querySelectorAll('.hero-dot')];
    if (slides.length < 2) return;

    let activeSlide = 0;
    let autoplayTimer;

    const showSlide = index => {
        activeSlide = (index + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => {
            const isActive = slideIndex === activeSlide;
            slide.classList.toggle('is-active', isActive);
            slide.setAttribute('aria-hidden', String(!isActive));
            slide.toggleAttribute('inert', !isActive);
        });
        dots.forEach((dot, dotIndex) => {
            const isActive = dotIndex === activeSlide;
            dot.classList.toggle('is-active', isActive);
            dot.setAttribute('aria-current', String(isActive));
        });
    };

    const stopAutoplay = () => window.clearTimeout(autoplayTimer);
    const startAutoplay = () => {
        stopAutoplay();
        if (document.hidden) return;
        autoplayTimer = window.setTimeout(() => {
            showSlide(activeSlide + 1);
            startAutoplay();
        }, 4200);
    };

    carousel.querySelectorAll('[data-carousel-direction]').forEach(button => {
        button.addEventListener('click', () => {
            showSlide(activeSlide + (button.dataset.carouselDirection === 'next' ? 1 : -1));
            startAutoplay();
        });
    });
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
            startAutoplay();
        });
    });
    carousel.querySelectorAll('[data-carousel-category]').forEach(button => {
        button.addEventListener('click', () => setCategory(button.dataset.carouselCategory));
    });
    document.addEventListener('visibilitychange', startAutoplay);

    showSlide(0);
    startAutoplay();
}

function setupStorefrontHeader() {
    const storefrontHeader = document.querySelector('.storefront-header');
    const searchForm = document.getElementById('headerSearchForm');
    const headerSearch = document.getElementById('headerSearchInput');
    const catalogSearch = document.getElementById('searchInput');

    if (storefrontHeader) {
        const updateHeaderHeight = () => {
            document.documentElement.style.setProperty('--storefront-header-height', `${storefrontHeader.offsetHeight}px`);
        };
        updateHeaderHeight();
        if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(storefrontHeader);
        else window.addEventListener('resize', updateHeaderHeight);
    }

    searchForm?.addEventListener('submit', event => {
        event.preventDefault();
        const liveDropdown = document.getElementById('headerLiveSearchDropdown');
        if (liveDropdown) liveDropdown.hidden = true;
        if (!catalogSearch || !headerSearch) return;
        catalogSearch.value = headerSearch.value.trim();
        renderProducts();
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    catalogSearch?.addEventListener('input', () => {
        if (headerSearch && headerSearch.value !== catalogSearch.value) {
            headerSearch.value = catalogSearch.value;
        }
    });

    // Live search & Visual search in header
    const liveDropdown = document.getElementById('headerLiveSearchDropdown');
    const cameraBtn = document.getElementById('headerVisualSearchBtn');
    const cameraInput = document.getElementById('headerVisualSearchInput');

    if (headerSearch && liveDropdown) {
        let debounceTimer = null;
        let selectedIndex = -1;
        function saveRecentSearch(term) {
            if (!term || term.trim().length < 2) return;
            const clean = term.trim();
            try {
                let list = JSON.parse(localStorage.getItem('techecommerce_recent_searches') || '[]');
                list = [clean, ...list.filter(x => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
                localStorage.setItem('techecommerce_recent_searches', JSON.stringify(list));
            } catch (e) {}
        }

        function getRecentSearches() {
            try {
                return JSON.parse(localStorage.getItem('techecommerce_recent_searches') || '[]');
            } catch (e) {
                return [];
            }
        }

        function clearRecentSearches() {
            try {
                localStorage.removeItem('techecommerce_recent_searches');
            } catch (e) {}
            renderTrending();
        }

        function removeRecentSearch(index) {
            try {
                let list = getRecentSearches();
                list.splice(index, 1);
                localStorage.setItem('techecommerce_recent_searches', JSON.stringify(list));
            } catch (e) {}
            renderTrending();
        }

        const trendingList = [
            { rank: 1, term: 'iPhone 16 Pro Max', tag: 'HOT', tagType: 'hot' },
            { rank: 2, term: 'MacBook Air M3', tag: 'MỚI', tagType: 'new' },
            { rank: 3, term: 'Samsung Galaxy S24 Ultra', tag: 'AI', tagType: 'ai' },
            { rank: 4, term: 'Sony WH-1000XM5', tag: '', tagType: '' },
            { rank: 5, term: 'Logitech MX Keys S', tag: '', tagType: '' },
            { rank: 6, term: 'Củ sạc Anker 65W GaN', tag: 'SALE', tagType: 'hot' }
        ];

        function renderTrending() {
            const recents = getRecentSearches();
            const hotProducts = (Array.isArray(allProducts) && allProducts.length > 0)
                ? allProducts.filter(p => p.featured || (p.soldCount && p.soldCount > 30)).slice(0, 3)
                : [];

            let html = '';

            // Section 1: Lịch sử tìm kiếm (nếu có)
            if (recents.length > 0) {
                html += `
                    <div class="search-section search-section-history">
                        <div class="search-section-header">
                            <span class="search-section-title"><span class="section-icon">🕒</span> Tìm kiếm gần đây</span>
                            <button type="button" class="btn-clear-history" id="btnClearSearchHistory">Xóa tất cả</button>
                        </div>
                        <div class="search-history-chips">
                            ${recents.map((term, idx) => `
                                <span class="history-chip" data-search-term="${escapeHTML(term)}">
                                    <span class="history-chip-text">${escapeHTML(term)}</span>
                                    <button type="button" class="history-chip-remove" data-remove-index="${idx}" aria-label="Xóa">×</button>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Section 2: Xu hướng tìm kiếm
            html += `
                <div class="search-section search-section-trending">
                    <div class="search-section-header">
                        <span class="search-section-title"><span class="section-icon">🔥</span> Xu hướng tìm kiếm</span>
                        <span class="search-section-badge">PHỔ BIẾN</span>
                    </div>
                    <div class="search-trending-grid">
                        ${trendingList.map(item => `
                            <button type="button" class="trending-rank-btn" data-search-term="${escapeHTML(item.term)}">
                                <span class="rank-badge rank-badge-${item.rank <= 3 ? item.rank : 'other'}">${item.rank}</span>
                                <span class="rank-title">${escapeHTML(item.term)}</span>
                                ${item.tag ? `<span class="rank-tag rank-tag-${item.tagType}">${item.tag}</span>` : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            // Section 3: Gợi ý sản phẩm nổi bật
            if (hotProducts.length > 0) {
                html += `
                    <div class="search-section search-featured-box">
                        <div class="search-section-header">
                            <span class="search-section-title"><span class="section-icon">⚡</span> Gợi ý mua sắm hàng đầu</span>
                        </div>
                        <div class="search-featured-list">
                            ${hotProducts.map(p => {
                                const discount = p.compareAtPrice && p.compareAtPrice > p.price;
                                const percent = discount ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
                                return `
                                    <a class="search-featured-card" href="pages/catalog/product.html?id=${p._id}">
                                        <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="search-featured-thumb" loading="lazy">
                                        <div class="search-featured-info">
                                            <strong class="search-featured-title">${escapeHTML(p.name)}</strong>
                                            <div class="search-featured-price-row">
                                                <span class="search-featured-price">${fmt(p.price)}</span>
                                                ${discount ? `<del class="search-featured-compare">${fmt(p.compareAtPrice)}</del>` : ''}
                                                ${percent > 0 ? `<span class="search-featured-badge">-${percent}%</span>` : ''}
                                            </div>
                                        </div>
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            // Section 4: Tip Footer
            html += `
                <div class="live-search-tip-footer">
                    <span>💡 <strong>Mẹo:</strong> Gõ từ 2 ký tự để tìm kiếm tức thì</span>
                    <span>📷 AI Visual Search</span>
                </div>
            `;

            liveDropdown.innerHTML = html;

            // Bind click events for history & trending
            liveDropdown.querySelector('#btnClearSearchHistory')?.addEventListener('click', e => {
                e.stopPropagation();
                clearRecentSearches();
            });

            liveDropdown.querySelectorAll('.history-chip-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-remove-index'));
                    removeRecentSearch(idx);
                });
            });

            liveDropdown.querySelectorAll('.history-chip, .trending-rank-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const term = btn.getAttribute('data-search-term');
                    if (term) {
                        headerSearch.value = term;
                        saveRecentSearch(term);
                        performLiveSearch(term);
                    }
                });
            });

            liveDropdown.hidden = false;
            selectedIndex = -1;
        }

        function highlightMatch(text, query) {
            if (!query || !text) return escapeHTML(text);
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return escapeHTML(text).replace(regex, '<mark class="search-highlight">$1</mark>');
        }

        function renderProductsDropdown(prods, query) {
            if (!prods.length) {
                liveDropdown.innerHTML = `
                    <div class="live-search-empty">
                        <span>🔎</span> Không tìm thấy sản phẩm nào khớp với "<strong>${escapeHTML(query)}</strong>"
                    </div>
                `;
                liveDropdown.hidden = false;
                return;
            }

            liveDropdown.innerHTML = `
                <header class="live-search-header">
                    <span class="live-search-title">Gợi ý sản phẩm (${prods.length})</span>
                </header>
                <ul class="live-search-list" role="listbox">
                    ${prods.map(p => {
                        const discount = p.compareAtPrice && p.compareAtPrice > p.price;
                        return `
                            <li class="live-search-item" role="option">
                                <a class="live-search-link" href="pages/catalog/product.html?id=${p._id}">
                                    <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="live-search-thumb" loading="lazy">
                                    <div class="live-search-meta">
                                        <strong class="live-search-name">${highlightMatch(p.name, query)}</strong>
                                        <div class="live-search-price-row">
                                            <span class="live-search-price">${fmt(p.price)}</span>
                                            ${discount ? `<del class="live-search-compare">${fmt(p.compareAtPrice)}</del>` : ''}
                                            <span class="live-search-stock ${p.stock > 0 ? 'in' : 'out'}">${p.stock > 0 ? '✓ Còn hàng' : 'Tạm hết'}</span>
                                        </div>
                                    </div>
                                </a>
                            </li>
                        `;
                    }).join('')}
                </ul>
                <footer class="live-search-footer">
                    <button type="button" class="live-search-view-all" onclick="headerSearchForm.requestSubmit()">
                        Xem tất cả kết quả cho "<strong>${escapeHTML(query)}</strong>" ➔
                    </button>
                </footer>
            `;
            liveDropdown.hidden = false;
            selectedIndex = -1;
        }

        async function performLiveSearch(query) {
            const trimmed = query.trim();
            if (trimmed.length < 2) {
                renderTrending();
                return;
            }
            try {
                const res = await fetch(`${API_URL}/products?search=${encodeURIComponent(trimmed)}&limit=5`);
                if (!res.ok) throw new Error('Search API error');
                const prods = await res.json();
                renderProductsDropdown(prods, trimmed);
            } catch (err) {
                console.error('Live search error:', err);
            }
        }

        headerSearch.addEventListener('input', e => {
            clearTimeout(debounceTimer);
            const q = e.target.value;
            if (q.trim().length < 2) {
                if (q.trim().length === 0) liveDropdown.hidden = true;
                else renderTrending();
                return;
            }
            debounceTimer = setTimeout(() => performLiveSearch(q), 200);
        });

        headerSearch.addEventListener('focus', () => {
            if (headerSearch.value.trim().length >= 2) performLiveSearch(headerSearch.value);
            else renderTrending();
        });

        document.addEventListener('click', e => {
            if (!searchForm?.contains(e.target)) liveDropdown.hidden = true;
        });

        headerSearch.addEventListener('keydown', e => {
            const items = liveDropdown.querySelectorAll('.live-search-link');
            if (!items.length || liveDropdown.hidden) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                liveDropdown.hidden = true;
            }
        });

        function updateSelection(items) {
            items.forEach((it, idx) => {
                if (idx === selectedIndex) {
                    it.classList.add('is-focused');
                    it.scrollIntoView({ block: 'nearest' });
                } else {
                    it.classList.remove('is-focused');
                }
            });
        }
    }

    if (cameraBtn && cameraInput && liveDropdown) {
        cameraBtn.addEventListener('click', () => cameraInput.click());
        cameraInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            liveDropdown.hidden = false;
            liveDropdown.innerHTML = `
                <div class="visual-search-loading">
                    <div class="visual-search-spinner" aria-hidden="true"></div>
                    <strong>🔍 AI đang phân tích thiết bị từ hình ảnh...</strong>
                    <p>Nhận diện model, thương hiệu và thông số kỹ thuật...</p>
                </div>
            `;

            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const res = await fetch(`${API_URL}/chat/visual-search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: reader.result, filename: file.name })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message);

                    if (!data.isTech || !data.products?.length) {
                        liveDropdown.innerHTML = `
                            <header class="visual-search-result-badge">
                                <span class="badge-ai-chip" style="background:rgba(239, 68, 68, 0.15); color:var(--danger, #ef4444);">🔍 AI Phân Loại Ảnh</span>
                                <div class="visual-detected-title" style="margin-top:0.4rem; font-size:0.9rem; line-height:1.4;">${escapeHTML(data.reply || 'Ảnh này chưa cho thấy thiết bị thuộc danh mục cửa hàng.')}</div>
                            </header>
                        `;
                        return;
                    }

                    const detected = data.detectedItem || 'Thiết bị công nghệ';
                    const prods = data.products || [];

                    liveDropdown.innerHTML = `
                        <header class="visual-search-result-badge">
                            <span class="badge-ai-chip">✨ AI Visual Search</span>
                            <div class="visual-detected-title">Nhận diện: <strong>${escapeHTML(detected)}</strong></div>
                            <small>${escapeHTML(data.description || '')}</small>
                        </header>
                        <ul class="live-search-list" role="listbox">
                            ${prods.slice(0, 5).map(p => `
                                <li class="live-search-item" role="option">
                                    <a class="live-search-link" href="pages/catalog/product.html?id=${p._id}">
                                        <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" class="live-search-thumb" loading="lazy">
                                        <div class="live-search-meta">
                                            <strong class="live-search-name">${escapeHTML(p.name)}</strong>
                                            <div class="live-search-price-row">
                                                <span class="live-search-price">${fmt(p.price)}</span>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    `;
                } catch (err) {
                    liveDropdown.innerHTML = `<div class="live-search-empty">⚠️ Không thể nhận diện ảnh lúc này. Vui lòng thử lại.</div>`;
                }
            };
            reader.readAsDataURL(file);
            cameraInput.value = '';
        });
    }

    document.querySelectorAll('[data-header-category]').forEach(button => {
        button.addEventListener('click', () => setCategory(button.dataset.headerCategory));
    });
    updateHeaderCategoryState();

    document.querySelectorAll('.header-categories, #storefrontCategories').forEach(nav => {
        setupCategoryDragScroll(nav);
    });

    setupAddressSelector();
}

function setupCategoryDragScroll(navEl) {
    if (!navEl) return;
    const list = navEl.querySelector('.header-category-list') || (navEl.classList.contains('header-category-list') ? navEl : null);
    if (!list) return;

    if (list._dragScrollInit) return;
    list._dragScrollInit = true;

    const prevBtn = navEl.querySelector('.category-scroll-prev');
    const nextBtn = navEl.querySelector('.category-scroll-next');

    list.querySelectorAll('img, button, a').forEach(el => {
        el.setAttribute('draggable', 'false');
    });

    function updateArrows() {
        const canScroll = list.scrollWidth > (list.clientWidth + 4);
        if (!canScroll) {
            if (prevBtn) prevBtn.hidden = true;
            if (nextBtn) nextBtn.hidden = true;
            return;
        }
        const maxScroll = list.scrollWidth - list.clientWidth;
        if (prevBtn) prevBtn.hidden = list.scrollLeft <= 6;
        if (nextBtn) nextBtn.hidden = list.scrollLeft >= (maxScroll - 6);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', e => {
            e.preventDefault();
            list.scrollBy({ left: -220, behavior: 'smooth' });
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', e => {
            e.preventDefault();
            list.scrollBy({ left: 220, behavior: 'smooth' });
        });
    }

    list.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });

    // Drag-to-scroll via mouse
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let hasMoved = false;

    list.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        isDown = true;
        hasMoved = false;
        startX = e.clientX;
        scrollStart = list.scrollLeft;
        list.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', e => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) {
            hasMoved = true;
        }
        if (hasMoved) {
            e.preventDefault();
            list.scrollLeft = scrollStart - dx;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        list.classList.remove('is-dragging');
    });

    list.addEventListener('click', e => {
        if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
            hasMoved = false;
        }
    }, true);

    // Mouse wheel horizontal scroll
    list.addEventListener('wheel', e => {
        if (list.scrollWidth > list.clientWidth) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                list.scrollLeft += e.deltaY;
            }
        }
    }, { passive: false });

    setTimeout(updateArrows, 60);
    setTimeout(updateArrows, 350);
}

function getSavedShoppingAddress() {
    try {
        return JSON.parse(localStorage.getItem('shoppingAddress') || 'null');
    } catch (error) {
        return null;
    }
}

function checkoutAddressValue() {
    const provinceSelect = document.getElementById('checkoutProvince');
    const wardSelect = document.getElementById('checkoutWard');
    const detailInput = document.getElementById('shippingAddressDetail');
    const provinceOption = provinceSelect?.selectedOptions?.[0];
    const wardOption = wardSelect?.selectedOptions?.[0];
    const detail = detailInput?.value.trim() || '';
    const province = provinceOption?.dataset.name || '';
    const ward = wardOption?.dataset.name || '';
    return {
        provinceCode: provinceSelect?.value || '',
        province,
        wardCode: wardSelect?.value || '',
        ward,
        detail,
        label: province.replace(/^(Thành phố|Tỉnh)\s+/u, '') || 'Địa chỉ giao hàng',
        fullAddress: [detail, ward, province].filter(Boolean).join(', ')
    };
}

function checkoutAddressDetail(savedAddress) {
    const ward = normalizeAddressSearch(savedAddress?.ward || '');
    const province = normalizeAddressSearch(savedAddress?.province || '');
    return String(savedAddress?.fullAddress || '')
        .split(',')
        .map(part => part.trim())
        .filter(part => {
            const normalized = normalizeAddressSearch(part);
            return normalized && normalized !== ward && normalized !== province;
        })
        .join(', ');
}

function setCheckoutAddressState(state, message = '') {
    const fieldset = document.getElementById('deliveryAddressFieldset');
    const helper = document.getElementById('shippingAddressHelp');
    if (!fieldset || !helper) return;
    fieldset.dataset.state = state;
    if (message) helper.textContent = message;
}

function populateCheckoutWards(provinceCode, selectedWardCode = '') {
    const wardSelect = document.getElementById('checkoutWard');
    const province = deliveryAreas.find(item => String(item.code) === String(provinceCode));
    if (!wardSelect) return;
    wardSelect.innerHTML = '<option value="">Chọn Phường/Xã</option>' + (province?.wards || []).map(ward =>
        `<option value="${escapeHTML(ward.code)}" data-name="${escapeHTML(ward.name)}" ${String(ward.code) === String(selectedWardCode) ? 'selected' : ''}>${escapeHTML(ward.name)}</option>`
    ).join('');
    wardSelect.disabled = !province;
}

function updateCheckoutAddress({ persist = true, refreshQuote = true } = {}) {
    const address = checkoutAddressValue();
    const hiddenInput = document.getElementById('shippingAddress');
    const preview = document.getElementById('shippingAddressPreview');
    if (hiddenInput) hiddenInput.value = address.fullAddress;
    if (preview) preview.textContent = address.fullAddress || 'Chưa đủ thông tin địa chỉ.';

    const fieldValues = {
        checkoutProvince: address.provinceCode,
        checkoutWard: address.wardCode,
        shippingAddressDetail: address.detail
    };
    const complete = Object.values(fieldValues).every(Boolean);
    Object.entries(fieldValues).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field) return;
        if (value) field.removeAttribute('aria-invalid');
    });
    setCheckoutAddressState(
        complete ? 'success' : 'default',
        complete
            ? 'Địa chỉ đã đủ Tỉnh/Thành, Phường/Xã và thông tin số nhà/đường.'
            : 'Ghi rõ số nhà, tên đường, tòa nhà hoặc chỉ dẫn; sau đó chọn đủ khu vực giao hàng.'
    );

    if (persist && (address.provinceCode || address.wardCode || address.detail)) {
        localStorage.setItem('shoppingAddress', JSON.stringify(address));
        if (address.label) localStorage.setItem('shoppingLocation', address.label);
    }
    if (refreshQuote) refreshShippingQuote(address);
    return address;
}

async function applySavedAddressToCheckout() {
    const provinceSelect = document.getElementById('checkoutProvince');
    const detailInput = document.getElementById('shippingAddressDetail');
    if (!provinceSelect || !detailInput) return;
    const savedAddress = getSavedShoppingAddress();
    setCheckoutAddressState('loading', 'Đang tải danh mục Tỉnh/Thành và Phường/Xã…');
    try {
        await loadDeliveryAreas();
        provinceSelect.innerHTML = '<option value="">Chọn Tỉnh/Thành</option>' + deliveryAreas.map(province =>
            `<option value="${escapeHTML(province.code)}" data-name="${escapeHTML(province.name)}" ${String(province.code) === String(savedAddress?.provinceCode || '') ? 'selected' : ''}>${escapeHTML(province.name)}</option>`
        ).join('');
        populateCheckoutWards(savedAddress?.provinceCode || '', savedAddress?.wardCode || '');
        detailInput.value = checkoutAddressDetail(savedAddress)
            || (!savedAddress?.provinceCode ? String(savedAddress?.fullAddress || detailInput.value || '') : '');
        updateCheckoutAddress({ persist: false, refreshQuote: false });
    } catch (error) {
        setCheckoutAddressState('error', 'Không tải được danh mục địa chỉ. Hãy tải lại trang rồi thử lại.');
    }
}

async function setupCheckoutAddressSelector() {
    if (checkoutAddressInitialized) return applySavedAddressToCheckout();
    checkoutAddressInitialized = true;
    const provinceSelect = document.getElementById('checkoutProvince');
    const wardSelect = document.getElementById('checkoutWard');
    const detailInput = document.getElementById('shippingAddressDetail');
    if (!provinceSelect || !wardSelect || !detailInput) return;
    provinceSelect.addEventListener('change', () => {
        populateCheckoutWards(provinceSelect.value);
        updateCheckoutAddress();
    });
    wardSelect.addEventListener('change', () => updateCheckoutAddress());
    detailInput.addEventListener('input', () => {
        currentShippingQuote = null;
        updateCheckoutAddress({ refreshQuote: false });
    });
    detailInput.addEventListener('blur', () => updateCheckoutAddress());
    await applySavedAddressToCheckout();
}

function setupAddressSelector() {
    const modal = document.getElementById('addressModal');
    const locationToggle = document.getElementById('headerLocationToggle');
    const locationLabel = document.getElementById('headerLocationLabel');
    const entryView = document.getElementById('addressEntryView');
    const selectionView = document.getElementById('addressSelectionView');
    const manualChoice = document.getElementById('addressManualChoice');
    const backButton = document.getElementById('addressBackButton');
    const quickForm = document.getElementById('addressQuickForm');
    const quickInput = document.getElementById('addressQuickInput');
    const suggestions = document.getElementById('addressSuggestions');
    const useLocationButton = document.getElementById('addressUseLocation');
    const locationStatus = document.getElementById('addressLocationStatus');
    const listSearch = document.getElementById('addressListSearch');
    const options = document.getElementById('addressOptions');
    const provinceStep = document.getElementById('provinceStep');
    const wardStep = document.getElementById('wardStep');
    const wardStepHint = document.getElementById('wardStepHint');
    const changeProvinceButton = document.getElementById('changeProvinceButton');
    if (!modal || !locationToggle || !options) return;

    let selectedProvince = null;
    let lastFocusedElement = null;
    let suggestionItems = [];
    let activeSuggestionIndex = -1;
    let suggestionTimer = null;
    let suggestionAbortController = null;

    const savedAddress = getSavedShoppingAddress();
    locationLabel.textContent = savedAddress?.label || localStorage.getItem('shoppingLocation') || 'Hồ Chí Minh';
    if (savedAddress?.fullAddress) quickInput.value = savedAddress.fullAddress;

    const findProvinceByName = value => {
        const normalizedValue = normalizeAddressSearch(value);
        if (!normalizedValue) return null;
        return deliveryAreas.find(province => [province.name, province.label, ...province.aliases]
            .some(name => normalizeAddressSearch(name) === normalizedValue)) || null;
    };

    const saveShoppingAddress = async address => {
        localStorage.setItem('shoppingAddress', JSON.stringify(address));
        localStorage.setItem('shoppingLocation', address.label);
        locationLabel.textContent = address.label;
        window.dispatchEvent(new CustomEvent('shopping-address-change', { detail: address }));

        if (auth.isLoggedIn()) {
            const user = auth.getUser();
            const userId = user?.id ?? user?._id;
            try {
                if (!userId) throw new Error('Không xác định được tài khoản hiện tại.');
                const response = await fetch(`${API_URL}/customers/${userId}`, {
                    method: 'PUT',
                    headers: auth.getHeaders(),
                    body: JSON.stringify({ address: address.fullAddress }),
                    keepalive: true
                });
                const data = await response.json();
                if (auth.handleApiError(response, data)) return;
                if (!response.ok) throw new Error(data.message || 'Không đồng bộ được địa chỉ với hồ sơ.');
                user.address = data.address || address.fullAddress;
                localStorage.setItem('user', JSON.stringify(user));
                closeAddressModal();
                showToast('Đã cập nhật địa chỉ nhận hàng và hồ sơ cá nhân.');
                return;
            } catch (error) {
                closeAddressModal();
                showToast(`Địa chỉ đã lưu trên thiết bị nhưng chưa đồng bộ hồ sơ: ${error.message}`, 'error');
                return;
            }
        }

        closeAddressModal();
        showToast('Đã cập nhật địa chỉ nhận hàng. Đăng nhập để lưu vào hồ sơ.');
    };

    const hideSuggestions = () => {
        suggestionItems = [];
        activeSuggestionIndex = -1;
        suggestions.hidden = true;
        suggestions.innerHTML = '';
        quickInput.setAttribute('aria-expanded', 'false');
        quickInput.removeAttribute('aria-activedescendant');
    };

    const saveSuggestedAddress = item => {
        const matchedProvince = findProvinceByName(item.province);
        saveShoppingAddress({
            provinceCode: matchedProvince?.code || '',
            province: matchedProvince?.name || item.province || '',
            ward: item.ward || '',
            label: matchedProvince?.label || item.province?.replace(/^(Thành phố|Tỉnh)\s+/u, '') || item.name,
            fullAddress: item.label,
            coordinates: item.coordinates
        });
    };

    const setActiveSuggestion = index => {
        const buttons = [...suggestions.querySelectorAll('[data-suggestion-index]')];
        if (!buttons.length) return;
        activeSuggestionIndex = (index + buttons.length) % buttons.length;
        buttons.forEach((button, itemIndex) => button.classList.toggle('is-active', itemIndex === activeSuggestionIndex));
        const activeButton = buttons[activeSuggestionIndex];
        quickInput.setAttribute('aria-activedescendant', activeButton.id);
        activeButton.scrollIntoView({ block: 'nearest' });
    };

    const renderSuggestions = (items, message = '') => {
        suggestionItems = items;
        activeSuggestionIndex = -1;
        suggestions.hidden = false;
        quickInput.setAttribute('aria-expanded', 'true');
        suggestions.innerHTML = items.length
            ? items.map((item, index) => `<button type="button" class="address-suggestion" id="addressSuggestion${index}" role="option" data-suggestion-index="${index}"><span aria-hidden="true">⌖</span><span class="address-suggestion-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.label)}</small></span></button>`).join('')
            : `<div class="address-empty">${escapeHTML(message || 'Không tìm thấy địa chỉ phù hợp.')}</div>`;

        suggestions.querySelectorAll('[data-suggestion-index]').forEach((button, index) => {
            button.addEventListener('click', () => saveSuggestedAddress(suggestionItems[index]));
        });
    };

    const requestAddressSuggestions = async query => {
        suggestionAbortController?.abort();
        suggestionAbortController = new AbortController();
        renderSuggestions([], 'Đang tìm địa chỉ...');
        try {
            const response = await fetch(`${API_URL}/locations/suggest?q=${encodeURIComponent(query)}`, {
                signal: suggestionAbortController.signal
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Không tải được địa chỉ gợi ý.');
            if (quickInput.value.trim() !== query) return;
            renderSuggestions(data.suggestions || []);
        } catch (error) {
            if (error.name === 'AbortError') return;
            renderSuggestions([], error.message || 'Dịch vụ gợi ý đang tạm thời gián đoạn.');
        }
    };

    const showEntryView = () => {
        entryView.classList.add('is-active');
        selectionView.classList.remove('is-active');
    };

    const renderAddressOptions = () => {
        if (deliveryAreasState === 'loading' || deliveryAreasState === 'idle') {
            options.innerHTML = '<div class="address-empty">Đang tải danh mục địa chỉ...</div>';
            return;
        }
        if (deliveryAreasState === 'error') {
            options.innerHTML = '<div class="address-empty">Không tải được dữ liệu địa chỉ. Vui lòng thử lại.</div>';
            return;
        }

        const query = normalizeAddressSearch(listSearch.value);
        const source = selectedProvince ? selectedProvince.wards : deliveryAreas;
        const filtered = source.filter(item => {
            const value = selectedProvince
                ? normalizeAddressSearch(item.name)
                : item.searchText;
            return value.includes(query);
        });

        options.innerHTML = filtered.length
            ? filtered.map((item, index) => {
                const title = item.name;
                const hint = selectedProvince ? selectedProvince.name : item.hint;
                return `<button type="button" class="address-option" data-address-index="${index}"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(hint)}</small><span aria-hidden="true">›</span></button>`;
            }).join('')
            : '<div class="address-empty">Không tìm thấy khu vực phù hợp.</div>';

        options.querySelectorAll('[data-address-index]').forEach((button, index) => {
            button.addEventListener('click', () => {
                const item = filtered[index];
                if (!selectedProvince) {
                    selectedProvince = item;
                    provinceStep.classList.add('is-complete');
                    provinceStep.querySelector('strong').textContent = item.name;
                    changeProvinceButton.hidden = false;
                    wardStep.classList.add('is-active');
                    wardStepHint.textContent = `Thuộc ${item.label}`;
                    listSearch.value = '';
                    listSearch.placeholder = 'Tìm nhanh phường, xã';
                    renderAddressOptions();
                    listSearch.focus();
                    return;
                }

                const address = {
                    provinceCode: selectedProvince.code,
                    province: selectedProvince.name,
                    wardCode: item.code,
                    ward: item.name,
                    label: selectedProvince.label,
                    fullAddress: `${item.name}, ${selectedProvince.name}`
                };
                saveShoppingAddress(address);
            });
        });
    };

    const showSelectionView = () => {
        selectedProvince = null;
        entryView.classList.remove('is-active');
        selectionView.classList.add('is-active');
        provinceStep.classList.remove('is-complete');
        provinceStep.classList.add('is-active');
        provinceStep.querySelector('strong').textContent = 'Chọn Tỉnh/Thành';
        changeProvinceButton.hidden = true;
        wardStep.classList.remove('is-active');
        wardStepHint.textContent = 'Chọn Tỉnh/Thành trước';
        listSearch.value = '';
        listSearch.placeholder = 'Tìm nhanh tỉnh thành';
        renderAddressOptions();
        loadDeliveryAreas()
            .then(() => {
                if (selectionView.classList.contains('is-active') && !selectedProvince) renderAddressOptions();
            })
            .catch(() => renderAddressOptions());
        listSearch.focus();
    };

    const openAddressModal = () => {
        lastFocusedElement = document.activeElement;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        modal.removeAttribute('inert');
        locationToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('address-modal-open');
        showEntryView();
        window.setTimeout(() => quickInput.focus(), 50);
    };

    const closeAddressModal = () => {
        window.clearTimeout(suggestionTimer);
        suggestionAbortController?.abort();
        hideSuggestions();
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('inert', '');
        locationToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('address-modal-open');
        lastFocusedElement?.focus();
    };

    locationToggle.addEventListener('click', openAddressModal);
    modal.querySelectorAll('[data-address-close]').forEach(button => button.addEventListener('click', closeAddressModal));
    manualChoice.addEventListener('click', showSelectionView);
    backButton.addEventListener('click', showEntryView);
    changeProvinceButton.addEventListener('click', showSelectionView);
    listSearch.addEventListener('input', renderAddressOptions);
    quickInput.addEventListener('input', () => {
        window.clearTimeout(suggestionTimer);
        const query = quickInput.value.trim();
        if (query.length < 3) {
            suggestionAbortController?.abort();
            hideSuggestions();
            return;
        }
        suggestionTimer = window.setTimeout(() => requestAddressSuggestions(query), 400);
    });
    quickInput.addEventListener('keydown', event => {
        if (suggestions.hidden) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestion(activeSuggestionIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestion(activeSuggestionIndex - 1);
        } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
            event.preventDefault();
            saveSuggestedAddress(suggestionItems[activeSuggestionIndex]);
        } else if (event.key === 'Escape') {
            event.stopPropagation();
            hideSuggestions();
        }
    });
    quickForm.addEventListener('submit', event => {
        event.preventDefault();
        const fullAddress = quickInput.value.trim();
        if (fullAddress.length < 5) return showToast('Vui lòng nhập địa chỉ cụ thể hơn.', 'error');
        const addressParts = fullAddress.split(',').map(part => part.trim()).filter(Boolean);
        const address = { label: addressParts[addressParts.length - 1] || 'Địa chỉ đã chọn', fullAddress };
        saveShoppingAddress(address);
    });
    useLocationButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Trình duyệt này không hỗ trợ định vị.';
            return showToast('Trình duyệt không hỗ trợ định vị.', 'error');
        }

        useLocationButton.disabled = true;
        locationStatus.textContent = 'Đang xác định vị trí của bạn...';
        navigator.geolocation.getCurrentPosition(async position => {
            try {
                const { latitude, longitude } = position.coords;
                locationStatus.textContent = 'Đang tìm địa chỉ gần nhất...';
                const response = await fetch(`${API_URL}/locations/reverse?lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Không tìm thấy địa chỉ tại vị trí này.');
                const address = data.address;
                const matchedProvince = findProvinceByName(address.province);
                saveShoppingAddress({
                    provinceCode: matchedProvince?.code || '',
                    province: matchedProvince?.name || address.province || '',
                    ward: address.ward || '',
                    label: matchedProvince?.label || address.province?.replace(/^(Thành phố|Tỉnh)\s+/u, '') || 'Vị trí hiện tại',
                    fullAddress: address.label,
                    coordinates: address.coordinates,
                    source: 'geolocation'
                });
            } catch (error) {
                locationStatus.textContent = error.message || 'Chưa thể xác định địa chỉ hiện tại.';
                showToast(locationStatus.textContent, 'error');
            } finally {
                useLocationButton.disabled = false;
            }
        }, error => {
            const messages = {
                1: 'Bạn đã từ chối quyền truy cập vị trí.',
                2: 'Không thể xác định vị trí hiện tại.',
                3: 'Quá thời gian chờ định vị. Vui lòng thử lại.'
            };
            locationStatus.textContent = messages[error.code] || 'Định vị không thành công.';
            useLocationButton.disabled = false;
            showToast(locationStatus.textContent, 'error');
        }, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 300000
        });
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.address-quick-area')) hideSuggestions();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('show')) closeAddressModal();
    });

    loadDeliveryAreas().catch(() => { });
}

let compareDiffOnly = false;

function selectedCompareProducts() {
    return [...compareProducts]
        .map(id => allProducts.find(product => String(product._id) === String(id)))
        .filter(Boolean);
}

function saveCompareProducts() {
    // Keep in-memory for the current page session only.
    // Purge localStorage so reload (F5 / Ctrl+R) always starts with an empty compare selection.
    try {
        localStorage.removeItem('compareProducts');
        sessionStorage.removeItem('compareProducts');
    } catch (e) { }
}

function toggleCompare(id) {
    const productId = String(id);
    if (compareProducts.has(productId)) {
        compareProducts.delete(productId);
        showToast('Đã bỏ sản phẩm khỏi so sánh');
    } else {
        if (compareProducts.size >= MAX_COMPARE_PRODUCTS) {
            showToast(`Chỉ so sánh tối đa ${MAX_COMPARE_PRODUCTS} sản phẩm cùng lúc.`, 'error');
            return;
        }
        compareProducts.add(productId);
        showToast('Đã thêm sản phẩm vào so sánh');
    }
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
    const modal = document.getElementById('compareModal');
    if (modal && modal.classList.contains('show')) {
        renderCompareTable();
    }
}

function removeCompareItem(id) {
    const productId = String(id);
    compareProducts.delete(productId);
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
    renderCompareTable();
    showToast('Đã bỏ sản phẩm khỏi so sánh');
}

function addCompareItem(id) {
    const productId = String(id);
    if (compareProducts.size >= MAX_COMPARE_PRODUCTS) {
        showToast(`Chỉ so sánh tối đa ${MAX_COMPARE_PRODUCTS} sản phẩm cùng lúc.`, 'error');
        return;
    }
    compareProducts.add(productId);
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
    renderCompareTable();
    showToast('Đã thêm sản phẩm vào so sánh');
}

function clearCompare() {
    compareProducts.clear();
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
    closeCompareModal();
    showToast('Đã xóa toàn bộ sản phẩm so sánh');
}

function ensureCompareUI() {
    if (!document.getElementById('compareBar')) {
        document.body.insertAdjacentHTML('beforeend', `
            <aside class="compare-bar" id="compareBar" aria-live="polite"></aside>
        `);
    }
    if (!document.getElementById('compareModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <aside class="compare-modal" id="compareModal" role="dialog" aria-modal="true" aria-labelledby="compareTitle" aria-hidden="true">
                <section class="compare-dialog">
                    <header class="compare-header">
                        <div class="compare-header-left">
                            <span class="compare-eyebrow">TechEcommerce Compare</span>
                            <h2 id="compareTitle">So sánh sản phẩm</h2>
                            <label class="compare-diff-toggle" for="compareDiffToggle">
                                <input type="checkbox" id="compareDiffToggle" onchange="toggleCompareDiffOnly(this.checked)" />
                                <span class="toggle-slider"></span>
                                <span class="toggle-text">Chỉ xem điểm khác biệt</span>
                            </label>
                        </div>
                        <div class="compare-header-right">
                            <div id="compareCategoryBadge" class="compare-cat-badge"></div>
                            <div id="compareToolbarAddSlot" class="compare-toolbar-add-slot"></div>
                            <button type="button" class="btn-compare-clear" onclick="clearCompare()">Xóa tất cả</button>
                            <button type="button" class="compare-close" onclick="closeCompareModal()" aria-label="Đóng bảng so sánh">×</button>
                        </div>
                    </header>
                    <div class="compare-table-wrap" id="compareTableWrap"></div>
                    <div class="compare-picker-dialog" id="comparePickerOverlay" style="display: none;" aria-hidden="true" role="dialog" aria-labelledby="pickerModalTitle">
                        <div class="compare-picker-backdrop" onclick="closeCompareSearchPicker()"></div>
                        <div class="compare-picker-box">
                            <header class="compare-picker-header">
                                <div class="compare-picker-title-wrap">
                                    <h4 id="pickerModalTitle" class="compare-picker-title">Thêm sản phẩm vào so sánh</h4>
                                    <span class="compare-picker-count" id="comparePickerRemainingBadge">Còn lại 2 vị trí</span>
                                </div>
                                <button type="button" class="compare-picker-close-btn" onclick="closeCompareSearchPicker()" aria-label="Đóng bảng tìm kiếm">×</button>
                            </header>
                            <div class="compare-picker-search-bar">
                                <svg class="picker-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input type="search" id="comparePickerSearchInput" placeholder="Tìm kiếm theo tên sản phẩm, thương hiệu..." oninput="onComparePickerSearch(this.value)" autocomplete="off" />
                            </div>
                            <div class="compare-picker-list" id="comparePickerResults" role="listbox" aria-label="Danh sách sản phẩm có thể thêm"></div>
                        </div>
                    </div>
                </section>
            </aside>
        `);
    }
    const modal = document.getElementById('compareModal');
    modal?.removeEventListener('click', handleCompareModalBackdropClick);
    modal?.addEventListener('click', handleCompareModalBackdropClick);
}

function handleCompareModalBackdropClick(event) {
    if (event.target.id === 'compareModal') closeCompareModal();
}

function renderCompareBar() {
    ensureCompareUI();
    const bar = document.getElementById('compareBar');
    if (!bar) return;
    const selected = selectedCompareProducts();
    if (!selected.length) {
        bar.classList.remove('show');
        bar.innerHTML = '';
        return;
    }

    bar.classList.add('show');
    bar.innerHTML = `
        <div class="compare-bar-inner">
            <div class="compare-bar-info">
                <span class="compare-bar-count">Đã chọn <strong>${selected.length}/${MAX_COMPARE_PRODUCTS}</strong> sản phẩm</span>
                <div class="compare-selected">
                    ${selected.map(product => `
                        <span class="compare-chip" title="${escapeHTML(product.name)}">
                            <img src="${escapeHTML(product.image)}" alt="" class="compare-chip-thumb" onerror="this.src='assets/images/product-placeholder.svg'" />
                            <span class="compare-chip-name">${escapeHTML(product.name)}</span>
                            <button type="button" class="compare-chip-remove" onclick="event.stopPropagation(); removeCompareItem('${product._id}')" aria-label="Xóa ${escapeHTML(product.name)}">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div class="compare-bar-actions">
                <button type="button" class="btn-primary compare-bar-btn" onclick="openCompareModal()">
                    So sánh ngay (${selected.length})
                </button>
                <button type="button" class="btn-secondary compare-clear-btn" onclick="clearCompare()">
                    Xóa tất cả
                </button>
            </div>
        </div>
    `;
}

function toggleCompareDiffOnly(checked) {
    compareDiffOnly = checked;
    const tableWrap = document.getElementById('compareTableWrap');
    if (!tableWrap) return;
    const dataRows = tableWrap.querySelectorAll('.compare-data-row');
    dataRows.forEach(row => {
        const isDiff = row.dataset.isDiff === 'true';
        if (checked && !isDiff) {
            row.style.display = 'none';
        } else {
            row.style.display = '';
        }
    });
}

function resolveProductSpec(p, key) {
    if (!p) return '—';
    const explicitVal = p.specs && p.specs[key];
    if (explicitVal && String(explicitVal).trim() && !String(explicitVal).toLowerCase().includes('chưa có thông tin')) {
        return String(explicitVal).trim();
    }
    const name = String(p.name || '').toLowerCase();
    const desc = String(p.description || '').toLowerCase();
    const cpu = String(p.specs?.cpu || '').toLowerCase();
    const brand = String(p.brand || '').toLowerCase();
    const category = String(p.category || '').toLowerCase();

    // 1. GPU (Đồ họa)
    if (key === 'gpu') {
        if (cpu.includes('a18 pro') || name.includes('16 pro')) return 'Apple GPU (6 nhân đồ họa)';
        if (cpu.includes('a18') || name.includes('16')) return 'Apple GPU (5 nhân đồ họa)';
        if (cpu.includes('a17 pro') || name.includes('15 pro')) return 'Apple GPU (6 nhân đồ họa)';
        if (cpu.includes('a16') || name.includes('15')) return 'Apple GPU (5 nhân đồ họa)';
        if (cpu.includes('a15')) return 'Apple GPU (5 nhân đồ họa)';
        if (cpu.includes('snapdragon 8 elite') || name.includes('s25')) return 'Qualcomm Adreno 830';
        if (cpu.includes('snapdragon 8 gen 3') || name.includes('s24')) return 'Qualcomm Adreno 750';
        if (cpu.includes('snapdragon 8 gen 2')) return 'Qualcomm Adreno 740';
        if (cpu.includes('dimensity 9400')) return 'Immortalis-G925';
        if (cpu.includes('dimensity 9300')) return 'Immortalis-G720';
        if (cpu.includes('dimensity 8300') || name.includes('poco x8')) return 'Mali-G615-MC6';
        if (brand.includes('apple')) return 'Apple GPU thế hệ mới';
        if (category.includes('điện thoại')) return 'GPU đồ họa tích hợp cao cấp';
        if (category.includes('laptop')) {
            if (name.includes('rtx 4090')) return 'NVIDIA GeForce RTX 4090 16GB';
            if (name.includes('rtx 4080')) return 'NVIDIA GeForce RTX 4080 12GB';
            if (name.includes('rtx 4070')) return 'NVIDIA GeForce RTX 4070 8GB';
            if (name.includes('rtx 4060')) return 'NVIDIA GeForce RTX 4060 8GB';
            if (name.includes('rtx 4050')) return 'NVIDIA GeForce RTX 4050 6GB';
            if (name.includes('rtx 3050')) return 'NVIDIA GeForce RTX 3050 4GB';
            if (name.includes('macbook pro')) return 'Apple 14-core / 18-core GPU';
            if (name.includes('macbook air')) return 'Apple 10-core GPU';
            if (cpu.includes('intel') || cpu.includes('core')) return 'Intel Iris Xe / Arc Graphics';
            if (cpu.includes('ryzen')) return 'AMD Radeon 780M / 680M';
            return 'Card đồ họa tích hợp hiệu năng cao';
        }
    }

    // 2. Camera (Camera sau & trước)
    if (key === 'camera') {
        if (name.includes('16 pro max') || name.includes('16 pro')) {
            return 'Chính 48MP, Siêu rộng 48MP, Tele 12MP (Zoom 5x) / Trước 12MP TrueDepth';
        }
        if (name.includes('iphone 16') || name.includes('16 plus')) {
            return 'Chính 48MP Fusion, Siêu rộng 12MP / Trước 12MP TrueDepth';
        }
        if (name.includes('15 pro max') || name.includes('15 pro')) {
            return 'Chính 48MP, Siêu rộng 12MP, Tele 12MP (Zoom 5x) / Trước 12MP TrueDepth';
        }
        if (name.includes('iphone 15') || name.includes('15 plus')) {
            return 'Chính 48MP, Siêu rộng 12MP / Trước 12MP TrueDepth';
        }
        if (name.includes('s25 ultra') || name.includes('s24 ultra')) {
            return 'Chính 200MP OIS, Tele 50MP + 10MP (Zoom 100x), Siêu rộng 12MP / Trước 12MP';
        }
        if (name.includes('s25 plus') || name.includes('s25') || name.includes('s24')) {
            return 'Chính 50MP OIS, Tele 10MP (Zoom quang 3x), Siêu rộng 12MP / Trước 12MP';
        }
        if (name.includes('xiaomi 14 ultra')) {
            return 'Chính 50MP 1-inch LYT-900, Tele 50MP + 50MP, Siêu rộng 50MP / Trước 32MP';
        }
        if (name.includes('xiaomi 14') || name.includes('poco')) {
            return 'Chính 50MP OIS, Tele 50MP, Siêu rộng 50MP / Trước 32MP';
        }
        if (category.includes('điện thoại')) {
            return 'Cụm đa camera AI sắc nét, Quay video 4K / Camera selfie HD';
        }
        if (category.includes('tablet')) {
            return 'Chính 12MP góc rộng, Quay 4K / Trước 12MP Ultra Wide Center Stage';
        }
        if (category.includes('laptop')) {
            return '1080p FHD Webcam tích hợp micro chống ồn AI';
        }
    }

    // 3. Connectivity (Kết nối mạng & Wi-Fi)
    if (key === 'connectivity') {
        if (name.includes('16') || name.includes('s25') || name.includes('xiaomi 14')) {
            return '5G siêu tốc, Wi-Fi 7, Bluetooth 5.4, USB-C 3.2, NFC';
        }
        if (name.includes('15') || name.includes('s24')) {
            return '5G siêu tốc, Wi-Fi 6E, Bluetooth 5.3, USB-C, NFC';
        }
        if (category.includes('điện thoại')) {
            return '5G, Wi-Fi 6E/7, Bluetooth 5.3, NFC, GPS';
        }
        if (category.includes('laptop')) {
            return 'Wi-Fi 6E / Wi-Fi 7, Bluetooth 5.3, Thunderbolt 4, HDMI, USB-A';
        }
        if (category.includes('tablet')) {
            return 'Wi-Fi 6E băng tần kép, Bluetooth 5.3, Cổng sạc USB-C';
        }
        if (category.includes('tai nghe')) {
            return 'Bluetooth 5.3 kết nối ổn định, Cổng sạc Type-C, Chống nước IPX4';
        }
        if (category.includes('đồng hồ')) {
            return 'Bluetooth 5.3, GPS đa băng tần, NFC, Wi-Fi, eSIM';
        }
    }

    // 4. Weight (Trọng lượng thân máy)
    if (key === 'weight') {
        if (name.includes('16 pro max')) return '227 g';
        if (name.includes('16 pro')) return '199 g';
        if (name.includes('16 plus')) return '199 g';
        if (name.includes('iphone 16')) return '170 g';
        if (name.includes('15 pro max')) return '221 g';
        if (name.includes('15 pro')) return '187 g';
        if (name.includes('15 plus')) return '201 g';
        if (name.includes('iphone 15')) return '171 g';
        if (name.includes('s25 ultra')) return '219 g';
        if (name.includes('s25 plus') || name.includes('s25+')) return '190 g';
        if (name.includes('galaxy s25')) return '162 g';
        if (name.includes('s24 ultra')) return '232 g';
        if (name.includes('s24 plus')) return '196 g';
        if (name.includes('galaxy s24')) return '167 g';
        if (name.includes('xiaomi 14 ultra')) return '220 g';
        if (name.includes('xiaomi 14')) return '193 g';
        if (name.includes('poco x8')) return '195 g';
        if (name.includes('poco')) return '190 g';
        if (name.includes('ipad pro 13')) return '579 g';
        if (name.includes('ipad pro 11')) return '444 g';
        if (name.includes('ipad air 13')) return '617 g';
        if (name.includes('ipad air 11')) return '462 g';
        if (name.includes('ipad gen 10')) return '477 g';
        if (name.includes('macbook air 13')) return '1.24 kg';
        if (name.includes('macbook air 15')) return '1.51 kg';
        if (name.includes('macbook pro 14')) return '1.61 kg';
        if (name.includes('macbook pro 16')) return '2.14 kg';
        if (name.includes('rog')) return 'Khoảng 2.2 kg';
        if (name.includes('xps 13')) return '1.19 kg';
        if (name.includes('xps 15')) return '1.86 kg';
        if (name.includes('xps 16')) return '2.13 kg';
        if (name.includes('thinkpad')) return 'Khoảng 1.35 kg';
        if (category.includes('điện thoại')) return 'Khoảng 180 g - 210 g';
        if (category.includes('laptop')) return 'Khoảng 1.4 kg - 1.8 kg';
        if (category.includes('tablet')) return 'Khoảng 460 g - 580 g';
        if (category.includes('tai nghe')) return 'Khoảng 5.3 g (mỗi tai), hộp sạc 45 g';
        if (category.includes('đồng hồ')) return 'Khoảng 35 g - 48 g';
    }

    // 5. Warranty
    if (key === 'warranty') {
        if (p.warranty && String(p.warranty).trim()) return String(p.warranty).trim();
        return 'Chính hãng 12 tháng tại trung tâm ủy quyền';
    }

    return '—';
}

function getCompareSpecGroups(selectedProducts) {
    const categories = [...new Set(selectedProducts.map(p => p.category))];
    const isSingleCategory = categories.length === 1;
    const mainCategory = categories[0];

    const getSpec = (p, key) => resolveProductSpec(p, key);
    const getWarranty = (p) => resolveProductSpec(p, 'warranty');

    const commonGeneralRows = [
        { label: 'Thương hiệu', get: p => p.brand || '—' },
        { label: 'Danh mục', get: p => p.category || '—' },
        { label: 'Giá bán chính hãng', get: p => fmt(p.price) },
        { label: 'Giá niêm yết', get: p => p.compareAtPrice > p.price ? fmt(p.compareAtPrice) : '—' },
        { label: 'Tình trạng tồn kho', get: p => p.stock > 0 ? `Còn hàng (${p.stock} sản phẩm)` : 'Tạm hết hàng' },
        { label: 'Chính sách bảo hành', get: getWarranty },
        { label: 'Đánh giá người dùng', get: p => p.rating ? `⭐ ${Number(p.rating).toFixed(1)}/5 (${p.reviewCount || 0} đánh giá)` : '—' },
        { label: 'Lượt đã bán', get: p => p.soldCount ? `${p.soldCount.toLocaleString('vi-VN')} sản phẩm` : '—' }
    ];

    if (isSingleCategory && mainCategory === 'Điện thoại') {
        return [
            { title: 'Thông tin chung', icon: '📱', rows: commonGeneralRows },
            {
                title: 'Màn hình & Hiển thị', icon: '📺', rows: [
                    { label: 'Công nghệ màn hình', get: p => getSpec(p, 'screen') }
                ]
            },
            {
                title: 'Cấu hình & Hiệu năng', icon: '⚡', rows: [
                    { label: 'Vi xử lý (CPU)', get: p => getSpec(p, 'cpu') },
                    { label: 'Đồ họa (GPU)', get: p => getSpec(p, 'gpu') },
                    { label: 'Bộ nhớ RAM', get: p => getSpec(p, 'ram') },
                    { label: 'Bộ nhớ trong (ROM)', get: p => getSpec(p, 'storage') },
                    { label: 'Hệ điều hành', get: p => getSpec(p, 'os') }
                ]
            },
            {
                title: 'Hệ thống Camera', icon: '📸', rows: [
                    { label: 'Camera sau & trước', get: p => getSpec(p, 'camera') }
                ]
            },
            {
                title: 'Pin & Công nghệ sạc', icon: '🔋', rows: [
                    { label: 'Dung lượng pin & Sạc', get: p => getSpec(p, 'battery') }
                ]
            },
            {
                title: 'Kết nối & Thiết kế', icon: '📶', rows: [
                    { label: 'Kết nối mạng & Wi-Fi', get: p => getSpec(p, 'connectivity') },
                    { label: 'Trọng lượng thân máy', get: p => getSpec(p, 'weight') }
                ]
            }
        ];
    }

    if (isSingleCategory && mainCategory === 'Laptop') {
        return [
            { title: 'Thông tin chung', icon: '💻', rows: commonGeneralRows },
            {
                title: 'Cấu hình & Đồ họa', icon: '⚡', rows: [
                    { label: 'Vi xử lý (CPU)', get: p => getSpec(p, 'cpu') },
                    { label: 'Card đồ họa (GPU)', get: p => getSpec(p, 'gpu') },
                    { label: 'Bộ nhớ RAM', get: p => getSpec(p, 'ram') },
                    { label: 'Ổ cứng lưu trữ (SSD)', get: p => getSpec(p, 'storage') },
                    { label: 'Hệ điều hành', get: p => getSpec(p, 'os') }
                ]
            },
            {
                title: 'Màn hình hiển thị', icon: '🖥️', rows: [
                    { label: 'Kích thước & Độ phân giải', get: p => getSpec(p, 'screen') }
                ]
            },
            {
                title: 'Thiết kế & Trọng lượng', icon: '⚖️', rows: [
                    { label: 'Trọng lượng thân máy', get: p => getSpec(p, 'weight') }
                ]
            },
            {
                title: 'Thời lượng Pin & Cổng cắm', icon: '🔋', rows: [
                    { label: 'Dung lượng pin', get: p => getSpec(p, 'battery') },
                    { label: 'Cổng kết nối', get: p => getSpec(p, 'connectivity') }
                ]
            }
        ];
    }

    if (isSingleCategory && mainCategory === 'Tablet') {
        return [
            { title: 'Thông tin chung', icon: '📋', rows: commonGeneralRows },
            {
                title: 'Màn hình hiển thị', icon: '📺', rows: [
                    { label: 'Kích thước & Công nghệ', get: p => getSpec(p, 'screen') }
                ]
            },
            {
                title: 'Cấu hình & Hiệu năng', icon: '⚡', rows: [
                    { label: 'Vi xử lý (Chip)', get: p => getSpec(p, 'cpu') },
                    { label: 'Bộ nhớ RAM', get: p => getSpec(p, 'ram') },
                    { label: 'Bộ nhớ trong', get: p => getSpec(p, 'storage') },
                    { label: 'Hệ điều hành', get: p => getSpec(p, 'os') },
                    { label: 'Đồ họa (GPU)', get: p => getSpec(p, 'gpu') }
                ]
            },
            {
                title: 'Camera & Dung lượng Pin', icon: '🔋', rows: [
                    { label: 'Hệ thống Camera', get: p => getSpec(p, 'camera') },
                    { label: 'Dung lượng pin', get: p => getSpec(p, 'battery') }
                ]
            },
            {
                title: 'Kết nối & Trọng lượng', icon: '⚖️', rows: [
                    { label: 'Kết nối không dây', get: p => getSpec(p, 'connectivity') },
                    { label: 'Trọng lượng thân máy', get: p => getSpec(p, 'weight') }
                ]
            }
        ];
    }

    if (isSingleCategory && mainCategory === 'Tai nghe') {
        return [
            { title: 'Thông tin chung', icon: '🎧', rows: commonGeneralRows },
            {
                title: 'Kết nối & Tiện ích âm thanh', icon: '📶', rows: [
                    { label: 'Cổng sạc & Kết nối', get: p => getSpec(p, 'connectivity') },
                    { label: 'Hệ điều hành tương thích', get: p => getSpec(p, 'os') }
                ]
            },
            {
                title: 'Thời lượng Pin & Thiết kế', icon: '🔋', rows: [
                    { label: 'Thời lượng pin sử dụng', get: p => getSpec(p, 'battery') },
                    { label: 'Trọng lượng', get: p => getSpec(p, 'weight') }
                ]
            }
        ];
    }

    if (isSingleCategory && mainCategory === 'Đồng hồ thông minh') {
        return [
            { title: 'Thông tin chung', icon: '⌚', rows: commonGeneralRows },
            {
                title: 'Màn hình & Mặt đồng hồ', icon: '📺', rows: [
                    { label: 'Màn hình hiển thị', get: p => getSpec(p, 'screen') }
                ]
            },
            {
                title: 'Pin & Thời lượng sử dụng', icon: '🔋', rows: [
                    { label: 'Thời lượng pin', get: p => getSpec(p, 'battery') }
                ]
            },
            {
                title: 'Tính năng & Kết nối', icon: '📶', rows: [
                    { label: 'Kết nối & Tiện ích', get: p => getSpec(p, 'connectivity') },
                    { label: 'Hệ điều hành', get: p => getSpec(p, 'os') },
                    { label: 'Trọng lượng', get: p => getSpec(p, 'weight') }
                ]
            }
        ];
    }

    // Default / Accessories / Gaming Consoles / Mixed categories
    const specFields = [
        { label: 'Vi xử lý (CPU/Chip)', key: 'cpu' },
        { label: 'Đồ họa (GPU)', key: 'gpu' },
        { label: 'Bộ nhớ RAM', key: 'ram' },
        { label: 'Bộ nhớ lưu trữ', key: 'storage' },
        { label: 'Màn hình', key: 'screen' },
        { label: 'Camera', key: 'camera' },
        { label: 'Pin & Nguồn', key: 'battery' },
        { label: 'Hệ điều hành', key: 'os' },
        { label: 'Kết nối & Tương thích', key: 'connectivity' },
        { label: 'Trọng lượng', key: 'weight' }
    ];

    const availableSpecRows = specFields.filter(field =>
        selectedProducts.some(p => p.specs && p.specs[field.key] && String(p.specs[field.key]).trim() !== '')
    ).map(field => ({
        label: field.label,
        get: p => getSpec(p, field.key)
    }));

    const groups = [
        { title: 'Thông tin chung', icon: '📋', rows: commonGeneralRows }
    ];
    if (availableSpecRows.length) {
        groups.push({ title: 'Thông số kỹ thuật chi tiết', icon: '⚙️', rows: availableSpecRows });
    }
    return groups;
}

function renderCompareTable() {
    const wrap = document.getElementById('compareTableWrap');
    const badge = document.getElementById('compareCategoryBadge');
    if (!wrap) return;

    const selected = selectedCompareProducts();
    const categories = [...new Set(selected.map(p => p.category))];

    if (badge) {
        if (!selected.length) {
            badge.style.display = 'none';
        } else if (categories.length > 1) {
            badge.style.display = 'inline-flex';
            badge.className = 'compare-cat-badge warning';
            badge.textContent = `Khác danh mục: ${categories.join(', ')}`;
        } else {
            badge.style.display = 'inline-flex';
            badge.className = 'compare-cat-badge';
            badge.textContent = `${categories[0]} (${selected.length} sản phẩm)`;
        }
    }

    if (!selected.length) {
        wrap.innerHTML = `
            <div class="compare-empty-state">
                <div class="empty-icon">⚖️</div>
                <h3>Chưa có sản phẩm nào để so sánh</h3>
                <p>Hãy chọn sản phẩm bằng nút <strong>So sánh</strong> trên danh sách hoặc thẻ sản phẩm để đối chiếu cấu hình chi tiết.</p>
                <button type="button" class="btn-primary" onclick="closeCompareModal()">Khám phá sản phẩm ngay</button>
            </div>
        `;
        return;
    }

    const availableCandidates = allProducts.filter(p =>
        !compareProducts.has(String(p._id)) &&
        (categories.length ? categories.includes(p.category) : true)
    );
    const colCount = selected.length + 1;
    const groups = getCompareSpecGroups(selected);

    const toolbarAddSlot = document.getElementById('compareToolbarAddSlot');
    if (toolbarAddSlot) {
        if (selected.length < MAX_COMPARE_PRODUCTS && availableCandidates.length > 0) {
            toolbarAddSlot.innerHTML = `
                <button type="button" class="btn-compare-toolbar-add" onclick="openCompareSearchPicker()" aria-label="Mở bộ chọn thêm sản phẩm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Thêm sản phẩm (${MAX_COMPARE_PRODUCTS - selected.length})</span>
                </button>
            `;
            toolbarAddSlot.style.display = 'block';
        } else {
            toolbarAddSlot.innerHTML = '';
            toolbarAddSlot.style.display = 'none';
        }
    }

    let singleNoticeHtml = '';
    if (selected.length === 1) {
        singleNoticeHtml = `
            <div class="compare-single-alert">
                <span>💡</span> Bạn đã chọn 1 sản phẩm. Hãy chọn thêm sản phẩm từ nút "+ Thêm sản phẩm" ở góc phải hoặc trên trang chủ để so sánh chi tiết.
            </div>
        `;
    }

    wrap.innerHTML = `
        ${singleNoticeHtml}
        <div class="compare-scroll-container">
            <table class="compare-table" id="compareTable">
                <thead>
                    <tr>
                        <th class="compare-col-criteria">
                            <div class="compare-criteria-head-box">
                                <span class="criteria-label">Bảng đối chiếu</span>
                                <strong>Tiêu chí so sánh</strong>
                            </div>
                        </th>
                        ${selected.map(product => `
                            <th class="compare-col-product" data-product-id="${product._id}">
                                <div class="compare-product-col-head">
                                    <figure class="compare-head-figure">
                                        <button type="button" class="compare-col-remove" onclick="removeCompareItem('${product._id}')" title="Xóa khỏi so sánh" aria-label="Bỏ ${escapeHTML(product.name)}">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null; this.src='assets/images/product-placeholder.svg'" />
                                    </figure>
                                    <span class="compare-head-brand">${escapeHTML(product.brand || product.category)}</span>
                                    <h3 class="compare-head-title" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</h3>
                                    <div class="compare-head-price-wrap">
                                        <strong class="compare-head-price">${fmt(product.price)}</strong>
                                        ${product.compareAtPrice > product.price ? `<del class="compare-head-old-price">${fmt(product.compareAtPrice)}</del>` : ''}
                                    </div>
                                    <button type="button" class="btn-primary compare-head-cart-btn" onclick="addToCart('${product._id}')">
                                        Thêm vào giỏ
                                    </button>
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${groups.map(group => `
                        <tr class="compare-group-row">
                            <th colspan="${colCount}">
                                <div class="compare-group-header-title">
                                    <span class="group-icon">${group.icon}</span>
                                    <span>${escapeHTML(group.title)}</span>
                                </div>
                            </th>
                        </tr>
                        ${group.rows.map(row => {
                            const rawValues = selected.map(p => row.get(p));
                            const allEmpty = rawValues.every(val => !val || val === '—' || val === 'Chưa có thông tin');
                            if (allEmpty) return ''; // Do not display rows with no information on any compared item
                            const isDiff = selected.length >= 2 && !rawValues.every(val => val === rawValues[0]);
                            const isHidden = compareDiffOnly && !isDiff;
                            return `
                                <tr class="compare-data-row ${isDiff ? 'is-diff' : ''}" data-is-diff="${isDiff}" style="${isHidden ? 'display: none;' : ''}">
                                    <td class="compare-criteria-cell">
                                        <strong>${escapeHTML(row.label)}</strong>
                                    </td>
                                    ${selected.map((product, pIndex) => `
                                        <td class="compare-val-cell ${isDiff ? 'highlight-diff' : ''}">
                                            <span class="val-text ${rawValues[pIndex] === '—' || rawValues[pIndex] === 'Chưa có thông tin' ? 'val-empty' : ''}">${escapeHTML(rawValues[pIndex])}</span>
                                        </td>
                                    `).join('')}
                                </tr>
                            `;
                        }).join('')}
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function openCompareSearchPicker() {
    const overlay = document.getElementById('comparePickerOverlay');
    if (!overlay) return;
    const selected = selectedCompareProducts();
    const remaining = MAX_COMPARE_PRODUCTS - selected.length;
    if (remaining <= 0) {
        showToast(`Đã chọn tối đa ${MAX_COMPARE_PRODUCTS} sản phẩm so sánh.`, 'info');
        return;
    }
    const badge = document.getElementById('comparePickerRemainingBadge');
    if (badge) badge.textContent = `Còn lại ${remaining} vị trí`;
    const input = document.getElementById('comparePickerSearchInput');
    if (input) input.value = '';
    renderComparePickerResults('');
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => input?.focus(), 60);
}

function closeCompareSearchPicker() {
    const overlay = document.getElementById('comparePickerOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
}

function onComparePickerSearch(val) {
    renderComparePickerResults(val ? val.trim() : '');
}

function renderComparePickerResults(filterText = '') {
    const listEl = document.getElementById('comparePickerResults');
    if (!listEl) return;
    const selected = selectedCompareProducts();
    const categories = [...new Set(selected.map(p => p.category))];
    const remaining = MAX_COMPARE_PRODUCTS - selected.length;

    let candidates = allProducts.filter(p => !compareProducts.has(String(p._id)));
    if (categories.length > 0) {
        const sameCat = candidates.filter(p => categories.includes(p.category));
        if (sameCat.length > 0) candidates = sameCat;
    }

    if (filterText) {
        const query = filterText.toLowerCase();
        candidates = candidates.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.brand && p.brand.toLowerCase().includes(query)) ||
            (p.category && p.category.toLowerCase().includes(query))
        );
    }

    if (!candidates.length) {
        listEl.innerHTML = `
            <div class="compare-picker-empty">
                <p>Không tìm thấy sản phẩm phù hợp để so sánh.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = candidates.slice(0, 30).map(p => `
        <article class="compare-picker-item" onclick="pickCompareItem('${p._id}')">
            <figure class="picker-item-thumb">
                <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" onerror="this.onerror=null; this.src='assets/images/product-placeholder.svg'" />
            </figure>
            <div class="picker-item-info">
                <span class="picker-item-brand">${escapeHTML(p.brand || p.category)}</span>
                <h5 class="picker-item-title">${escapeHTML(p.name)}</h5>
                <strong class="picker-item-price">${fmt(p.price)}</strong>
            </div>
            <button type="button" class="btn-picker-add" onclick="event.stopPropagation(); pickCompareItem('${p._id}')" ${remaining <= 0 ? 'disabled' : ''}>
                + Thêm
            </button>
        </article>
    `).join('');
}

function pickCompareItem(id) {
    addCompareItem(id);
    const selected = selectedCompareProducts();
    const remaining = MAX_COMPARE_PRODUCTS - selected.length;
    if (remaining <= 0) {
        closeCompareSearchPicker();
    } else {
        const badge = document.getElementById('comparePickerRemainingBadge');
        if (badge) badge.textContent = `Còn lại ${remaining} vị trí`;
        const input = document.getElementById('comparePickerSearchInput');
        renderComparePickerResults(input ? input.value.trim() : '');
    }
}

function openCompareModal() {
    ensureCompareUI();
    const modal = document.getElementById('compareModal');
    if (!modal) return;
    const diffToggle = document.getElementById('compareDiffToggle');
    if (diffToggle) diffToggle.checked = compareDiffOnly;
    renderCompareTable();
    modal.classList.add('show');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('compare-open');
}

function closeCompareModal() {
    const modal = document.getElementById('compareModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('compare-open');
    closeCompareSearchPicker();
}

function resetCompareOnLoad() {
    compareProducts.clear();
    try {
        localStorage.removeItem('compareProducts');
        sessionStorage.removeItem('compareProducts');
    } catch (e) { }
    document.body.classList.remove('compare-open');
    const bar = document.getElementById('compareBar');
    if (bar) {
        bar.classList.remove('show');
        bar.innerHTML = '';
    }
    const modal = document.getElementById('compareModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

resetCompareOnLoad();
window.addEventListener('beforeunload', resetCompareOnLoad);
window.addEventListener('pagehide', resetCompareOnLoad);

function renderProducts() {
    const sections = document.getElementById('productSections');
    if (!sections) return;
    const products = filteredProducts();
    const resultCount = document.getElementById('resultCount');
    if (resultCount) resultCount.textContent = `${products.length} sản phẩm`;
    const catalogTitle = document.getElementById('catalogTitle');
    if (catalogTitle) {
        catalogTitle.textContent = activeCategory === 'all'
            ? 'Tất cả sản phẩm'
            : categoryLabels[activeCategory] || activeCategory;
    }

    if (!products.length) {
        sections.innerHTML = '<div class="empty-state"><p>Không tìm thấy sản phẩm phù hợp</p></div>';
        renderCompareBar();
        return;
    }

    const grouped = {};
    products.forEach(product => {
        if (!grouped[product.category]) grouped[product.category] = [];
        grouped[product.category].push(product);
    });

    const sortedEntries = Object.entries(grouped).sort(([catA], [catB]) => {
        const idxA = CANONICAL_CATEGORY_ORDER.indexOf(catA);
        const idxB = CANONICAL_CATEGORY_ORDER.indexOf(catB);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return catA.localeCompare(catB, 'vi');
    });

    sections.innerHTML = sortedEntries.map(([category, items]) => `
        <section class="category-section">
            <header class="category-header">
                <h3>${escapeHTML(categoryLabels[category] || category)}</h3>
                <span class="category-count">${items.length} sản phẩm</span>
            </header>
            <section class="product-grid" aria-label="Sản phẩm ${escapeHTML(categoryLabels[category] || category)}">
                ${items.map(productCard).join('')}
            </section>
        </section>
    `).join('');
    renderCompareBar();
}

function catalogImageSource(product) {
    return product?.image || '';
}

function productCard(p) {
    const liked = wishlistIds.has(Number(p._id));
    const compared = compareProducts.has(String(p._id));
    const stockLabel = p.stock <= 0 ? 'Hết hàng' : `Kho: ${p.stock}`;
    const specs = p.specs || {};
    let specLine = '';
    if (p.category === 'Laptop' || p.category === 'Điện thoại' || p.category === 'Tablet') {
        specLine = [specs.chip || specs.cpu, specs.ram, specs.storage, specs.screen || specs.display].filter(Boolean).slice(0, 3).join(' - ');
    } else if (p.category === 'Tai nghe') {
        specLine = [specs.connectivity, specs.battery, specs.anc || specs.audio].filter(Boolean).slice(0, 3).join(' - ');
    } else if (p.category === 'Đồng hồ thông minh') {
        specLine = [specs.display || specs.screen, specs.battery, specs.features || specs.connectivity].filter(Boolean).slice(0, 3).join(' - ');
    } else if (p.category === 'Phụ kiện') {
        specLine = [specs.power || specs.capacity, specs.ports || specs.sensor || specs.dpi, specs.compatibility].filter(Boolean).slice(0, 3).join(' - ');
    } else if (p.category === 'Máy chơi game') {
        specLine = [specs.chip || specs.cpu, specs.storage, specs.resolution || specs.display].filter(Boolean).slice(0, 3).join(' - ');
    }
    if (!specLine) {
        specLine = Object.values(specs).filter(v => typeof v === 'string').slice(0, 3).join(' - ');
    }
    const discount = p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
    const imgSrc = catalogImageSource(p);
    const fallbackSrc = p.originalImageUrl || p.image || '';

    return `
        <article class="product-card fade-in" onclick="window.location.href='pages/catalog/product.html?id=${p._id}'" title="Xem chi tiết ${escapeHTML(p.name)}">
            <button class="wishlist-btn ${liked ? 'active' : ''}" type="button" title="Yêu thích" onclick="event.stopPropagation(); toggleWishlist('${p._id}').catch(err => showToast(err.message, 'error'))">${liked ? '♥' : '♡'}</button>
            ${discount ? `<span class="discount-ribbon">Giảm ${discount}%</span>` : (p.featured ? '<span class="product-ribbon">Nổi bật</span>' : '')}
            <a href="pages/catalog/product.html?id=${p._id}" class="product-link" onclick="event.stopPropagation()">
                <figure class="product-media">
                    <img src="${escapeHTML(imgSrc)}" data-original-src="${escapeHTML(fallbackSrc)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="if(this.dataset.originalSrc && this.src !== this.dataset.originalSrc){this.src=this.dataset.originalSrc;}else{this.onerror=null;this.src='assets/images/product-placeholder.svg';}">
                </figure>
            </a>
            <section class="card-body">
                <span class="category-badge">${escapeHTML(p.category)}</span>
                <div class="product-brand"><span class="product-brand-name">${brandIconMarkup(p.brand)} ${escapeHTML(p.brand || 'TechStore Select')}</span>${p.sku ? `<span>${escapeHTML(p.sku)}</span>` : ''}</div>
                <h3 title="${escapeHTML(p.name)}"><a href="pages/catalog/product.html?id=${p._id}" onclick="event.stopPropagation()">${escapeHTML(p.name)}</a></h3>
                <p class="product-desc">${escapeHTML(p.description || '')}</p>
                ${p.recommendation?.reason ? `<p class="recommendation-reason">${escapeHTML(p.recommendation.reason)}</p>` : ''}
                ${specLine ? `<p class="product-spec-line">${escapeHTML(specLine)}</p>` : ''}
                ${p.rating ? `<p class="product-rating">★ ${Number(p.rating).toFixed(1)} <span>(${p.reviewCount || 0})</span>${p.soldCount ? ` <span>- đã bán ${p.soldCount}</span>` : ''}</p>` : ''}
                <div class="product-price-row">
                    <p class="price">${fmt(p.price)}</p>
                    ${p.compareAtPrice > p.price ? `<p class="compare-price">${fmt(p.compareAtPrice)}</p>` : ''}
                </div>
                <p class="stock-info ${p.stock <= (p.minStock ?? 5) ? 'low-stock-text' : ''}">${stockLabel}</p>
                <div class="product-actions">
                    <button class="btn-add-cart" ${p.stock <= 0 ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart('${p._id}')">${p.stock <= 0 ? 'Hết hàng' : 'Thêm giỏ'}</button>
                    <button class="btn-compare ${compared ? 'active' : ''}" type="button" onclick="event.stopPropagation(); toggleCompare('${p._id}')">${compared ? 'Đã chọn' : 'So sánh'}</button>
                </div>
            </section>
        </article>
    `;
}

function getCart() {
    const key = auth.getCartStorageKey();
    const legacyCart = localStorage.getItem('cart');
    if (legacyCart !== null) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, legacyCart);
        localStorage.removeItem('cart');
    }
    try {
        const cart = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(cart) ? cart : [];
    } catch (error) {
        return [];
    }
}

function setCart(cart) {
    localStorage.setItem(auth.getCartStorageKey(), JSON.stringify(cart));
}

function cartItemCount() {
    return getCart().reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function updateCartBadge() {
    const headerBadge = document.getElementById('headerCartBadge');
    const bottomBadge = document.getElementById('bottomNavCartBadge');
    const count = cartItemCount();
    if (headerBadge) {
        headerBadge.textContent = count;
        headerBadge.hidden = count < 1;
    }
    if (bottomBadge) {
        bottomBadge.textContent = count;
        bottomBadge.hidden = count < 1;
    }
}

function openCartDrawer() {
    document.body.classList.add('cart-open');
    const drawer = document.getElementById('cartDrawer');
    drawer?.setAttribute('aria-hidden', 'false');
    drawer?.removeAttribute('inert');
    document.getElementById('cartOverlay')?.setAttribute('aria-hidden', 'false');
    const zaloBtn = document.getElementById('zaloFloatingBtn');
    if (zaloBtn) zaloBtn.style.setProperty('display', 'none', 'important');
}

function closeCartDrawer() {
    document.body.classList.remove('cart-open');
    const drawer = document.getElementById('cartDrawer');
    drawer?.setAttribute('aria-hidden', 'true');
    drawer?.setAttribute('inert', '');
    document.getElementById('cartOverlay')?.setAttribute('aria-hidden', 'true');
    const zaloBtn = document.getElementById('zaloFloatingBtn');
    if (zaloBtn) zaloBtn.style.removeProperty('display');
}

function toggleCartDrawer() {
    if (document.body.classList.contains('cart-open')) closeCartDrawer();
    else openCartDrawer();
}

function goToLoginForCheckout() {
    localStorage.setItem('checkoutAfterLogin', 'true');
    window.location.href = 'pages/auth/login.html';
}

function resetCartDrawerState() {
    document.body.classList.add('cart-no-transition');
    closeCartDrawer();
    requestAnimationFrame(() => {
        document.body.classList.remove('cart-no-transition');
    });
}

resetCartDrawerState();
window.addEventListener('beforeunload', resetCartDrawerState);
window.addEventListener('pagehide', resetCartDrawerState);

let currentCartStep = 1;

function goToCartStep(step) {
    const cart = getCart();
    if (step === 2 && !cart.length) {
        showToast('Giỏ hàng của bạn đang trống!', 'error');
        return;
    }
    currentCartStep = step;
    const reviewStep = document.getElementById('cartStepReview');
    const checkoutStep = document.getElementById('cartStepCheckout');
    const indicator1 = document.getElementById('cartStepIndicator1');
    const indicator2 = document.getElementById('cartStepIndicator2');

    if (step === 1) {
        if (reviewStep) reviewStep.style.display = 'block';
        if (checkoutStep) checkoutStep.style.display = 'none';
        indicator1?.classList.add('active');
        indicator1?.classList.remove('completed');
        indicator2?.classList.remove('active', 'completed');
        if (indicator1) {
            const num = indicator1.querySelector('.step-num');
            if (num) num.textContent = '1';
        }
        renderCart();
    } else {
        if (reviewStep) reviewStep.style.display = 'none';
        if (checkoutStep) checkoutStep.style.display = 'block';
        indicator1?.classList.remove('active');
        indicator1?.classList.add('completed');
        indicator2?.classList.add('active');
        if (indicator1) {
            const num = indicator1.querySelector('.step-num');
            if (num) num.textContent = '✓';
        }
        renderCheckoutRecap();
        const drawer = document.getElementById('cartDrawer');
        if (drawer) drawer.scrollTop = 0;
        const container = document.getElementById('cartContainer');
        if (container) container.scrollTop = 0;
    }
}

function clearEntireCart() {
    if (!getCart().length) return;
    setCart([]);
    appliedCoupon = null;
    currentCartStep = 1;
    renderCart();
    goToCartStep(1);
    showToast('Đã xóa toàn bộ sản phẩm trong giỏ hàng');
}

function addToCart(id) {
    const product = allProducts.find(p => String(p._id) === String(id));
    if (!product) return;
    if (product.stock <= 0) return showToast('Sản phẩm đã hết hàng!', 'error');

    const cart = getCart();
    const item = cart.find(i => String(i.productId) === String(id));
    const nextQty = item ? item.quantity + 1 : 1;
    if (nextQty > product.stock) return showToast('Số lượng trong giỏ đã chạm tồn kho!', 'error');

    if (item) item.quantity = nextQty;
    else cart.push({ productId: Number(id), quantity: 1 });
    setCart(cart);
    appliedCoupon = null;
    renderCart();
    goToCartStep(1);
    openCartDrawer();
    showToast('Đã thêm vào giỏ hàng!');
}

function changeQty(id, delta) {
    let cart = getCart();
    const item = cart.find(i => String(i.productId) === String(id));
    const product = allProducts.find(p => String(p._id) === String(id));
    if (!item || !product) return;
    item.quantity += delta;
    if (item.quantity > product.stock) {
        item.quantity = product.stock;
        showToast(`Số lượng tối đa có thể mua là ${product.stock}`, 'info');
    }
    if (item.quantity <= 0) cart = cart.filter(i => String(i.productId) !== String(id));
    setCart(cart);
    appliedCoupon = null;
    renderCart();
}

function removeItem(id) {
    setCart(getCart().filter(i => String(i.productId) !== String(id)));
    appliedCoupon = null;
    renderCart();
    showToast('Đã xóa khỏi giỏ hàng');
}

function currentCartSubtotal() {
    return getCart().reduce((sum, item) => {
        const product = allProducts.find(p => String(p._id) === String(item.productId));
        if (!product) return sum;
        return sum + product.price * (Number(item.quantity) || 1);
    }, 0);
}

async function applyCoupon() {
    const input = document.getElementById('couponCode');
    const hint = document.getElementById('couponHint');
    const code = input?.value.trim().toUpperCase();
    if (!code) {
        appliedCoupon = null;
        if (hint) hint.textContent = 'Nhập mã giảm giá để áp dụng.';
        renderCart();
        return;
    }

    const subtotal = currentCartSubtotal();
    if (subtotal <= 0) {
        if (hint) hint.textContent = 'Giỏ hàng đang trống.';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/coupons/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, subtotal })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Mã giảm giá không hợp lệ');
        appliedCoupon = data;
        if (hint) hint.textContent = `${data.name}: giảm ${fmt(data.discountAmount)}`;
        showToast(`Áp dụng mã giảm giá thành công: -${fmt(data.discountAmount)}!`);
        renderCart();
    } catch (error) {
        appliedCoupon = null;
        if (hint) hint.textContent = error.message;
        showToast(error.message, 'error');
        renderCart();
    }
}

function renderCheckoutRecap() {
    const miniList = document.getElementById('checkoutMiniList');
    const recapSubtotalEl = document.getElementById('recapSubtotal');
    const recapDiscountRow = document.getElementById('recapDiscountRow');
    const recapDiscountEl = document.getElementById('recapDiscount');
    const recapShippingEl = document.getElementById('recapShipping');
    const recapFinalTotalEl = document.getElementById('recapFinalTotal');
    if (!miniList) return;

    const cart = getCart().map(item => {
        const product = allProducts.find(p => String(p._id) === String(item.productId));
        if (!product) return null;
        return { ...item, product };
    }).filter(Boolean);

    let subtotal = 0;
    miniList.innerHTML = cart.map(item => {
        const lineTotal = item.product.price * item.quantity;
        subtotal += lineTotal;
        return `
            <article class="checkout-mini-item">
                <figure class="mini-item-thumb">
                    <img src="${escapeHTML(item.product.image)}" alt="${escapeHTML(item.product.name)}" onerror="this.onerror=null; this.src='assets/images/product-placeholder.svg'" />
                </figure>
                <div class="mini-item-info">
                    <h5 class="mini-item-title">${escapeHTML(item.product.name)}</h5>
                    <div class="mini-item-qty-price">${fmt(item.product.price)} × <strong>${item.quantity}</strong></div>
                </div>
                <strong class="mini-item-total">${fmt(lineTotal)}</strong>
            </article>
        `;
    }).join('');

    const shippingFee = Number(document.getElementById('shippingFee')?.value || 0);
    const hasShipping = currentShippingQuote !== null && shippingFee > 0;
    const effectiveShipping = hasShipping ? shippingFee : 0;
    const discountAmount = Math.min(Number(appliedCoupon?.discountAmount) || 0, subtotal);
    const finalTotal = Math.max(subtotal - discountAmount, 0) + effectiveShipping;

    if (recapSubtotalEl) recapSubtotalEl.textContent = fmt(subtotal);
    if (recapDiscountRow) {
        recapDiscountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
        if (recapDiscountEl) recapDiscountEl.textContent = `-${fmt(discountAmount)}`;
    }
    if (recapShippingEl) {
        recapShippingEl.textContent = hasShipping ? fmt(shippingFee) : 'Tính ở bước thanh toán';
    }
    if (recapFinalTotalEl) recapFinalTotalEl.textContent = fmt(finalTotal);
}

function renderCart() {
    const cartDiv = document.getElementById('cartList');
    const countBadge = document.getElementById('cartCountBadge');
    const proceedBtn = document.getElementById('proceedToCheckoutBtn');
    updateCartBadge();
    if (!cartDiv) return;

    const cart = getCart().map(item => {
        const product = allProducts.find(p => String(p._id) === String(item.productId));
        if (!product) return null;
        const quantity = Math.min(Number(item.quantity) || 1, product.stock);
        return { ...item, quantity, product };
    }).filter(Boolean);
    setCart(cart.map(item => ({ productId: item.productId, quantity: item.quantity })));

    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (countBadge) countBadge.textContent = `(${totalQty})`;

    const customerGroup = document.getElementById('customerSelectionGroup');
    if (customerGroup) customerGroup.style.display = auth.isAdmin() ? 'block' : 'none';

    if (!cart.length) {
        cartDiv.innerHTML = `
            <div class="cart-empty-state">
                <div class="empty-icon">🛒</div>
                <h4>Giỏ hàng của bạn đang trống</h4>
                <p>Khám phá ngay hàng trăm sản phẩm công nghệ chính hãng giá tốt tại TechEcommerce!</p>
                <button type="button" class="btn-primary" onclick="closeCartDrawer()">Bắt đầu mua sắm</button>
            </div>
        `;
        if (proceedBtn) {
            proceedBtn.disabled = true;
            proceedBtn.classList.add('disabled');
            proceedBtn.title = 'Giỏ hàng đang trống. Vui lòng chọn sản phẩm để tiếp tục.';
        }
        document.getElementById('cartSubtotal').textContent = '0 đ';
        document.getElementById('cartShippingPreview').textContent = 'Tính ở bước thanh toán';
        document.getElementById('total').textContent = '0 đ';
        const discountRow = document.getElementById('cartDiscountRow');
        if (discountRow) discountRow.style.display = 'none';
        if (currentCartStep === 2) goToCartStep(1);
        return;
    }

    if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.classList.remove('disabled');
        proceedBtn.removeAttribute('title');
        proceedBtn.style.opacity = '';
        proceedBtn.style.pointerEvents = '';
    }

    let subtotal = 0;
    cartDiv.innerHTML = cart.map(item => {
        const lineTotal = item.product.price * item.quantity;
        subtotal += lineTotal;
        const isMaxStock = item.quantity >= item.product.stock;

        return `
            <article class="cart-item-card" data-product-id="${item.productId}">
                <figure class="cart-item-thumb">
                    <img src="${escapeHTML(item.product.image)}" alt="${escapeHTML(item.product.name)}" onerror="this.onerror=null; this.src='assets/images/product-placeholder.svg'" />
                </figure>
                <div class="cart-item-details">
                    <span class="cart-item-brand">${escapeHTML(item.product.brand || item.product.category)}</span>
                    <h4 class="cart-item-title">${escapeHTML(item.product.name)}</h4>
                    <div class="cart-item-unit-price">${fmt(item.product.price)}</div>
                    ${isMaxStock ? `<p class="cart-item-stock-limit">Đã đạt tối đa tồn kho (${item.product.stock} máy)</p>` : ''}
                </div>
                <div class="cart-item-actions">
                    <div class="cart-stepper">
                        <button type="button" class="stepper-btn minus" onclick="changeQty('${item.productId}', -1)" aria-label="Giảm">-</button>
                        <span class="stepper-val">${item.quantity}</span>
                        <button type="button" class="stepper-btn plus" onclick="changeQty('${item.productId}', 1)" ${isMaxStock ? 'disabled' : ''} aria-label="Tăng">+</button>
                    </div>
                    <strong class="cart-item-line-total">${fmt(lineTotal)}</strong>
                    <button type="button" class="cart-item-remove-btn" onclick="removeItem('${item.productId}')" aria-label="Xóa ${escapeHTML(item.product.name)}">
                        Xóa
                    </button>
                </div>
            </article>
        `;
    }).join('');

    const shippingFee = Number(document.getElementById('shippingFee')?.value || 0);
    const hasShipping = currentShippingQuote !== null && shippingFee > 0;
    const effectiveShipping = hasShipping ? shippingFee : 0;
    const discountAmount = Math.min(Number(appliedCoupon?.discountAmount) || 0, subtotal);
    const finalTotal = Math.max(subtotal - discountAmount, 0) + effectiveShipping;

    document.getElementById('cartSubtotal').textContent = fmt(subtotal);
    document.getElementById('cartShippingPreview').textContent = hasShipping ? fmt(shippingFee) : 'Tính ở bước thanh toán';
    document.getElementById('total').textContent = fmt(finalTotal);

    const discountRow = document.getElementById('cartDiscountRow');
    if (discountRow) {
        discountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
        document.getElementById('cartDiscount').textContent = `-${fmt(discountAmount)}`;
    }

    document.getElementById('guestCheckoutGate').style.display = auth.isLoggedIn() ? 'none' : 'grid';

    if (currentCartStep === 2) {
        renderCheckoutRecap();
    }
    scheduleInstallmentQuote();
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/admin/dashboard`, { headers: auth.getHeaders() });
        const data = await res.json();
        if (!res.ok) return;
        document.getElementById('statProducts').textContent = data.productCount || allProducts.length;
        document.getElementById('statCustomers').textContent = data.customerCount || 0;
        document.getElementById('statRevenue').textContent = fmt(data.revenue);
        document.getElementById('statProfit').textContent = fmt(data.profit);
    } catch (e) {
        console.error('Stats error:', e);
    }
}

async function loadProfileForCheckout() {
    if (!auth.isLoggedIn()) return;
    const user = auth.getUser();
    try {
        const res = await fetch(`${API_URL}/customers/${user.id}`, { headers: auth.getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('recipientName').value = data.name || '';
        document.getElementById('guestEmail').value = data.email || '';
        document.getElementById('recipientPhone').value = data.phone || '';
        if (!getSavedShoppingAddress()) document.getElementById('shippingAddressDetail').value = data.address || '';
    } catch (e) { }
}

async function loadCustomers() {
    if (!auth.isAdmin()) return;
    try {
        const res = await fetch(`${API_URL}/customers`, { headers: auth.getHeaders() });
        if (!res.ok) return;
        const customers = await res.json();
        const select = document.getElementById('customerSelect');
        select.innerHTML = '<option value="">-- Chọn khách hàng --</option>' +
            customers.map(c => `<option value="${c._id}" data-name="${escapeHTML(c.name)}" data-phone="${escapeHTML(c.phone || '')}" data-address="${escapeHTML(c.address || '')}">${escapeHTML(c.name)} - ${escapeHTML(c.phone || '')}</option>`).join('');
        select.addEventListener('change', () => {
            const opt = select.options[select.selectedIndex];
            if (!opt) return;
            document.getElementById('recipientName').value = opt.dataset.name || '';
            document.getElementById('recipientPhone').value = opt.dataset.phone || '';
            document.getElementById('checkoutProvince').value = '';
            populateCheckoutWards('');
            document.getElementById('shippingAddressDetail').value = opt.dataset.address || '';
            updateCheckoutAddress({ persist: false });
        });
    } catch (e) { }
}

function checkoutAmount() {
    const cart = getCart();
    const subtotal = cart.reduce((total, item) => {
        const product = allProducts.find(candidate => String(candidate._id) === String(item.productId));
        return total + Number(product?.price || 0) * Number(item.quantity || 0);
    }, 0);
    const discount = Math.min(Number(appliedCoupon?.discountAmount) || 0, subtotal);
    return Math.max(subtotal - discount, 0) + Number(currentShippingQuote?.fee || 0);
}

async function refreshShippingQuote(address = checkoutAddressValue()) {
    const output = document.getElementById('shippingFeeDisplay');
    const hint = document.getElementById('shippingFeeHint');
    const feeInput = document.getElementById('shippingFee');
    const quoteBox = output?.closest('.shipping-quote');
    if (!output || !hint || !feeInput) return;

    const shippingAddress = address?.fullAddress || document.getElementById('shippingAddress')?.value.trim() || '';
    if (!address?.provinceCode) {
        currentShippingQuote = null;
        feeInput.value = 0;
        output.textContent = 'Chưa có báo giá';
        hint.textContent = 'Chọn Tỉnh/Thành để hệ thống đề xuất phí giao hàng.';
        if (quoteBox) quoteBox.dataset.state = 'default';
        renderCart();
        return;
    }
    if (quoteBox) quoteBox.dataset.state = 'loading';
    output.textContent = 'Đang tính phí…';
    hint.textContent = 'Đang xác định khu vực giao hàng.';
    try {
        const response = await fetch(`${API_URL}/shipping/quote`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify({
                provinceCode: address?.provinceCode || '',
                wardCode: address?.wardCode || '',
                address: shippingAddress
            })
        });
        const quote = await response.json();
        if (!response.ok) throw new Error(quote.message || 'Không tính được phí vận chuyển.');
        currentShippingQuote = quote;
        feeInput.value = quote.fee;
        output.textContent = fmt(quote.fee);
        hint.textContent = `${quote.serviceLabel} · ${quote.zoneLabel}. ${quote.message}`;
        if (quoteBox) quoteBox.dataset.state = 'success';
        renderCart();
    } catch (error) {
        currentShippingQuote = null;
        feeInput.value = 0;
        output.textContent = 'Chưa có báo giá';
        hint.textContent = error.message;
        if (quoteBox) quoteBox.dataset.state = 'error';
        renderCart();
    }
}

function renderSelectedInstallmentPlan() {
    const selected = document.querySelector('input[name="installmentTerm"]:checked');
    const plan = currentInstallmentQuote?.plans?.find(item => item.term === Number(selected?.value));
    document.getElementById('selectedDownPayment').textContent = plan ? fmt(plan.downPayment) : '—';
    document.getElementById('selectedMonthlyPayment').textContent = plan ? fmt(plan.monthlyPayment) : '—';
}

function renderInstallmentQuote(quote) {
    currentInstallmentQuote = quote;
    const rows = document.getElementById('installmentPlanRows');
    const previousTerm = Number(document.querySelector('input[name="installmentTerm"]:checked')?.value);
    rows.innerHTML = quote.plans.map((plan, index) => `
        <tr>
          <td data-label="Kỳ hạn">
            <label class="installment-plan-label">
              <input type="radio" name="installmentTerm" value="${plan.term}" ${plan.term === previousTerm || (!previousTerm && index === 0) ? 'checked' : ''}>
              <span>${plan.term} tháng</span>
            </label>
          </td>
          <td data-label="Trả trước">${fmt(plan.downPayment)}</td>
          <td data-label="Mỗi tháng">${fmt(plan.monthlyPayment)}</td>
          <td data-label="Tổng lãi">${fmt(plan.totalInterest)}</td>
        </tr>`).join('');
    document.getElementById('installmentCaption').textContent =
        `${quote.policy.policyName}: trả trước ${quote.policy.downPaymentPercent}%, lãi suất năm ${quote.policy.annualRatePercent}%.`;
    document.getElementById('installmentLoading').textContent = '';
    document.getElementById('installmentError').textContent = '';
    rows.querySelectorAll('input[name="installmentTerm"]').forEach(input => {
        input.addEventListener('change', renderSelectedInstallmentPlan);
    });
    renderSelectedInstallmentPlan();
}

async function refreshInstallmentQuote() {
    const options = document.getElementById('installmentOptions');
    if (!options || options.hidden) return;
    const amount = checkoutAmount();
    if (!amount || !currentShippingQuote) {
        document.getElementById('installmentPlanRows').innerHTML = '';
        document.getElementById('installmentError').textContent = 'Chọn địa chỉ giao hàng để tính đủ khoản trả trước và số tiền mỗi tháng.';
        return;
    }
    document.getElementById('installmentLoading').textContent = 'Đang tính phương án trả góp…';
    try {
        const response = await fetch(`${API_URL}/payments/installment/quote`, {
            method: 'POST', headers: auth.getHeaders(), body: JSON.stringify({ amount })
        });
        const quote = await response.json();
        if (!response.ok) throw new Error(quote.message || 'Không tính được phương án trả góp.');
        renderInstallmentQuote(quote);
    } catch (error) {
        currentInstallmentQuote = null;
        document.getElementById('installmentLoading').textContent = '';
        document.getElementById('installmentError').textContent = error.message;
    }
}

function scheduleInstallmentQuote() {
    window.clearTimeout(installmentQuoteTimer);
    installmentQuoteTimer = window.setTimeout(refreshInstallmentQuote, 180);
}

function updatePaymentInfo() {
    const method = document.getElementById('paymentMethod').value;
    const bank = document.getElementById('bankTransferInfo');
    bank.style.display = method === 'bank_transfer' ? 'block' : 'none';
    document.getElementById('installmentOptions').hidden = method !== 'installment';
    if (method === 'installment') scheduleInstallmentQuote();
    renderPaymentMethodHint();
}

async function createOrder() {
    const cart = getCart();
    if (!cart.length) return showToast('Giỏ hàng trống!', 'error');

    const checkoutAddress = checkoutAddressValue();
    const payload = {
        products: cart.map(item => ({ product: item.productId, quantity: item.quantity })),
        paymentMethod: document.getElementById('paymentMethod').value,
        shippingProvinceCode: checkoutAddress.provinceCode,
        shippingProvince: checkoutAddress.province,
        shippingWardCode: checkoutAddress.wardCode,
        shippingWard: checkoutAddress.ward,
        recipientName: document.getElementById('recipientName').value.trim(),
        recipientPhone: document.getElementById('recipientPhone').value.trim(),
        shippingAddress: checkoutAddress.fullAddress,
        guestEmail: document.getElementById('guestEmail').value.trim(),
        installmentTerm: Number(document.querySelector('input[name="installmentTerm"]:checked')?.value || 0),
        note: document.getElementById('orderNote').value.trim(),
        couponCode: appliedCoupon?.code || document.getElementById('couponCode')?.value.trim() || ''
    };
    if (auth.isAdmin()) payload.customer = document.getElementById('customerSelect')?.value || null;
    const selectedProvider = paymentProviders[payload.paymentMethod];
    if (selectedProvider && selectedProvider.configured === false) {
        return showToast(selectedProvider.message || 'Cổng thanh toán này chưa sẵn sàng.', 'error');
    }

    if (!payload.recipientName || !payload.recipientPhone) {
        return showToast('Vui lòng nhập đầy đủ thông tin nhận hàng!', 'error');
    }
    if (!checkoutAddress.provinceCode || !checkoutAddress.wardCode || !checkoutAddress.detail) {
        const missingFields = [
            ['checkoutProvince', checkoutAddress.provinceCode],
            ['checkoutWard', checkoutAddress.wardCode],
            ['shippingAddressDetail', checkoutAddress.detail]
        ];
        missingFields.forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (field && !value) field.setAttribute('aria-invalid', 'true');
        });
        setCheckoutAddressState('error', 'Địa chỉ chưa đủ. Chọn Tỉnh/Thành, Phường/Xã và ghi rõ số nhà hoặc tên đường.');
        return showToast('Vui lòng nhập đầy đủ địa chỉ giao hàng.', 'error');
    }
    if (!currentShippingQuote) {
        return showToast('Vui lòng chọn Tỉnh/Thành để hệ thống tính phí vận chuyển.', 'error');
    }
    if (payload.paymentMethod === 'installment' && !payload.installmentTerm) {
        return showToast('Vui lòng chọn kỳ hạn trả góp.', 'error');
    }
    if (!auth.isLoggedIn() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.guestEmail)) {
        return showToast('Vui lòng nhập email hợp lệ để nhận xác nhận đơn hàng!', 'error');
    }
    if (!auth.isLoggedIn() && !['bank_transfer', 'vnpay', 'momo'].includes(payload.paymentMethod)) {
        return showToast('Khách chưa đăng nhập chỉ dùng được chuyển khoản thủ công, VNPay hoặc MoMo.', 'error');
    }

    const btn = document.getElementById('checkoutBtn');
    btn.disabled = true;
    btn.textContent = 'Đang tạo đơn...';

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi đặt hàng');

        setCart([]);
        appliedCoupon = null;
        if (data.guestAccessToken && data.order?._id) {
            localStorage.setItem(`guestOrderToken:${data.order._id}`, data.guestAccessToken);
        }
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return;
        }
        if (data.paymentUrl) {
            window.location.href = data.paymentUrl;
            return;
        }

        const message = payload.paymentMethod === 'bank_transfer'
            ? 'Đã tạo đơn. Vui lòng chuyển khoản đúng nội dung và chờ cửa hàng xác nhận!'
            : 'Đặt hàng thành công!';
        showToast(message);
        await loadProducts();
        if (!auth.isAdmin()) setTimeout(() => window.location.href = 'pages/account/orders.html', 900);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Đặt hàng';
    }
}

function subscribeNewsletter() {
    const email = document.getElementById('newsletterEmail')?.value || '';
    if (!email.includes('@')) return alert('Vui lòng nhập email hợp lệ!');
    alert('Đăng ký nhận ưu đãi thành công!');
    document.getElementById('newsletterEmail').value = '';
}

document.addEventListener('DOMContentLoaded', async () => {
    const pageParams = new URLSearchParams(window.location.search);
    const initialSearch = pageParams.get('search') || '';
    if (initialSearch) {
        const catalogSearch = document.getElementById('searchInput');
        const headerSearch = document.getElementById('headerSearchInput');
        if (catalogSearch) catalogSearch.value = initialSearch;
        if (headerSearch) headerSearch.value = initialSearch;
    }
    setupStorefrontHeader();
    if (pageParams.get('openAddress') === '1') {
        document.getElementById('headerLocationToggle')?.click();
    }
    document.getElementById('bottomNavCategoryBtn')?.addEventListener('click', () => {
        document.getElementById('storefrontCategories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('bottomNavStoreBtn')?.addEventListener('click', () => {
        document.getElementById('headerLocationToggle')?.click();
    });
    setupPromoCarousel();
    document.querySelectorAll('[data-product-filter]').forEach(el => {
        el.addEventListener('input', renderProducts);
        el.addEventListener('change', renderProducts);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCartDrawer();
    });
    document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentInfo);
    window.addEventListener('shopping-address-change', async () => {
        await applySavedAddressToCheckout();
        refreshShippingQuote(checkoutAddressValue());
    });
    window.addEventListener('popstate', () => {
        activeCategory = new URLSearchParams(window.location.search).get('category') || 'all';
        updateHeaderCategoryState();
        renderProducts();
    });

    document.getElementById('customerSelectionGroup').style.display = auth.isAdmin() ? 'block' : 'none';
    if (!auth.isAdmin()) {
        document.getElementById('adminStats')?.classList.add('hide-admin-stats');
    }

    await loadWishlist();
    await loadPaymentProviders();
    await loadProductMeta();
    await loadProducts();
    await loadRecommendations();
    await loadProfileForCheckout();
    await setupCheckoutAddressSelector();
    await refreshShippingQuote(checkoutAddressValue());
    await loadCustomers();
    updatePaymentInfo();
    if (pageParams.get('category') || window.location.hash === '#catalogStart') {
        setTimeout(() => {
            document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    }
    if (pageParams.get('openCart') === '1' || (auth.isLoggedIn() && localStorage.getItem('checkoutAfterLogin') === 'true')) {
        localStorage.removeItem('checkoutAfterLogin');
        openCartDrawer();
    }
});
