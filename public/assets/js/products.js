const EP = API_URL + '/products';
let adminProducts = [];
let currentCategory = 'all';

const CATEGORY_META = {
    'all': { name: 'Tất cả', icon: '📁' },
    'Điện thoại': { name: 'Điện thoại', icon: '📱' },
    'Laptop': { name: 'Laptop', icon: '💻' },
    'Tablet': { name: 'Tablet', icon: '📟' },
    'Tai nghe': { name: 'Tai nghe', icon: '🎧' },
    'Đồng hồ thông minh': { name: 'Đồng hồ thông minh', icon: '⌚' },
    'Phụ kiện': { name: 'Phụ kiện', icon: '🔌' },
    'Máy chơi game': { name: 'Máy chơi game', icon: '🎮' }
};

function getCategoryIcon(cat) {
    return CATEGORY_META[cat]?.icon || '🏷️';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3200);
    }, 100);
}

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function splitRatingReview(value) {
    const [rating, reviews] = String(value || '').split('/').map(item => Number(item.trim()));
    return {
        rating: Number.isFinite(rating) ? rating : 0,
        reviewCount: Number.isFinite(reviews) ? reviews : 0
    };
}

function specPayload() {
    return {
        cpu: document.getElementById('specCpu')?.value.trim() || '',
        ram: document.getElementById('specRam')?.value.trim() || '',
        storage: document.getElementById('specStorage')?.value.trim() || '',
        screen: document.getElementById('specScreen')?.value.trim() || '',
        camera: document.getElementById('specCamera')?.value.trim() || '',
        battery: document.getElementById('specBattery')?.value.trim() || '',
        os: document.getElementById('specOs')?.value.trim() || '',
        gpu: document.getElementById('specGpu')?.value.trim() || ''
    };
}

async function loadSuppliersForSelect() {
    try {
        const res = await fetch(`${API_URL}/suppliers`, { headers: auth.getHeaders() });
        const suppliers = await res.json();
        const select = document.getElementById('supplier');
        if (select && Array.isArray(suppliers)) {
            select.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>' +
                suppliers.map(s => `<option value="${s._id}">${escapeHTML(s.name)}</option>`).join('');
        }
    } catch (e) {
        console.error('Error loading suppliers', e);
    }
}

