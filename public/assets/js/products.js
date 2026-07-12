const EP = API_URL + '/products';
let adminProducts = [];

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
        cpu: document.getElementById('specCpu').value.trim(),
        ram: document.getElementById('specRam').value.trim(),
        storage: document.getElementById('specStorage').value.trim(),
        screen: document.getElementById('specScreen').value.trim(),
        camera: document.getElementById('specCamera').value.trim(),
        battery: document.getElementById('specBattery').value.trim(),
        os: document.getElementById('specOs').value.trim(),
        gpu: document.getElementById('specGpu').value.trim()
    };
}

async function loadSuppliersForSelect() {
    try {
        const res = await fetch(`${API_URL}/suppliers`, { headers: auth.getHeaders() });
        const suppliers = await res.json();
        const select = document.getElementById('supplier');
        if (select) {
            select.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>' +
                suppliers.map(s => `<option value="${s._id}">${escapeHTML(s.name)}</option>`).join('');
        }
    } catch (e) {
        console.error('Error loading suppliers', e);
    }
}

async function loadProducts() {
    try {
        const response = await fetch(EP, { headers: auth.getHeaders() });
        adminProducts = await response.json();
        renderProductTable();
    } catch (error) {
        console.error('Error:', error);
        showToast('Lỗi tải danh sách sản phẩm!', 'error');
    }
}

function adminFilteredProducts() {
    const search = (document.getElementById('adminProductSearch')?.value || '').toLowerCase().trim();
    const stockFilter = document.getElementById('adminStockFilter')?.value || '';
    const sort = document.getElementById('adminSortProducts')?.value || '';
    let products = [...adminProducts];

    if (search) {
        products = products.filter(p => `${p.name} ${p.description || ''} ${p.category || ''} ${p.brand || ''} ${p.sku || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(search));
    }
    if (stockFilter === 'low') products = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5));
    if (stockFilter === 'out') products = products.filter(p => p.stock === 0);
    if (stockFilter === 'in') products = products.filter(p => p.stock > 0);

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

    const tbody = document.querySelector('#productTable tbody');
    if (!tbody) return;
    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text-muted);">Không có sản phẩm phù hợp</td></tr>';
        return;
    }

    tbody.innerHTML = products.map((product, index) => {
        const minStock = product.minStock ?? 5;
        let stockClass = 'in-stock';
        if (product.stock === 0) stockClass = 'no-stock';
        else if (product.stock <= minStock) stockClass = 'low-stock';

        return `
            <tr class="fade-in">
                <td style="font-weight:600;color:var(--text-muted);">${index + 1}</td>
                <td>
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"
                         style="width:50px;height:50px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"
                         onerror="this.src='https://via.placeholder.com/50?text=N/A'">
                </td>
                <td>
                    <strong>${escapeHTML(product.name)}</strong>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${escapeHTML(product.description || '')}</div>
                    <div style="font-size:0.75rem;color:var(--primary-light);margin-top:4px;">
                        ${product.featured ? 'Nổi bật' : ''}${product.soldCount ? ` • Đã bán ${product.soldCount}` : ''}
                    </div>
                </td>
                <td style="font-size:0.85rem;color:var(--text-secondary)">${escapeHTML(product.brand || '—')}</td>
                <td style="font-size:0.78rem;color:var(--text-muted);font-weight:700">${escapeHTML(product.sku || '—')}</td>
                <td class="td-price">${fmt(product.price)}</td>
                <td><span class="category-badge">${escapeHTML(product.category)}</span></td>
                <td><span class="td-stock ${stockClass}">${product.stock}</span></td>
                <td style="font-size:0.85rem;color:var(--text-secondary)">${product.supplier ? '🏭 ' + escapeHTML(product.supplier.name) : '—'}</td>
                <td style="font-size:0.85rem;color:var(--text-secondary)">${escapeHTML(product.warranty || 'Không')}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn-edit" onclick="editProduct('${product._id}')">Sửa</button>
                        <button class="btn-delete" onclick="deleteProduct('${product._id}')">Xóa</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

const productForm = document.getElementById('productForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = document.getElementById('productId').value;
        const ratingData = splitRatingReview(document.getElementById('ratingReview').value);
        const productData = {
            name: document.getElementById('name').value.trim(),
            sku: document.getElementById('sku').value.trim(),
            brand: document.getElementById('brand').value.trim(),
            price: Number(document.getElementById('price').value),
            compareAtPrice: Number(document.getElementById('compareAtPrice').value || 0),
            category: document.getElementById('category').value.trim(),
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
            showToast(productId ? 'Cập nhật thành công!' : 'Thêm sản phẩm thành công!');
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
        document.getElementById('name').value = product.name;
        document.getElementById('sku').value = product.sku || '';
        document.getElementById('brand').value = product.brand || '';
        document.getElementById('price').value = product.price;
        document.getElementById('compareAtPrice').value = product.compareAtPrice || '';
        document.getElementById('category').value = product.category;
        document.getElementById('stock').value = product.stock;
        document.getElementById('description').value = product.description || '';
        document.getElementById('image').value = product.image || '';
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

        document.getElementById('formTitle').textContent = 'Sửa sản phẩm';
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
        const response = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Lỗi xóa sản phẩm!');
        showToast('Đã xóa sản phẩm!');
        loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('minStock').value = 5;
    document.getElementById('warranty').value = 'Không bảo hành';
    document.getElementById('featured').value = 'false';
    document.getElementById('formTitle').textContent = 'Thêm sản phẩm mới';
}

document.addEventListener('DOMContentLoaded', () => {
    ['adminProductSearch', 'adminStockFilter', 'adminSortProducts'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderProductTable);
            el.addEventListener('change', renderProductTable);
        }
    });
    loadSuppliersForSelect().then(loadProducts);
});
