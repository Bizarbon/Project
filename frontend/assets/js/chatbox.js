(function initAIChatbox() {
    if (window.__aiChatboxLoaded) return;
    window.__aiChatboxLoaded = true;

    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : getBasePath();
    const apiUrl = window.API_URL || 'http://localhost:5000/api';
    const starterSuggestions = [
        'Tư vấn laptop dưới 15 triệu',
        'So sánh sản phẩm',
        'Mã giảm giá hôm nay',
        'Tính trả góp 0%',
        'Nhắn tin qua Zalo'
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
        if (document.querySelector('link[data-ai-chat-style]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${root}assets/css/chatbox.css?v=rag-consultant-20260923-3`;
        link.dataset.aiChatStyle = 'true';
        document.head.appendChild(link);
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

    function formatAIMessage(rawText) {
        if (!rawText) return '';
        const escaped = escapeHTML(rawText);
        let formatted = escaped
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        const lines = formatted.split('\n');
        const output = [];
        let inList = false;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                if (!inList) {
                    output.push('<ul class="ai-chat-bullet-list">');
                    inList = true;
                }
                output.push(`<li>${trimmed.replace(/^[•-]\s*/, '')}</li>`);
            } else {
                if (inList) {
                    output.push('</ul>');
                    inList = false;
                }
                if (trimmed) {
                    output.push(`<p>${trimmed}</p>`);
                }
            }
        });

        if (inList) output.push('</ul>');
        return output.join('');
    }

    function renderShell() {
        const chat = document.createElement('aside');
        chat.className = 'ai-chat';
        chat.setAttribute('aria-label', 'Trợ lý tư vấn AI TechEcommerce');
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
                <main class="ai-chat-body" id="aiChatBody" aria-live="polite"></main>
                <nav class="ai-chat-suggestions-nav" id="aiChatSuggestionsNav" aria-label="Gợi ý tác vụ nhanh">
                    <button type="button" class="ai-suggestions-arrow ai-suggestions-prev" aria-label="Cuộn gợi ý sang trái" hidden>‹</button>
                    <div class="ai-chat-suggestions-bar" id="aiChatSuggestions"></div>
                    <button type="button" class="ai-suggestions-arrow ai-suggestions-next" aria-label="Cuộn gợi ý sang phải" hidden>›</button>
                </nav>
                <form class="ai-chat-form" id="aiChatForm" role="search">
                    <button class="ai-chat-mic" type="button" aria-label="Nhập bằng giọng nói" title="Nhập bằng giọng nói">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/>
                        </svg>
                    </button>
                    <input class="ai-chat-input" id="aiChatInput" type="text" placeholder="Hỏi giá, so sánh, mã giảm giá, trả góp..." autocomplete="off">
                    <button class="ai-chat-send" type="submit" aria-label="Gửi tin nhắn">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-6-6 6 6-6 6"></path>
                        </svg>
                    </button>
                </form>
            </section>
            <button class="ai-chat-min-pill" type="button" aria-label="Mở lại AI tư vấn" title="Mở lại AI tư vấn">
                <figure class="ai-chat-min-avatar">
                    <img src="${root}assets/images/logo/ai-consultant-logo.svg" alt="" width="20" height="20" class="ai-avatar-img">
                </figure>
                <span>AI tư vấn</span>
                <span class="ai-chat-min-arrow" aria-hidden="true">▲</span>
            </button>
            <button class="ai-chat-toggle" type="button" aria-label="Mở trợ lý tư vấn" title="Tư vấn mua sắm cùng AI">
                <figure class="ai-chat-toggle-icon" aria-hidden="true">
                    <img src="${root}assets/images/logo/ai-consultant-logo.svg" alt="" width="26" height="26" class="ai-toggle-avatar-img">
                </figure>
                <span class="ai-chat-toggle-label">Tư vấn AI</span>
            </button>
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

    function appendMessage(body, role, text) {
        const message = document.createElement('article');
        message.className = `ai-message ${role}`;
        const bubble = document.createElement('section');
        bubble.className = 'ai-bubble';
        bubble.innerHTML = role === 'user' ? `<p>${escapeHTML(text)}</p>` : formatAIMessage(text);
        message.appendChild(bubble);
        body.appendChild(message);
        scrollToBottom(body);
        return message;
    }

    function streamAIMessage(body, text, onComplete) {
        const message = document.createElement('article');
        message.className = 'ai-message ai';
        const bubble = document.createElement('section');
        bubble.className = 'ai-bubble';
        message.appendChild(bubble);
        body.appendChild(message);

        // Nếu chuỗi ngắn hoặc trình duyệt giảm chuyển động
        if (!text || text.length < 40 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            bubble.innerHTML = formatAIMessage(text);
            scrollToBottom(body);
            if (typeof onComplete === 'function') onComplete();
            return message;
        }

        let idx = 0;
        const total = text.length;
        const step = Math.max(3, Math.floor(total / 25));
        const cursor = document.createElement('span');
        cursor.className = 'ai-typing-cursor';
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
                        <small class="ai-chat-product-tag">${escapeHTML(product.recommendation?.reason || product.category || 'Chính hãng')}</small>
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

    async function askAssistant(message, context) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, context })
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

        function saveSession() {
            try {
                sessionStorage.setItem('ai_chat_history', JSON.stringify(chatHistory));
                sessionStorage.setItem('ai_chat_context', JSON.stringify(consultationContext));
                sessionStorage.setItem('ai_chat_active_open', chat.classList.contains('open') ? 'true' : 'false');
            } catch (e) {
                console.warn('Cannot persist AI chat session:', e);
            }
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

                // Bỏ các ký tự đặc biệt / emoji ở đầu dòng để kiểm tra từ khóa
                const normalized = line.replace(/^[\s•\-\*✨🎁💡👉🛡️🚚🔄💳]+/u, '').trim();

                // Bỏ qua dòng thông số, cấu hình, đánh giá, chính sách, ưu đãi, phụ kiện kèm...
                if (/^(?:thông số|cấu hình|đánh giá|cpu|ram|bộ nhớ|màn hình|pin|chính sách|ưu đãi|tăng cường trải nghiệm|bạn có muốn xem thêm|quà tặng|hỗ trợ|100%|bạn có thể|lỗi 1 đổi 1)/i.test(normalized)) {
                    continue;
                }

                // Nhận diện dòng sản phẩm dạng: "1. iPhone 15 Pro Max 256GB - 29.490.000 đ (Còn 40 máy)" hoặc "1. **iPhone...** - **29.490.000 đ**"
                const productMatch = line.match(/^(\d+)[\.\)]\s*(?:\*\*)?(.*?)(?:\*\*)?\s*[-–:]\s*(?:\*\*)?([0-9\.,]+(?:\s*(?:đ|vnd|đồng|₫))?)(?:\*\*)?(.*)$/i);
                if (productMatch) {
                    const index = productMatch[1];
                    const name = productMatch[2].replace(/\*\*|\*|`/g, '').trim();
                    const priceRaw = productMatch[3].trim();
                    const priceSpeech = formatVndForSpeech(priceRaw);
                    spokenLines.push(`Sản phẩm ${index}: ${name}, giá ${priceSpeech}.`);
                    continue;
                }

                // Nếu là dòng giới thiệu hoặc văn bản thông thường
                // Lọc bỏ markdown, emoji và ghi chú tồn kho
                let cleanLine = line
                    .replace(/\*\*|\*|`|#/g, '')
                    .replace(/^[•\-]\s*/, '')
                    .replace(/\((?:còn|tạm hết)[^)]*\)/gi, '')
                    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                    .trim();

                // Chuyển đổi các định dạng tiền trong câu nếu có
                cleanLine = cleanLine.replace(/(\d{1,3}(?:\.\d{3}){1,3})\s*(?:đ|vnd|đồng|₫)/gi, (m, p) => formatVndForSpeech(p));

                if (cleanLine.length > 2) {
                    spokenLines.push(cleanLine);
                }
            }

            return spokenLines.join(' ');
        };

        const speak = text => {
            if (!voiceEnabled || !('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const cleanText = cleanSpeechText(text);
            if (!cleanText) return;
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'vi-VN';
            utterance.rate = 1.05;
            const voices = window.speechSynthesis.getVoices();
            utterance.voice = voices.find(voice => voice.lang?.toLowerCase().startsWith('vi')) || null;
            window.speechSynthesis.speak(utterance);
        };

        updateVoiceButton();
        voiceButton.addEventListener('click', () => {
            voiceEnabled = !voiceEnabled;
            localStorage.setItem('chatVoiceEnabled', String(voiceEnabled));
            if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
            updateVoiceButton();
        });

        if (recognition) {
            recognition.lang = 'vi-VN';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onstart = () => {
                recognizedText = '';
                micButton.classList.add('listening');
                micButton.setAttribute('aria-label', 'Đang nghe, bấm để dừng');
                input.placeholder = 'Đang lắng nghe tiếng Việt...';
                status.textContent = 'Đang nghe...';
            };
            recognition.onresult = event => {
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
                micButton.classList.remove('listening');
                micButton.setAttribute('aria-label', 'Nhập bằng giọng nói');
                input.placeholder = 'Hỏi giá, so sánh, mã giảm giá, trả góp...';
                status.textContent = 'Trực tuyến · Hỗ trợ 24/7';
                if (recognizedText) send(recognizedText);
            };
            micButton.addEventListener('click', () => {
                if (micButton.classList.contains('listening')) recognition.stop();
                else recognition.start();
            });
        } else {
            micButton.disabled = true;
            micButton.title = 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói';
        }

        function handleAutoNavigation(userMessage, data) {
            // Không chuyển trang nếu sản phẩm không có trong cửa hàng hoặc không có sản phẩm gợi ý
            if (data.notFound || !Array.isArray(data.products) || data.products.length === 0) {
                return;
            }

            const userMsgLower = String(userMessage || '').toLowerCase().trim();

            // 1. Phân tích danh mục mục tiêu (ưu tiên context.category từ AI, rồi đến category của sản phẩm gợi ý)
            let targetCategory = data.context?.category || null;
            if (!targetCategory && Array.isArray(data.products) && data.products.length > 0) {
                targetCategory = data.products[0]?.category;
            }

            // Keyword heuristics nếu cần phân loại nhanh từ tin nhắn khách hàng
            if (!targetCategory) {
                if (/laptop|máy tính xách tay|macbook/i.test(userMsgLower)) targetCategory = 'Laptop';
                else if (/đồng hồ thông minh|smartwatch|apple watch|garmin/i.test(userMsgLower)) targetCategory = 'Đồng hồ thông minh';
                else if (/điện thoại|smartphone|iphone|galaxy\s*[sz]/i.test(userMsgLower)) targetCategory = 'Điện thoại';
                else if (/tablet|máy tính bảng|ipad|matepad/i.test(userMsgLower)) targetCategory = 'Tablet';
                else if (/tai nghe|headphone|airpods/i.test(userMsgLower)) targetCategory = 'Tai nghe';
                else if (/máy chơi game|playstation|ps5|nintendo/i.test(userMsgLower)) targetCategory = 'Máy chơi game';
                else if (/\b(phụ kiện|củ sạc|dây sạc|cáp sạc|pin dự phòng|sạc dự phòng|chuột|bàn phím)\b/i.test(userMsgLower)) targetCategory = 'Phụ kiện';
            }

            // 2. Yêu cầu của người dùng:
            // "thứ nhất khi khách hàng muốn mua 1 thứ gì đó nó sẽ nhảy sang sản phẩm thứ đó (danh mục đó)
            // chứ không phải nhảy [1] sản phẩm đó, ví dụ khách muốn mua laptop nó sẽ nhảy sang trang laptop chứ không nhảy sang 1 sản phẩm laptop nào đó".
            // Do đó: Khách muốn mua hoặc tìm hiểu dòng máy nào -> Chuyển sang danh mục sản phẩm của dòng đó (trang laptop, trang điện thoại...).
            // Chỉ khi khách hàng yêu cầu đích danh mở trang chi tiết của 1 sản phẩm cụ thể mới chuyển sang product.html!
            const topProduct = data.products?.[0];
            const isExplicitSingleProductView = Boolean(
                topProduct && (
                    userMsgLower.includes('mở trang sản phẩm') ||
                    userMsgLower.includes('xem chi tiết máy này') ||
                    userMsgLower.includes('chi tiết sản phẩm') ||
                    (userMsgLower.startsWith('chi tiết ') && topProduct.name.toLowerCase().includes(userMsgLower.replace('chi tiết ', '').trim()))
                )
            );

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
            } else if (targetCategory) {
                const isMainShop = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || (!window.location.pathname.includes('/pages/') && !window.location.pathname.includes('/admin/'));
                const currentCategory = new URLSearchParams(window.location.search).get('category');
                const isAlreadyOnThisCategory = isMainShop && (
                    currentCategory === targetCategory ||
                    (typeof window.activeCategory !== 'undefined' && window.activeCategory === targetCategory)
                );

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

        const send = async (value) => {
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
                const reply = 'Đã mở Zalo để bạn trò chuyện trực tiếp cùng chuyên viên tư vấn TechEcommerce (Hotline/Zalo: 0842.331.606). Bạn cũng có thể hỏi tiếp mình bất kỳ thông tin nào khác nhé!';
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
            saveSession();

            const typing = appendMessage(body, 'ai ai-typing', 'Đang tìm kiếm thông tin tối ưu...');
            sendButton.disabled = true;
            panel.dataset.state = 'loading';

            try {
                const data = await askAssistant(message, consultationContext);
                if (data.context && typeof data.context === 'object') {
                    consultationContext = { ...consultationContext, ...data.context };
                }
                if (Array.isArray(data.products) && data.products.length > 0) {
                    consultationContext.lastProducts = data.products;
                }
                typing.remove();

                const reply = data.reply || 'Mình chưa có câu trả lời phù hợp.';
                streamAIMessage(body, reply, () => {
                    chatHistory.push({
                        role: 'ai',
                        text: reply,
                        vouchers: data.vouchers,
                        products: data.products,
                        suggestions: data.suggestions
                    });
                    saveSession();

                    if (data.vouchers && data.vouchers.length > 0) {
                        renderVouchers(body, data.vouchers);
                    }
                    if (data.products && data.products.length > 0) {
                        renderChatProducts(body, data.products);
                    }

                    // Tự động chuyển hướng đến danh mục sản phẩm (hoặc chi tiết sản phẩm nếu có yêu cầu đích danh)
                    handleAutoNavigation(message, data);

                    renderSuggestions(suggestionsBar, data.suggestions, send);
                    scrollToBottom(body);
                });

                speak(reply);
                panel.dataset.state = 'success';
            } catch (error) {
                typing.remove();
                appendMessage(body, 'ai', error.message || 'Có lỗi xảy ra, bạn thử lại giúp mình nhé.');
                panel.dataset.state = 'error';
            } finally {
                sendButton.disabled = false;
                input.focus();
            }
        };

        input.addEventListener('input', () => {
            if (input.value.trim()) input.removeAttribute('aria-invalid');
            if (panel.dataset.state === 'error' || panel.dataset.state === 'success') {
                panel.dataset.state = 'default';
            }
        });

        function openChat(focusInput = false) {
            chat.classList.add('open');
            chat.classList.remove('minimized');
            document.body.classList.add('ai-chat-open');
            sessionStorage.removeItem('ai_chat_closed');
            sessionStorage.setItem('ai_chat_active_open', 'true');
            scrollToBottom(body);
            if (focusInput) input.focus();
            const nav = chat.querySelector('.ai-chat-suggestions-nav');
            if (nav && suggestionsBar) setupSuggestionsDragScroll(nav, suggestionsBar);
        }

        function closeChat() {
            chat.classList.remove('open');
            chat.classList.remove('minimized');
            document.body.classList.remove('ai-chat-open');
            sessionStorage.setItem('ai_chat_closed', 'true');
            sessionStorage.setItem('ai_chat_active_open', 'false');
            if (recognition && micButton.classList.contains('listening')) recognition.abort();
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }

        function minimizeChat() {
            const isMin = chat.classList.toggle('minimized');
            if (isMin) {
                document.body.classList.remove('ai-chat-open');
            } else {
                document.body.classList.add('ai-chat-open');
                scrollToBottom(body);
                input.focus();
                const nav = chat.querySelector('.ai-chat-suggestions-nav');
                if (nav && suggestionsBar) setupSuggestionsDragScroll(nav, suggestionsBar);
            }
        }

        chat.querySelector('.ai-chat-toggle').addEventListener('click', () => {
            openChat(true);
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

        function resetChatbox(showNotice = false) {
            sessionStorage.removeItem('ai_chat_history');
            sessionStorage.removeItem('ai_chat_context');
            sessionStorage.removeItem('ai_chat_just_redirected_category');
            sessionStorage.removeItem('ai_chat_just_redirected_name');
            chatHistory = [];
            consultationContext = {};
            body.innerHTML = '';
            const welcomeText = 'Xin chào! Mình là Trợ lý Mua sắm AI của TechEcommerce. Mình có thể giúp bạn tìm sản phẩm theo ngân sách, so sánh thông số kỹ thuật, săn mã giảm giá và tính toán trả góp 0%. Bạn cần hỗ trợ gì hôm nay?';
            appendMessage(body, 'ai', welcomeText);
            chatHistory.push({ role: 'ai', text: welcomeText });
            saveSession();
            renderSuggestions(suggestionsBar, starterSuggestions, send);
            scrollToBottom(body);
            if (showNotice && typeof window.showToast === 'function') {
                window.showToast('Đã làm mới phiên trò chuyện cùng Trợ lý AI!', 'info');
            }
        }

        const resetBtn = chat.querySelector('.ai-chat-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => resetChatbox(true));
        }

        // Khi người dùng bấm reload lại trang (F5 hoặc nút Refresh của trình duyệt),
        // hệ thống sẽ reload làm mới lại toàn bộ chatbox theo yêu cầu của người dùng
        const navEntries = window.performance?.getEntriesByType?.('navigation');
        const isPageReload = (navEntries && navEntries[0]?.type === 'reload') || (window.performance?.navigation?.type === 1);

        if (isPageReload) {
            sessionStorage.removeItem('ai_chat_history');
            sessionStorage.removeItem('ai_chat_context');
            sessionStorage.removeItem('ai_chat_just_redirected_category');
            sessionStorage.removeItem('ai_chat_just_redirected_name');
        }

        // Khôi phục phiên tư vấn trước đó (nếu chuyển từ trang khác sang mà không phải reload)
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
            } catch (e) {}
        }

        if (Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory;
            savedHistory.forEach(item => {
                if (item.role === 'user') {
                    appendMessage(body, 'user', item.text);
                } else if (item.role === 'ai') {
                    appendMessage(body, 'ai', item.text);
                    if (item.vouchers && item.vouchers.length) {
                        renderVouchers(body, item.vouchers);
                    }
                    if (item.products && item.products.length) {
                        renderChatProducts(body, item.products, false);
                    }
                }
            });

            const justRedirectedCategory = sessionStorage.getItem('ai_chat_just_redirected_category');
            if (justRedirectedCategory) {
                sessionStorage.removeItem('ai_chat_just_redirected_category');
                const arrivalMsg = `✨ Mình đã mở trang danh mục **${justRedirectedCategory}** cho bạn! Bạn có thể xem toàn bộ các sản phẩm bên dưới, hoặc trao đổi thêm với mình để chọn được chiếc máy ưng ý nhất nhé.`;
                appendMessage(body, 'ai', arrivalMsg);
                chatHistory.push({ role: 'ai', text: arrivalMsg });
                saveSession();
            }

            const justRedirectedName = sessionStorage.getItem('ai_chat_just_redirected_name');
            if (justRedirectedName) {
                sessionStorage.removeItem('ai_chat_just_redirected_name');
                const arrivalMsg = `✨ Mình đã đưa bạn đến màn hình **${justRedirectedName}**! Bạn có thể xem thông số, lướt xuống xem video trên tay thực tế hoặc hỏi mình thêm nhé.`;
                appendMessage(body, 'ai', arrivalMsg);
                chatHistory.push({ role: 'ai', text: arrivalMsg });
                saveSession();
            }

            const lastAiMsg = [...chatHistory].reverse().find(m => m.role === 'ai' && m.suggestions);
            renderSuggestions(suggestionsBar, lastAiMsg?.suggestions || consultationContext.suggestions || starterSuggestions, send);
            scrollToBottom(body);

            const wasClosed = sessionStorage.getItem('ai_chat_closed') === 'true';
            if (!wasClosed || justRedirectedName || justRedirectedCategory) {
                openChat(false);
            }
        } else {
            const welcomeText = 'Xin chào! Mình là Trợ lý Mua sắm AI của TechEcommerce. Mình có thể giúp bạn tìm sản phẩm theo ngân sách, so sánh thông số kỹ thuật, săn mã giảm giá và tính toán trả góp 0%. Bạn cần hỗ trợ gì hôm nay?';
            appendMessage(body, 'ai', welcomeText);
            chatHistory.push({ role: 'ai', text: welcomeText });
            saveSession();
            renderSuggestions(suggestionsBar, starterSuggestions, send);

            setTimeout(() => {
                if (sessionStorage.getItem('ai_chat_closed') !== 'true') {
                    openChat(false);
                }
            }, 450);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
