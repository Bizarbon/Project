const dashboardState = { range: 'month', from: '', to: '', data: null };

const ORDER_STATUS = {
    pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', processing: 'Đang xử lý',
    ready_to_ship: 'Chờ bàn giao', shipping: 'Đang giao', completed: 'Hoàn thành',
    cancelled: 'Đã hủy', delivery_failed: 'Giao thất bại', returned: 'Đã hoàn',
    boom: 'Khách boom', return_requested: 'Yêu cầu trả'
};
const STATUS_COLORS = ['#24c8ce', '#3488e6', '#10284d', '#65a8ef', '#7dd9dc', '#f2b44d', '#e76d85', '#8b9db2'];

function escapeHTML(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function money(value, compact = false) {
    const amount = Number(value) || 0;
    if (compact && Math.abs(amount) >= 1e9) return `${(amount / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
    if (compact && Math.abs(amount) >= 1e6) return `${(amount / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
    return `${amount.toLocaleString('vi-VN')} ₫`;
}

function dateLabel(value) {
    return new Date(value).toLocaleDateString('vi-VN');
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(element, target, formatter = value => Math.round(value).toLocaleString('vi-VN'), duration = 1100) {
    if (!element) return;
    const end = Number(target) || 0;
    if (prefersReducedMotion) { element.textContent = formatter(end); return; }
    const startTime = performance.now();
    const tick = now => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        element.textContent = formatter(end * eased);
        if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function setBadge(id, value) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const count = Math.max(0, Number(value) || 0);
    badge.value = String(count);
    badge.hidden = count === 0;
    badge.textContent = count.toLocaleString('vi-VN');
}

function renderLowStock(items) {
    const host = document.getElementById('lowStockList');
    if (!items.length) {
        host.innerHTML = '<li class="empty-dashboard">Tồn kho ổn định, không có sản phẩm cần nhập.</li>';
        return;
    }
    host.innerHTML = items.slice(0, 6).map((item, index) => {
        const ratio = Math.min(100, (Number(item.stock) || 0) / Math.max(Number(item.minStock) || 1, 1) * 100);
        const level = item.stock <= 0 ? 'out' : ratio < 50 ? 'low' : 'warn';
        return `<li class="stock-item ${level}" style="--i:${index}"><a href="products.html?search=${encodeURIComponent(item.name)}" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</a><strong>${item.stock <= 0 ? 'Hết hàng' : `Còn ${item.stock}`}</strong><meter min="0" max="100" low="34" high="67" optimum="100" value="${ratio}">${Math.round(ratio)}%</meter></li>`;
    }).join('');
}

function setupReveal() {
    const targets = document.querySelectorAll('.dashboard-card, .kpi-card');
    targets.forEach((element, index) => {
        element.classList.add('reveal');
        element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
    });
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        targets.forEach(element => element.classList.add('is-visible'));
        return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
    }), { threshold: 0.12 });
    targets.forEach(element => observer.observe(element));
}

function setupSpotlight() {
    document.getElementById('dashboardMain').addEventListener('pointermove', event => {
        const card = event.target.closest('.dashboard-card, .kpi-card, .module-card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
}

function normalizeText(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
}

function setupModuleSearch() {
    const input = document.getElementById('moduleSearch');
    const cards = [...document.querySelectorAll('.module-card')];
    input.addEventListener('input', () => {
        const query = normalizeText(input.value);
        let visible = 0;
        cards.forEach(card => {
            const match = !query || normalizeText(`${card.textContent} ${card.dataset.keywords}`).includes(query);
            card.parentElement.hidden = !match;
            if (match) visible += 1;
        });
        document.getElementById('moduleEmpty').hidden = visible > 0;
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            const first = cards.find(card => !card.parentElement.hidden);
            if (first) window.location.href = first.querySelector('a').href;
        }
        if (event.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); input.blur(); }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== '/' || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
        event.preventDefault();
        input.focus();
        input.closest('.module-hub').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

function startClock() {
    const clock = document.getElementById('dashboardClock');
    const update = () => {
        const now = new Date();
        clock.dateTime = now.toISOString();
        clock.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    update();
    setInterval(update, 1000);
}

function moveTabIndicator() {
    const active = document.querySelector('.view-tab.active');
    const indicator = document.querySelector('.view-tab-indicator');
    if (!active || !indicator) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft - 5}px)`;
}

function svgPointSeries(values, width, height, padX = 12, padY = 12) {
    const max = Math.max(...values, 1);
    const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
    return values.map((value, index) => ({
        x: padX + index * step,
        y: height - padY - (Number(value || 0) / max) * (height - padY * 2),
        value: Number(value || 0)
    }));
}

function renderSparkline(series) {
    const svg = document.getElementById('revenueSparkline');
    const values = series.map(item => item.revenue);
    const points = svgPointSeries(values.length ? values : [0], 320, 82, 4, 10);
    const line = points.map(point => `${point.x},${point.y}`).join(' ');
    const area = `4,78 ${line} 316,78`;
    svg.innerHTML = `
        <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24c8ce" stop-opacity=".34"/><stop offset="1" stop-color="#24c8ce" stop-opacity="0"/></linearGradient></defs>
        <polygon class="chart-area" points="${area}" fill="url(#sparkFill)"/>
        <polyline class="chart-line" pathLength="1" points="${line}" fill="none" stroke="#3ee1e4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map((point, index) => `<circle class="chart-dot" style="--i:${index}" cx="${point.x}" cy="${point.y}" r="${index === points.length - 1 ? 4 : 2}" fill="#fff"><title>${escapeHTML(series[index]?.label || '')}: ${money(point.value)}</title></circle>`).join('')}`;
}

function renderBarChart(series) {
    const svg = document.getElementById('revenueBarChart');
    const width = 720, height = 310, left = 58, right = 18, top = 20, bottom = 45;
    const chartHeight = height - top - bottom;
    const max = Math.max(...series.map(item => item.revenue), 1);
    const slot = (width - left - right) / Math.max(series.length, 1);
    const barWidth = Math.min(34, slot * .58);
    const grid = Array.from({ length: 5 }, (_, index) => {
        const y = top + index * (chartHeight / 4);
        const value = max * (1 - index / 4);
        return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="var(--commerce-grid)"/><text x="${left - 9}" y="${y + 4}" text-anchor="end" fill="var(--commerce-muted)" font-size="10">${money(value, true)}</text>`;
    }).join('');
    const lastDataIndex = series.reduce((last, item, index) => item.revenue > 0 ? index : last, -1);
    const bars = series.map((item, index) => {
        const barHeight = (item.revenue / max) * chartHeight;
        const x = left + index * slot + (slot - barWidth) / 2;
        const y = top + chartHeight - barHeight;
        const fill = index === lastDataIndex ? '#24c8ce' : '#10284d';
        const labelEvery = series.length > 15 ? Math.ceil(series.length / 10) : 1;
        return `<g class="chart-bar" style="--i:${index}" tabindex="0" aria-label="${escapeHTML(item.label)}: ${money(item.revenue)}"><rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 2)}" rx="${Math.min(barWidth / 2, 10)}" fill="${fill}"><title>${escapeHTML(item.label)} — Doanh thu ${money(item.revenue)}; ${item.orders} đơn</title></rect>${index % labelEvery === 0 || index === series.length - 1 ? `<text x="${x + barWidth / 2}" y="${height - 17}" text-anchor="middle" fill="var(--commerce-muted)" font-size="10">${escapeHTML(item.label)}</text>` : ''}</g>`;
    }).join('');
    svg.innerHTML = `${grid}${bars}`;
}

function renderAreaChart(series) {
    const svg = document.getElementById('revenueAreaChart');
    const width = 720, height = 240;
    const points = svgPointSeries(series.map(item => item.revenue), width, height, 24, 28);
    const line = points.map(point => `${point.x},${point.y}`).join(' ');
    const area = `24,${height - 28} ${line} ${width - 24},${height - 28}`;
    svg.innerHTML = `
        <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3488e6" stop-opacity=".34"/><stop offset="1" stop-color="#3488e6" stop-opacity="0"/></linearGradient></defs>
        ${[0, 1, 2, 3].map(i => `<line x1="24" y1="${28 + i * 52}" x2="696" y2="${28 + i * 52}" stroke="var(--commerce-grid)"/>`).join('')}
        <polygon class="chart-area" points="${area}" fill="url(#areaFill)"/>
        <polyline class="chart-line" pathLength="1" points="${line}" fill="none" stroke="#3488e6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map((point, index) => `<circle class="chart-dot" style="--i:${index}" cx="${point.x}" cy="${point.y}" r="4" fill="#24c8ce" stroke="var(--commerce-card)" stroke-width="3"><title>${escapeHTML(series[index]?.label || '')}: ${money(point.value)}</title></circle>`).join('')}`;
}

function renderCategories(items) {
    const host = document.getElementById('categoryBars');
    const total = items.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
    if (!items.length || total <= 0) {
        host.innerHTML = '<p class="empty-dashboard">Chưa có doanh thu sản phẩm trong kỳ.</p>';
        return;
    }
    host.innerHTML = items.slice(0, 6).map(item => {
        const percent = (Number(item.revenue || 0) / total) * 100;
        return `<article class="category-row"><header><span title="${escapeHTML(item.category)}">${escapeHTML(item.category)}</span><strong>${percent.toFixed(1)}%</strong></header><div class="category-track" title="${money(item.revenue)} · ${item.quantity} sản phẩm"><span style="width:${percent}%"></span></div></article>`;
    }).join('');
}

function renderStatusDonut(items, total) {
    const svg = document.getElementById('statusDonut');
    const legend = document.getElementById('statusLegend');
    const circumference = 2 * Math.PI * 78;
    let offset = 0;
    svg.innerHTML = `<circle cx="110" cy="110" r="78" fill="none" stroke="var(--commerce-grid)" stroke-width="28"/>` + items.map((item, index) => {
        const fraction = total ? item.count / total : 0;
        const length = fraction * circumference;
        const circle = `<circle class="donut-segment" style="--i:${index};--len:${length};--gap:${circumference - length}" cx="110" cy="110" r="78" fill="none" stroke="${STATUS_COLORS[index % STATUS_COLORS.length]}" stroke-width="28" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" stroke-linecap="butt"><title>${escapeHTML(ORDER_STATUS[item.status] || item.status)}: ${item.count} đơn</title></circle>`;
        offset += length;
        return circle;
    }).join('');
    legend.innerHTML = items.length ? items.map((item, index) => `<li><span class="legend-dot" style="background:${STATUS_COLORS[index % STATUS_COLORS.length]}"></span><span>${escapeHTML(ORDER_STATUS[item.status] || item.status)}</span><strong>${item.count} · ${total ? Math.round(item.count / total * 100) : 0}%</strong></li>`).join('') : '<li>Chưa có đơn trong kỳ.</li>';
    countUp(document.getElementById('donutTotal'), total);
}

function productImage(src) {
    const value = String(src || '').trim();
    if (!value) return '../assets/images/product-placeholder.svg';
    if (/^(https?:|data:)/i.test(value)) return value;
    return `../${value.replace(/^\.?\/?/, '')}`;
}

function renderBestSellers(items) {
    const host = document.getElementById('bestSellerList');
    const max = Math.max(...items.map(item => item.quantity), 1);
    host.innerHTML = items.length ? items.map(item => `<li class="bestseller-item"><img src="${escapeHTML(productImage(item.image))}" alt="" loading="lazy"><span class="bestseller-copy"><strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong><span>${money(item.revenue)}</span></span><strong>${item.quantity} SP</strong><span class="bestseller-track"><span style="width:${item.quantity / max * 100}%"></span></span></li>`).join('') : '<li class="empty-dashboard">Chưa có sản phẩm bán ra trong kỳ.</li>';
}

function renderRecentOrders(orders) {
    const host = document.getElementById('recentOrdersBody');
    host.innerHTML = orders.length ? orders.map(order => `<tr><td><strong>#${String(order._id).padStart(5, '0')}</strong></td><td>${escapeHTML(order.customerName)}</td><td><strong>${money(order.totalAmount)}</strong></td><td>${order.paymentStatus === 'paid' ? 'Đã thu' : order.paymentStatus === 'pending' ? 'Chờ thanh toán' : 'Chưa thu'}</td><td><span class="order-status status-${escapeHTML(order.status)}">${escapeHTML(ORDER_STATUS[order.status] || order.status)}</span></td><td>${dateLabel(order.orderDate)}</td><td><a class="order-action" href="orders.html?search=${encodeURIComponent(order._id)}">Chi tiết</a></td></tr>`).join('') : '<tr><td colspan="7" class="empty-dashboard">Chưa có đơn hàng trong khoảng thời gian này.</td></tr>';
}

function setProgress(id, value, total) {
    document.getElementById(id).style.width = `${total ? Math.min(100, value / total * 100) : 0}%`;
}

function renderDashboard(data) {
    const now = new Date();
    const defaultFrom = dashboardState.range === 'today'
        ? now
        : dashboardState.range === '7d'
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
            : dashboardState.range === 'custom' && dashboardState.from
                ? new Date(`${dashboardState.from}T00:00:00`)
                : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = dashboardState.range === 'custom' && dashboardState.to
        ? new Date(`${dashboardState.to}T23:59:59`)
        : now;
    const responseRange = data.range || { from: defaultFrom.toISOString(), to: defaultTo.toISOString() };
    const fallbackRevenue = Number(data.paidRevenue ?? data.revenue ?? 0);
    const series = Array.isArray(data.timeSeries) && data.timeSeries.length
        ? data.timeSeries
        : [{ key: 'current', label: 'Hiện tại', revenue: fallbackRevenue, orderValue: Number(data.orderValue ?? fallbackRevenue), orders: Number(data.orderCount || 0) }];
    document.getElementById('dashboardPeriodLabel').textContent = `${dateLabel(responseRange.from)} – ${dateLabel(responseRange.to)}`;
    countUp(document.getElementById('paidRevenue'), fallbackRevenue, value => money(Math.round(value)), 1400);
    document.getElementById('orderValue').textContent = money(data.orderValue ?? fallbackRevenue);
    document.getElementById('chartRevenueTotal').textContent = money(fallbackRevenue, true);
    document.getElementById('periodExpenses').textContent = money(data.expenses);
    document.getElementById('periodProfit').textContent = money(data.profit);
    document.getElementById('validOrderCount').textContent = Number(data.validOrderCount ?? data.orderCount ?? 0).toLocaleString('vi-VN');
    document.getElementById('heroOrderCount').textContent = Number(data.orderCount || 0).toLocaleString('vi-VN');
    document.getElementById('heroCompletedCount').textContent = Number(data.completedOrders || 0).toLocaleString('vi-VN');
    document.getElementById('processingCount').textContent = data.processingOrders || 0;
    document.getElementById('shippingCount').textContent = data.shippingOrders || 0;
    document.getElementById('completedCount').textContent = data.completedOrders || 0;
    setProgress('processingBar', data.processingOrders, data.orderCount);
    setProgress('shippingBar', data.shippingOrders, data.orderCount);
    setProgress('completedBar', data.completedOrders, data.orderCount);

    const change = document.getElementById('revenueChange');
    if (data.revenueChangePercent === null || data.revenueChangePercent === undefined) {
        change.className = 'revenue-change neutral';
        change.textContent = data.previousRevenue > 0 ? 'Không tính được biến động' : 'Kỳ trước chưa phát sinh doanh thu';
    } else {
        change.className = `revenue-change ${data.revenueChangePercent >= 0 ? 'positive' : 'negative'}`;
        change.textContent = `${data.revenueChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.revenueChangePercent).toLocaleString('vi-VN')}% so với kỳ trước`;
    }

    renderSparkline(series);
    renderBarChart(series);
    renderAreaChart(series);
    renderCategories(data.categorySales || []);
    const fallbackStatuses = [
        { status: 'pending', count: Number(data.pendingOrders || 0) },
        { status: 'shipping', count: Number(data.shippingOrders || 0) },
        { status: 'completed', count: Number(data.completedOrders || 0) }
    ].filter(item => item.count > 0);
    renderStatusDonut(Array.isArray(data.orderStatuses) ? data.orderStatuses : fallbackStatuses, Number(data.orderCount || 0));
    renderBestSellers(data.bestSellers || []);
    renderRecentOrders(data.recentOrders || []);
    renderLowStock(data.lowStockProducts || []);

    const pendingWork = Number(data.processingOrders || 0);
    const lowStock = (data.lowStockProducts || []).length;
    countUp(document.getElementById('kpiRevenue'), fallbackRevenue, value => money(Math.round(value), true), 1300);
    countUp(document.getElementById('kpiOrders'), data.orderCount);
    countUp(document.getElementById('kpiCustomers'), data.customerCount);
    countUp(document.getElementById('kpiProducts'), data.productCount);
    const revenueNote = document.getElementById('kpiRevenueNote');
    revenueNote.textContent = data.revenueChangePercent == null ? `Chi phí: ${money(data.expenses, true)}` : `${data.revenueChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.revenueChangePercent).toLocaleString('vi-VN')}% so với kỳ trước`;
    revenueNote.className = `kpi-note ${data.revenueChangePercent > 0 ? 'up' : data.revenueChangePercent < 0 ? 'down' : ''}`;
    document.getElementById('kpiOrdersNote').textContent = `${pendingWork} đơn cần xử lý · ${data.shippingOrders || 0} đang giao`;
    document.getElementById('kpiCustomersNote').textContent = `+${Number(data.newCustomers || 0).toLocaleString('vi-VN')} khách mới trong kỳ`;
    const productsNote = document.getElementById('kpiProductsNote');
    productsNote.textContent = lowStock ? `${lowStock} sản phẩm sắp hết hàng` : 'Tồn kho ổn định';
    productsNote.className = `kpi-note ${lowStock ? 'down' : 'up'}`;
    setBadge('badgeProducts', lowStock);
    setBadge('badgeOrders', pendingWork);
    setBadge('badgeCustomers', Number(data.newCustomers || 0));
    document.getElementById('badgeProducts').title = 'Sản phẩm sắp hết hàng';
    document.getElementById('badgeOrders').title = 'Đơn cần xử lý';
    document.getElementById('badgeCustomers').title = 'Khách mới trong kỳ';
}

function queryString() {
    const params = new URLSearchParams({ range: dashboardState.range });
    if (dashboardState.range === 'custom') {
        params.set('from', dashboardState.from);
        params.set('to', dashboardState.to);
    }
    return params.toString();
}

async function loadDashboard() {
    const loading = document.getElementById('dashboardLoading');
    const content = document.getElementById('dashboardContent');
    const error = document.getElementById('dashboardError');
    const refresh = document.getElementById('dashboardRefresh');
    loading.hidden = false;
    content.hidden = true;
    error.hidden = true;
    refresh.classList.add('loading');
    refresh.disabled = true;
    try {
        const response = await fetch(`${API_URL}/admin/dashboard?${queryString()}`, { headers: auth.getHeaders(), cache: 'no-store' });
        const data = await response.json();
        if (auth.handleApiError(response, data)) return;
        if (!response.ok) throw new Error(data.message || 'Không tải được dữ liệu dashboard.');
        dashboardState.data = data;
        renderDashboard(data);
        content.hidden = false;
        content.classList.remove('is-rendered');
        requestAnimationFrame(() => requestAnimationFrame(() => content.classList.add('is-rendered')));
        moveTabIndicator();
    } catch (requestError) {
        error.textContent = `${requestError.message} `;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'control-button';
        retry.textContent = 'Thử lại';
        retry.addEventListener('click', loadDashboard);
        error.appendChild(retry);
        error.hidden = false;
    } finally {
        loading.hidden = true;
        refresh.classList.remove('loading');
        refresh.disabled = false;
    }
}

function selectRange(range) {
    dashboardState.range = range;
    document.querySelectorAll('.period-pill').forEach(button => {
        const active = button.dataset.range === range;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('customDateFields').hidden = range !== 'custom';
    if (range !== 'custom') loadDashboard();
}

function setupDashboardControls() {
    document.querySelectorAll('.period-pill').forEach(button => button.addEventListener('click', () => selectRange(button.dataset.range)));
    document.getElementById('dashboardFilters').addEventListener('submit', event => {
        event.preventDefault();
        dashboardState.from = document.getElementById('dashboardFrom').value;
        dashboardState.to = document.getElementById('dashboardTo').value;
        if (!dashboardState.from || !dashboardState.to) return;
        loadDashboard();
    });
    document.getElementById('dashboardRefresh').addEventListener('click', loadDashboard);
    document.getElementById('dashboardThemeToggle').addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        if (typeof setTheme === 'function') setTheme(next);
        else {
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        }
    });
    document.querySelectorAll('.view-tab').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab === button);
            if (tab === button) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });
        moveTabIndicator();
        const target = document.querySelector(`[data-dashboard-section="${button.dataset.view}"]`) || document.querySelector('.dashboard-primary-grid');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.remove('view-highlight');
        requestAnimationFrame(() => target.classList.add('view-highlight'));
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('dashboardFrom').value = start.toISOString().slice(0, 10);
    document.getElementById('dashboardTo').value = now.toISOString().slice(0, 10);
    setupDashboardControls();
    setupReveal();
    setupSpotlight();
    setupModuleSearch();
    startClock();
    moveTabIndicator();
    window.addEventListener('resize', moveTabIndicator);
    loadDashboard();
});