async function loadProducts(silent = false) {
    try {
        const response = await fetch(EP, { headers: auth.getHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Lỗi tải sản phẩm');
        adminProducts = Array.isArray(data) ? data : [];
        renderCategoryTabs();
        renderProductTable();
    } catch (error) {
        console.error('Error loading products:', error);
        if (!silent) showToast('Lỗi tải danh sách sản phẩm!', 'error');
    }
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('adminCategoryTabs');
    if (!tabsContainer) return;

    // Aggregate counts
    const counts = {};
    counts['all'] = adminProducts.length;

    adminProducts.forEach(p => {
        const cat = p.category || 'Khác';
        counts[cat] = (counts[cat] || 0) + 1;
    });

    // Known priority order, then any other dynamic categories
    const priority = ['all', 'Điện thoại', 'Laptop', 'Tablet', 'Tai nghe', 'Đồng hồ thông minh', 'Phụ kiện', 'Máy chơi game'];
    const otherCats = Object.keys(counts).filter(c => !priority.includes(c)).sort((a, b) => a.localeCompare(b, 'vi'));
    const allTabs = [...priority.filter(c => c === 'all' || counts[c] !== undefined), ...otherCats];

    tabsContainer.innerHTML = allTabs.map(cat => {
        const meta = CATEGORY_META[cat] || { name: cat, icon: '🏷️' };
        const count = counts[cat] || 0;
        const isActive = currentCategory === cat;
        return `
            <button type="button" 
                    role="tab" 
                    class="admin-cat-tab ${isActive ? 'active' : ''}" 
                    aria-selected="${isActive}" 
                    title="Lọc sản phẩm danh mục: ${escapeHTML(meta.name)}"
                    onclick="setCategoryFilter('${escapeHTML(cat)}')">
                <span class="cat-tab-icon" aria-hidden="true">${meta.icon}</span>
                <span class="cat-tab-name">${escapeHTML(meta.name)}</span>
                <span class="cat-tab-badge">${count}</span>
            </button>
        `;
    }).join('');

    // Synchronize adminCategoryFilter select
    const select = document.getElementById('adminCategoryFilter');
    if (select) {
        select.innerHTML = '<option value="">📁 Tất cả danh mục (' + adminProducts.length + ')</option>' +
            allTabs.filter(c => c !== 'all').map(cat => {
                const icon = getCategoryIcon(cat);
                const count = counts[cat] || 0;
                return `<option value="${escapeHTML(cat)}" ${currentCategory === cat ? 'selected' : ''}>${icon} ${escapeHTML(cat)} (${count})</option>`;
            }).join('');
        if (currentCategory !== 'all') {
            select.value = currentCategory;
        }
    }

    renderCategorySummaryBar();
}

function renderCategorySummaryBar() {
    const summaryContainer = document.getElementById('adminCategorySummaryBar');
    const quickStatsContainer = document.getElementById('adminHubQuickStats');

    const filtered = adminFilteredProducts();
    const inStock = filtered.filter(p => p.stock > (p.minStock ?? 5)).length;
    const lowStock = filtered.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5)).length;
    const outStock = filtered.filter(p => p.stock === 0).length;

    const catName = currentCategory === 'all' ? 'Tất cả danh mục' : currentCategory;
    const catIcon = currentCategory === 'all' ? '📁' : getCategoryIcon(currentCategory);

    // Update Quick Stats in Hub Header
    if (quickStatsContainer) {
        quickStatsContainer.innerHTML = `
            <div class="hub-stat-badge stat-badge-total" title="Tổng số lượng sản phẩm trong hệ thống">
                <span class="hub-stat-label">Tổng sp:</span>
                <strong class="hub-stat-val">${adminProducts.length}</strong>
            </div>
            <div class="hub-stat-badge stat-badge-filtered" title="Số lượng sản phẩm sau khi lọc">
                <span class="hub-stat-label">Hiển thị:</span>
                <strong class="hub-stat-val">${filtered.length}</strong>
            </div>
            <div class="hub-stat-badge stat-badge-instock" title="Sản phẩm sẵn sàng bán">
                <span class="hub-stat-dot dot-green" aria-hidden="true"></span>
                <span class="hub-stat-label">Còn hàng:</span>
                <strong class="hub-stat-val">${inStock}</strong>
            </div>
            ${lowStock > 0 ? `
            <div class="hub-stat-badge stat-badge-low" title="Sản phẩm sắp hết hàng (tồn ≤ 5)">
                <span class="hub-stat-dot dot-yellow" aria-hidden="true"></span>
                <span class="hub-stat-label">Sắp hết:</span>
                <strong class="hub-stat-val">${lowStock}</strong>
            </div>` : ''}
            ${outStock > 0 ? `
            <div class="hub-stat-badge stat-badge-out" title="Sản phẩm đã hết hàng">
                <span class="hub-stat-dot dot-red" aria-hidden="true"></span>
                <span class="hub-stat-label">Hết hàng:</span>
                <strong class="hub-stat-val">${outStock}</strong>
            </div>` : ''}
        `;
    }

    if (!summaryContainer) return;

    const searchVal = document.getElementById('adminProductSearch')?.value?.trim();
    const stockVal = document.getElementById('adminStockFilter')?.value;
    const sortVal = document.getElementById('adminSortProducts')?.value;
    const hasCustomFilter = (currentCategory !== 'all') || Boolean(searchVal) || Boolean(stockVal) || Boolean(sortVal);

    summaryContainer.innerHTML = `
        <div class="admin-cat-summary-left">
            <span class="cat-summary-icon" aria-hidden="true">${catIcon}</span>
            <span>Đang lọc: <strong>${escapeHTML(catName)}</strong> &bull; Hiển thị <strong>${filtered.length}</strong> / ${adminProducts.length} sản phẩm</span>
        </div>
        <div class="admin-cat-summary-right">
            <span class="cat-status-chip chip-in-stock" title="Sản phẩm còn hàng tốt">✅ Còn hàng: <strong>${inStock}</strong></span>
            ${lowStock > 0 ? `<span class="cat-status-chip chip-low-stock" title="Sản phẩm sắp hết hàng">⚠️ Sắp hết: <strong>${lowStock}</strong></span>` : ''}
            ${outStock > 0 ? `<span class="cat-status-chip chip-out-stock" title="Sản phẩm đã hết hàng">❌ Hết hàng: <strong>${outStock}</strong></span>` : ''}
            ${hasCustomFilter ? `<button type="button" class="btn-clear-active-filters" onclick="resetFilters()" title="Xóa toàn bộ bộ lọc và về mặc định">✕ Xóa bộ lọc</button>` : ''}
        </div>
    `;
}

