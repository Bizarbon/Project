let allProducts = [];
let activeCategory = new URLSearchParams(window.location.search).get('category') || 'all';
let wishlistIds = new Set();
let paymentProviders = {};
let productMeta = { categories: [], brands: [], tags: [] };
let appliedCoupon = null;
let compareProducts = new Set(JSON.parse(localStorage.getItem('compareProducts') || '[]').map(String));
const MAX_COMPARE_PRODUCTS = 4;

const categoryLabels = {
    'Điện thoại': 'Điện thoại',
    Laptop: 'Laptop',
    Tablet: 'Tablet',
    'Tai nghe': 'Tai nghe',
    'Đồng hồ thông minh': 'Đồng hồ thông minh',
    'Phụ kiện': 'Phụ kiện'
};

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

    const selected = paymentProviders[select.value];
    if (!auth.isLoggedIn() && ['cod', 'installment'].includes(select.value)) {
        hint.textContent = 'Phương thức này chỉ dành cho khách hàng đã đăng nhập.';
        return;
    }
    if (selected && selected.configured === false) {
        hint.textContent = selected.message || `${selected.label || select.value} chua san sang.`;
        return;
    }

    const unavailable = ['vnpay', 'momo']
        .map(key => paymentProviders[key])
        .filter(provider => provider && provider.configured === false)
        .map(provider => provider.label);

    hint.textContent = unavailable.length
        ? `${unavailable.join(', ')} tam an vi backend chua co sandbox key.`
        : '';
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
            option.textContent = `${option.dataset.baseLabel} (cần đăng nhập)`;
        } else if (provider && provider.configured === false) {
            option.disabled = true;
            option.textContent = `${option.dataset.baseLabel} (chưa cấu hình)`;
        } else {
            option.disabled = false;
            option.textContent = option.dataset.baseLabel;
        }
    });

    const selected = select.options[select.selectedIndex];
    if (!selected || selected.disabled) {
        const fallback = [...select.options].find(option => !option.disabled);
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
        const res = await fetch(`${API_URL}/customers/me/wishlist`, {
            method: 'PUT',
            headers: auth.getHeaders(),
            body: JSON.stringify({ productId, action: 'toggle' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Không cập nhật được yêu thích');
        wishlistIds = new Set(data.map(item => Number(item._id || item)));
    } else {
        if (wishlistIds.has(productId)) wishlistIds.delete(productId);
        else wishlistIds.add(productId);
        localStorage.setItem('wishlist', JSON.stringify([...wishlistIds]));
    }
    renderProducts();
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

    if (activeCategory !== 'all') products = products.filter(p => p.category === activeCategory);
    if (filters.brand !== 'all') products = products.filter(p => (p.brand || '') === filters.brand);
    if (filters.search) {
        products = products.filter(p =>
            `${p.name} ${p.description || ''} ${p.category || ''} ${p.brand || ''} ${p.sku || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(filters.search)
        );
    }
    if (filters.minPrice) products = products.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) products = products.filter(p => p.price <= filters.maxPrice);
    if (filters.inStock) products = products.filter(p => p.stock > 0);

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
    const brands = productMeta.brands?.length
        ? productMeta.brands
        : [...new Set(allProducts.map(p => p.brand).filter(Boolean))];
    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Tất cả thương hiệu</option>' +
        brands.map(brand => `<option value="${escapeHTML(brand)}">${escapeHTML(brand)}</option>`).join('');
    select.value = brands.includes(current) ? current : 'all';
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        allProducts = await res.json();
        renderBrandFilter();
        renderCategoryNav();
        renderProducts();
        renderCart();
        if (auth.isAdmin()) loadStats();
    } catch (err) {
        console.error('Products error:', err);
        showToast('Lỗi kết nối server', 'error');
    }
}

function renderCategoryNav() {
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
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
    updateHeaderCategoryState();
}

function updateHeaderCategoryState() {
    document.querySelectorAll('[data-header-category]').forEach(button => {
        const isActive = button.dataset.headerCategory === activeCategory;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

function setCategory(category, options = {}) {
    activeCategory = category;
    const url = new URL(window.location.href);
    if (category === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', category);
    window.history.replaceState({}, '', url);
    renderCategoryNav();
    renderProducts();

    if (options.scroll !== false) {
        document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

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

    document.querySelectorAll('[data-header-category]').forEach(button => {
        button.addEventListener('click', () => setCategory(button.dataset.headerCategory));
    });
    updateHeaderCategoryState();

    setupAddressSelector();
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

    loadDeliveryAreas().catch(() => {});
}

function selectedCompareProducts() {
    return [...compareProducts]
        .map(id => allProducts.find(product => String(product._id) === String(id)))
        .filter(Boolean);
}

function saveCompareProducts() {
    localStorage.setItem('compareProducts', JSON.stringify([...compareProducts]));
}

function toggleCompare(id) {
    const productId = String(id);
    if (compareProducts.has(productId)) {
        compareProducts.delete(productId);
    } else {
        if (compareProducts.size >= MAX_COMPARE_PRODUCTS) {
            showToast(`Chỉ so sánh tối đa ${MAX_COMPARE_PRODUCTS} sản phẩm cùng lúc.`, 'error');
            return;
        }
        compareProducts.add(productId);
    }
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
}

function clearCompare() {
    compareProducts.clear();
    saveCompareProducts();
    renderProducts();
    renderCompareBar();
    closeCompareModal();
}

function ensureCompareUI() {
    if (!document.getElementById('compareBar')) {
        document.body.insertAdjacentHTML('beforeend', `
            <aside class="compare-bar" id="compareBar" aria-live="polite"></aside>
            <aside class="compare-modal" id="compareModal" role="dialog" aria-modal="true" aria-labelledby="compareTitle">
                <section class="compare-dialog">
                    <header class="compare-header">
                        <h2 id="compareTitle">So sánh sản phẩm</h2>
                        <button type="button" class="compare-close btn-secondary" onclick="closeCompareModal()" aria-label="Đóng">×</button>
                    </header>
                    <div class="compare-table-wrap" id="compareTableWrap"></div>
                </section>
            </aside>
        `);
        document.getElementById('compareModal').addEventListener('click', event => {
            if (event.target.id === 'compareModal') closeCompareModal();
        });
    }
}

function renderCompareBar() {
    ensureCompareUI();
    const bar = document.getElementById('compareBar');
    const selected = selectedCompareProducts();
    if (!selected.length) {
        bar.classList.remove('show');
        bar.innerHTML = '';
        return;
    }

    bar.classList.add('show');
    bar.innerHTML = `
        <div class="compare-bar-inner">
            <div>
                <strong>Đã chọn ${selected.length}/${MAX_COMPARE_PRODUCTS}</strong>
                <div class="compare-selected">
                    ${selected.map(product => `<span class="compare-chip" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</span>`).join('')}
                </div>
            </div>
            <button type="button" class="btn-primary" ${selected.length < 2 ? 'disabled' : ''} onclick="openCompareModal()">So sánh</button>
            <button type="button" class="btn-secondary" onclick="clearCompare()">Xóa chọn</button>
        </div>
    `;
}

function compareValue(product, key) {
    const specs = product.specs || {};
    const values = {
        brand: product.brand || 'Chưa cập nhật',
        category: product.category || 'Chưa phân loại',
        price: fmt(product.price),
        compareAtPrice: product.compareAtPrice > product.price ? fmt(product.compareAtPrice) : 'Không',
        stock: product.stock > 0 ? `${product.stock} sản phẩm` : 'Hết hàng',
        warranty: product.warranty || 'Chưa cập nhật',
        rating: product.rating ? `${Number(product.rating).toFixed(1)}/5 (${product.reviewCount || 0} đánh giá)` : 'Chưa có',
        soldCount: product.soldCount ? `${product.soldCount} đã bán` : 'Chưa có',
        cpu: specs.cpu || 'Chưa cập nhật',
        ram: specs.ram || 'Chưa cập nhật',
        storage: specs.storage || 'Chưa cập nhật',
        screen: specs.screen || 'Chưa cập nhật',
        camera: specs.camera || 'Chưa cập nhật',
        battery: specs.battery || 'Chưa cập nhật',
        os: specs.os || 'Chưa cập nhật',
        gpu: specs.gpu || 'Chưa cập nhật'
    };
    return values[key] || 'Chưa cập nhật';
}

function openCompareModal() {
    ensureCompareUI();
    const selected = selectedCompareProducts();
    if (selected.length < 2) {
        showToast('Vui lòng chọn ít nhất 2 sản phẩm để so sánh.', 'error');
        return;
    }

    const rows = [
        ['Thương hiệu', 'brand'],
        ['Danh mục', 'category'],
        ['Giá bán', 'price'],
        ['Giá niêm yết', 'compareAtPrice'],
        ['Tồn kho', 'stock'],
        ['Bảo hành', 'warranty'],
        ['Đánh giá', 'rating'],
        ['Đã bán', 'soldCount'],
        ['CPU / Chip', 'cpu'],
        ['RAM', 'ram'],
        ['Bộ nhớ', 'storage'],
        ['Màn hình', 'screen'],
        ['Camera', 'camera'],
        ['Pin', 'battery'],
        ['Hệ điều hành', 'os'],
        ['GPU', 'gpu']
    ];

    document.getElementById('compareTableWrap').innerHTML = `
        <table class="compare-table">
            <thead>
                <tr>
                    <th>Tiêu chí</th>
                    ${selected.map(product => `
                        <th>
                            <div class="compare-product-head">
                                <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" onerror="this.src='https://via.placeholder.com/320x220?text=No+Image'">
                                <strong>${escapeHTML(product.name)}</strong>
                            </div>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(([label, key]) => `
                    <tr>
                        <td><strong>${label}</strong></td>
                        ${selected.map(product => `<td>${escapeHTML(compareValue(product, key))}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('compareModal').classList.add('show');
}

function closeCompareModal() {
    document.getElementById('compareModal')?.classList.remove('show');
}

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

    sections.innerHTML = Object.entries(grouped).map(([category, items]) => `
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

function productCard(p) {
    const liked = wishlistIds.has(Number(p._id));
    const compared = compareProducts.has(String(p._id));
    const stockLabel = p.stock <= 0 ? 'Hết hàng' : `Kho: ${p.stock}`;
    const specs = p.specs || {};
    const specLine = [specs.cpu, specs.ram, specs.storage, specs.screen].filter(Boolean).slice(0, 3).join(' - ');
    const discount = p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
    return `
        <article class="product-card fade-in" onclick="window.location.href='pages/catalog/product.html?id=${p._id}'" title="Xem chi tiết ${escapeHTML(p.name)}">
            <button class="wishlist-btn ${liked ? 'active' : ''}" title="Yêu thích" onclick="event.stopPropagation(); toggleWishlist('${p._id}').catch(err => showToast(err.message, 'error'))">${liked ? '♥' : '♡'}</button>
            ${p.featured ? '<span class="product-ribbon">Nổi bật</span>' : ''}
            ${discount ? `<span class="discount-ribbon">-${discount}%</span>` : ''}
            <a href="pages/catalog/product.html?id=${p._id}" class="product-link" onclick="event.stopPropagation()">
                <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" onerror="this.src='https://via.placeholder.com/400x220?text=No+Image'">
            </a>
            <section class="card-body">
                <span class="category-badge">${escapeHTML(p.category)}</span>
                <div class="product-brand">${escapeHTML(p.brand || 'TechStore Select')} ${p.sku ? `<span>${escapeHTML(p.sku)}</span>` : ''}</div>
                <h3 title="${escapeHTML(p.name)}"><a href="pages/catalog/product.html?id=${p._id}" onclick="event.stopPropagation()">${escapeHTML(p.name)}</a></h3>
                <p class="product-desc">${escapeHTML(p.description || '')}</p>
                ${p.recommendation?.reason ? `<p class="recommendation-reason">${escapeHTML(p.recommendation.reason)}</p>` : ''}
                ${specLine ? `<p class="product-spec-line">${escapeHTML(specLine)}</p>` : ''}
                ${p.rating ? `<p class="product-rating">★ ${Number(p.rating).toFixed(1)} <span>(${p.reviewCount || 0})</span>${p.soldCount ? ` <span>- đã bán ${p.soldCount}</span>` : ''}</p>` : ''}
                <p class="price">${fmt(p.price)}</p>
                ${p.compareAtPrice > p.price ? `<p class="compare-price">${fmt(p.compareAtPrice)}</p>` : ''}
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
    const count = cartItemCount();
    if (headerBadge) {
        headerBadge.textContent = count;
        headerBadge.hidden = count < 1;
    }
}

function openCartDrawer() {
    document.body.classList.add('cart-open');
    const drawer = document.getElementById('cartDrawer');
    drawer?.setAttribute('aria-hidden', 'false');
    drawer?.removeAttribute('inert');
    document.getElementById('cartOverlay')?.setAttribute('aria-hidden', 'false');
}

function closeCartDrawer() {
    document.body.classList.remove('cart-open');
    const drawer = document.getElementById('cartDrawer');
    drawer?.setAttribute('aria-hidden', 'true');
    drawer?.setAttribute('inert', '');
    document.getElementById('cartOverlay')?.setAttribute('aria-hidden', 'true');
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
    openCartDrawer();
    showToast('Đã thêm vào giỏ hàng!');
}

function changeQty(id, delta) {
    let cart = getCart();
    const item = cart.find(i => String(i.productId) === String(id));
    const product = allProducts.find(p => String(p._id) === String(id));
    if (!item || !product) return;
    item.quantity += delta;
    if (item.quantity > product.stock) item.quantity = product.stock;
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
        renderCart();
    } catch (error) {
        appliedCoupon = null;
        if (hint) hint.textContent = error.message;
        renderCart();
    }
}

function renderCart() {
    const cartDiv = document.getElementById('cartList');
    const cartTotal = document.getElementById('cartTotal');
    updateCartBadge();
    if (!cartDiv) return;

    const cart = getCart().map(item => {
        const product = allProducts.find(p => String(p._id) === String(item.productId));
        if (!product) return null;
        const quantity = Math.min(Number(item.quantity) || 1, product.stock);
        return { ...item, quantity, product };
    }).filter(Boolean);
    setCart(cart.map(item => ({ productId: item.productId, quantity: item.quantity })));

    if (!cart.length) {
        cartDiv.innerHTML = '<p class="cart-empty">Giỏ hàng trống</p>';
        if (cartTotal) cartTotal.style.display = 'none';
        document.getElementById('checkoutPanel').style.display = 'none';
        document.getElementById('guestCheckoutGate').style.display = 'none';
        return;
    }

    let subtotal = 0;
    cartDiv.innerHTML = cart.map(item => {
        subtotal += item.product.price * item.quantity;
        return `
            <article class="cart-item">
                <div>
                    <div class="cart-item-name">${escapeHTML(item.product.name)}</div>
                    <div class="cart-item-price">${fmt(item.product.price)} - ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button onclick="changeQty('${item.productId}', -1)">-</button>
                    <span class="qty">${item.quantity}</span>
                    <button onclick="changeQty('${item.productId}', 1)">+</button>
                    <button class="btn-remove" onclick="removeItem('${item.productId}')">Xóa</button>
                </div>
            </article>
        `;
    }).join('');

    const shippingFee = Number(document.getElementById('shippingFee')?.value || 0);
    const discountAmount = Math.min(Number(appliedCoupon?.discountAmount) || 0, subtotal);
    document.getElementById('cartSubtotal').textContent = fmt(subtotal);
    document.getElementById('cartShippingPreview').textContent = fmt(shippingFee);
    document.getElementById('total').textContent = fmt(subtotal - discountAmount + shippingFee);
    const discountRow = document.getElementById('cartDiscountRow');
    if (discountRow) {
        discountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
        document.getElementById('cartDiscount').textContent = `-${fmt(discountAmount)}`;
    }
    cartTotal.style.display = 'block';
    document.getElementById('checkoutPanel').style.display = 'block';
    document.getElementById('guestCheckoutGate').style.display = auth.isLoggedIn() ? 'none' : 'grid';
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
    } catch (e) {}
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
    } catch (e) {}
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
    if (pageParams.get('openCart') === '1' || (auth.isLoggedIn() && localStorage.getItem('checkoutAfterLogin') === 'true')) {
        localStorage.removeItem('checkoutAfterLogin');
        openCartDrawer();
    }
});
