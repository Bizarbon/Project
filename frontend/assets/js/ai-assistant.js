(function initAssistantWorkspace() {
    const root = '../../';
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const staticPorts = new Set(['5500', '5501']);
    const apiUrl = localHosts.has(window.location.hostname) && staticPorts.has(window.location.port)
        ? 'http://localhost:5000/api'
        : `${window.location.origin}/api`;
    const assistantAuth = {
        getUser() {
            try { return JSON.parse(localStorage.getItem('user') || 'null'); }
            catch (error) { return null; }
        },
        isLoggedIn() { return Boolean(localStorage.getItem('token')); },
        getHeaders() {
            const token = localStorage.getItem('token');
            return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
        }
    };
    const user = assistantAuth.getUser();
    const identity = user?.id ?? user?._id ?? user?.username ?? 'guest';
    const historyKey = `ai:history:${identity}`;
    const initialPromptsTech = [
        'Tư vấn tai nghe có dây cắm laptop 3.5mm',
        'Tư vấn laptop phù hợp với sinh viên IT',
        'So sánh hai điện thoại chụp ảnh tốt',
        'Chính sách bảo hành & mã giảm giá hôm nay'
    ];
    const initialPromptsOpen = [
        'Giải thích cảm biến quang học vs laser trên chuột gaming',
        'Viết hàm tìm kiếm nhị phân bằng Python có giải thích',
        'Lên kế hoạch học tiếng Anh giao tiếp trong 30 ngày',
        'Tìm giúp mình tai nghe có dây dưới 2 triệu tại shop'
    ];
    const CHAT_MODE_KEY = 'ai_chat_mode';
    let activeChatMode = localStorage.getItem(CHAT_MODE_KEY) === 'open_ai' ? 'open_ai' : 'tech_advisor';
    let activeStreamController = null;

    const views = {
        chat: document.getElementById('chatView'),
        history: document.getElementById('historyView'),
        saved: document.getElementById('savedView'),
        support: document.getElementById('supportView')
    };
    const conversation = document.getElementById('conversation');
    const form = document.getElementById('assistantForm');
    const input = document.getElementById('assistantInput');
    const sendButton = document.getElementById('sendButton');
    const stopButton = document.getElementById('stopButton');
    const activeModelNameEl = document.getElementById('activeModelName');
    const modeButtons = Array.from(document.querySelectorAll('.ai-mode-btn[data-chat-mode]'));
    const settingsDialog = document.getElementById('settingsDialog');
    const voiceOutputToggle = document.getElementById('voiceOutputToggle');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let sessions = readJSON(historyKey, []);
    let currentSession = createSession();
    let voiceOutputEnabled = localStorage.getItem('ai:voice-output') === 'true';

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[character]));
    }

    function createSession() {
        return { id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title: 'Cuộc trò chuyện mới', updatedAt: new Date().toISOString(), messages: [], context: {} };
    }

    function saveCurrentSession() {
        if (!currentSession.messages.length) return;
        currentSession.updatedAt = new Date().toISOString();
        const index = sessions.findIndex(item => item.id === currentSession.id);
        if (index >= 0) sessions[index] = currentSession;
        else sessions.unshift(currentSession);
        sessions = sessions.slice(0, 30);
        localStorage.setItem(historyKey, JSON.stringify(sessions));
        updateCounts();
    }

    function updateCounts(savedCount) {
        document.getElementById('historyCount').textContent = String(sessions.length);
        if (Number.isFinite(savedCount)) document.getElementById('savedCount').textContent = String(savedCount);
    }

    function switchView(name) {
        Object.entries(views).forEach(([key, section]) => {
            const active = key === name;
            section.hidden = !active;
            section.classList.toggle('active', active);
        });
        document.querySelectorAll('.ai-nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
        document.body.classList.remove('sidebar-open');
        document.getElementById('sidebarToggle').setAttribute('aria-expanded', 'false');
        if (name === 'history') renderHistory();
        if (name === 'saved') loadSavedProducts();
    }

    function renderMarkdownTable(tableLines) {
        const rows = [];
        for (const line of tableLines) {
            const trimmed = line.trim();
            if (/^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(trimmed)) continue;
            let cells = trimmed.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            if (cells.length) rows.push(cells);
        }
        if (!rows.length) return '';
        const head = rows[0];
        const body = rows.slice(1);
        let html = '<section class="ai-md-table-wrap" tabindex="0" role="region" aria-label="Bảng so sánh thông tin"><table class="ai-md-table"><thead><tr>';
        head.forEach(cell => { html += `<th scope="col">${cell}</th>`; });
        html += '</tr></thead>';
        if (body.length) {
            html += '<tbody>';
            body.forEach(row => {
                html += '<tr>';
                row.forEach((cell, idx) => {
                    html += idx === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }
        html += '</table></section>';
        return html;
    }

    function formatRichMarkdown(rawText) {
        const str = String(rawText || '').replace(/\r\n/g, '\n');
        const codeBlocks = [];
        const withPlaceholders = str.replace(/```([a-zA-Z0-9_+#.-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push({ lang: (lang || 'code').trim().toLowerCase(), code: String(code || '').replace(/\n$/, '') });
            return `\n@@CODEBLOCK_${idx}@@\n`;
        });
        const escaped = escapeHTML(withPlaceholders)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/`([^`\n]+)`/g, '<code>$1</code>');

        const lines = escaped.split('\n');
        const out = [];
        let inList = false;
        let tableLines = [];
        const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };
        const flushTable = () => { if (tableLines.length) { out.push(renderMarkdownTable(tableLines)); tableLines = []; } };

        for (const line of lines) {
            const t = line.trim();
            const cm = t.match(/^@@CODEBLOCK_(\d+)@@$/);
            if (cm) {
                flushList();
                flushTable();
                const blk = codeBlocks[Number(cm[1])];
                if (blk) {
                    out.push(`<figure class="ai-code-block"><figcaption><span>${escapeHTML(blk.lang)}</span><button type="button" class="ai-code-copy-btn">Sao chép</button></figcaption><pre><code>${escapeHTML(blk.code)}</code></pre></figure>`);
                }
                continue;
            }
            if (t.startsWith('|') && t.includes('|')) {
                flushList();
                tableLines.push(t);
                continue;
            }
            flushTable();
            if (/^[-*_]{3,}$/.test(t)) {
                flushList();
                out.push('<hr class="ai-md-hr">');
                continue;
            }
            if (/^[•\-*]\s+/.test(t)) {
                if (!inList) { out.push('<ul class="ai-md-list">'); inList = true; }
                out.push(`<li>${t.replace(/^[•\-*]\s+/, '')}</li>`);
            } else {
                flushList();
                if (/^#{1,4}\s+/.test(t)) {
                    out.push(`<h3 class="ai-md-heading">${t.replace(/^#{1,4}\s+/, '')}</h3>`);
                } else if (t) {
                    out.push(`<p>${t}</p>`);
                }
            }
        }
        flushList();
        flushTable();
        return out.join('');
    }

    function syncWorkspaceModeUI(nextMode) {
        activeChatMode = nextMode === 'open_ai' ? 'open_ai' : 'tech_advisor';
        try { localStorage.setItem(CHAT_MODE_KEY, activeChatMode); } catch (_) { }
        modeButtons.forEach(btn => {
            const active = btn.dataset.chatMode === activeChatMode;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-checked', String(active));
        });
        if (input) {
            input.placeholder = activeChatMode === 'open_ai'
                ? 'Hỏi bất kỳ điều gì (lập trình, toán, viết lách, công nghệ, tìm mua sản phẩm...)'
                : 'Hỏi về sản phẩm, cấu hình, tai nghe, đơn hàng hoặc chính sách bảo hành...';
        }
        if (!currentSession.messages.length) renderWelcome();
    }

    modeButtons.forEach(btn => btn.addEventListener('click', () => syncWorkspaceModeUI(btn.dataset.chatMode)));
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            if (activeStreamController) {
                activeStreamController.abort();
                activeStreamController = null;
            }
        });
    }
    conversation.addEventListener('click', (event) => {
        const btn = event.target.closest('.ai-code-copy-btn');
        if (!btn) return;
        const codeEl = btn.closest('.ai-code-block')?.querySelector('pre code');
        if (!codeEl) return;
        navigator.clipboard?.writeText(codeEl.textContent || '').then(() => {
            const old = btn.textContent;
            btn.textContent = '✓ Đã chép';
            setTimeout(() => { btn.textContent = old; }, 1600);
        }).catch(() => {});
    });
    fetch(`${apiUrl}/chat/ai-status`).then(r => r.json()).then(st => {
        if (st?.model && st.model !== 'none' && activeModelNameEl) {
            activeModelNameEl.textContent = st.model;
        }
    }).catch(() => {});

    function renderWelcome() {
        const prompts = activeChatMode === 'open_ai' ? initialPromptsOpen : initialPromptsTech;
        const heading = activeChatMode === 'open_ai'
            ? 'Xin chào, em là Trợ lý AI Toàn năng.'
            : 'Xin chào, em là Chuyên gia AI Công nghệ & Mua sắm.';
        const sub = activeChatMode === 'open_ai'
            ? 'Bạn có thể hỏi tự do mọi lĩnh vực (lập trình, học tập, viết lách, đời sống, công nghệ...) hoặc nhờ em tra giá, so sánh sản phẩm thật tại cửa hàng.'
            : 'Em có thể giải đáp chuyên sâu công nghệ, gợi ý sản phẩm theo nhu cầu và ngân sách, so sánh thông số, tính trả góp 0% và tra cứu đơn hàng.';
        conversation.innerHTML = `
            <article class="assistant-message">
                <span class="message-avatar" aria-hidden="true">AI</span>
                <section class="message-content welcome-message">
                    <h2>${heading}</h2>
                    <p>${sub}</p>
                    <nav class="prompt-chips" aria-label="Câu hỏi gợi ý">
                        ${prompts.map(prompt => `<button type="button" data-prompt="${escapeHTML(prompt)}">${escapeHTML(prompt)}</button>`).join('')}
                    </nav>
                </section>
            </article>`;
        bindPromptButtons(conversation);
    }

    function bindPromptButtons(scope) {
        scope.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
    }

    function resolveImg(src) {
        if (!src) return `${root}assets/images/product-placeholder.svg`;
        if (/^(?:https?:|data:|\/)/i.test(src)) return src;
        return `${root}${String(src).replace(/^\.?\//, '')}`;
    }

    function productMarkup(products) {
        if (!Array.isArray(products) || !products.length) return '';
        return `<section class="message-products" aria-label="Sản phẩm được gợi ý">${products.slice(0, 3).map(product => `
            <a class="message-product" href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}">
                <img src="${escapeHTML(resolveImg(product.image))}" alt="${escapeHTML(product.name || 'Sản phẩm công nghệ')}" onerror="this.onerror=null; this.src='${root}assets/images/product-placeholder.svg'">
                <strong>${escapeHTML(product.name)}</strong>
                <small>${escapeHTML(product.category || product.brand || '')}</small>
                <b>${Number(product.price || 0).toLocaleString('vi-VN')} đ</b>
            </a>`).join('')}</section>`;
    }

    function addBatchToStoreCart(cartItems = []) {
        if (!Array.isArray(cartItems) || !cartItems.length) return;
        const cartKey = localStorage.getItem('token') ? 'cart:user' : 'cart:guest';
        let cart = readJSON(cartKey, []);
        if (!Array.isArray(cart)) cart = [];
        cartItems.forEach(item => {
            const pid = Number(item.productId);
            const qty = Math.max(1, Number(item.quantity) || 1);
            if (!pid) return;
            const found = cart.find(i => String(i.productId) === String(pid) && !i.selectedColor && !i.selectedStorage);
            if (found) found.quantity = (Number(found.quantity) || 1) + qty;
            else cart.push({ productId: pid, quantity: qty, selectedColor: null, selectedStorage: null, selectedImage: item.image || '', price: Number(item.price || 0) });
        });
        localStorage.setItem(cartKey, JSON.stringify(cart));
    }

    function cartBatchMarkup(cartItems = [], totalAmt = 0) {
        if (!Array.isArray(cartItems) || !cartItems.length) return '';
        const computedTotal = Number(totalAmt || cartItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0));
        return `<section class="ai-cart-batch-box" aria-label="Sản phẩm vừa thêm vào giỏ hàng">
            <header><strong>✓ Đã thêm ${cartItems.length} sản phẩm vào giỏ hàng</strong></header>
            <ul>${cartItems.map(item => `
                <li>
                    <img src="${escapeHTML(resolveImg(item.image))}" alt="${escapeHTML(item.name)}" width="44" height="44" onerror="this.onerror=null;this.src='${root}assets/images/product-placeholder.svg'">
                    <span><strong>${escapeHTML(item.name)}</strong><small>SL: ${Number(item.quantity || 1)} · ${Number(item.price || 0).toLocaleString('vi-VN')} đ</small></span>
                </li>`).join('')}</ul>
            <footer>
                <span>Tạm tính: <b>${computedTotal.toLocaleString('vi-VN')} đ</b></span>
                <a href="${root}index.html?openCart=1">🛒 Mở Giỏ Hàng &amp; Thanh Toán</a>
            </footer>
        </section>`;
    }

    function appendMessage(role, text, products = [], suggestions = [], persist = true, cartAction = null) {
        const article = document.createElement('article');
        article.className = `assistant-message ${role}`;
        const avatar = role === 'user' ? escapeHTML((user?.name || 'Bạn').charAt(0).toUpperCase()) : 'AI';
        const bodyHtml = role === 'assistant' ? formatRichMarkdown(text) : `<p>${escapeHTML(text)}</p>`;
        article.innerHTML = `
            <span class="message-avatar" aria-hidden="true">${avatar}</span>
            <section class="message-content">
                <section class="message-markdown">${bodyHtml}</section>
                ${cartAction?.cartItems?.length ? cartBatchMarkup(cartAction.cartItems, cartAction.totalCartAddedAmount) : ''}
                ${productMarkup(products)}
                ${suggestions.length ? `<nav class="prompt-chips" aria-label="Gợi ý tiếp theo">${suggestions.slice(0, 4).map(item => `<button type="button" data-prompt="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join('')}</nav>` : ''}
            </section>`;
        conversation.appendChild(article);
        bindPromptButtons(article);
        article.scrollIntoView({ behavior: 'smooth', block: 'end' });
        if (persist) {
            currentSession.messages.push({ role, text, products, suggestions });
            if (role === 'user' && currentSession.title === 'Cuộc trò chuyện mới') currentSession.title = text.slice(0, 54);
            saveCurrentSession();
        }
        return article;
    }

    function renderSession() {
        conversation.innerHTML = '';
        if (!currentSession.messages.length) return renderWelcome();
        currentSession.messages.forEach(message => appendMessage(message.role, message.text, message.products, message.suggestions, false));
    }

    async function requestAssistant(message) {
        const ctx = { ...(currentSession.context || {}), chatMode: activeChatMode };
        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers: assistantAuth.getHeaders(),
            body: JSON.stringify({ message, mode: activeChatMode, sessionId: currentSession.id, context: ctx })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'AI chưa thể phản hồi lúc này.');
        return data;
    }

    async function requestAssistantStream(message, { onStatus, onDelta, signal } = {}) {
        const ctx = { ...(currentSession.context || {}), chatMode: activeChatMode };
        const headers = { ...assistantAuth.getHeaders(), Accept: 'text/event-stream' };
        const response = await fetch(`${apiUrl}/chat/stream`, {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({ message, mode: activeChatMode, sessionId: currentSession.id, context: ctx })
        });
        const ct = response.headers.get('content-type') || '';
        if (!response.ok || !response.body || !ct.includes('text/event-stream')) {
            return await requestAssistant(message);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let streamedText = '';
        let finalData = null;

        const handleBlock = (block) => {
            const lines = block.split(/\r?\n/);
            let evt = 'message';
            const dataLines = [];
            for (const line of lines) {
                if (line.startsWith('event:')) evt = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            if (!dataLines.length) return;
            let payload = null;
            try { payload = JSON.parse(dataLines.join('\n')); } catch (_) { return; }
            if (evt === 'status' && payload?.text && typeof onStatus === 'function') onStatus(payload.text);
            else if (evt === 'delta' && payload?.text) {
                streamedText += payload.text;
                if (typeof onDelta === 'function') onDelta(payload.text, streamedText);
            } else if (evt === 'done') finalData = payload;
            else if (evt === 'error') throw new Error(payload?.message || 'AI chưa thể phản hồi lúc này.');
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || '';
            for (const b of blocks) if (b.trim()) handleBlock(b);
        }
        if (buffer.trim()) handleBlock(buffer);
        return finalData || (streamedText ? { reply: streamedText, products: [], suggestions: [], context: ctx } : await requestAssistant(message));
    }

    function formatVndForSpeech(priceStr) {
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
    }

    function cleanSpeechText(text) {
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

            const productMatch = line.match(/^(\d+)[\.\)]\s*(?:\*\*)?(.*?)(?:\*\*)?\s*[-–:]\s*(?:\*\*)?([0-9\.,]+(?:\s*(?:đ|vnd|đồng|₫))?)(?:\*\*)?(.*)$/i);
            if (productMatch) {
                const index = productMatch[1];
                const name = productMatch[2].replace(/\*\*|\*|`/g, '').trim();
                const priceRaw = productMatch[3].trim();
                const priceSpeech = formatVndForSpeech(priceRaw);
                spokenLines.push(`Sản phẩm ${index}: ${name}, giá ${priceSpeech}.`);
                continue;
            }

            let cleanLine = line
                .replace(/\*\*|\*|`|#/g, '')
                .replace(/^[•\-]\s*/, '')
                .replace(/\((?:còn|tạm hết)[^)]*\)/gi, '')
                .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                .trim();

            cleanLine = cleanLine.replace(/(\d{1,3}(?:\.\d{3}){1,3})\s*(?:đ|vnd|đồng|₫)/gi, (m, p) => formatVndForSpeech(p));

            if (cleanLine.length > 2) {
                spokenLines.push(cleanLine);
            }
        }

        return spokenLines.join(' ');
    }

    function speak(text) {
        if (!voiceOutputEnabled || !('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const cleanText = cleanSpeechText(text);
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.05;
        const voices = speechSynthesis.getVoices();
        utterance.voice = voices.find(voice => voice.lang?.toLowerCase().startsWith('vi')) || null;
        speechSynthesis.speak(utterance);
    }

    async function sendMessage(value) {
        const message = String(value || input.value || '').trim();
        if (!message || sendButton.disabled) return;
        switchView('chat');
        input.value = '';
        resizeInput();
        appendMessage('user', message);
        const pending = appendMessage('assistant', activeChatMode === 'open_ai' ? '✨ AI đang suy luận...' : '🧠 Đang phân tích nhu cầu và tra cứu thông tin...', [], [], false);
        const pendingMd = pending.querySelector('.message-markdown');
        sendButton.disabled = true;
        if (stopButton) stopButton.hidden = false;
        const controller = new AbortController();
        activeStreamController = controller;
        let accumulated = '';
        try {
            const data = await requestAssistantStream(message, {
                signal: controller.signal,
                onStatus: (statusText) => {
                    if (!accumulated && pendingMd) {
                        pendingMd.innerHTML = `<p class="ai-stream-status">${escapeHTML(statusText)}</p>`;
                    }
                },
                onDelta: (_, fullSoFar) => {
                    accumulated = fullSoFar;
                    if (pendingMd) {
                        pendingMd.innerHTML = formatRichMarkdown(accumulated);
                        pending.scrollIntoView({ behavior: 'auto', block: 'end' });
                    }
                }
            });
            if (data.context && typeof data.context === 'object') currentSession.context = data.context;
            if (data.meta?.model && data.meta.model !== 'none' && activeModelNameEl) {
                activeModelNameEl.textContent = data.meta.model;
            }
            pending.remove();
            const reply = data.reply || accumulated || 'Em chưa tìm được câu trả lời phù hợp.';
            if (data.action === 'add_to_cart_batch' && Array.isArray(data.cartItems) && data.cartItems.length > 0) {
                addBatchToStoreCart(data.cartItems);
            }
            appendMessage('assistant', reply, data.products || [], data.suggestions || [], true, data.action === 'add_to_cart_batch' ? data : null);
            speak(reply);
        } catch (error) {
            pending.remove();
            if (error?.name === 'AbortError' && accumulated) {
                appendMessage('assistant', accumulated, [], []);
            } else if (error?.name !== 'AbortError') {
                appendMessage('assistant', error.message || 'Có lỗi xảy ra. Bạn vui lòng thử lại.', [], [], false);
            }
        } finally {
            activeStreamController = null;
            if (stopButton) stopButton.hidden = true;
            sendButton.disabled = false;
            input.focus();
        }
    }

    function newChat() {
        saveCurrentSession();
        currentSession = createSession();
        renderWelcome();
        switchView('chat');
        input.focus();
    }

    function renderHistory() {
        const list = document.getElementById('historyList');
        if (!sessions.length) {
            list.innerHTML = '<p class="empty-state"><strong>Chưa có lịch sử tư vấn</strong>Các cuộc trò chuyện sẽ tự động được lưu trên thiết bị này.</p>';
            return;
        }
        list.innerHTML = sessions.map(session => `
            <article class="history-card">
                <button type="button" data-session-id="${escapeHTML(session.id)}"><strong>${escapeHTML(session.title)}</strong><small>${session.messages.length} tin nhắn</small></button>
                <small>${new Date(session.updatedAt).toLocaleString('vi-VN')}</small>
                <button class="delete-session" type="button" data-delete-session="${escapeHTML(session.id)}" aria-label="Xóa cuộc trò chuyện">×</button>
            </article>`).join('');
        list.querySelectorAll('[data-session-id]').forEach(button => button.addEventListener('click', () => {
            const session = sessions.find(item => item.id === button.dataset.sessionId);
            if (!session) return;
            currentSession = session;
            renderSession();
            switchView('chat');
        }));
        list.querySelectorAll('[data-delete-session]').forEach(button => button.addEventListener('click', () => {
            sessions = sessions.filter(item => item.id !== button.dataset.deleteSession);
            localStorage.setItem(historyKey, JSON.stringify(sessions));
            updateCounts();
            renderHistory();
        }));
    }

    async function loadSavedProducts() {
        const list = document.getElementById('savedProductList');
        list.innerHTML = '<p class="empty-state"><strong>Đang tải sản phẩm</strong>Vui lòng chờ trong giây lát.</p>';
        try {
            let products = [];
            if (assistantAuth.isLoggedIn()) {
                const response = await fetch(`${apiUrl}/customers/me/wishlist`, { headers: assistantAuth.getHeaders() });
                if (!response.ok) throw new Error('Không tải được danh sách đã lưu.');
                products = await response.json();
            } else {
                const ids = new Set(readJSON('wishlist', []).map(Number));
                if (ids.size) {
                    const response = await fetch(`${apiUrl}/products`);
                    const data = await response.json();
                    products = (Array.isArray(data) ? data : data.products || []).filter(product => ids.has(Number(product._id)));
                }
            }
            updateCounts(products.length);
            renderSavedProducts(products);
        } catch (error) {
            list.innerHTML = `<p class="empty-state"><strong>Không tải được sản phẩm</strong>${escapeHTML(error.message)}</p>`;
        }
    }

    function renderSavedProducts(products) {
        const list = document.getElementById('savedProductList');
        if (!products.length) {
            list.innerHTML = '<p class="empty-state"><strong>Chưa có sản phẩm đã lưu</strong>Nhấn biểu tượng yêu thích ở trang cửa hàng để thêm sản phẩm.</p>';
            return;
        }
        list.innerHTML = products.map(product => `
            <article class="saved-card">
                <img src="${escapeHTML(resolveImg(product.image))}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null; this.src='${root}assets/images/product-placeholder.svg'">
                <section><h2>${escapeHTML(product.name)}</h2><p>${escapeHTML(product.brand || product.category || '')}</p><b>${Number(product.price || 0).toLocaleString('vi-VN')} đ</b></section>
                <footer><a href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}">Xem sản phẩm</a><button type="button" data-remove-product="${product._id}" aria-label="Bỏ lưu ${escapeHTML(product.name)}">×</button></footer>
            </article>`).join('');
        list.querySelectorAll('[data-remove-product]').forEach(button => button.addEventListener('click', () => removeSavedProduct(Number(button.dataset.removeProduct))));
    }

    async function removeSavedProduct(productId) {
        if (assistantAuth.isLoggedIn()) {
            await fetch(`${apiUrl}/customers/me/wishlist`, {
                method: 'PUT', headers: assistantAuth.getHeaders(), body: JSON.stringify({ productId, action: 'remove' })
            });
        } else {
            const ids = readJSON('wishlist', []).map(Number).filter(id => id !== productId);
            localStorage.setItem('wishlist', JSON.stringify(ids));
        }
        loadSavedProducts();
    }

    function resizeInput() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
    }

    document.querySelectorAll('.ai-nav-item').forEach(button => button.addEventListener('click', () => button.dataset.view === 'chat' ? newChat() : switchView(button.dataset.view)));
    document.querySelectorAll('[data-support-prompt]').forEach(button => button.addEventListener('click', () => {
        newChat();
        sendMessage(button.dataset.supportPrompt);
    }));
    form.addEventListener('submit', event => { event.preventDefault(); sendMessage(); });
    input.addEventListener('input', resizeInput);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });

    document.getElementById('sidebarToggle').addEventListener('click', event => {
        const open = document.body.classList.toggle('sidebar-open');
        event.currentTarget.setAttribute('aria-expanded', String(open));
    });
    document.getElementById('settingsButton').addEventListener('click', () => settingsDialog.showModal());
    voiceOutputToggle.checked = voiceOutputEnabled;
    voiceOutputToggle.addEventListener('change', () => {
        voiceOutputEnabled = voiceOutputToggle.checked;
        localStorage.setItem('ai:voice-output', String(voiceOutputEnabled));
        if (!voiceOutputEnabled && 'speechSynthesis' in window) speechSynthesis.cancel();
    });
    document.getElementById('clearHistoryButton').addEventListener('click', () => {
        if (!window.confirm('Xóa toàn bộ lịch sử tư vấn trên thiết bị này?')) return;
        sessions = [];
        localStorage.removeItem(historyKey);
        updateCounts();
        settingsDialog.close();
        newChat();
    });

    const voiceInputButton = document.getElementById('voiceInputButton');
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        let recognizedText = '';
        let silenceTimer = null;
        recognition.lang = 'vi-VN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onstart = () => {
            recognizedText = '';
            voiceInputButton.classList.add('listening');
            voiceInputButton.setAttribute('aria-label', 'Đang nghe, bấm để dừng');
        };
        recognition.onresult = event => {
            const finalParts = [];
            const interimParts = [];
            Array.from(event.results).forEach(result => {
                (result.isFinal ? finalParts : interimParts).push(result[0].transcript);
            });
            recognizedText = [...finalParts, ...interimParts].join(' ').trim();
            input.value = recognizedText;
            resizeInput();
            window.clearTimeout(silenceTimer);
            silenceTimer = window.setTimeout(() => recognition.stop(), 1200);
        };
        recognition.onspeechend = () => {
            window.clearTimeout(silenceTimer);
            silenceTimer = window.setTimeout(() => recognition.stop(), 1200);
        };
        recognition.onend = () => {
            window.clearTimeout(silenceTimer);
            voiceInputButton.classList.remove('listening');
            voiceInputButton.setAttribute('aria-label', 'Nhập bằng giọng nói');
            if (recognizedText) sendMessage(recognizedText);
        };
        recognition.onerror = () => voiceInputButton.classList.remove('listening');
        voiceInputButton.addEventListener('click', () => {
            if (voiceInputButton.classList.contains('listening')) recognition.stop();
            else recognition.start();
        });
    } else {
        voiceInputButton.disabled = true;
        voiceInputButton.title = 'Trình duyệt chưa hỗ trợ nhận dạng giọng nói';
    }

    syncWorkspaceModeUI(activeChatMode);
    updateCounts();
    loadSavedProducts();
})();
