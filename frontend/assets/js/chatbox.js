(function initAIChatbox() {
    if (window.__aiChatboxLoaded) return;
    window.__aiChatboxLoaded = true;

    const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : getBasePath();
    const apiUrl = window.API_URL || 'http://localhost:5000/api';
    const starterSuggestions = [
        'Tư vấn laptop dưới 15 triệu',
        'Điện thoại chụp ảnh đẹp',
        'Kiểm tra đơn hàng của tôi',
        'Chính sách bảo hành'
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
        link.href = `${root}assets/css/chatbox.css`;
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

    function renderShell() {
        const chat = document.createElement('section');
        chat.className = 'ai-chat';
        chat.innerHTML = `
            <div class="ai-chat-panel" role="dialog" aria-label="Trợ lý tư vấn mua hàng">
                <header class="ai-chat-header">
                    <div class="ai-chat-title">
                        <div class="ai-chat-avatar">AI</div>
                        <div>
                            <strong>TechEcommerce Assistant</strong>
                            <span>Tư vấn sản phẩm và hỗ trợ đơn hàng</span>
                        </div>
                    </div>
                    <button class="ai-chat-close" type="button" aria-label="Đóng chat">×</button>
                </header>
                <div class="ai-chat-body" id="aiChatBody"></div>
                <form class="ai-chat-form" id="aiChatForm">
                    <input class="ai-chat-input" id="aiChatInput" type="text" placeholder="Nhập nhu cầu mua hàng..." autocomplete="off">
                    <button class="ai-chat-send" type="submit" aria-label="Gửi tin nhắn">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-6-6 6 6-6 6"></path>
                        </svg>
                    </button>
                </form>
            </div>
            <button class="ai-chat-toggle" type="button" aria-label="Mở trợ lý tư vấn">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m8-2a8 8 0 1 1-3.1-6.32L21 5l-1.04 3.05A7.97 7.97 0 0 1 21 12Z"></path>
                </svg>
            </button>
        `;
        document.body.appendChild(chat);
        return chat;
    }

    function appendMessage(body, role, text) {
        const message = document.createElement('div');
        message.className = `ai-message ${role}`;
        message.innerHTML = `<div class="ai-bubble">${escapeHTML(text)}</div>`;
        body.appendChild(message);
        body.scrollTop = body.scrollHeight;
        return message;
    }

    function renderSuggestions(body, suggestions, onClick) {
        const old = body.querySelector('.ai-chat-suggestions');
        if (old) old.remove();
        if (!suggestions || !suggestions.length) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'ai-chat-suggestions';
        wrapper.innerHTML = suggestions
            .slice(0, 4)
            .map(item => `<button class="ai-chip" type="button">${escapeHTML(item)}</button>`)
            .join('');
        wrapper.querySelectorAll('.ai-chip').forEach(button => {
            button.addEventListener('click', () => onClick(button.textContent));
        });
        body.appendChild(wrapper);
        body.scrollTop = body.scrollHeight;
    }

    async function askAssistant(message) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Chatbot chưa phản hồi được.');
        return data;
    }

    function boot() {
        ensureStylesheet();
        const chat = renderShell();
        const body = chat.querySelector('#aiChatBody');
        const form = chat.querySelector('#aiChatForm');
        const input = chat.querySelector('#aiChatInput');
        const sendButton = chat.querySelector('.ai-chat-send');

        const send = async (value) => {
            const message = String(value || input.value || '').trim();
            if (!message) return;

            input.value = '';
            appendMessage(body, 'user', message);
            const typing = appendMessage(body, 'ai ai-typing', 'Đang tìm thông tin phù hợp...');
            sendButton.disabled = true;

            try {
                const data = await askAssistant(message);
                typing.remove();
                appendMessage(body, 'ai', data.reply || 'Mình chưa có câu trả lời phù hợp.');
                renderSuggestions(body, data.suggestions, send);
            } catch (error) {
                typing.remove();
                appendMessage(body, 'ai', error.message || 'Có lỗi xảy ra, bạn thử lại giúp mình nhé.');
            } finally {
                sendButton.disabled = false;
                input.focus();
            }
        };

        chat.querySelector('.ai-chat-toggle').addEventListener('click', () => {
            chat.classList.toggle('open');
            if (chat.classList.contains('open')) input.focus();
        });

        chat.querySelector('.ai-chat-close').addEventListener('click', () => {
            chat.classList.remove('open');
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            send();
        });

        appendMessage(body, 'ai', 'Xin chào, mình có thể tư vấn sản phẩm công nghệ theo ngân sách, nhu cầu sử dụng hoặc hỗ trợ kiểm tra đơn hàng nếu bạn đã đăng nhập.');
        renderSuggestions(body, starterSuggestions, send);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
