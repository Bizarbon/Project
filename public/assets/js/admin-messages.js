/**
 * TechEcommerce - Admin AI Chatbox Messages & Customer Insights
 * Quản lý lịch sử hội thoại khách hàng với AI, nhu cầu và phân loại tư vấn
 */

(function () {
    'use strict';

    let currentConversations = [];
    let activeConversation = null;
    let currentFilterStatus = 'all';
    let searchQuery = '';
    let searchDebounceTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
        initEventListeners();
        loadConversations();
    });

    function initEventListeners() {
        const searchInput = document.getElementById('conversationSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    searchQuery = e.target.value.trim();
                    loadConversations();
                }, 300);
            });
        }

        const filterBtns = document.querySelectorAll('.msg-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilterStatus = btn.dataset.status || 'all';
                loadConversations();
            });
        });

        const btnToggleStatus = document.getElementById('btnToggleStatus');
        if (btnToggleStatus) {
            btnToggleStatus.addEventListener('click', handleToggleStatus);
        }

        const btnSaveAdminNote = document.getElementById('btnSaveAdminNote');
        if (btnSaveAdminNote) {
            btnSaveAdminNote.addEventListener('click', handleSaveAdminNote);
        }
    }

    async function loadConversations() {
        const container = document.getElementById('conversationsListContainer');
        if (!container) return;

        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (currentFilterStatus !== 'all') params.append('status', currentFilterStatus);

            const token = localStorage.getItem('token');
            const res = await fetch(`/api/chat/admin/conversations?${params.toString()}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (!res.ok) {
                throw new Error(`Lỗi tải dữ liệu: ${res.status}`);
            }

            const data = await res.json();
            currentConversations = data.conversations || [];

            updateStats(data.stats);
            renderConversationList(currentConversations);

            if (currentConversations.length > 0) {
                // If there's an active conversation, keep it selected if still in list, else select first
                const stillExists = activeConversation && currentConversations.find(c => c._id === activeConversation._id);
                selectConversation(stillExists || currentConversations[0]);
            } else {
                renderEmptyDetail();
            }
        } catch (err) {
            console.error('Lỗi khi tải danh sách cuộc trò chuyện:', err);
            container.innerHTML = `
                <li class="widget-empty-note" style="padding: 24px; text-align: center; color: #ef4444;">
                    Không thể kết nối máy chủ để tải hội thoại. Vui lòng thử lại sau.
                </li>
            `;
        }
    }

    function updateStats(stats) {
        if (!stats) return;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val !== undefined ? val : 0;
        };
        setVal('statTotalConversations', stats.totalAll);
        setVal('statMemberConversations', stats.memberCount);
        setVal('statNeedsAgent', stats.needSupportCount);
        setVal('statActiveToday', stats.activeToday);
    }

    function renderConversationList(conversations) {
        const container = document.getElementById('conversationsListContainer');
        if (!container) return;

        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <li class="widget-empty-note" style="padding: 32px 16px; text-align: center;">
                    Không tìm thấy cuộc trò chuyện nào phù hợp.
                </li>
            `;
            return;
        }

        container.innerHTML = conversations.map(c => {
            const isSelected = activeConversation && activeConversation._id === c._id;
            const initials = getInitials(c.customerName);
            const formattedTime = formatTimestamp(c.updatedAt || c.createdAt);
            const statusConfig = getStatusConfig(c.status);
            const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].text : 'Chưa có tin nhắn';

            return `
                <li class="conversation-card-item ${isSelected ? 'selected' : ''}" data-id="${c._id}">
                    <div class="conv-card-top">
                        <div class="conv-user-info">
                            <div class="conv-avatar ${c.isMember ? '' : 'guest'}">${escapeHtml(initials)}</div>
                            <div class="conv-name-box">
                                <span class="conv-customer-name">${escapeHtml(c.customerName)}</span>
                                <time class="conv-date-time">${formattedTime}</time>
                            </div>
                        </div>
                        <span class="conv-status-badge ${statusConfig.className}">${statusConfig.label}</span>
                    </div>

                    <div class="conv-intent-preview" title="${escapeHtml(c.intentSummary)}">
                        <span>🎯 ${escapeHtml(c.intentSummary)}</span>
                    </div>

                    <p class="conv-last-message">${escapeHtml(lastMsg)}</p>
                </li>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.conversation-card-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const found = currentConversations.find(c => c._id === id);
                if (found) {
                    selectConversation(found);
                }
            });
        });
    }

    function selectConversation(conv) {
        activeConversation = conv;

        // Highlight selected in sidebar list
        document.querySelectorAll('.conversation-card-item').forEach(el => {
            if (el.dataset.id === conv._id) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });

        // Fill Header Info
        const avatarEl = document.getElementById('activeConvAvatar');
        const nameEl = document.getElementById('activeConvCustomerName');
        const memberTagEl = document.getElementById('activeConvMemberTag');
        const phoneEl = document.getElementById('activeConvPhone');
        const emailEl = document.getElementById('activeConvEmail');
        const timeEl = document.getElementById('activeConvTime');
        const toggleBtn = document.getElementById('btnToggleStatus');

        if (avatarEl) {
            avatarEl.textContent = getInitials(conv.customerName);
            avatarEl.className = `conv-header-avatar ${conv.isMember ? '' : 'guest'}`;
        }
        if (nameEl) nameEl.textContent = conv.customerName;
        if (memberTagEl) {
            memberTagEl.textContent = conv.isMember ? '👑 Thành viên TechEcommerce' : '👤 Khách vãng lai';
            memberTagEl.style.background = conv.isMember ? 'rgba(37, 99, 235, 0.15)' : 'rgba(100, 116, 139, 0.15)';
            memberTagEl.style.color = conv.isMember ? 'var(--admin-blue-accent)' : 'var(--admin-text-muted)';
        }
        if (phoneEl) phoneEl.textContent = conv.customerPhone ? `📞 ${conv.customerPhone}` : '📞 Chưa có SĐT';
        if (emailEl) emailEl.textContent = conv.customerEmail ? `✉️ ${conv.customerEmail}` : '✉️ Chưa có Email';
        if (timeEl) timeEl.textContent = `🕒 ${formatTimestamp(conv.updatedAt || conv.createdAt)}`;

        const statusConfig = getStatusConfig(conv.status);
        if (toggleBtn) {
            toggleBtn.innerHTML = `<span>Trạng thái: <strong>${statusConfig.label}</strong></span>`;
        }

        // Fill AI Customer Want & Intent Insight Box
        const intentEl = document.getElementById('activeConvIntent');
        const budgetEl = document.getElementById('activeConvBudget');
        const categoryEl = document.getElementById('activeConvCategory');
        const actionNoteEl = document.getElementById('activeConvActionNote');
        const adminNoteInput = document.getElementById('adminNoteInput');

        if (intentEl) intentEl.textContent = conv.intentSummary || 'Tư vấn thông tin sản phẩm';
        if (budgetEl) budgetEl.textContent = conv.budgetRange || 'Theo mức niêm yết';
        if (categoryEl) categoryEl.textContent = formatCategory(conv.interestedCategory);
        if (adminNoteInput) adminNoteInput.value = conv.intentSummary || '';

        if (actionNoteEl) {
            if (conv.status === 'needs_agent') {
                actionNoteEl.innerHTML = '<span style="color:#ef4444; font-weight:700;">⚠️ Khách cần nhân viên hỗ trợ trực tiếp, ưu tiên gọi hotline/liên hệ ngay!</span>';
            } else if (conv.isMember) {
                actionNoteEl.innerHTML = '<span style="color:#10b981; font-weight:600;">Khách có tài khoản, có thể tặng voucher cá nhân hóa theo giỏ hàng.</span>';
            } else {
                actionNoteEl.innerHTML = '<span>Tư vấn hoàn tất tự động bằng Trợ lý AI TechEcommerce.</span>';
            }
        }

        // Render Timeline
        renderTranscriptTimeline(conv.messages || [], conv.customerName);
    }

    function renderTranscriptTimeline(messages, customerName) {
        const container = document.getElementById('chatTimelineContainer');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <p class="widget-empty-note" style="text-align: center; margin-top: 40px;">
                    Chưa có tin nhắn nào trong phiên này.
                </p>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isUser = msg.sender === 'user';
            const senderBar = isUser
                ? `<span>👤 ${escapeHtml(customerName)}</span> <time>${formatTimestamp(msg.timestamp)}</time>`
                : `<span>✨ Trợ lý AI TechEcommerce</span> <time>${formatTimestamp(msg.timestamp)}</time>`;

            let mediaHtml = '';
            if (msg.isImage && msg.imageUrl) {
                mediaHtml = `
                    <div style="margin-top: 8px;">
                        <img src="${escapeHtml(msg.imageUrl)}" alt="Ảnh khách gửi" class="chat-bubble-img-preview" loading="lazy">
                        <small style="display:block; margin-top: 4px; font-size: 0.72rem; color: var(--admin-text-muted);">📷 Hình ảnh tìm kiếm / nhận diện</small>
                    </div>
                `;
            }

            let productsHtml = '';
            if (msg.products && msg.products.length > 0) {
                productsHtml = msg.products.map(p => `
                    <div class="chat-product-recommend-chip">
                        <div class="chat-product-chip-name">📦 ${escapeHtml(p.name || 'Sản phẩm')}</div>
                        <div class="chat-product-chip-price">${formatMoney(p.price)}</div>
                    </div>
                `).join('');
            }

            return `
                <article class="chat-bubble-wrapper ${isUser ? 'customer-side' : 'ai-side'}">
                    <header class="chat-bubble-sender-bar">
                        ${senderBar}
                    </header>
                    <div class="chat-bubble-content">
                        ${formatMessageText(msg.text)}
                        ${mediaHtml}
                        ${productsHtml}
                    </div>
                </article>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    function renderEmptyDetail() {
        const nameEl = document.getElementById('activeConvCustomerName');
        const intentEl = document.getElementById('activeConvIntent');
        const container = document.getElementById('chatTimelineContainer');
        if (nameEl) nameEl.textContent = 'Chưa có cuộc trò chuyện nào';
        if (intentEl) intentEl.textContent = '--';
        if (container) {
            container.innerHTML = `
                <p class="widget-empty-note" style="text-align: center; margin-top: 40px;">
                    Không có cuộc trò chuyện nào trong danh sách.
                </p>
            `;
        }
    }

    async function handleToggleStatus() {
        if (!activeConversation) return;

        const statusCycle = {
            'active': 'needs_agent',
            'needs_agent': 'resolved',
            'resolved': 'active'
        };

        const nextStatus = statusCycle[activeConversation.status] || 'active';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/chat/admin/conversations/${activeConversation._id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ status: nextStatus })
            });

            if (!res.ok) throw new Error('Cập nhật thất bại');

            const result = await res.json();
            activeConversation.status = nextStatus;

            // Update in list
            const inList = currentConversations.find(c => c._id === activeConversation._id);
            if (inList) inList.status = nextStatus;

            renderConversationList(currentConversations);
            selectConversation(activeConversation);

            showToast(`Đã chuyển trạng thái sang: ${getStatusConfig(nextStatus).label}`);
        } catch (err) {
            alert('Lỗi cập nhật trạng thái: ' + err.message);
        }
    }

    async function handleSaveAdminNote() {
        if (!activeConversation) return;
        const noteInput = document.getElementById('adminNoteInput');
        const newNote = noteInput ? noteInput.value.trim() : '';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/chat/admin/conversations/${activeConversation._id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ note: newNote })
            });

            if (!res.ok) throw new Error('Lưu thất bại');

            activeConversation.intentSummary = newNote;
            const inList = currentConversations.find(c => c._id === activeConversation._id);
            if (inList) inList.intentSummary = newNote;

            renderConversationList(currentConversations);
            selectConversation(activeConversation);

            showToast('Đã lưu thông tin ghi chú nhu cầu khách hàng thành công!');
        } catch (err) {
            alert('Lỗi lưu ghi chú: ' + err.message);
        }
    }

    // Helpers
    function getInitials(name) {
        if (!name) return 'KH';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function formatTimestamp(d) {
        if (!d) return '--';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '--';
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${hours}:${mins} - ${day}/${month}/${year}`;
    }

    function getStatusConfig(status) {
        switch (status) {
            case 'needs_agent':
                return { className: 'needs_agent', label: 'Cần hỗ trợ' };
            case 'resolved':
                return { className: 'resolved', label: 'Đã xử lý' };
            case 'active':
            default:
                return { className: 'active', label: 'Đang trao đổi' };
        }
    }

    function formatCategory(cat) {
        const map = {
            'all': 'Tất cả thiết bị',
            'laptop': '💻 Laptop & Máy tính',
            'phone': '📱 Điện thoại di động',
            'tablet': '📲 Máy tính bảng',
            'audio': '🎧 Tai nghe & Âm thanh',
            'smartwatch': '⌚ Đồng hồ thông minh',
            'accessory': '🔌 Phụ kiện công nghệ',
            'other': '🌿 Nhận diện ngoại cảnh'
        };
        return map[cat] || cat || 'Thiết bị công nghệ';
    }

    function formatMoney(amount) {
        if (!amount) return '0 đ';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    function formatMessageText(text) {
        if (!text) return '';
        // Basic bold markdown replace **text** with <strong>text</strong> and linebreaks
        const escaped = escapeHtml(text);
        return escaped
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = '#10b981';
        toast.style.color = '#ffffff';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '8px';
        toast.style.fontWeight = '600';
        toast.style.fontSize = '0.88rem';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        toast.style.zIndex = '99999';
        toast.style.transition = 'all 0.3s ease';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

})();