function setCategoryFilter(cat) {
    currentCategory = cat || 'all';
    const select = document.getElementById('adminCategoryFilter');
    if (select) select.value = currentCategory === 'all' ? '' : currentCategory;
    renderCategoryTabs();
    renderProductTable();
}

function resetFilters() {
    const searchInput = document.getElementById('adminProductSearch');
    const stockSelect = document.getElementById('adminStockFilter');
    const sortSelect = document.getElementById('adminSortProducts');
    const catSelect = document.getElementById('adminCategoryFilter');

    if (searchInput) searchInput.value = '';
    if (stockSelect) stockSelect.value = '';
    if (sortSelect) sortSelect.value = '';
    if (catSelect) catSelect.value = '';

    currentCategory = 'all';
    renderCategoryTabs();
    renderProductTable();
}

function adminFilteredProducts() {
    const search = (document.getElementById('adminProductSearch')?.value || '').toLowerCase().trim();
    const stockFilter = document.getElementById('adminStockFilter')?.value || '';
    const sort = document.getElementById('adminSortProducts')?.value || '';
    let products = [...adminProducts];

    // Filter by category
    if (currentCategory && currentCategory !== 'all') {
        products = products.filter(p => p.category === currentCategory);
    }

    // Filter by search query
    if (search) {
        products = products.filter(p => {
            const combined = `${p.name} ${p.description || ''} ${p.category || ''} ${p.brand || ''} ${p.sku || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
            return combined.includes(search);
        });
    }

    // Filter by stock level
    if (stockFilter === 'low') products = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5));
    if (stockFilter === 'out') products = products.filter(p => p.stock === 0);
    if (stockFilter === 'in') products = products.filter(p => p.stock > 0);

    // Sorting
    const sorters = {
        price_asc: (a, b) => a.price - b.price,
        price_desc: (a, b) => b.price - a.price,
        stock_asc: (a, b) => a.stock - b.stock,
        stock_desc: (a, b) => b.stock - a.stock,
        name: (a, b) => a.name.localeCompare(b.name, 'vi')
    };
    if (sorters[sort]) products.sort(sorters[sort]);

    return products;
}

function renderProductTable() {
    const products = adminFilteredProducts();
    const countEl = document.getElementById('productCount');
    if (countEl) countEl.textContent = products.length;

    renderCategorySummaryBar();

    const tbody = document.querySelector('#productTable tbody');
    if (!tbody) return;
    if (!products.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;" aria-hidden="true">📦</div>
                    <strong>Không tìm thấy sản phẩm nào phù hợp</strong>
                    <div style="margin-top:0.4rem;font-size:0.85rem;">Thử chọn danh mục khác hoặc đặt lại bộ lọc tìm kiếm.</div>
                    <button type="button" class="btn-secondary" style="margin-top:1rem;" onclick="resetFilters()">🔄 Đặt lại bộ lọc</button>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = products.map((product, index) => {
        const minStock = product.minStock ?? 5;
        let stockClass = 'in-stock';
        if (product.stock === 0) stockClass = 'no-stock';
        else if (product.stock <= minStock) stockClass = 'low-stock';

        const catIcon = getCategoryIcon(product.category);

        return `
            <tr class="fade-in">
                <td style="font-weight:600;color:var(--text-muted);text-align:center;">${index + 1}</td>
                <td>
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"
                         style="width:50px;height:50px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"
                         onerror="this.src='https://via.placeholder.com/50?text=N/A'">
                </td>
                <td>
                    <strong>${escapeHTML(product.name)}</strong>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${escapeHTML(product.description || '')}</div>
                    <div style="font-size:0.75rem;color:var(--primary-light);margin-top:4px;">
                        ${product.featured ? '⭐ Nổi bật' : ''}${product.soldCount ? ` • Đã bán ${product.soldCount}` : ''}
                    </div>
                </td>
                <td style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">${escapeHTML(product.brand || '—')}</td>
                <td style="font-size:0.78rem;color:var(--text-muted);font-weight:700;"><code>${escapeHTML(product.sku || '—')}</code></td>
                <td class="td-price">${fmt(product.price)}</td>
                <td>
                    <button type="button" 
                            class="category-badge cat-clickable" 
                            title="Bấm để lọc theo danh mục ${escapeHTML(product.category)}"
                            onclick="setCategoryFilter('${escapeHTML(product.category)}')">
                        ${catIcon} ${escapeHTML(product.category)}
                    </button>
                </td>
                <td><span class="td-stock ${stockClass}">${product.stock}</span></td>
                <td style="font-size:0.85rem;color:var(--text-secondary)">${product.supplier ? '🏭 ' + escapeHTML(product.supplier.name) : '—'}</td>
                <td style="font-size:0.85rem;color:var(--text-secondary)">${escapeHTML(product.warranty || 'Không')}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn-edit" title="Chỉnh sửa sản phẩm" onclick="editProduct('${product._id}')">Sửa</button>
                        <button class="btn-delete" title="Xóa sản phẩm vĩnh viễn" onclick="deleteProduct('${product._id}')">Xóa</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function handleCategorySelectChange() {
    const select = document.getElementById('categorySelect');
    const customInput = document.getElementById('category');
    if (!select || !customInput) return;

    if (select.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = select.value;
    }
}

function updateImagePreview() {
    const input = document.getElementById('image');
    const img = document.getElementById('imagePreviewImg');
    const placeholder = document.getElementById('imagePreviewPlaceholder');
    if (!input || !img || !placeholder) return;

    const url = input.value.trim();
    if (url) {
        img.src = url;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        img.src = '';
        img.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

const productForm = document.getElementById('productForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = document.getElementById('productId').value;
        const categoryVal = document.getElementById('category').value.trim();

        if (!categoryVal) {
            showToast('Vui lòng chọn hoặc nhập danh mục sản phẩm!', 'error');
            document.getElementById('categorySelect')?.focus();
            return;
        }

        const ratingData = splitRatingReview(document.getElementById('ratingReview').value);
        const productData = {
            name: document.getElementById('name').value.trim(),
            sku: document.getElementById('sku').value.trim(),
            brand: document.getElementById('brand').value.trim(),
            price: Number(document.getElementById('price').value),
            compareAtPrice: Number(document.getElementById('compareAtPrice').value || 0),
            category: categoryVal,
            stock: Number(document.getElementById('stock').value),
            description: document.getElementById('description').value.trim(),
            image: document.getElementById('image').value.trim(),
            supplier: document.getElementById('supplier').value || null,
            minStock: parseInt(document.getElementById('minStock').value, 10) || 5,
            warranty: document.getElementById('warranty').value.trim() || 'Không bảo hành',
            tags: document.getElementById('tags').value.trim(),
            rating: ratingData.rating,
            reviewCount: ratingData.reviewCount,
            soldCount: Number(document.getElementById('soldCount').value || 0),
            featured: document.getElementById('featured').value === 'true',
            specs: specPayload()
        };

        try {
            const method = productId ? 'PUT' : 'POST';
            const url = productId ? `${EP}/${productId}` : EP;
            const response = await fetch(url, {
                method,
                headers: auth.getHeaders(),
                body: JSON.stringify(productData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Có lỗi khi lưu thông tin!');

            showToast(productId ? 'Cập nhật sản phẩm thành công!' : 'Thêm sản phẩm mới thành công!');
            resetForm();
            loadProducts();
        } catch (error) {
            showToast(error.message || 'Có lỗi kết nối mạng!', 'error');
        }
    });
}

async function editProduct(id) {
    try {
        const response = await fetch(`${EP}/${id}`, { headers: auth.getHeaders() });
        const product = await response.json();
        if (!response.ok) throw new Error(product.message || 'Không tải được sản phẩm');

        document.getElementById('productId').value = product._id;
        document.getElementById('name').value = product.name || '';
        document.getElementById('sku').value = product.sku || '';
        document.getElementById('brand').value = product.brand || '';
        document.getElementById('price').value = product.price ?? '';
        document.getElementById('compareAtPrice').value = product.compareAtPrice || '';
        
        // Category selection
        const catSelect = document.getElementById('categorySelect');
        const catInput = document.getElementById('category');
        const prodCat = product.category || '';
        if (catSelect && catInput) {
            catInput.value = prodCat;
            const matchOpt = Array.from(catSelect.options).find(opt => opt.value === prodCat);
            if (matchOpt) {
                catSelect.value = prodCat;
                catInput.style.display = 'none';
            } else if (prodCat) {
                catSelect.value = '__custom__';
                catInput.style.display = 'block';
            } else {
                catSelect.value = '';
                catInput.style.display = 'none';
            }
        }

        document.getElementById('stock').value = product.stock ?? 0;
        document.getElementById('description').value = product.description || '';
        
        const imageInput = document.getElementById('image');
        imageInput.value = product.image || '';
        updateImagePreview();

        document.getElementById('supplier').value = product.supplier?._id || product.supplier || '';
        document.getElementById('minStock').value = product.minStock ?? 5;
        document.getElementById('warranty').value = product.warranty || 'Không bảo hành';
        document.getElementById('ratingReview').value = product.rating ? `${product.rating}/${product.reviewCount || 0}` : '';
        document.getElementById('soldCount').value = product.soldCount || '';
        document.getElementById('featured').value = product.featured ? 'true' : 'false';
        document.getElementById('tags').value = (product.tags || []).join(', ');

        const specs = product.specs || {};
        document.getElementById('specCpu').value = specs.cpu || '';
        document.getElementById('specRam').value = specs.ram || '';
        document.getElementById('specStorage').value = specs.storage || '';
        document.getElementById('specScreen').value = specs.screen || '';
        document.getElementById('specCamera').value = specs.camera || '';
        document.getElementById('specBattery').value = specs.battery || '';
        document.getElementById('specOs').value = specs.os || '';
        document.getElementById('specGpu').value = specs.gpu || '';

        // Show edit banner
        const editingNotice = document.getElementById('editingNotice');
        if (editingNotice) {
            editingNotice.style.display = 'flex';
            document.getElementById('editingProductName').textContent = product.name;
            document.getElementById('editingProductSku').textContent = product.sku || `#${product._id}`;
        }
        document.getElementById('formTitle').textContent = `Sửa sản phẩm #${product._id}`;
        const submitBtn = document.getElementById('btnSubmitProduct');
        if (submitBtn) submitBtn.textContent = 'Cập nhật sản phẩm';

        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteProduct(id) {
    const prod = adminProducts.find(p => String(p._id) === String(id));
    const name = prod?.name ? `"${prod.name}"` : 'sản phẩm này';
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${name}?\nSản phẩm sẽ bị xóa vĩnh viễn khỏi danh sách.`)) {
        return;
    }

    try {
        const response = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Lỗi khi xóa sản phẩm!');

        showToast(`Đã xóa thành công ${name}!`);

        // Optimistically remove immediately from local array
        adminProducts = adminProducts.filter(p => String(p._id) !== String(id));
        renderCategoryTabs();
        renderProductTable();

        // If form was currently editing this deleted product, reset form
        if (document.getElementById('productId')?.value === String(id)) {
            resetForm();
        }

        // Silent sync with server
        loadProducts(true);
    } catch (error) {
        console.error('Delete error:', error);
        showToast(error.message || 'Lỗi khi xóa sản phẩm!', 'error');
    }
}

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('minStock').value = 5;
    document.getElementById('warranty').value = 'Không bảo hành';
    document.getElementById('featured').value = 'false';
    document.getElementById('formTitle').textContent = 'Thêm sản phẩm mới';

    const submitBtn = document.getElementById('btnSubmitProduct');
    if (submitBtn) submitBtn.textContent = 'Lưu sản phẩm';

    const editingNotice = document.getElementById('editingNotice');
    if (editingNotice) editingNotice.style.display = 'none';

    const catSelect = document.getElementById('categorySelect');
    const catInput = document.getElementById('category');
    if (catSelect) catSelect.value = '';
    if (catInput) {
        catInput.value = '';
        catInput.style.display = 'none';
    }

    updateImagePreview();
}

document.addEventListener('DOMContentLoaded', () => {
    // Search input
    document.getElementById('adminProductSearch')?.addEventListener('input', renderProductTable);

    // Category dropdown filter
    document.getElementById('adminCategoryFilter')?.addEventListener('change', (e) => {
        setCategoryFilter(e.target.value || 'all');
    });

    // Stock and Sort dropdown filters
    ['adminStockFilter', 'adminSortProducts'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', renderProductTable);
        }
    });

    loadSuppliersForSelect().then(() => loadProducts());
});
