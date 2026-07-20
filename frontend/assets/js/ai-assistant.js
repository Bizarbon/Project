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
    const initialPrompts = [
        'Tư vấn laptop phù hợp với sinh viên IT',
        'So sánh hai điện thoại chụp ảnh tốt',
        'Kiểm tra quá trình giao hàng của tôi',
        'Chính sách bảo hành sản phẩm'
    ];

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
        return { id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title: 'Cuộc trò chuyện mới', updatedAt: new Date().toISOString(), messages: [] };
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

    function renderWelcome() {
        conversation.innerHTML = `
            <article class="assistant-message">
                <span class="message-avatar" aria-hidden="true">AI</span>
                <section class="message-content welcome-message">
                    <h2>Xin chào, mình là AI tư vấn khách hàng.</h2>
                    <p>Mình có thể gợi ý sản phẩm theo nhu cầu và ngân sách, so sánh thông số, kiểm tra đơn hàng hoặc hỗ trợ các vấn đề kỹ thuật.</p>
                    <nav class="prompt-chips" aria-label="Câu hỏi gợi ý">
                        ${initialPrompts.map(prompt => `<button type="button" data-prompt="${escapeHTML(prompt)}">${escapeHTML(prompt)}</button>`).join('')}
                    </nav>
                </section>
            </article>`;
        bindPromptButtons(conversation);
    }

    function bindPromptButtons(scope) {
        scope.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
    }

    function productMarkup(products) {
        if (!Array.isArray(products) || !products.length) return '';
        return `<section class="message-products" aria-label="Sản phẩm được gợi ý">${products.slice(0, 3).map(product => `
            <a class="message-product" href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}">
                <img src="${escapeHTML(product.image || '')}" alt="${escapeHTML(product.name || 'Sản phẩm công nghệ')}">
                <strong>${escapeHTML(product.name)}</strong>
                <small>${escapeHTML(product.category || product.brand || '')}</small>
                <b>${Number(product.price || 0).toLocaleString('vi-VN')} đ</b>
            </a>`).join('')}</section>`;
    }

    function appendMessage(role, text, products = [], suggestions = [], persist = true) {
        const article = document.createElement('article');
        article.className = `assistant-message ${role}`;
        const avatar = role === 'user' ? escapeHTML((user?.name || 'Bạn').charAt(0).toUpperCase()) : 'AI';
        article.innerHTML = `
            <span class="message-avatar" aria-hidden="true">${avatar}</span>
            <section class="message-content">
                ${escapeHTML(text)}
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
        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers: assistantAuth.getHeaders(),
            body: JSON.stringify({ message })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'AI chưa thể phản hồi lúc này.');
        return data;
    }

    function speak(text) {
        if (!voiceOutputEnabled || !('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1;
        speechSynthesis.speak(utterance);
    }

    async function sendMessage(value) {
        const message = String(value || input.value || '').trim();
        if (!message || sendButton.disabled) return;
        switchView('chat');
        input.value = '';
        resizeInput();
        appendMessage('user', message);
        const pending = appendMessage('assistant', 'Đang phân tích nhu cầu và tìm thông tin phù hợp...', [], [], false);
        sendButton.disabled = true;
        try {
            const data = await requestAssistant(message);
            pending.remove();
            const reply = data.reply || 'Mình chưa tìm được câu trả lời phù hợp.';
            appendMessage('assistant', reply, data.products || [], data.suggestions || []);
            speak(reply);
        } catch (error) {
            pending.remove();
            appendMessage('assistant', error.message || 'Có lỗi xảy ra. Bạn vui lòng thử lại.', [], [], false);
        } finally {
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
                <img src="${escapeHTML(product.image || '')}" alt="${escapeHTML(product.name)}">
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
        recognition.lang = 'vi-VN';
        recognition.interimResults = true;
        recognition.onstart = () => voiceInputButton.classList.add('listening');
        recognition.onresult = event => {
            input.value = Array.from(event.results).map(result => result[0].transcript).join(' ');
            resizeInput();
        };
        recognition.onend = () => voiceInputButton.classList.remove('listening');
        recognition.onerror = () => voiceInputButton.classList.remove('listening');
        voiceInputButton.addEventListener('click', () => recognition.start());
    } else {
        voiceInputButton.disabled = true;
        voiceInputButton.title = 'Trình duyệt chưa hỗ trợ nhận dạng giọng nói';
    }

    renderWelcome();
    updateCounts();
    loadSavedProducts();
})();
