(function initAIChatbox() {
    if (window.__aiChatboxLoaded) return;
    window.__aiChatboxLoaded = true;

    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : getBasePath();
    const apiUrl = window.API_URL || 'http://localhost:5000/api';
    const starterSuggestions = [
        '📦 Tra cứu đơn hàng',
        '💳 Tính trả góp 0%',
        '📍 Địa chỉ showroom',
        'Tư vấn laptop dưới 15 triệu',
        'Mã giảm giá hôm nay',
        'Tìm máy chơi mượt Genshin'
    ];

    function getBasePath() {
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('/admin/')) return '../';
        const pagesIndex = path.indexOf('/pages/');
        if (pagesIndex >= 0) {
            const pagePath = path.slice(pagesIndex + '/pages/'.length);
            const depth = Math.max(pagePath.split('/').length - 1, 0);
            return '../'.repeat(depth + 1);
        }
        return '';
    }

    function ensureStylesheet() {
        if (!document.querySelector('link[data-ai-chat-style]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${root}assets/css/chatbox.css?v=20261109-nearest-v1`;
            link.dataset.aiChatStyle = 'true';
            document.head.appendChild(link);
        }
        ensureMascotAssets();
    }

    function ensureMascotAssets() {
        if (!document.querySelector('link[data-tm-mascot-style]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${root}assets/css/mascot.css?v=20261109-playful-cat-v1`;
            link.dataset.tmMascotStyle = 'true';
            document.head.appendChild(link);
        }
        if (!window.TechMascot && !document.querySelector('script[data-tm-mascot-script]')) {
            const script = document.createElement('script');
            script.src = `${root}assets/js/mascot.js?v=20261109-playful-cat-v1`;
            script.dataset.tmMascotScript = 'true';
            document.body.appendChild(script);
        }
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    function humanizeStoreName(value) {
        return String(value ?? '');
    }

    function renderMarkdownTable(tableLines) {
        if (!tableLines || !tableLines.length) return '';
        const contentRows = [];
        tableLines.forEach(line => {
            const trimmed = line.trim();
            if (/^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(trimmed)) return;
            let parts = trimmed.split('|').map(c => c.trim());
            if (parts.length > 0 && parts[0] === '') parts.shift();
            if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
            if (parts.length > 0) contentRows.push(parts);
        });

        if (contentRows.length === 0) return '';
        const headerCells = contentRows[0];
        const bodyRows = contentRows.slice(1);

        // Identify prices to detect cheaper / higher options
        const prices = [];
        bodyRows.forEach(row => {
            const criteriaText = (row[0] || '').replace(/<[^>]*>/g, '').toLowerCase();
            if (criteriaText.includes('giá') || criteriaText.includes('price')) {
                for (let i = 1; i < row.length; i++) {
                    const num = parseInt(row[i].replace(/[^\d]/g, ''), 10) || 0;
                    prices[i] = num;
                }
            }
        });

        let minPrice = Infinity;
        let maxPrice = -Infinity;
        prices.forEach(p => {
            if (p > 0) {
                if (p < minPrice) minPrice = p;
                if (p > maxPrice) maxPrice = p;
            }
        });

        let html = '<section class="ai-table-wrapper" tabindex="0" role="region" aria-label="Bảng so sánh thông số kỹ thuật">';
        html += '<div class="ai-table-scroll-hint" aria-hidden="true"><span>↔ Vuốt ngang xem chi tiết</span></div>';
        html += '<table class="ai-comparison-table">';
        html += '<caption class="visually-hidden">Bảng so sánh chi tiết kỹ thuật và giá bán sản phẩm</caption>';

        // Thead
        html += '<thead><tr>';
        headerCells.forEach((cell, idx) => {
            if (idx === 0) {
                html += `<th scope="col" class="ai-th-criteria">${cell || 'Tiêu chí'}</th>`;
            } else {
                const cleanTitle = cell.replace(/<[^>]*>/g, '').replace(/\*/g, '').trim();
                const cleanDisplay = cell.replace(/^<strong>(.*)<\/strong>$/, '$1').replace(/\*/g, '').trim();
                let badgeText = `Lựa chọn ${idx}`;
                let badgeClass = 'ai-th-badge';

                if (prices[idx] && minPrice < maxPrice) {
                    if (prices[idx] === minPrice) {
                        badgeText = '💡 Tiết kiệm chi phí';
                        badgeClass += ' ai-badge-cheaper';
                    } else if (prices[idx] === maxPrice) {
                        badgeText = '⚡ Hiệu năng vượt trội';
                        badgeClass += ' ai-badge-premium';
                    }
                }

                html += `<th scope="col" class="ai-th-product">` +
                    `<span class="${badgeClass}">${badgeText}</span>` +
                    `<strong class="ai-th-name" title="${cleanTitle}">${cleanDisplay}</strong>` +
                    `<button class="ai-table-btn-buy" type="button" data-product-name="${cleanTitle}">🛒 Chọn máy này</button>` +
                    `</th>`;
            }
        });
        html += '</tr></thead>';

        if (bodyRows.length > 0) {
            html += '<tbody>';
            bodyRows.forEach(row => {
                const criteriaCell = row[0] || '';
                const criteriaText = criteriaCell.replace(/<[^>]*>/g, '').toLowerCase();

                let rowClass = '';
                let icon = '📌';
                if (criteriaText.includes('giá') || criteriaText.includes('price')) {
                    rowClass = 'ai-row-price';
                    icon = '💰';
                } else if (criteriaText.includes('kho') || criteriaText.includes('tồn') || criteriaText.includes('stock')) {
                    rowClass = 'ai-row-stock';
                    icon = '📦';
                } else if (criteriaText.includes('cpu') || criteriaText.includes('xử lý') || criteriaText.includes('chip')) {
                    rowClass = 'ai-row-cpu';
                    icon = '⚡';
                } else if (criteriaText.includes('ram')) {
                    rowClass = 'ai-row-ram';
                    icon = '🧠';
                } else if (criteriaText.includes('ổ cứng') || criteriaText.includes('lưu trữ') || criteriaText.includes('rom') || criteriaText.includes('storage')) {
                    rowClass = 'ai-row-storage';
                    icon = '💾';
                } else if (criteriaText.includes('màn hình') || criteriaText.includes('screen')) {
                    rowClass = 'ai-row-screen';
                    icon = '📱';
                } else if (criteriaText.includes('pin') || criteriaText.includes('battery')) {
                    rowClass = 'ai-row-battery';
                    icon = '🔋';
                } else if (criteriaText.includes('bảo hành') || criteriaText.includes('warranty')) {
                    rowClass = 'ai-row-warranty';
                    icon = '🛡️';
                } else if (criteriaText.includes('trọng lượng') || criteriaText.includes('weight')) {
                    rowClass = 'ai-row-weight';
                    icon = '⚖️';
                } else if (criteriaText.includes('hệ điều hành') || criteriaText.includes('os')) {
                    rowClass = 'ai-row-os';
                    icon = '⚙️';
                }

                html += `<tr class="${rowClass}">`;
                row.forEach((cell, idx) => {
                    if (idx === 0) {
                        html += `<th scope="row" class="ai-td-label"><span class="ai-criteria-icon" aria-hidden="true">${icon}</span> <span>${cell}</span></th>`;
                    } else {
                        let cellClass = 'ai-td-val';
                        let cellDisplay = cell;
                        if (rowClass === 'ai-row-price') {
                            cellClass += ' ai-td-price';
                            const isCheapest = prices[idx] && prices[idx] === minPrice && minPrice < maxPrice;
                            cellDisplay = `<b class="ai-price-highlight">${cell}</b>` +
                                (isCheapest ? `<span class="ai-price-diff-tag">✓ Giá tốt nhất</span>` : '');
                        } else if (rowClass === 'ai-row-stock') {
                            const inStock = /còn/i.test(cell);
                            cellClass += inStock ? ' ai-td-instock' : ' ai-td-outstock';
                            cellDisplay = `<span class="ai-stock-chip ${inStock ? 'instock' : 'outstock'}">${cell}</span>`;
                        } else if (rowClass === 'ai-row-warranty') {
                            cellDisplay = `<span class="ai-warranty-chip">${cell}</span>`;
                        }
                        html += `<td class="${cellClass}">${cellDisplay}</td>`;
                    }
                });
                html += '</tr>';
            });

            // Action row at bottom of table for frictionless purchase decision
            html += '<tr class="ai-row-cta">';
            html += '<th scope="row" class="ai-td-label"><span class="ai-criteria-icon" aria-hidden="true">🎯</span> <span>Chốt đơn</span></th>';
            for (let i = 1; i < headerCells.length; i++) {
                const cleanTitle = (headerCells[i] || '').replace(/<[^>]*>/g, '').replace(/\*/g, '').trim();
                html += `<td class="ai-td-cta"><button class="ai-table-btn-buy" type="button" data-product-name="${cleanTitle}">Chọn máy này</button></td>`;
            }
            html += '</tr>';

            html += '</tbody>';
        }
        html += '</table>';

        // Reassurance footer strip to overcome purchase hesitation
        html += `<footer class="ai-table-trust">` +
            `<span class="ai-trust-badge">🛡️ 100% Chính hãng nguyên seal</span>` +
            `<span class="ai-trust-badge">🔄 Lỗi 1 đổi 1 trong 30 ngày</span>` +
            `<span class="ai-trust-badge">💳 Hỗ trợ trả góp 0% lãi suất</span>` +
            `</footer>`;

        html += '</section>';
        return html;
    }

    function formatAIMessage(rawText) {
        if (!rawText) return '';
        const escaped = escapeHTML(humanizeStoreName(rawText));
        let formatted = escaped
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        const lines = formatted.split('\n');
        const output = [];
        let inList = false;
        let tableLines = [];

        const flushList = () => {
            if (inList) {
                output.push('</ul>');
                inList = false;
            }
        };

        const flushTable = () => {
            if (tableLines.length > 0) {
                output.push(renderMarkdownTable(tableLines));
                tableLines = [];
            }
        };

        lines.forEach(line => {
            const trimmed = line.trim();

            // Detect markdown table rows
            const isTableLine = trimmed.startsWith('|') && trimmed.includes('|');
            if (isTableLine) {
                flushList();
                tableLines.push(trimmed);
                return;
            }

            // Flush table when non-table line is encountered
            flushTable();

            if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                if (!inList) {
                    output.push('<ul class="ai-chat-bullet-list">');
                    inList = true;
                }
                output.push(`<li>${trimmed.replace(/^[•-]\s*/, '')}</li>`);
            } else {
                flushList();
                if (trimmed) {
                    if (trimmed.startsWith('⚖️')) {
                        output.push(`<div class="ai-compare-header"><span class="ai-compare-pill">SO SÁNH MINH BẠCH</span><h4 class="ai-compare-title">${trimmed}</h4></div>`);
                    } else if (trimmed.startsWith('🔍')) {
                        output.push(`<div class="ai-callout ai-callout-tradeoff"><h5 class="ai-callout-title">${trimmed}</h5></div>`);
                    } else if (trimmed.startsWith('🎯')) {
                        output.push(`<div class="ai-callout ai-callout-conclusion"><h5 class="ai-callout-title">${trimmed}</h5></div>`);
                    } else if (trimmed.startsWith('🛡️')) {
                        output.push(`<div class="ai-callout ai-callout-trust"><h5 class="ai-callout-title">${trimmed}</h5></div>`);
                    } else if (trimmed.startsWith('👉')) {
                        output.push(`<p class="ai-closing-prompt">${trimmed}</p>`);
                    } else {
                        output.push(`<p>${trimmed}</p>`);
                    }
                }
            }
        });

        flushList();
        flushTable();

        return output.join('');
    }

    function renderShell() {
        const chat = document.createElement('aside');
        chat.className = 'ai-chat';
        chat.setAttribute('aria-label', 'Trợ lý tư vấn AI của cửa hàng');
        chat.innerHTML = `
            <section class="ai-chat-panel" role="dialog" aria-label="Trợ lý tư vấn mua hàng">
                <header class="ai-chat-header">
                    <div class="ai-chat-title">
                        <figure class="ai-chat-avatar">
                            <img src="${root}assets/images/logo/ai-consultant-logo.svg" alt="Avatar Trợ lý AI" width="34" height="34" class="ai-avatar-img">
                            <span class="ai-status-indicator" aria-hidden="true"></span>
                        </figure>
                        <div class="ai-chat-title-text">
                            <strong>Trợ lý AI Mua sắm</strong>
                            <span id="aiChatStatus" role="status">Trực tuyến · Hỗ trợ 24/7</span>
                        </div>
                    </div>
                    <div class="ai-chat-header-actions" aria-label="Tác vụ cửa sổ chat">
                        <button class="ai-chat-reset" type="button" aria-label="Làm mới đoạn chat" title="Làm mới đoạn chat">↺</button>
                        <button class="ai-chat-minimize" type="button" aria-label="Thu nhỏ chat" title="Thu nhỏ">─</button>
                        <a class="ai-chat-expand" href="${root}pages/ai/assistant.html" aria-label="Mở giao diện AI đầy đủ" title="Mở giao diện AI đầy đủ">↗</a>
                        <button class="ai-chat-voice" type="button" aria-label="Bật đọc câu trả lời" aria-pressed="false" title="Đọc câu trả lời bằng giọng nói">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/>
                            </svg>
                        </button>
                        <button class="ai-chat-close" type="button" aria-label="Đóng chat">×</button>
                    </div>
                </header>
                <main class="ai-chat-body" id="aiChatBody" role="log" aria-live="polite"></main>
                <nav class="ai-chat-suggestions-nav" id="aiChatSuggestionsNav" aria-label="Gợi ý tác vụ nhanh">
                    <button type="button" class="ai-suggestions-arrow ai-suggestions-prev" aria-label="Cuộn gợi ý sang trái" hidden>‹</button>
                    <div class="ai-chat-suggestions-bar" id="aiChatSuggestions"></div>
                    <button type="button" class="ai-suggestions-arrow ai-suggestions-next" aria-label="Cuộn gợi ý sang phải" hidden>›</button>
                </nav>
                <form class="ai-chat-form" id="aiChatForm" role="search">
                    <button class="ai-chat-camera" id="aiChatCameraBtn" type="button" aria-label="Tìm kiếm sản phẩm bằng hình ảnh" title="Gửi ảnh để AI tìm sản phẩm">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </button>
                    <input type="file" id="aiChatCameraInput" accept="image/*" style="display:none" aria-hidden="true">
                    <!-- Lucian UX/UI Prompt #084 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#084 -->
                    <button class="ai-chat-mic u084-mic-btn" type="button" aria-label="Nhập bằng giọng nói" title="Nhập bằng giọng nói">
                        <svg class="u084-mic-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/>
                        </svg>
                        <span class="u084-voice-dots" aria-hidden="true"><i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i><i style="--i:3"></i><i style="--i:4"></i></span>
                    </button>
                    <input class="ai-chat-input" id="aiChatInput" type="text" placeholder="Hỏi giá, so sánh, mã giảm giá, trả góp..." autocomplete="off">
                    <button class="ai-chat-send" type="submit" aria-label="Gửi tin nhắn">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-6-6 6 6-6 6"></path>
                        </svg>
                    </button>
                </form>
            </section>
            <aside class="ai-fab-greeting" id="aiFabGreeting" role="tooltip" aria-hidden="true">
                <span class="ai-fab-greeting-text">👋 Cần AI tư vấn chọn máy?</span>
                <button type="button" class="ai-fab-greeting-close" aria-label="Đóng lời chào">×</button>
            </aside>
            <button class="ai-chat-min-pill" type="button" aria-label="Mở lại AI tư vấn" title="Mở lại AI tư vấn">
                <figure class="ai-chat-min-avatar">
                    <img src="${root}assets/images/logo/ai-consultant-logo.svg" alt="" width="20" height="20" class="ai-avatar-img">
                </figure>
                <span>AI tư vấn</span>
                <span class="ai-chat-min-arrow" aria-hidden="true">▲</span>
            </button>
            <!-- Store Contact Launcher Widget (Chuẩn ảnh 1: Nút đỏ Liên hệ + Popover menu Zalo & Tư vấn AI đồng bộ) -->
            <aside class="store-contact-launcher" id="storeContactLauncher" aria-label="Widget liên hệ hỗ trợ">
                <!-- Popup menu sổ lên phía trên -->
                <nav class="contact-popover" id="contactPopover" role="menu" aria-label="Menu liên hệ hỗ trợ" aria-hidden="true">
                    <button type="button" class="contact-popover-item contact-item-ai" id="contactItemAi" role="menuitem" title="Chat tư vấn cùng Trợ lý AI của cửa hàng">
                        <figure class="contact-item-icon ai-avatar-circle" aria-hidden="true">
                            <img src="${root}assets/images/logo/ai-consultant-logo.svg" alt="" width="38" height="38" class="contact-ai-avatar">
                        </figure>
                        <div class="contact-item-text-group">
                            <span class="contact-item-title">Tư vấn AI</span>
                            <span class="contact-item-sub">Giải đáp mọi thắc mắc 24/7</span>
                        </div>
                    </button>
                    <a href="https://zalo.me/0842331606" target="_blank" rel="noopener noreferrer" class="contact-popover-item contact-item-zalo" id="contactItemZalo" role="menuitem" title="Chat trực tiếp qua Zalo CSKH (0842.331.606)">
                        <figure class="contact-item-icon zalo-avatar-circle" aria-hidden="true">
                            <img src="${root}assets/images/logo/zalo-badge.svg" alt="" width="38" height="38" class="contact-zalo-avatar">
                        </figure>
                        <div class="contact-item-text-group">
                            <span class="contact-item-title">Liên hệ Zalo</span>
                            <span class="contact-item-sub">Hotline: 0842.331.606</span>
                        </div>
                    </a>
                </nav>

                <!-- Nút Liên hệ chính màu đỏ chuẩn ảnh 1 -->
                <button type="button" class="contact-main-btn rhythmic-pulse-shake-contact" id="contactMainBtn" aria-expanded="false" aria-haspopup="true" aria-label="Liên hệ hỗ trợ và tư vấn">
                    <span class="contact-btn-text">Liên hệ</span>
                    <svg class="contact-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                </button>
            </aside>
        `;
        document.body.appendChild(chat);
        return chat;
    }

    function scrollToBottom(body) {
        if (!body) return;
        requestAnimationFrame(() => {
            body.scrollTop = body.scrollHeight;
            setTimeout(() => {
                body.scrollTop = body.scrollHeight;
            }, 80);
        });
    }

    /* Lucian UX/UI Prompt #086 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#086 */
    function appendMessage(body, role, text) {
        const message = document.createElement('article');
        message.className = `ai-message ${role} u215-msg-pop`;
        const bubble = document.createElement('section');
        bubble.className = 'ai-bubble';
        if (String(role).includes('ai-typing')) {
            bubble.innerHTML = `<div class="u086-thinking-row"><span class="u086-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${escapeHTML(text)}</span></div>`;
        } else {
            bubble.innerHTML = role === 'user' ? `<p>${escapeHTML(text)}</p>` : formatAIMessage(text);
        }
        message.appendChild(bubble);
        body.appendChild(message);
        scrollToBottom(body);
        return message;
    }

    function streamAIMessage(body, text, onComplete) {
        const message = document.createElement('article');
        message.className = 'ai-message ai u215-msg-pop';
        const bubble = document.createElement('section');
        bubble.className = 'ai-bubble u086-stream-bubble';
        message.appendChild(bubble);
        body.appendChild(message);

        // Nếu chuỗi ngắn hoặc trình duyệt giảm chuyển động
        if (!text || text.length < 40 || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('visual-reduce-motion')) {
            bubble.innerHTML = formatAIMessage(text);
            scrollToBottom(body);
            if (typeof onComplete === 'function') onComplete();
            return message;
        }

        let idx = 0;
        const total = text.length;
        const step = Math.max(3, Math.floor(total / 25));
        const cursor = document.createElement('span');
        cursor.className = 'ai-typing-cursor u086-caret';
        cursor.setAttribute('aria-hidden', 'true');

        const timer = setInterval(() => {
            idx = Math.min(idx + step, total);
            bubble.innerHTML = formatAIMessage(text.slice(0, idx));
            bubble.appendChild(cursor);
            scrollToBottom(body);

            if (idx >= total) {
                clearInterval(timer);
                cursor.remove();
                if (typeof onComplete === 'function') onComplete();
            }
        }, 20);

        return message;
    }

    function handleAddToCart(productId, button) {
        // 1. Ưu tiên hàm addToCart có sẵn trên trang nếu tồn tại
        if (typeof window.addToCart === 'function') {
            try {
                window.addToCart(productId);
                setAddedFeedback(button);
                return;
            } catch (err) {
                console.warn('window.addToCart error, using fallback:', err);
            }
        }

        // 2. Dự phòng an toàn cho toàn bộ các trang trên website
        const cartKey = window.auth?.getCartStorageKey?.() || (localStorage.getItem('token') ? 'cart:user' : 'cart:guest');
        let cart = [];
        try {
            cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
            if (!Array.isArray(cart)) cart = [];
        } catch (e) {
            cart = [];
        }

        const item = cart.find(i => String(i.productId) === String(productId));
        if (item) {
            item.quantity = (Number(item.quantity) || 1) + 1;
        } else {
            cart.push({ productId: Number(productId), quantity: 1 });
        }
        localStorage.setItem(cartKey, JSON.stringify(cart));

        // Cập nhật tất cả badge giỏ hàng đang có trên trang
        const totalCount = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
        document.querySelectorAll('#headerCartBadge, .header-cart-badge, #bottomNavCartBadge').forEach(badge => {
            badge.textContent = totalCount;
            badge.removeAttribute('hidden');
        });

        // Kích hoạt sự kiện toàn cục để các component khác đồng bộ
        window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
        if (typeof window.renderCart === 'function') window.renderCart();

        setAddedFeedback(button);
    }

    function setAddedFeedback(button) {
        if (!button) return;
        const originalText = button.innerHTML;
        button.classList.add('added');
        button.innerHTML = '<span>✓ Đã thêm</span>';
        setTimeout(() => {
            button.classList.remove('added');
            button.innerHTML = originalText;
        }, 2000);
    }

    function setupSuggestionsDragScroll(navEl, list) {
        if (!list || !navEl) return;

        const prevBtn = navEl.querySelector('.ai-suggestions-prev');
        const nextBtn = navEl.querySelector('.ai-suggestions-next');

        function updateArrows() {
            if (!list || !list.isConnected) return;
            const canScroll = list.scrollWidth > (list.clientWidth + 4);
            if (!canScroll) {
                if (prevBtn) prevBtn.hidden = true;
                if (nextBtn) nextBtn.hidden = true;
                navEl.classList.remove('has-prev', 'has-next');
                return;
            }
            const maxScroll = list.scrollWidth - list.clientWidth;
            const hasPrev = list.scrollLeft > 4;
            const hasNext = list.scrollLeft < (maxScroll - 4);
            if (prevBtn) prevBtn.hidden = !hasPrev;
            if (nextBtn) nextBtn.hidden = !hasNext;
            navEl.classList.toggle('has-prev', hasPrev);
            navEl.classList.toggle('has-next', hasNext);
        }

        if (!list._dragScrollInit) {
            list._dragScrollInit = true;

            if (prevBtn) {
                prevBtn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    list.scrollBy({ left: -140, behavior: 'smooth' });
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    list.scrollBy({ left: 140, behavior: 'smooth' });
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

            // Prevent chip click when user was dragging
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
        }

        requestAnimationFrame(updateArrows);
        setTimeout(updateArrows, 60);
        setTimeout(updateArrows, 300);
    }

    function renderSuggestions(container, suggestions, onClick) {
        if (!container) return;
        const nav = container.closest('.ai-chat-suggestions-nav') || container.parentElement || container;
        container.innerHTML = '';
        if (!Array.isArray(suggestions) || !suggestions.length) {
            nav.style.display = 'none';
            return;
        }

        nav.style.display = 'flex';
        container.scrollLeft = 0;
        container.innerHTML = suggestions
            .map(item => `<button class="ai-chip" type="button" draggable="false">${escapeHTML(item)}</button>`)
            .join('');

        container.querySelectorAll('.ai-chip').forEach(button => {
            button.addEventListener('click', () => onClick(button.textContent));
        });

        setupSuggestionsDragScroll(nav, container);
    }

    function renderVouchers(body, vouchers) {
        if (!Array.isArray(vouchers) || !vouchers.length) return;

        const list = document.createElement('section');
        list.className = 'ai-chat-vouchers';
        list.setAttribute('aria-label', 'Mã giảm giá đang hoạt động');
        list.innerHTML = vouchers.slice(0, 3).map(v => {
            const discount = v.type === 'percent' ? `Giảm ${v.value}%` : `Giảm ${Number(v.value || 0).toLocaleString('vi-VN')} đ`;
            const condition = v.minOrderValue > 0 ? `Đơn từ ${Number(v.minOrderValue).toLocaleString('vi-VN')} đ` : 'Mọi đơn hàng';
            return `
                <article class="ai-voucher-card">
                    <span class="ai-voucher-badge">MÃ GIẢM GIÁ</span>
                    <div class="ai-voucher-info">
                        <strong class="ai-voucher-code">${escapeHTML(v.code)}</strong>
                        <small class="ai-voucher-desc">${discount} · ${condition}</small>
                    </div>
                    <button class="ai-voucher-copy-btn" type="button" data-code="${escapeHTML(v.code)}" aria-label="Sao chép mã ${escapeHTML(v.code)}">
                        Sao chép
                    </button>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.ai-voucher-copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.getAttribute('data-code');
                try {
                    await navigator.clipboard.writeText(code);
                    btn.textContent = '✓ Đã lưu';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.textContent = 'Sao chép';
                        btn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    btn.textContent = code;
                }
            });
        });

        body.appendChild(list);
        scrollToBottom(body);
    }

    function getOrCreateVideoModal() {
        let modal = document.getElementById('aiVideoModal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.className = 'ai-video-modal';
            modal.id = 'aiVideoModal';
            modal.setAttribute('aria-labelledby', 'aiVideoModalTitle');
            modal.innerHTML = `
                <article class="ai-video-modal-content">
                    <header class="ai-video-modal-header">
                        <h3 id="aiVideoModalTitle">🎬 Video giới thiệu sản phẩm</h3>
                        <button class="ai-video-modal-close" type="button" aria-label="Đóng video">×</button>
                    </header>
                    <figure class="ai-video-modal-figure">
                        <div class="ai-video-iframe-box">
                            <iframe id="aiVideoModalIframe" src="" title="Video giới thiệu sản phẩm" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="origin"></iframe>
                        </div>
                        <figcaption class="ai-video-modal-caption" id="aiVideoModalCaption">Video review & trên tay thực tế</figcaption>
                    </figure>
                </article>
            `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('.ai-video-modal-close');
            if (closeBtn) closeBtn.addEventListener('click', () => closeVideoModal(modal));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeVideoModal(modal);
            });
            modal.addEventListener('close', () => {
                const iframe = modal.querySelector('#aiVideoModalIframe');
                if (iframe) iframe.src = '';
            });
        }
        return modal;
    }

    function openVideoModal(videoUrl, title) {
        if (!videoUrl) return;
        const modal = getOrCreateVideoModal();
        const iframe = modal.querySelector('#aiVideoModalIframe');
        const titleEl = modal.querySelector('#aiVideoModalTitle');
        const captionEl = modal.querySelector('#aiVideoModalCaption');

        if (titleEl) titleEl.textContent = `🎬 ${title || 'Video giới thiệu sản phẩm'}`;

        let embedUrl = videoUrl;
        const originParam = `origin=${encodeURIComponent(window.location.origin)}`;
        if (!embedUrl.includes('?')) {
            embedUrl += `?rel=0&modestbranding=1&enablejsapi=1&${originParam}`;
        } else if (!embedUrl.includes('origin=')) {
            embedUrl += `&enablejsapi=1&${originParam}`;
        }

        const watchUrl = videoUrl.replace('/embed/', '/watch?v=').split('?')[0];
        if (captionEl) {
            captionEl.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;">
                    <span>Trải nghiệm cận cảnh và đánh giá tính năng nổi bật của <strong>${escapeHTML(title || 'sản phẩm')}</strong></span>
                    <a href="${escapeHTML(watchUrl)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:none;font-weight:700;font-size:0.8rem;white-space:nowrap;padding:3px 8px;border-radius:6px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);">↗ Xem YouTube</a>
                </div>
            `;
        }

        if (iframe) iframe.src = embedUrl;

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.setAttribute('open', 'true');
        }
    }

    function closeVideoModal(modal) {
        if (!modal) modal = document.getElementById('aiVideoModal');
        if (!modal) return;
        const iframe = modal.querySelector('#aiVideoModalIframe');
        if (iframe) iframe.src = '';
        if (typeof modal.close === 'function') {
            modal.close();
        } else {
            modal.removeAttribute('open');
        }
    }

    function renderChatProducts(body, products, shouldScroll = true) {
        if (!Array.isArray(products) || !products.length) return;

        const list = document.createElement('section');
        list.className = 'ai-chat-products';
        list.setAttribute('aria-label', 'Sản phẩm chatbot gợi ý');
        list.innerHTML = products.slice(0, 3).map(product => `
            <article class="ai-chat-product-card">
                <a class="ai-chat-product-link" href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}" title="Xem chi tiết ${escapeHTML(product.name)}">
                    <figure class="ai-chat-product-figure">
                        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" width="54" height="54" loading="lazy">
                    </figure>
                    <span class="ai-chat-product-info">
                        <strong class="ai-chat-product-title">${escapeHTML(product.name)}</strong>
                        <small class="ai-chat-product-tag ${product.recommendation?.reason ? 'ai-tag-optimal' : ''}">${product.recommendation?.reason ? `🏆 ${escapeHTML(product.recommendation.reason)}` : escapeHTML(product.category || 'Chính hãng')}</small>
                        <b class="ai-chat-product-price">${Number(product.price || 0).toLocaleString('vi-VN')} đ</b>
                    </span>
                </a>
                <footer class="ai-chat-product-actions">
                    <button class="ai-chat-btn-cart" type="button" data-id="${product._id}" aria-label="Thêm ${escapeHTML(product.name)} vào giỏ">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        <span>+ Giỏ</span>
                    </button>
                    ${product.videoUrl ? `
                    <button class="ai-chat-btn-video" type="button" data-video="${escapeHTML(product.videoUrl)}" data-name="${escapeHTML(product.name)}" aria-label="Xem video ${escapeHTML(product.name)}">
                        ▶ Video
                    </button>
                    ` : ''}
                    <a class="ai-chat-btn-detail" href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}">
                        Chi tiết
                    </a>
                </footer>
            </article>
        `).join('');

        list.querySelectorAll('.ai-chat-btn-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                handleAddToCart(id, btn);
            });
        });

        list.querySelectorAll('.ai-chat-btn-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const videoUrl = btn.getAttribute('data-video');
                const name = btn.getAttribute('data-name');
                openVideoModal(videoUrl, name);
            });
        });

        body.appendChild(list);
        if (shouldScroll) scrollToBottom(body);
        return list;
    }

    function handleAddToCartWithVariant(productId, quantity = 1, variant = {}, customPrice = null) {
        const cartKey = window.auth?.getCartStorageKey?.() || (localStorage.getItem('token') ? 'cart:user' : 'cart:guest');
        let cart = [];
        try {
            cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
            if (!Array.isArray(cart)) cart = [];
        } catch (e) {
            cart = [];
        }

        const matchIdx = cart.findIndex(i => String(i.productId) === String(productId) && JSON.stringify(i.selectedVariant || {}) === JSON.stringify(variant));
        if (matchIdx >= 0) {
            cart[matchIdx].quantity = (Number(cart[matchIdx].quantity) || 1) + quantity;
            if (customPrice) cart[matchIdx].bundlePrice = customPrice;
        } else {
            const entry = { productId: Number(productId), quantity: Number(quantity) || 1 };
            if (Object.keys(variant).length > 0) entry.selectedVariant = variant;
            if (customPrice) entry.bundlePrice = customPrice;
            cart.push(entry);
        }

        localStorage.setItem(cartKey, JSON.stringify(cart));

        // Cập nhật tất cả badge giỏ hàng trên trang
        const totalCount = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
        document.querySelectorAll('#headerCartBadge, .header-cart-badge, #bottomNavCartBadge').forEach(badge => {
            badge.textContent = totalCount;
            badge.removeAttribute('hidden');
        });

        window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
        window.dispatchEvent(new Event('cartUpdated'));
        if (typeof window.renderCart === 'function') window.renderCart();
    }

    function recordUserShoppingInterest(category, productName) {
        try {
            const profile = JSON.parse(localStorage.getItem('ai_shopping_profile') || '{}');
            if (category) profile.lastCategory = category;
            if (productName) {
                profile.lastProduct = productName;
                profile.viewed = profile.viewed || [];
                if (!profile.viewed.includes(productName)) {
                    profile.viewed.unshift(productName);
                    profile.viewed = profile.viewed.slice(0, 5);
                }
            }
            profile.updatedAt = Date.now();
            localStorage.setItem('ai_shopping_profile', JSON.stringify(profile));
        } catch (e) { }
    }

    function getPersonalizedWelcome() {
        try {
            const profile = JSON.parse(localStorage.getItem('ai_shopping_profile') || '{}');
            const now = Date.now();
            const currentCat = new URLSearchParams(window.location.search).get('category');
            const matchCategory = !currentCat || (profile.lastCategory && profile.lastCategory.toLowerCase() === currentCat.toLowerCase());

            // Chỉ hiển thị sản phẩm vừa xem nếu thực sự có tương tác trong vòng 10 phút gần nhất và cùng danh mục
            if (profile.lastProduct && profile.updatedAt && (now - profile.updatedAt < 10 * 60 * 1000) && matchCategory) {
                return {
                    text: `Xin chào! Rất vui được gặp lại bạn 😊 Bạn đang quan tâm mẫu **${profile.lastProduct}**. Mẫu này hiện đang có sẵn tại showroom và hỗ trợ trả góp 0%. Bạn có muốn em so sánh chi tiết hoặc kiểm tra gói combo trợ giá hôm nay không?`,
                    suggestions: [
                        `Xem giá ${profile.lastProduct}`,
                        'Combo phụ kiện giảm 30%',
                        'Săn mã giảm giá hôm nay',
                        'Tính trả góp 0%'
                    ]
                };
            }
        } catch (e) { }

        return {
            text: 'Xin chào! Em là Trợ lý Mua sắm AI của cửa hàng. Em có thể giúp bạn tìm sản phẩm theo ngân sách, so sánh thông số kỹ thuật, săn mã giảm giá và tính toán trả góp 0%. Bạn cần hỗ trợ gì hôm nay?',
            suggestions: starterSuggestions
        };
    }

    function renderInteractiveProductCard(body, product, coupon = null, shouldScroll = true) {
        if (!product) return null;

        const card = document.createElement('article');
        card.className = 'ai-interactive-card';
        card.setAttribute('role', 'region');
        card.setAttribute('aria-label', `Bộ chọn cấu hình & Mua nhanh ${escapeHTML(product.name)}`);

        // Xử lý biến thể màu sắc
        let colors = [];
        if (Array.isArray(product.variants) && product.variants.length > 0) {
            colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];
        }
        if (!colors.length) {
            const nameLower = (product.name || '').toLowerCase();
            if (nameLower.includes('titan') || nameLower.includes('iphone')) {
                colors = ['Titan Tự Nhiên', 'Titan Đen', 'Titan Trắng', 'Titan Xanh'];
            } else if (nameLower.includes('galaxy') || nameLower.includes('samsung')) {
                colors = ['Đen Titan', 'Xám Bạc', 'Tím Violet'];
            } else if (nameLower.includes('macbook')) {
                colors = ['Xám Không Gian', 'Bạc Tinh Khiết', 'Đen Nửa Đêm'];
            } else if (nameLower.includes('laptop') || nameLower.includes('asus') || nameLower.includes('lenovo')) {
                colors = ['Xám Mecha', 'Đen Eclipse', 'Bạc Platinum'];
            } else {
                colors = ['Đen Tiêu Chuẩn', 'Bạc Sang Trọng'];
            }
        }

        // Xử lý cấu hình bộ nhớ / thông số
        let specs = [];
        const catLower = (product.category || '').toLowerCase();
        if (catLower.includes('thoại') || catLower.includes('tablet')) {
            specs = [
                { label: '128GB', extra: 0 },
                { label: '256GB', extra: 2000000 },
                { label: '512GB', extra: 5000000 }
            ];
        } else if (catLower.includes('laptop')) {
            specs = [
                { label: '16GB RAM / 512GB SSD', extra: 0 },
                { label: '32GB RAM / 1TB SSD', extra: 3500000 }
            ];
        } else if (catLower.includes('đồng hồ') || catLower.includes('smartwatch')) {
            specs = [
                { label: 'Bản 40mm GPS', extra: 0 },
                { label: 'Bản 44mm GPS + LTE', extra: 1500000 }
            ];
        }

        const basePrice = Number(product.price || 0);
        let selectedColor = colors[0] || 'Mặc định';
        let selectedSpec = specs[0] || { label: 'Tiêu chuẩn', extra: 0 };
        let currentPrice = basePrice + selectedSpec.extra;

        const colorMap = {
            'titan tự nhiên': '#b8aba0',
            'titan đen': '#2d3033',
            'titan trắng': '#e3e4e5',
            'titan xanh': '#394653',
            'đen titan': '#1e2022',
            'xám bạc': '#9ba1a6',
            'tím violet': '#685e79',
            'xám không gian': '#53565b',
            'bạc tinh khiết': '#e3e4e5',
            'đen nửa đêm': '#1a222d',
            'xám mecha': '#4a5568',
            'đen eclipse': '#1a202c',
            'bạc platinum': '#cbd5e1',
            'đen tiêu chuẩn': '#0f172a',
            'bạc sang trọng': '#94a3b8'
        };

        const renderColorChips = () => colors.map(c => {
            const hex = colorMap[c.toLowerCase()] || '#0068FF';
            const isActive = c === selectedColor;
            return `
                <button type="button" class="ai-variant-chip color-chip ${isActive ? 'active' : ''}" data-color="${escapeHTML(c)}" role="radio" aria-checked="${isActive}">
                    <span class="ai-color-dot" style="background:${hex};" aria-hidden="true"></span>
                    <span>${escapeHTML(c)}</span>
                </button>
            `;
        }).join('');

        const renderSpecChips = () => specs.map((s, idx) => {
            const isActive = s.label === selectedSpec.label;
            const diffTag = s.extra > 0 ? ` (+${(s.extra / 1000000).toFixed(1).replace('.0', '')}tr)` : '';
            return `
                <button type="button" class="ai-variant-chip spec-chip ${isActive ? 'active' : ''}" data-index="${idx}" role="radio" aria-checked="${isActive}">
                    <span>${escapeHTML(s.label)}</span>
                    ${diffTag ? `<small class="ai-diff-tag">${diffTag}</small>` : ''}
                </button>
            `;
        }).join('');

        const updateDisplay = () => {
            currentPrice = basePrice + selectedSpec.extra;
            const priceEl = card.querySelector('.ai-icard-price-current');
            const compareEl = card.querySelector('.ai-icard-price-compare');
            const instEl = card.querySelector('.ai-icard-inst-val');
            if (priceEl) priceEl.textContent = `${Number(currentPrice).toLocaleString('vi-VN')} đ`;
            if (compareEl) {
                const orig = Math.round(currentPrice * 1.15 / 100000) * 100000;
                compareEl.textContent = `${Number(orig).toLocaleString('vi-VN')} đ`;
            }
            if (instEl) {
                const perMonth = Math.round((currentPrice * 0.7) / 12);
                instEl.textContent = `~${Number(perMonth).toLocaleString('vi-VN')} đ/tháng`;
            }
        };

        const origPrice = Math.round(currentPrice * 1.15 / 100000) * 100000;
        const perMonth = Math.round((currentPrice * 0.7) / 12);

        card.innerHTML = `
            <header class="ai-icard-header">
                <figure class="ai-icard-fig">
                    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" width="70" height="70" loading="lazy">
                </figure>
                <div class="ai-icard-info">
                    <div class="ai-icard-badges">
                        <span class="ai-badge-verified">✓ Chính hãng 100%</span>
                        <span class="ai-badge-stock">⚡ Sẵn hàng</span>
                    </div>
                    <h4 class="ai-icard-title">
                        <a href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}" title="Xem chi tiết ${escapeHTML(product.name)}">
                            ${escapeHTML(product.name)}
                        </a>
                    </h4>
                    <div class="ai-icard-rating">
                        <span class="ai-stars" aria-hidden="true">★★★★★</span>
                        <small>4.9/5 (142 đánh giá)</small>
                    </div>
                </div>
            </header>

            <section class="ai-icard-body">
                ${colors.length > 1 ? `
                <div class="ai-icard-group">
                    <span class="ai-group-label">Chọn màu sắc:</span>
                    <div class="ai-variant-chips ai-color-chips-container" role="radiogroup" aria-label="Màu sắc">
                        ${renderColorChips()}
                    </div>
                </div>
                ` : ''}

                ${specs.length > 0 ? `
                <div class="ai-icard-group">
                    <span class="ai-group-label">Cấu hình bộ nhớ:</span>
                    <div class="ai-variant-chips ai-spec-chips-container" role="radiogroup" aria-label="Cấu hình">
                        ${renderSpecChips()}
                    </div>
                </div>
                ` : ''}

                <div class="ai-icard-pricing">
                    <div class="ai-icard-price-row">
                        <strong class="ai-icard-price-current">${Number(currentPrice).toLocaleString('vi-VN')} đ</strong>
                        <span class="ai-icard-price-compare">${Number(origPrice).toLocaleString('vi-VN')} đ</span>
                        <span class="ai-icard-discount-pill">-15%</span>
                    </div>
                    <div class="ai-icard-installment">
                        <span>💳 Trả góp 0%: <strong class="ai-icard-inst-val">~${Number(perMonth).toLocaleString('vi-VN')} đ/tháng</strong> (Duyệt nhanh CCCD)</span>
                    </div>
                </div>

                <div class="ai-icard-voucher" role="status">
                    <span class="ai-voucher-star" aria-hidden="true">🎁</span>
                    <span>Mã AI trợ giá: <strong>TECHVIP</strong> (Giảm thêm 200.000 đ)</span>
                </div>
            </section>

            <footer class="ai-icard-footer">
                <button type="button" class="ai-icard-btn-buy" aria-label="Mua ngay và thanh toán nhanh">
                    ⚡ Mua Ngay (1 chạm)
                </button>
                <button type="button" class="ai-icard-btn-cart" aria-label="Thêm vào giỏ hàng">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <span>Thêm giỏ</span>
                </button>
            </footer>
        `;

        // Sự kiện chọn màu
        card.querySelectorAll('.color-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                selectedColor = btn.getAttribute('data-color');
                card.querySelectorAll('.color-chip').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
            });
        });

        // Sự kiện chọn cấu hình
        card.querySelectorAll('.spec-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const idx = parseInt(btn.getAttribute('data-index'), 10) || 0;
                selectedSpec = specs[idx] || specs[0];
                card.querySelectorAll('.spec-chip').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                updateDisplay();
            });
        });

        // Nút Mua Ngay -> Thanh toán siêu tốc 1 chạm
        const buyBtn = card.querySelector('.ai-icard-btn-buy');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                const variantInfo = { color: selectedColor, spec: selectedSpec.label };
                handleAddToCartWithVariant(product._id, 1, variantInfo, currentPrice);
                sessionStorage.setItem('appliedCoupon', JSON.stringify({ code: 'TECHVIP', discount: 200000 }));
                localStorage.setItem('checkout_coupon', 'TECHVIP');

                // 1. Nếu đang ở trang chi tiết sản phẩm: mở trực tiếp modal Thanh toán 1 chạm
                if (typeof window.openExpressCheckoutModal === 'function') {
                    window.openExpressCheckoutModal();
                    return;
                }

                // 2. Nếu đang ở storefront: mở trực tiếp giỏ hàng drawer
                if (typeof window.openCartDrawer === 'function') {
                    window.openCartDrawer();
                    if (typeof window.goToCartStep === 'function') window.goToCartStep(2);
                    return;
                }

                // 3. Mặc định chuyển sang giỏ hàng storefront mở sẵn
                window.location.href = `${root}index.html?openCart=1`;
            });
        }

        // Nút Thêm Vào Giỏ
        const cartBtn = card.querySelector('.ai-icard-btn-cart');
        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                const variantInfo = { color: selectedColor, spec: selectedSpec.label };
                handleAddToCartWithVariant(product._id, 1, variantInfo, currentPrice);
                cartBtn.innerHTML = `<span>✓ Đã thêm</span>`;
                cartBtn.classList.add('added');
                setTimeout(() => {
                    cartBtn.innerHTML = `
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        <span>Thêm giỏ</span>
                    `;
                    cartBtn.classList.remove('added');
                }, 2000);
            });
        }

        body.appendChild(card);
        if (shouldScroll) scrollToBottom(body);
        return card;
    }

    function renderBundleCard(body, bundleData, shouldScroll = true) {
        if (!bundleData || !bundleData.mainProduct) return null;

        const card = document.createElement('section');
        card.className = 'ai-bundle-card';
        card.setAttribute('role', 'region');
        card.setAttribute('aria-label', 'Combo phụ kiện trợ giá độc quyền');

        const mainProd = bundleData.mainProduct;
        const addons = Array.isArray(bundleData.addons) ? bundleData.addons : [];

        const calculateTotals = () => {
            const checkedAddons = [];
            card.querySelectorAll('.ai-bundle-checkbox:checked').forEach(cb => {
                const id = cb.getAttribute('data-id');
                const matched = addons.find(a => a.id === id);
                if (matched) checkedAddons.push(matched);
            });

            const mainPrice = Number(mainProd.price) || 0;
            const originalTotal = mainPrice + checkedAddons.reduce((s, a) => s + (Number(a.originalPrice) || 0), 0);
            const bundleTotal = mainPrice + checkedAddons.reduce((s, a) => s + (Number(a.bundlePrice) || 0), 0);
            const savings = Math.max(originalTotal - bundleTotal, 0);

            const totalEl = card.querySelector('.ai-bundle-total-price');
            const origEl = card.querySelector('.ai-bundle-total-orig');
            const savingsEl = card.querySelector('.ai-bundle-savings-amount');
            const countEl = card.querySelector('.ai-bundle-count');

            if (totalEl) totalEl.textContent = `${Number(bundleTotal).toLocaleString('vi-VN')} đ`;
            if (origEl) origEl.textContent = savings > 0 ? `${Number(originalTotal).toLocaleString('vi-VN')} đ` : '';
            if (savingsEl) savingsEl.textContent = `${Number(savings).toLocaleString('vi-VN')} đ`;
            if (countEl) countEl.textContent = `${1 + checkedAddons.length}`;
        };

        const mainPrice = Number(mainProd.price) || 0;
        const initialChecked = addons.filter(a => a.selected !== false);
        const initialOrig = mainPrice + initialChecked.reduce((s, a) => s + (Number(a.originalPrice) || 0), 0);
        const initialTotal = mainPrice + initialChecked.reduce((s, a) => s + (Number(a.bundlePrice) || 0), 0);
        const initialSavings = Math.max(initialOrig - initialTotal, 0);

        card.innerHTML = `
            <header class="ai-bundle-header">
                <span class="ai-bundle-pill">🔥 COMBO TRỢ GIÁ ĐỘC QUYỀN</span>
                <h4 class="ai-bundle-title">Gói Phụ Kiện Trợ Giá Tiết Kiệm Khi Mua Kèm Máy</h4>
                <p class="ai-bundle-subtitle">Tùy ý tích chọn phụ kiện bạn cần để nhận mức chiết khấu đến 30%</p>
            </header>

            <article class="ai-bundle-main-row">
                <span class="ai-bundle-main-check" aria-label="Đã chọn">✓</span>
                <figure class="ai-bundle-fig">
                    <img src="${escapeHTML(mainProd.image)}" alt="${escapeHTML(mainProd.name)}" width="44" height="44" loading="lazy">
                </figure>
                <div class="ai-bundle-row-info">
                    <span class="ai-bundle-badge-role">Máy chính:</span>
                    <strong>${escapeHTML(mainProd.name)}</strong>
                    <b class="ai-bundle-price">${Number(mainProd.price).toLocaleString('vi-VN')} đ</b>
                </div>
            </article>

            <fieldset class="ai-bundle-addons-list">
                <legend class="visually-hidden">Danh sách phụ kiện mua kèm</legend>
                ${addons.map(addon => `
                    <label class="ai-bundle-addon-item">
                        <input type="checkbox" class="ai-bundle-checkbox" data-id="${escapeHTML(addon.id)}" data-pid="${addon.productId}" ${addon.selected !== false ? 'checked' : ''}>
                        <figure class="ai-bundle-fig">
                            <img src="${escapeHTML(addon.image)}" alt="${escapeHTML(addon.name)}" width="40" height="40" loading="lazy">
                        </figure>
                        <div class="ai-bundle-row-info">
                            <strong>${escapeHTML(addon.name)}</strong>
                            <div class="ai-bundle-price-pair">
                                <b class="ai-bundle-addon-price">${Number(addon.bundlePrice).toLocaleString('vi-VN')} đ</b>
                                <span class="ai-bundle-addon-orig">${Number(addon.originalPrice).toLocaleString('vi-VN')} đ</span>
                                <span class="ai-bundle-discount-tag">-${addon.discountPercent || 25}%</span>
                            </div>
                        </div>
                    </label>
                `).join('')}
            </fieldset>

            <footer class="ai-bundle-footer">
                <div class="ai-bundle-summary-info">
                    <div class="ai-bundle-total-row">
                        <span>Tổng <span class="ai-bundle-count">${1 + initialChecked.length}</span> món:</span>
                        <strong class="ai-bundle-total-price">${Number(initialTotal).toLocaleString('vi-VN')} đ</strong>
                        <span class="ai-bundle-total-orig">${Number(initialOrig).toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div class="ai-bundle-savings-tag">
                        <span>Tiết kiệm ngay: <b class="ai-bundle-savings-amount">${Number(initialSavings).toLocaleString('vi-VN')} đ</b></span>
                    </div>
                </div>
                <button type="button" class="ai-bundle-btn-buy">
                    ⚡ Thêm Cả Combo Vào Giỏ Hàng
                </button>
            </footer>
        `;

        card.querySelectorAll('.ai-bundle-checkbox').forEach(cb => {
            cb.addEventListener('change', calculateTotals);
        });

        const submitBtn = card.querySelector('.ai-bundle-btn-buy');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const checkedAddons = [];
                card.querySelectorAll('.ai-bundle-checkbox:checked').forEach(cb => {
                    const id = cb.getAttribute('data-id');
                    const matched = addons.find(a => a.id === id);
                    if (matched) checkedAddons.push(matched);
                });

                // Thêm máy chính
                handleAddToCart(mainProd._id);
                // Thêm các phụ kiện đã chọn
                checkedAddons.forEach(a => {
                    handleAddToCartWithVariant(a.productId, 1, { isBundleAddon: true }, a.bundlePrice);
                });

                submitBtn.textContent = '✓ Đã thêm Combo! Đến Giỏ Hàng ➜';
                submitBtn.classList.add('added');
                submitBtn.onclick = () => {
                    if (typeof window.openCartDrawer === 'function') {
                        window.openCartDrawer();
                        return;
                    }
                    window.location.href = `${root}index.html?openCart=1`;
                };
            });
        }

        body.appendChild(card);
        if (shouldScroll) scrollToBottom(body);
        return card;
    }

    function renderActionCard(body, data) {
        if (!data || !data.product) return;
        const card = document.createElement('section');
        card.className = 'ai-action-card';
        card.setAttribute('aria-label', 'Tác vụ mua hàng tự động');

        const prod = data.product;
        const voucherInfo = data.coupon ? ` · Áp voucher <b>${escapeHTML(data.coupon.code)}</b> (-${Number(data.coupon.discount || 0).toLocaleString('vi-VN')} đ)` : '';
        const finalPrice = data.finalPrice || prod.price;

        card.innerHTML = `
            <div class="ai-action-badge">⚡ Hành động tự động đã thực thi</div>
            <div class="ai-action-prod">
                <img src="${escapeHTML(prod.image)}" alt="${escapeHTML(prod.name)}">
                <div>
                    <strong>${escapeHTML(prod.name)}</strong>
                    <div style="font-size:0.8rem; color:#38bdf8;">Tổng thanh toán: <b>${Number(finalPrice).toLocaleString('vi-VN')} đ</b>${voucherInfo}</div>
                </div>
            </div>
            <button type="button" class="ai-action-btn-checkout" onclick="if(typeof window.openCartDrawer==='function'){window.openCartDrawer();}else{window.location.href='${root}index.html?openCart=1';}">
                🛒 Chuyển Đến Giỏ Hàng &amp; Thanh Toán Ngay
            </button>
        `;
        body.appendChild(card);
        scrollToBottom(body);
    }

    async function askAssistant(message, context) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const urlParams = new URLSearchParams(window.location.search);
        const pageCategory = urlParams.get('category') || '';
        const pageProductId = window.location.pathname.includes('product.html') ? (urlParams.get('id') || '') : '';
        const requestContext = { ...(context || {}), ...(pageProductId ? { pageProductId } : {}) };
        if (pageCategory) {
            const hasActiveConversationScope = Boolean(
                requestContext.productType
                || requestContext.stage === 'qualifying_needs'
                || requestContext.currentIntent === 'qualifying_needs'
                || requestContext.currentIntent === 'clarify_needs'
            );
            if (!hasActiveConversationScope && requestContext.pageCategory && requestContext.pageCategory !== pageCategory) {
                delete requestContext.brand;
                delete requestContext.budget;
                delete requestContext.budgetType;
                delete requestContext.useCase;
                delete requestContext.lastProducts;
                delete requestContext.currentIntent;
                delete requestContext.productType;
            }
            if (!hasActiveConversationScope) {
                requestContext.category = pageCategory;
            }
            requestContext.pageCategory = pageCategory;
        }

        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, context: requestContext })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Chatbot chưa phản hồi được.');
        return data;
    }

    function boot() {
        ensureStylesheet();
        const chat = renderShell();
        const body = chat.querySelector('#aiChatBody');
        const suggestionsBar = chat.querySelector('#aiChatSuggestions');
        const form = chat.querySelector('#aiChatForm');
        const panel = chat.querySelector('.ai-chat-panel');
        const input = chat.querySelector('#aiChatInput');
        const sendButton = chat.querySelector('.ai-chat-send');
        const cameraButton = chat.querySelector('#aiChatCameraBtn');
        const cameraInput = chat.querySelector('#aiChatCameraInput');
        const micButton = chat.querySelector('.ai-chat-mic');
        const voiceButton = chat.querySelector('.ai-chat-voice');
        const status = chat.querySelector('#aiChatStatus');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = SpeechRecognition ? new SpeechRecognition() : null;
        let recognizedText = '';
        let recognitionSilenceTimer = null;
        let consultationContext = {};
        let chatHistory = [];
        let voiceEnabled = localStorage.getItem('chatVoiceEnabled') === 'true';
        let reengagementTimer = null;
        let voiceSessionActive = false;
        let voiceMediaStream = null;
        let voiceRecognitionRunning = false;
        let voiceAwaitingReply = false;
        let voiceRestartTimer = null;
        let suppressRecognitionEnd = false;

        function restartVoiceRecognition(delay = 180) {
            window.clearTimeout(voiceRestartTimer);
            voiceRestartTimer = window.setTimeout(() => {
                if (!voiceSessionActive || voiceAwaitingReply || suppressRecognitionEnd ||
                    voiceRecognitionRunning || (window.speechSynthesis && window.speechSynthesis.speaking) || !recognition) return;
                try { recognition.start(); } catch (e) {
                    // SpeechRecognition can report an already-running state
                    // asynchronously; retry once after its end callback settles.
                    window.clearTimeout(voiceRestartTimer);
                    voiceRestartTimer = window.setTimeout(() => {
                        if (voiceSessionActive && !voiceAwaitingReply && !voiceRecognitionRunning) {
                            try { recognition.start(); } catch (ignored) { }
                        }
                    }, 260);
                }
            }, delay);
        }

        function saveSession() {
            try {
                // Chỉ lưu vào sessionStorage khi người dùng thực sự đã gửi tin nhắn tương tác
                const hasUserInteraction = Array.isArray(chatHistory) && chatHistory.some(m => m.role === 'user');
                if (hasUserInteraction) {
                    sessionStorage.setItem('ai_chat_history', JSON.stringify(chatHistory));
                    sessionStorage.setItem('ai_chat_context', JSON.stringify(consultationContext));
                    sessionStorage.setItem('ai_chat_active_open', chat.classList.contains('open') ? 'true' : 'false');
                } else {
                    sessionStorage.removeItem('ai_chat_history');
                    sessionStorage.removeItem('ai_chat_context');
                    sessionStorage.setItem('ai_chat_active_open', 'false');
                }
            } catch (e) {
                console.warn('Cannot persist AI chat session:', e);
            }
        }

        function cancelReengagement() {
            if (!reengagementTimer) return;
            window.clearTimeout(reengagementTimer);
            reengagementTimer = null;
        }

        function buildReengagementMessage() {
            const products = Array.isArray(consultationContext.lastProducts)
                ? consultationContext.lastProducts.filter(Boolean)
                : [];
            const category = consultationContext.category || 'sản phẩm vừa xem';

            if (products.length >= 2) {
                return `Em vẫn ở đây nha 😊 Bạn còn phân vân giữa các mẫu vừa xem ở điểm nào: giá, tính năng hay trải nghiệm sử dụng? Nhắn em tiêu chí quan trọng nhất, em sẽ so sánh thật gọn để bạn dễ chọn hơn.`;
            }
            if (products.length === 1) {
                return `Bạn còn băn khoăn gì về mẫu **${products[0].name || category}** không? Em có thể kiểm tra thêm giá, tính năng, bảo hành hoặc phương án trả góp giúp bạn nhé.`;
            }
            return `Em vẫn ở đây nếu bạn còn phân vân về **${category}** nhé 😊 Bạn cứ cho em biết mức giá mong muốn hoặc nhu cầu quan trọng nhất, em sẽ gợi ý sát hơn cho bạn.`;
        }

        function scheduleReengagement() {
            cancelReengagement();
            reengagementTimer = window.setTimeout(() => {
                reengagementTimer = null;
                if (!chat.classList.contains('open') || chat.classList.contains('minimized') || document.hidden || input.value.trim()) return;

                const followUp = buildReengagementMessage();
                appendMessage(body, 'ai', followUp);
                chatHistory.push({ role: 'ai', text: followUp, proactive: true });
                saveSession();
                // A proactive reminder is visual-only during hands-free voice
                // chat. Reading this long prompt aloud would block recognition
                // and force the customer to wait until speechSynthesis ends.
                if (!voiceSessionActive) {
                    speak(followUp);
                } else if (recognition && !voiceRecognitionRunning && !voiceAwaitingReply) {
                    status.textContent = 'Đang nghe...';
                    try { recognition.start(); } catch (e) { }
                }
            }, 25000);
        }

        const updateVoiceButton = () => {
            voiceButton.classList.toggle('active', voiceEnabled);
            voiceButton.setAttribute('aria-pressed', String(voiceEnabled));
            voiceButton.setAttribute('aria-label', voiceEnabled ? 'Tắt đọc câu trả lời' : 'Bật đọc câu trả lời');
        };

        const formatVndForSpeech = priceStr => {
            const cleaned = String(priceStr || '').replace(/[^\d]/g, '');
            const num = parseInt(cleaned, 10);
            if (isNaN(num) || num <= 0) return priceStr;

            const millions = Math.floor(num / 1000000);
            const thousands = Math.floor((num % 1000000) / 1000);

            let result = '';
            if (millions > 0) {
                result += `${millions} triệu`;
                if (thousands > 0) result += ` ${thousands} nghìn`;
                result += ' đồng';
            } else if (thousands > 0) {
                result += `${thousands} nghìn đồng`;
            } else {
                result += `${num} đồng`;
            }
            return result;
        };

        const cleanSpeechText = text => {
            if (!text) return '';
            const lines = String(text).split('\n');
            const spokenLines = [];

            for (let rawLine of lines) {
                let line = rawLine.trim();
                if (!line) continue;

                // Dừng đọc ngay lập tức khi bắt đầu vào danh sách sản phẩm (1., 2.), gạch đầu dòng (•, -, *), bảng so sánh (|) hoặc thông số
                if (
                    line.startsWith('|') ||
                    line.startsWith('```') ||
                    line.startsWith('{') ||
                    /^(?:#+\s*)?(?:\*\*|\*)?\d+[\.\)\-]/.test(line) ||
                    /^(?:#+\s*)?(?:\*\*|\*)?(?:phương án|lựa chọn|mẫu|sản phẩm)\s+\d+/i.test(line) ||
                    /^(?:[•\-\*\+]|⭐|🌟|🏆|🚀|💼|💫|📱|🎧|💻|⚖️|📋|🔍|🎯|📌|🛡️|💳|💡|👉)/.test(line) ||
                    /(?:\bgiá(?:\s+bán|\s+niêm\s+yết|\s+ưu\s+đãi)?\s*:|ưu điểm\s*:|đánh đổi\s*:|nhược điểm\s*:|cấu hình(?:\s+nổi\s+bật)?\s*:|thông số(?:\s+kỹ\s+thuật)?\s*:|tình trạng(?:\s+kho)?\s*:)/i.test(line)
                ) {
                    break;
                }

                // Làm sạch đoạn văn dẫn nhập mở đầu (như phần khung đỏ) để đọc tự nhiên
                let cleanLine = line
                    .replace(/\*\*|\*|`|#|"/g, '')
                    .replace(/\((?:còn|tạm hết)[^)]*\)/gi, '')
                    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                    .replace(/(\d+)\s*[-–]\s*(\d+)\s*(năm|tháng|ngày|giờ|tiếng|triệu)/gi, '$1 đến $2 $3')
                    .replace(/(\d{1,3}(?:\.\d{3}){1,3})\s*(?:đ|vnd|đồng|₫)/gi, (m, p) => formatVndForSpeech(p))
                    .replace(/\s+/g, ' ')
                    .trim();

                if (cleanLine.length > 2) {
                    spokenLines.push(cleanLine);
                }

                // Chỉ đọc tối đa 2 đoạn mở đầu dẫn dắt câu trả lời, phần sản phẩm để khách tự nhìn
                if (spokenLines.length >= 2) break;
            }

            if (spokenLines.length === 0) {
                return 'Mình đã hiển thị thông tin chi tiết và các sản phẩm phù hợp trên màn hình, bạn xem bên dưới nhé!';
            }

            return spokenLines.join(' ');
        };

        const stopSpeaking = () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            voiceButton.classList.remove('speaking');
            status.textContent = 'Trực tuyến · Hỗ trợ 24/7';
        };

        const speak = text => {
            if (!voiceEnabled || !('speechSynthesis' in window)) return;
            // Dừng micro ngay để tránh thu lại giọng bot
            if (recognition) {
                suppressRecognitionEnd = true;
                recognizedText = '';
                window.clearTimeout(recognitionSilenceTimer);
                try { recognition.abort(); } catch (e) { }
            }
            stopSpeaking();

            const cleanText = cleanSpeechText(humanizeStoreName(text));
            if (!cleanText) return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'vi-VN';
            utterance.rate = 1.05;
            const voices = window.speechSynthesis.getVoices();
            utterance.voice = voices.find(voice => voice.lang?.toLowerCase().startsWith('vi')) || null;

            voiceButton.classList.add('speaking');
            status.textContent = 'Đang đọc tư vấn... (Bấm loa để dừng)';

            utterance.onend = () => {
                stopSpeaking();
                suppressRecognitionEnd = false;
                voiceAwaitingReply = false;
                if (voiceSessionActive && !voiceAwaitingReply) {
                    restartVoiceRecognition(220);
                }
            };
            utterance.onerror = () => {
                stopSpeaking();
                suppressRecognitionEnd = false;
                voiceAwaitingReply = false;
                if (voiceSessionActive && !voiceAwaitingReply) {
                    restartVoiceRecognition(220);
                }
            };

            window.speechSynthesis.speak(utterance);
        };

        updateVoiceButton();
        voiceButton.addEventListener('click', () => {
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
                stopSpeaking();
                return;
            }
            voiceEnabled = !voiceEnabled;
            localStorage.setItem('chatVoiceEnabled', String(voiceEnabled));
            if (!voiceEnabled) stopSpeaking();
            updateVoiceButton();
        });

        if (recognition) {
            recognition.lang = 'vi-VN';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onstart = () => {
                recognizedText = '';
                voiceRecognitionRunning = true;
                micButton.classList.add('listening');
                micButton.setAttribute('aria-label', 'Đang nghe, bấm để dừng');
                input.placeholder = 'Đang lắng nghe tiếng Việt...';
                status.textContent = 'Đang nghe...';
            };
            recognition.onresult = event => {
                if (!voiceSessionActive || voiceAwaitingReply || suppressRecognitionEnd || (window.speechSynthesis && window.speechSynthesis.speaking)) return;
                const finalParts = [];
                const interimParts = [];
                Array.from(event.results).forEach(result => {
                    (result.isFinal ? finalParts : interimParts).push(result[0].transcript);
                });
                recognizedText = [...finalParts, ...interimParts].join(' ').trim();
                input.value = recognizedText;
                status.textContent = 'Đang nghe...';
                window.clearTimeout(recognitionSilenceTimer);
                recognitionSilenceTimer = window.setTimeout(() => recognition.stop(), 1200);
            };
            recognition.onspeechend = () => {
                window.clearTimeout(recognitionSilenceTimer);
                recognitionSilenceTimer = window.setTimeout(() => recognition.stop(), 1200);
            };
            recognition.onerror = event => {
                if (!['no-speech', 'aborted'].includes(event.error)) {
                    appendMessage(body, 'ai', 'Không nhận được giọng nói. Bạn hãy cấp quyền micro và thử lại nhé.');
                }
            };
            recognition.onend = () => {
                window.clearTimeout(recognitionSilenceTimer);
                voiceRecognitionRunning = false;
                micButton.classList.remove('listening');
                micButton.setAttribute('aria-label', 'Nhập bằng giọng nói');
                input.placeholder = 'Hỏi giá, so sánh, mã giảm giá, trả góp...';
                status.textContent = 'Trực tuyến · Hỗ trợ 24/7';
                if (suppressRecognitionEnd) {
                    suppressRecognitionEnd = false;
                    status.textContent = 'Đang trả lời...';
                    return;
                }
                if (recognizedText) {
                    voiceAwaitingReply = voiceSessionActive;
                    send(recognizedText, { fromVoice: voiceSessionActive });
                } else if (voiceSessionActive) {
                    window.clearTimeout(voiceRestartTimer);
                    voiceRestartTimer = window.setTimeout(() => {
                        if (voiceSessionActive && !voiceAwaitingReply) {
                            try { recognition.start(); } catch (e) { }
                        }
                    }, 180);
                }
            };
            micButton.addEventListener('click', () => {
                if (voiceSessionActive) {
                    voiceSessionActive = false;
                    voiceAwaitingReply = false;
                    window.clearTimeout(voiceRestartTimer);
                    try { recognition.abort(); } catch (e) { }
                    if (voiceMediaStream) {
                        voiceMediaStream.getTracks().forEach(track => track.stop());
                        voiceMediaStream = null;
                    }
                    micButton.classList.remove('voice-session-active', 'listening');
                    micButton.setAttribute('aria-pressed', 'false');
                    micButton.setAttribute('aria-label', 'Bắt đầu trò chuyện bằng giọng nói');
                    status.textContent = 'Đã tắt microphone';
                } else if (navigator.mediaDevices?.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(stream => {
                        voiceMediaStream = stream;
                        voiceSessionActive = true;
                        voiceAwaitingReply = false;
                        micButton.classList.add('voice-session-active');
                        micButton.setAttribute('aria-pressed', 'true');
                        micButton.setAttribute('aria-label', 'Kết thúc phiên trò chuyện bằng giọng nói');
                        status.textContent = 'Sẵn sàng · Phiên giọng nói';
                        try { recognition.start(); } catch (e) { }
                    }).catch(error => {
                        status.textContent = error?.name === 'NotAllowedError' ? 'Microphone bị từ chối quyền' : 'Không thể truy cập microphone';
                    });
                } else {
                    status.textContent = 'Thiết bị không hỗ trợ microphone';
                }
            });
        } else {
            micButton.disabled = true;
            micButton.title = 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói';
        }

        if (cameraButton && cameraInput) {
            cameraButton.addEventListener('click', () => {
                cameraInput.click();
            });

            cameraInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async () => {
                    const base64Data = reader.result;
                    const imgMsg = document.createElement('article');
                    imgMsg.className = 'ai-message user';
                    imgMsg.innerHTML = `<section class="ai-bubble"><div style="max-width:180px; border-radius:8px; overflow:hidden;"><img src="${base64Data}" alt="Ảnh tải lên" style="width:100%; display:block;"></div><p style="margin-top:4px; font-size:0.8rem;">[Tìm sản phẩm từ hình ảnh]</p></section>`;
                    body.appendChild(imgMsg);
                    scrollToBottom(body);

                    const typing = appendMessage(body, 'ai ai-typing', 'AI đang phân tích nhận diện thiết bị công nghệ...');
                    try {
                        const hintText = (input?.value || '').trim();
                        const res = await fetch(`${apiUrl}/chat/visual-search`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image: base64Data, filename: file.name, hint: hintText })
                        });
                        const visualResult = await res.json();
                        typing.remove();

                        if (!res.ok) throw new Error(visualResult.message || 'Không thể nhận diện hình ảnh');

                        if (!visualResult.isTech) {
                            const msg = visualResult.reply || 'Ảnh này chưa cho thấy thiết bị thuộc danh mục cửa hàng hỗ trợ (như điện thoại, laptop, tablet, tai nghe, phụ kiện công nghệ...). Bạn vui lòng gửi ảnh chụp rõ nét hơn của thiết bị cần tìm nhé!';
                            streamAIMessage(body, msg, () => {
                                scrollToBottom(body);
                            });
                            return;
                        }

                        const detected = visualResult.detectedItem || 'Thiết bị công nghệ';
                        const reply = visualResult.reply || `✨ AI đã nhận diện hình ảnh của bạn là **${detected}**!\n${visualResult.description || ''}\nDưới đây là các sản phẩm tương thích chính hãng tốt nhất tại cửa hàng:`;

                        streamAIMessage(body, reply, () => {
                            if (visualResult.products?.length === 1) {
                                renderInteractiveProductCard(body, visualResult.products[0]);
                                recordUserShoppingInterest(visualResult.products[0].category, visualResult.products[0].name);
                            } else if (visualResult.products?.length > 1) {
                                renderChatProducts(body, visualResult.products);
                                recordUserShoppingInterest(visualResult.products[0]?.category, visualResult.products[0]?.name);
                            }
                            scrollToBottom(body);
                        });
                    } catch (err) {
                        typing.remove();
                        appendMessage(body, 'ai', 'Rất tiếc, AI chưa thể nhận diện rõ thiết bị trong ảnh này. Bạn hãy thử chụp góc rõ hơn hoặc gửi ảnh thiết bị công nghệ khác nhé!');
                    }
                };
                reader.readAsDataURL(file);
                cameraInput.value = '';
            });
        }

        function extractBudgetFromText(text) {
            if (!text) return 0;
            const str = String(text).toLowerCase();
            const mMillion = str.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|triệu|m\b)/i);
            if (mMillion) {
                const val = parseFloat(mMillion[1].replace(',', '.'));
                if (!isNaN(val) && val > 0 && val < 500) {
                    return Math.round(val * 1000000);
                }
            }
            const mRaw = str.match(/(\d{1,3}(?:\.\d{3}){2,3})\s*(?:d|đ|vnd)?/i);
            if (mRaw) {
                const val = parseInt(mRaw[1].replace(/\./g, ''), 10);
                if (!isNaN(val) && val > 0) return val;
            }
            const mK = str.match(/(\d+)\s*(?:k|nghin|nghìn|ngan|ngàn)\b/i);
            if (mK) {
                const val = parseInt(mK[1], 10);
                if (!isNaN(val) && val > 0) return val * 1000;
            }
            return 0;
        }

        function handleAutoNavigation(userMessage, data) {
            if (data.notFound) {
                return;
            }

            const currentUrl = new URL(window.location.href);
            const currentProductId = currentUrl.searchParams.get('id');
            const isProductDetailPage = window.location.pathname.includes('/product.html');
            const topProduct = data.products?.[0];
            const userMsgLower = String(userMessage || '').toLowerCase().trim();

            const isExplicitSingleProductView = Boolean(
                topProduct && (
                    userMsgLower.includes('mở trang sản phẩm') ||
                    userMsgLower.includes('xem chi tiết') ||
                    userMsgLower.includes('chi tiết sản phẩm') ||
                    (userMsgLower.startsWith('xem ') && topProduct.name && topProduct.name.toLowerCase().includes(userMsgLower.replace('xem ', '').trim())) ||
                    (userMsgLower.startsWith('chi tiết ') && topProduct.name && topProduct.name.toLowerCase().includes(userMsgLower.replace('chi tiết ', '').trim()))
                )
            );

            // NẾU ĐANG Ở TRANG CHI TIẾT SẢN PHẨM:
            // Tuyệt đối không tự động reload hoặc chuyển hướng ra ngoài nếu đang tư vấn sản phẩm hiện tại!
            if (isProductDetailPage) {
                // Đang hỏi về chính sản phẩm này -> giữ nguyên để khách hàng đọc phản hồi trong chatbox
                if (topProduct?._id && String(currentProductId) === String(topProduct._id)) {
                    return;
                }
                // Nếu người dùng chỉ hỏi tư vấn tính năng/giá/ưu nhược điểm (không yêu cầu mở máy khác) -> không chuyển hướng
                if (!isExplicitSingleProductView) {
                    return;
                }
            }

            // Đang thu thập nhu cầu thì giữ nguyên trang hiện tại. Chỉ đổi danh mục
            // và xóa từ khóa tìm kiếm để khách thấy toàn bộ mặt hàng. Nếu khách đã cung cấp ngân sách
            // (ví dụ: dưới 10tr) thì lọc ngay toàn bộ các sản phẩm thỏa mãn mức giá đó trên storefront.
            if (data.context?.currentIntent === 'qualifying_needs' || data.context?.currentIntent === 'budget_qualified_needs') {
                const qualifyingCategory = data.context?.category;
                const qualifyingBudget = Number(data.context?.budget || 0);
                const onMainShop = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || (!window.location.pathname.includes('/pages/') && !window.location.pathname.includes('/admin/'));
                if (onMainShop && qualifyingCategory) {
                    if (typeof window.setCategory === 'function') {
                        window.setCategory(qualifyingCategory, { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch('', { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter('all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice(qualifyingBudget > 0 ? qualifyingBudget : '', { scroll: false });
                    }
                } else if (qualifyingCategory && !isProductDetailPage) {
                    const priceQuery = qualifyingBudget > 0 ? `&maxPrice=${qualifyingBudget}` : '';
                    window.location.href = `${root}index.html?category=${encodeURIComponent(qualifyingCategory)}${priceQuery}#catalogStart`;
                }
                return;
            }

            const isMainShop = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || (!window.location.pathname.includes('/pages/') && !window.location.pathname.includes('/admin/'));

            // 1. Phân tích danh mục mục tiêu
            let targetCategory = data.context?.category || null;
            if (!targetCategory && Array.isArray(data.products) && data.products.length > 0) {
                targetCategory = data.products[0]?.category;
            }

            if (!targetCategory) {
                if (/laptop|máy tính xách tay|macbook/i.test(userMsgLower)) targetCategory = 'Laptop';
                else if (/đồng hồ thông minh|smartwatch|apple watch|garmin/i.test(userMsgLower)) targetCategory = 'Đồng hồ thông minh';
                else if (/điện thoại|smartphone|iphone|galaxy\s*[sz]/i.test(userMsgLower)) targetCategory = 'Điện thoại';
                else if (/tablet|máy tính bảng|ipad|matepad/i.test(userMsgLower)) targetCategory = 'Tablet';
                else if (/tai nghe|headphone|airpods/i.test(userMsgLower)) targetCategory = 'Tai nghe';
                else if (/máy chơi game|playstation|ps5|nintendo/i.test(userMsgLower)) targetCategory = 'Máy chơi game';
                else if (/\b(phụ kiện|củ sạc|dây sạc|cáp sạc|pin dự phòng|sạc dự phòng|chuột|bàn phím|keyboard|hub chuyển đổi|apple pencil|bút cảm ứng)\b/i.test(userMsgLower)) targetCategory = 'Phụ kiện';
            }
            // A. Khách hàng yêu cầu đích danh mở trang chi tiết sản phẩm -> chuyển hướng sang product.html
            if (isExplicitSingleProductView && topProduct?._id) {
                const currentParams = new URLSearchParams(window.location.search);
                const currentId = currentParams.get('id');
                const isAlreadyOnThisProduct = window.location.pathname.includes('/product.html') && String(currentId) === String(topProduct._id);

                if (!isAlreadyOnThisProduct) {
                    sessionStorage.setItem('ai_chat_just_redirected_name', topProduct.name);
                    sessionStorage.setItem('ai_chat_active_open', 'true');
                    saveSession();

                    const banner = document.createElement('aside');
                    banner.className = 'ai-redirect-banner';
                    banner.setAttribute('role', 'status');
                    banner.innerHTML = `
                        <div class="ai-redirect-info">
                            <span class="ai-redirect-icon" aria-hidden="true">🚀</span>
                            <div class="ai-redirect-text">
                                <strong>Đang mở trang chi tiết sản phẩm...</strong>
                                <small>${escapeHTML(topProduct.name)}</small>
                            </div>
                        </div>
                        <button class="ai-redirect-cancel-btn" type="button">Ở lại</button>
                    `;
                    body.appendChild(banner);
                    scrollToBottom(body);

                    let cancelled = false;
                    const redirectTimer = setTimeout(() => {
                        if (!cancelled) {
                            window.location.href = `${root}pages/catalog/product.html?id=${encodeURIComponent(topProduct._id)}`;
                        }
                    }, 1200);

                    banner.querySelector('.ai-redirect-cancel-btn')?.addEventListener('click', () => {
                        cancelled = true;
                        clearTimeout(redirectTimer);
                        banner.remove();
                        sessionStorage.removeItem('ai_chat_just_redirected_name');
                    });
                }
                return;
            }

            // A1. Khách hàng đã trả lời đầy đủ 4 câu hỏi tư vấn -> Bây giờ mới sổ sang trang sản phẩm đó!
            if (data.context?.currentIntent === 'consultation_completed' && topProduct) {
                if (isMainShop) {
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter('all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice('', { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch(topProduct.name, { scroll: true });
                    }
                } else if (topProduct._id) {
                    window.location.href = `${root}pages/catalog/product.html?id=${encodeURIComponent(topProduct._id)}`;
                }
                return;
            }

            // B. Khách hàng hỏi chính xác 1 sản phẩm cụ thể ("s25 ultra", "galaxy a55", "iphone 16 pro max")
            // Yêu cầu: "khi khách hàng hỏi sản phẩm nào đó thì nó chỉ nhảy đúng tên sản phẩm đó thôi không nhảy sản phẩm khác"
            if (data.context?.currentIntent === 'exact_lookup' && topProduct) {
                if (isMainShop) {
                    if (topProduct.category && typeof window.setCategory === 'function') {
                        window.setCategory(topProduct.category, { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter('all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice('', { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch(topProduct.name);
                    }
                } else if (topProduct._id) {
                    window.location.href = `${root}pages/catalog/product.html?id=${encodeURIComponent(topProduct._id)}`;
                }
                return;
            }

            // C. Khách hàng hỏi thương hiệu trong danh mục ("samsung", "mình thích samsung", "laptop asus")
            if (data.context?.currentIntent === 'brand_showcase' && data.context?.brand) {
                if (isMainShop) {
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch('', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice('', { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter(data.context.brand);
                    }
                } else if (targetCategory) {
                    window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}#catalogStart`;
                }
                return;
            }

            // D1. Khách hàng hỏi ngân sách ngoài phạm vi hoặc sản phẩm có giá gần nhất (Nearest Price Match)
            // TUYỆT ĐỐI không gán maxPrice thấp vào bộ lọc cửa hàng vì sẽ làm trắng màn hình ("Không tìm thấy sản phẩm phù hợp").
            // Thay vào đó: xóa bộ lọc khoảng giá, chọn đúng danh mục, xóa lọc hãng và hiển thị ngay sản phẩm gần nhất lên storefront!
            const effectiveBudget = Number(data.context?.budget || extractBudgetFromText(userMessage) || 0);
            const isNearestPriceMatch = Boolean(
                data.context?.isNearestMatch ||
                data.context?.currentIntent === 'nearest_price_match' ||
                data.context?.currentIntent === 'out_of_budget_scope' ||
                data.context?.currentIntent === 'product_type_no_match' ||
                (topProduct && effectiveBudget > 0 && Number(topProduct.price) > Number(effectiveBudget))
            );

            if (isNearestPriceMatch) {
                if (isMainShop) {
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter('all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        // Xóa bộ lọc khoảng giá để không ẩn sản phẩm có giá cao hơn ngân sách dự kiến của khách
                        window.setShopPrice('', { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch(topProduct?.name || '', { scroll: true });
                    }
                } else if (topProduct?._id) {
                    window.location.href = `${root}pages/catalog/product.html?id=${encodeURIComponent(topProduct._id)}`;
                } else if (targetCategory) {
                    window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}#catalogStart`;
                }
                return;
            }

            // D2.1. Khách hàng hỏi theo loại sản phẩm và có sản phẩm phù hợp ngân sách
            if (data.context?.currentIntent === 'product_type_showcase') {
                if (isMainShop) {
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter(data.context?.brand || 'all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice(data.context?.budget || '', { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch('', { scroll: false });
                    }
                } else if (targetCategory) {
                    const priceParam = data.context?.budget ? `&maxPrice=${encodeURIComponent(data.context.budget)}` : '';
                    window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}${priceParam}#catalogStart`;
                }
                return;
            }

            if (data.context?.currentIntent === 'feature_showcase') {
                if (isMainShop) {
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter(data.context?.brand || 'all', { scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice('', { scroll: false });
                    }
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch(data.context?.featureKeyword || '');
                    }
                } else if (targetCategory) {
                    window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}#catalogStart`;
                }
                return;
            }

            // D3. Khách hàng hỏi ngân sách trong tầm giá hợp lệ ("còn khi khách hàng muốn ngân sách trong tầm giá thì mới nhảy ra để tư vấn khách hàng")
            if (effectiveBudget > 0) {
                if (isMainShop) {
                    if (typeof window.setShopSearch === 'function') {
                        window.setShopSearch('', { scroll: false });
                    }
                    if (typeof window.setBrandFilter === 'function') {
                        window.setBrandFilter(data.context?.brand || 'all', { scroll: false });
                    }
                    if (targetCategory && typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { preserveFilters: true, scroll: false });
                    }
                    if (typeof window.setShopPrice === 'function') {
                        window.setShopPrice(effectiveBudget);
                    }
                } else if (targetCategory) {
                    window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}&maxPrice=${encodeURIComponent(effectiveBudget)}#catalogStart`;
                }
                return;
            }

            // E. Chuyển đổi danh mục sản phẩm chung
            if (targetCategory && !isProductDetailPage) {
                const currentCategory = new URLSearchParams(window.location.search).get('category');
                const isAlreadyOnThisCategory = isMainShop && (
                    currentCategory === targetCategory ||
                    (typeof window.activeCategory !== 'undefined' && window.activeCategory === targetCategory)
                );

                if (isAlreadyOnThisCategory) {
                    // Nếu đang ở sẵn danh mục nhưng khách hỏi lại danh mục này (hoặc chuyển từ hỏi sản phẩm trước sang)
                    // thì xóa sạch các bộ lọc tìm kiếm và giá cũ để hiển thị lại đầy đủ sản phẩm
                    if (typeof window.setCategory === 'function') {
                        window.setCategory(targetCategory, { scroll: false });
                    } else {
                        if (typeof window.setShopSearch === 'function') window.setShopSearch('', { scroll: false });
                        if (typeof window.setShopPrice === 'function') window.setShopPrice('', { scroll: false });
                        if (typeof window.setBrandFilter === 'function') window.setBrandFilter('all', { scroll: false });
                    }
                }

                if (!isAlreadyOnThisCategory) {
                    sessionStorage.setItem('ai_chat_just_redirected_category', targetCategory);
                    sessionStorage.setItem('ai_chat_active_open', 'true');
                    saveSession();

                    if (isMainShop && typeof window.setCategory === 'function') {
                        const banner = document.createElement('aside');
                        banner.className = 'ai-redirect-banner';
                        banner.setAttribute('role', 'status');
                        banner.innerHTML = `
                            <div class="ai-redirect-info">
                                <span class="ai-redirect-icon" aria-hidden="true">🚀</span>
                                <div class="ai-redirect-text">
                                    <strong>Đang hiển thị toàn bộ ${escapeHTML(targetCategory)}...</strong>
                                    <small>Xem danh sách sản phẩm bên dưới</small>
                                </div>
                            </div>
                            <button class="ai-redirect-cancel-btn" type="button">Đóng</button>
                        `;
                        body.appendChild(banner);
                        scrollToBottom(body);

                        const timer = setTimeout(() => {
                            window.setCategory(targetCategory);
                        }, 500);

                        banner.querySelector('.ai-redirect-cancel-btn')?.addEventListener('click', () => {
                            clearTimeout(timer);
                            banner.remove();
                        });
                    } else {
                        const banner = document.createElement('aside');
                        banner.className = 'ai-redirect-banner';
                        banner.setAttribute('role', 'status');
                        banner.innerHTML = `
                            <div class="ai-redirect-info">
                                <span class="ai-redirect-icon" aria-hidden="true">🚀</span>
                                <div class="ai-redirect-text">
                                    <strong>Đang mở trang danh mục ${escapeHTML(targetCategory)}...</strong>
                                    <small>Xem toàn bộ sản phẩm ${escapeHTML(targetCategory)}</small>
                                </div>
                            </div>
                            <button class="ai-redirect-cancel-btn" type="button">Ở lại</button>
                        `;
                        body.appendChild(banner);
                        scrollToBottom(body);

                        let cancelled = false;
                        const redirectTimer = setTimeout(() => {
                            if (!cancelled) {
                                window.location.href = `${root}index.html?category=${encodeURIComponent(targetCategory)}#catalogStart`;
                            }
                        }, 1200);

                        banner.querySelector('.ai-redirect-cancel-btn')?.addEventListener('click', () => {
                            cancelled = true;
                            clearTimeout(redirectTimer);
                            banner.remove();
                            sessionStorage.removeItem('ai_chat_just_redirected_category');
                        });
                    }
                } else if (isMainShop) {
                    document.getElementById('catalogStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }

        const send = async (value, options = {}) => {
            cancelReengagement();
            const message = String(value || input.value || '').trim();
            if (!message) {
                input.setAttribute('aria-invalid', 'true');
                panel.dataset.state = 'error';
                return;
            }

            // Xử lý chuyển tiếp Zalo
            if (message.toLowerCase().includes('zalo')) {
                input.value = '';
                appendMessage(body, 'user', message);
                chatHistory.push({ role: 'user', text: message });
                const reply = 'Đã mở Zalo để bạn trò chuyện trực tiếp cùng chuyên viên tư vấn của cửa hàng (Hotline/Zalo: 0842.331.606). Bạn cũng có thể hỏi tiếp em bất kỳ thông tin nào khác nhé!';
                appendMessage(body, 'ai', reply);
                chatHistory.push({ role: 'ai', text: reply });
                saveSession();
                speak(reply);
                window.open('https://zalo.me/0842331606', '_blank', 'noopener,noreferrer');
                renderSuggestions(suggestionsBar, starterSuggestions, send);
                scrollToBottom(body);
                return;
            }

            input.value = '';
            input.removeAttribute('aria-invalid');
            appendMessage(body, 'user', message);
            chatHistory.push({ role: 'user', text: message });
            renderSuggestions(suggestionsBar, [], send);
            saveSession();

            const typing = appendMessage(body, 'ai ai-typing', 'Đang tìm kiếm thông tin tối ưu...');
            sendButton.disabled = true;
            panel.dataset.state = 'loading';
            window.TechMascot?.setState('thinking');

            try {
                consultationContext.conversationHistory = chatHistory.slice(-7, -1).filter(item => item && item.text && !item.proactive).map(item => ({ role: item.role === 'user' ? 'user' : 'assistant', text: String(item.text).slice(0, 320) }));
                const data = await askAssistant(message, consultationContext);
                if (data.context && typeof data.context === 'object') {
                    if (!data.notFound) {
                        delete consultationContext.notFound;
                        delete consultationContext.uncarriedBrand;
                        delete consultationContext.stage;
                    }
                    consultationContext = { ...consultationContext, ...data.context };
                    if (!data.context.brand) {
                        consultationContext.brand = '';
                    }
                    if (data.context.currentIntent === 'qualifying_needs' && (!data.products || data.products.length === 0)) {
                        consultationContext.lastProducts = [];
                        delete consultationContext.topProduct;
                    }
                }
                if (Array.isArray(data.products) && data.products.length > 0) {
                    consultationContext.lastProducts = data.products;
                }
                typing.remove();

                const reply = data.reply || 'Mình chưa có câu trả lời phù hợp.';
                window.TechMascot?.onReplyStart();
                streamAIMessage(body, reply, () => {
                    chatHistory.push({
                        role: 'ai',
                        text: reply,
                        vouchers: data.vouchers,
                        products: data.products,
                        bundle: data.bundle,
                        suggestions: data.suggestions
                    });
                    saveSession();

                    if (data.vouchers && data.vouchers.length > 0) {
                        renderVouchers(body, data.vouchers);
                    }

                    if (data.bundle) {
                        renderBundleCard(body, data.bundle);
                        if (data.bundle.mainProduct) {
                            recordUserShoppingInterest(data.bundle.mainProduct.category, data.bundle.mainProduct.name);
                        }
                    } else if (data.products && data.products.length === 1) {
                        renderInteractiveProductCard(body, data.products[0], data.coupon);
                        recordUserShoppingInterest(data.products[0].category, data.products[0].name);
                    } else if (data.products && data.products.length > 1) {
                        renderChatProducts(body, data.products);
                        recordUserShoppingInterest(data.products[0]?.category, data.products[0]?.name);
                    }

                    if (data.action === 'add_to_cart_and_checkout' && data.product) {
                        handleAddToCart(data.product._id);
                        if (data.coupon) {
                            sessionStorage.setItem('appliedCoupon', JSON.stringify(data.coupon));
                            localStorage.setItem('checkout_coupon', data.coupon.code);
                        }
                        renderActionCard(body, data);
                    }

                    // Tự động chuyển hướng đến danh mục sản phẩm (hoặc chi tiết sản phẩm nếu có yêu cầu đích danh)
                    handleAutoNavigation(message, data);

                    renderSuggestions(suggestionsBar, data.suggestions, send);
                    scrollToBottom(body);
                    scheduleReengagement();
                    window.TechMascot?.onReplyComplete(reply.length);
                });

                speak(reply);
                panel.dataset.state = 'success';
            } catch (error) {
                typing.remove();
                appendMessage(body, 'ai', error.message || 'Có lỗi xảy ra, bạn thử lại giúp em nhé.');
                panel.dataset.state = 'error';
                window.TechMascot?.onReplyError();
            } finally {
                sendButton.disabled = false;
                input.focus();
                if (options.fromVoice) {
                    voiceAwaitingReply = false;
                    if (voiceSessionActive && !(window.speechSynthesis && window.speechSynthesis.speaking)) {
                        try { recognition?.start(); } catch (e) { }
                    }
                }
            }
        };

        input.addEventListener('input', () => {
            cancelReengagement();
            if (input.value.trim()) input.removeAttribute('aria-invalid');
            if (panel.dataset.state === 'error' || panel.dataset.state === 'success') {
                panel.dataset.state = 'default';
            }
        });

        function toggleContactMenu(forceState) {
            const contactBtn = chat.querySelector('#contactMainBtn');
            const contactPopover = chat.querySelector('#contactPopover');
            const contactLauncher = chat.querySelector('#storeContactLauncher');
            if (!contactPopover || !contactBtn || !contactLauncher) return;
            const isOpen = contactLauncher.classList.contains('is-open');
            const targetState = typeof forceState === 'boolean' ? forceState : !isOpen;
            contactLauncher.classList.toggle('is-open', targetState);
            contactBtn.setAttribute('aria-expanded', String(targetState));
            contactPopover.setAttribute('aria-hidden', String(!targetState));
        }

        function openChat(focusInput = false) {
            toggleContactMenu(false);
            chat.classList.add('open');
            chat.classList.remove('minimized');
            document.body.classList.add('ai-chat-open');
            sessionStorage.removeItem('ai_chat_closed');
            sessionStorage.setItem('ai_chat_active_open', 'true');
            hideMobileFabGreeting();
            scrollToBottom(body);
            if (focusInput) input.focus();
            const nav = chat.querySelector('.ai-chat-suggestions-nav');
            if (nav && suggestionsBar) setupSuggestionsDragScroll(nav, suggestionsBar);
        }

        function closeChat() {
            cancelReengagement();
            chat.classList.remove('open');
            chat.classList.remove('minimized');
            document.body.classList.remove('ai-chat-open');
            sessionStorage.setItem('ai_chat_closed', 'true');
            sessionStorage.setItem('ai_chat_active_open', 'false');
            if (voiceSessionActive) {
                voiceSessionActive = false;
                voiceAwaitingReply = false;
                window.clearTimeout(voiceRestartTimer);
                if (recognition) { try { recognition.abort(); } catch (e) { } }
                if (voiceMediaStream) {
                    voiceMediaStream.getTracks().forEach(track => track.stop());
                    voiceMediaStream = null;
                }
                micButton.classList.remove('voice-session-active', 'listening');
            }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }

        function minimizeChat() {
            const isMin = chat.classList.toggle('minimized');
            if (isMin) {
                cancelReengagement();
                if (voiceSessionActive) {
                    voiceSessionActive = false;
                    voiceAwaitingReply = false;
                    window.clearTimeout(voiceRestartTimer);
                    try { recognition?.abort(); } catch (e) { }
                    voiceMediaStream?.getTracks().forEach(track => track.stop());
                    voiceMediaStream = null;
                    micButton.classList.remove('voice-session-active', 'listening');
                }
                document.body.classList.remove('ai-chat-open');
            } else {
                document.body.classList.add('ai-chat-open');
                scrollToBottom(body);
                input.focus();
                const nav = chat.querySelector('.ai-chat-suggestions-nav');
                if (nav && suggestionsBar) setupSuggestionsDragScroll(nav, suggestionsBar);
            }
        }

        function showMobileFabGreeting() {
            if (window.innerWidth >= 768) return;
            const greeting = chat.querySelector('#aiFabGreeting');
            if (!greeting || chat.classList.contains('open')) return;
            greeting.classList.add('show');
            greeting.setAttribute('aria-hidden', 'false');
            window.clearTimeout(greeting._hideTimer);
            greeting._hideTimer = window.setTimeout(() => {
                hideMobileFabGreeting();
            }, 6000);
        }

        function hideMobileFabGreeting() {
            const greeting = chat.querySelector('#aiFabGreeting');
            if (!greeting) return;
            greeting.classList.remove('show');
            greeting.setAttribute('aria-hidden', 'true');
        }

        const fabGreetingEl = chat.querySelector('#aiFabGreeting');
        if (fabGreetingEl) {
            fabGreetingEl.addEventListener('click', (e) => {
                if (e.target.closest('.ai-fab-greeting-close')) {
                    e.stopPropagation();
                    hideMobileFabGreeting();
                    return;
                }
                openChat(true);
            });
        }

        // Store Contact Widget Event Handlers (Ảnh 1)
        const contactBtn = chat.querySelector('#contactMainBtn');
        const contactLauncher = chat.querySelector('#storeContactLauncher');
        if (contactBtn) {
            contactBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleContactMenu();
            });
        }

        const contactAiBtn = chat.querySelector('#contactItemAi');
        if (contactAiBtn) {
            contactAiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleContactMenu(false);
                openChat(true);
            });
        } else {
            const legacyToggle = chat.querySelector('.ai-chat-toggle');
            if (legacyToggle) {
                legacyToggle.addEventListener('click', () => {
                    openChat(true);
                });
            }
        }

        const contactZaloBtn = chat.querySelector('#contactItemZalo');
        if (contactZaloBtn) {
            contactZaloBtn.addEventListener('click', () => {
                toggleContactMenu(false);
            });
        }

        // Đóng menu popover khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (contactLauncher && !contactLauncher.contains(e.target)) {
                toggleContactMenu(false);
            }
        });

        // Đóng menu popover khi nhấn ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                toggleContactMenu(false);
            }
        });

        chat.querySelector('.ai-chat-close').addEventListener('click', () => {
            closeChat();
        });

        const minBtn = chat.querySelector('.ai-chat-minimize');
        if (minBtn) minBtn.addEventListener('click', () => {
            minimizeChat();
        });

        const pillBtn = chat.querySelector('.ai-chat-min-pill');
        if (pillBtn) pillBtn.addEventListener('click', () => {
            openChat(true);
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            send();
        });

        // Delegate purchase action clicks directly from comparison table
        body.addEventListener('click', (e) => {
            const buyBtn = e.target.closest('.ai-table-btn-buy');
            if (buyBtn) {
                const prodName = buyBtn.getAttribute('data-product-name');
                if (prodName) {
                    send(`Chọn mua ${prodName}`);
                }
            }
        });

        window.openAiChatWithPrompt = function (promptText) {
            if (!chat) return;
            openChat(true);
            if (promptText && input) {
                input.value = promptText;
                input.focus();
                setTimeout(() => send(), 200);
            }
        };

        function resetChatbox(showNotice = false) {
            cancelReengagement();
            if (voiceSessionActive) {
                voiceSessionActive = false;
                voiceAwaitingReply = false;
                try { recognition?.abort(); } catch (e) { }
                voiceMediaStream?.getTracks().forEach(track => track.stop());
                voiceMediaStream = null;
                micButton.classList.remove('voice-session-active', 'listening');
            }
            sessionStorage.removeItem('ai_chat_history');
            sessionStorage.removeItem('ai_chat_context');
            sessionStorage.removeItem('ai_chat_just_redirected_category');
            sessionStorage.removeItem('ai_chat_just_redirected_name');
            try {
                localStorage.removeItem('ai_shopping_profile');
            } catch (e) { }
            chatHistory = [];
            consultationContext = {};
            body.innerHTML = '';
            const welcome = getPersonalizedWelcome();
            appendMessage(body, 'ai', welcome.text);
            chatHistory.push({ role: 'ai', text: welcome.text });
            saveSession();
            renderSuggestions(suggestionsBar, welcome.suggestions, send);
            scrollToBottom(body);
            if (showNotice && typeof window.showToast === 'function') {
                window.showToast('Đã làm mới phiên trò chuyện cùng Trợ lý AI!', 'info');
            }
        }

        const resetBtn = chat.querySelector('.ai-chat-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => resetChatbox(true));
        }

        // Dọn dẹp profile cũ nếu đã quá hạn (> 10 phút)
        try {
            const rawProfile = localStorage.getItem('ai_shopping_profile');
            if (rawProfile) {
                const p = JSON.parse(rawProfile);
                if (!p.updatedAt || (Date.now() - p.updatedAt > 10 * 60 * 1000)) {
                    localStorage.removeItem('ai_shopping_profile');
                }
            }
        } catch (e) { }

        // Khi người dùng reload lại trang (F5 hoặc nút Refresh của trình duyệt),
        // hệ thống đặt chatbox về trạng thái đóng (collapsed), xóa bộ nhớ đệm
        const navEntries = window.performance?.getEntriesByType?.('navigation');
        const isPageReload = (navEntries && navEntries[0]?.type === 'reload') || (window.performance?.navigation?.type === 1);

        if (isPageReload) {
            sessionStorage.removeItem('ai_chat_history');
            sessionStorage.removeItem('ai_chat_context');
            sessionStorage.removeItem('ai_chat_just_redirected_category');
            sessionStorage.removeItem('ai_chat_just_redirected_name');
            sessionStorage.setItem('ai_chat_closed', 'true');
            sessionStorage.setItem('ai_chat_active_open', 'false');
            try {
                localStorage.removeItem('ai_shopping_profile');
            } catch (e) { }
        }

        // Khôi phục phiên tư vấn trước đó (chỉ khôi phục nếu người dùng thực sự đã nhắn tin)
        let savedHistory = null;
        if (!isPageReload) {
            try {
                const raw = sessionStorage.getItem('ai_chat_history');
                if (raw) savedHistory = JSON.parse(raw);
            } catch (e) {
                savedHistory = null;
            }

            try {
                const rawCtx = sessionStorage.getItem('ai_chat_context');
                if (rawCtx) consultationContext = JSON.parse(rawCtx);
            } catch (e) { }
        }

        const justRedirectedCategory = sessionStorage.getItem('ai_chat_just_redirected_category');
        const justRedirectedName = sessionStorage.getItem('ai_chat_just_redirected_name');

        const hasUserHistory = Array.isArray(savedHistory) && savedHistory.some(item => item.role === 'user');

        if (hasUserHistory) {
            chatHistory = savedHistory;
            savedHistory.forEach(item => {
                if (item.role === 'user') {
                    appendMessage(body, 'user', item.text);
                } else if (item.role === 'ai') {
                    appendMessage(body, 'ai', item.text);
                    if (item.vouchers && item.vouchers.length) {
                        renderVouchers(body, item.vouchers);
                    }
                    if (item.bundle) {
                        renderBundleCard(body, item.bundle, false);
                    } else if (item.products && item.products.length === 1) {
                        renderInteractiveProductCard(body, item.products[0], item.coupon, false);
                    } else if (item.products && item.products.length > 1) {
                        renderChatProducts(body, item.products, false);
                    }
                }
            });

            if (justRedirectedCategory) {
                sessionStorage.removeItem('ai_chat_just_redirected_category');
                const arrivalMsg = `✨ Em đã mở trang danh mục **${justRedirectedCategory}** cho bạn! Bạn có thể xem toàn bộ các sản phẩm bên dưới, hoặc trao đổi thêm với em để chọn được chiếc máy ưng ý nhất nhé.`;
                appendMessage(body, 'ai', arrivalMsg);
                chatHistory.push({ role: 'ai', text: arrivalMsg });
                saveSession();
            }

            if (justRedirectedName) {
                sessionStorage.removeItem('ai_chat_just_redirected_name');
                const arrivalMsg = `✨ Em đã đưa bạn đến màn hình **${justRedirectedName}**! Bạn có thể xem thông số, lướt xuống xem video trên tay thực tế hoặc hỏi em thêm nhé.`;
                appendMessage(body, 'ai', arrivalMsg);
                chatHistory.push({ role: 'ai', text: arrivalMsg });
                saveSession();
            }

            const lastAiMsg = [...chatHistory].reverse().find(m => m.role === 'ai' && m.suggestions);
            renderSuggestions(suggestionsBar, lastAiMsg?.suggestions || consultationContext.suggestions || starterSuggestions, send);
            scrollToBottom(body);

            // Mở chatbox nếu có yêu cầu điều hướng có chủ đích từ AI hoặc người dùng đang mở chat trong phiên duyệt này (và không phải vừa reload trang)
            if (justRedirectedName || justRedirectedCategory || (!isPageReload && sessionStorage.getItem('ai_chat_active_open') === 'true' && sessionStorage.getItem('ai_chat_closed') !== 'true')) {
                openChat(false);
            }
        } else {
            // Xóa session rác không có tin nhắn người dùng
            sessionStorage.removeItem('ai_chat_history');
            sessionStorage.removeItem('ai_chat_context');

            const welcome = getPersonalizedWelcome();
            appendMessage(body, 'ai', welcome.text);
            chatHistory.push({ role: 'ai', text: welcome.text });
            saveSession();
            renderSuggestions(suggestionsBar, welcome.suggestions, send);

            // Mặc định chatbox luôn đóng ở góc màn hình (chỉ hiển thị nút FAB).
            // Tuyệt đối không tự động mở tràn màn hình trên desktop hay mobile khi tải/reload trang.
            if (justRedirectedName || justRedirectedCategory) {
                openChat(false);
            }
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
