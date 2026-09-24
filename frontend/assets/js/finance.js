const EP = API_URL + '/expenses';

const typeLabels = {
    ads: 'Quảng cáo',
    packaging: 'Bao bì',
    platform_fee: 'Phí sàn',
    shipping_fee: 'Phí ship',
    import_cost: 'Nhập hàng',
    other: 'Khác'
};

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.remove(), 3000);
    }, 100);
}

function fmt(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function getFilterParams() {
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return params.toString() ? '?' + params.toString() : '';
}

function applyFilter() {
    loadAll();
}

function clearFilter() {
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    loadAll();
}

async function loadSummary() {
    try {
        const res = await fetch(`${EP}/summary${getFilterParams()}`, { headers: auth.getHeaders() });
        const data = await res.json();

        document.getElementById('fcRevenue').textContent = fmt(data.revenue);
        document.getElementById('fcExpense').textContent = fmt(data.totalExpenses);
        document.getElementById('fcProfit').textContent = fmt(data.profit);
        document.getElementById('fcOrderCount').textContent = `(${data.orderCount || 0} đơn hoàn thành)`;

        const max = Math.max(data.revenue, data.totalExpenses, 1);
        const profitPct = Math.max(0, data.profit) / max * 100;

        setBar('barRevenue', 'barRevAmt', data.revenue / max * 100, data.revenue);
        setBar('barExpense', 'barExpAmt', data.totalExpenses / max * 100, data.totalExpenses);
        setBar('barProfit', 'barProfAmt', profitPct, data.profit);

        const breakdown = document.getElementById('typeBreakdown');
        const byType = data.byType || {};
        const hasData = Object.keys(byType).length > 0;
        breakdown.innerHTML = hasData
            ? Object.entries(byType).map(([type, amt]) => `
                <div class="type-card">
                    <div class="type-name">${typeLabels[type] || type}</div>
                    <div class="type-value">${fmt(amt)}</div>
                </div>`).join('')
            : '<div style="color:var(--text-muted);font-size:0.85rem;">Chưa có chi phí nào.</div>';

        // 1. Gross Margin Table
        const marginTable = document.getElementById('marginTableBody');
        if (marginTable && data.categoryAnalysis) {
            marginTable.innerHTML = data.categoryAnalysis.map(item => {
                const marginColor = item.marginPct >= 30 ? 'var(--success)' : item.marginPct >= 20 ? 'var(--primary)' : 'var(--warning)';
                return `
                    <tr>
                        <td><strong>${escapeHTML(item.category)}</strong></td>
                        <td style="color:var(--text-secondary);">${item.soldCount || 0} sp</td>
                        <td style="font-weight:700;">${fmt(item.revenue)}</td>
                        <td style="color:var(--text-muted);">${fmt(item.cogs)}</td>
                        <td style="color:var(--primary); font-weight:700;">+${fmt(item.grossProfit)}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                <div style="flex:1; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                                    <div style="width:${Math.min(item.marginPct * 2, 100)}%; height:100%; background:${marginColor};"></div>
                                </div>
                                <span style="font-weight:800; color:${marginColor}; min-width:48px; text-align:right;">${item.marginPct}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Payment & Cashflow
        const directEl = document.getElementById('directCashVal');
        const codEl = document.getElementById('codPendingVal');
        if (directEl && data.cashflowStatus) {
            directEl.textContent = fmt(data.cashflowStatus.directReceived || 0);
        }
        if (codEl && data.cashflowStatus) {
            codEl.textContent = fmt(data.cashflowStatus.codPendingSettlement || 0);
        }

        const payList = document.getElementById('paymentBreakdownList');
        if (payList && data.paymentBreakdown) {
            payList.innerHTML = Object.entries(data.paymentBreakdown).map(([k, item]) => `
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                        <span><strong>${escapeHTML(item.name)}</strong> (${item.count || 0} đơn)</span>
                        <span><strong>${fmt(item.total)}</strong> (${item.pct}%)</span>
                    </div>
                    <div style="height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                        <div style="width:${item.pct}%; height:100%; background:${k === 'cod' ? 'var(--warning)' : 'var(--success)'};"></div>
                    </div>
                </div>
            `).join('');
        }

        // 3. AI Forecast & Insights
        if (data.forecast) {
            const f7 = document.getElementById('forecast7d');
            const f30 = document.getElementById('forecast30d');
            const cap = document.getElementById('workingCapital');
            if (f7) f7.textContent = fmt(data.forecast.forecast7Days || 0);
            if (f30) f30.textContent = fmt(data.forecast.forecast30Days || 0);
            if (cap) cap.textContent = fmt(data.forecast.requiredWorkingCapital || 0);
        }

        const aiCont = document.getElementById('aiInsightsContainer');
        if (aiCont && data.aiCashflowInsights) {
            aiCont.innerHTML = data.aiCashflowInsights.map(insight => `
                <article class="glass-card" style="padding:1rem 1.2rem; border-left:4px solid var(--primary); border-radius:0 var(--radius-sm) var(--radius-sm) 0; background:rgba(47, 128, 237, 0.04);">
                    <h5 style="margin:0 0 0.3rem 0; font-size:0.95rem; color:var(--text-primary);">${escapeHTML(insight.title)}</h5>
                    <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">${escapeHTML(insight.text)}</p>
                </article>
            `).join('');
        }
    } catch (error) {
        console.error('Summary error:', error);
    }
}

function setBar(barId, amtId, pct, value) {
    const bar = document.getElementById(barId);
    const amt = document.getElementById(amtId);
    setTimeout(() => {
        bar.style.width = Math.max(pct, 0) + '%';
    }, 100);
    amt.textContent = fmt(value);
}

async function loadExpenses() {
    try {
        const res = await fetch(`${EP}${getFilterParams()}`, { headers: auth.getHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('expenseBody');

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">Chưa có chi phí nào</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((expense, index) => `
            <tr>
                <td style="color:var(--text-muted)">${index + 1}</td>
                <td>${new Date(expense.date).toLocaleDateString('vi-VN')}</td>
                <td><span class="expense-type-badge type-${expense.type}">${typeLabels[expense.type] || expense.type}</span></td>
                <td style="color:var(--text-secondary)">${escapeHTML(expense.description || '-')}</td>
                <td class="td-price">${fmt(expense.amount)}</td>
                <td><button class="btn-delete btn-sm" onclick="deleteExpense('${expense._id}')">Xóa</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load expenses error:', error);
    }
}

async function submitExpense(event) {
    event.preventDefault();
    const payload = {
        type: document.getElementById('eType').value,
        amount: parseFloat(document.getElementById('eAmount').value),
        description: document.getElementById('eDescription').value.trim(),
        date: document.getElementById('eDate').value || new Date().toISOString()
    };

    if (!payload.amount || payload.amount <= 0) {
        showToast('Số tiền phải lớn hơn 0!', 'error');
        return;
    }

    try {
        const res = await fetch(EP, {
            method: 'POST',
            headers: auth.getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        showToast('Đã ghi nhận chi phí!');
        document.getElementById('expenseForm').reset();
        document.getElementById('eDate').value = new Date().toISOString().split('T')[0];
        loadAll();
    } catch (error) {
        showToast('Có lỗi xảy ra!', 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Xóa khoản chi phí này?')) return;
    try {
        const res = await fetch(`${EP}/${id}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });
        if (!res.ok) throw new Error();
        showToast('Đã xóa chi phí!');
        loadAll();
    } catch (error) {
        showToast('Có lỗi xảy ra!', 'error');
    }
}

function loadAll() {
    loadSummary();
    loadExpenses();
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('expenseForm');
    if (form) form.addEventListener('submit', submitExpense);

    const dateInput = document.getElementById('eDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    loadAll();
});
