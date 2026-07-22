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
        link.href = `${root}assets/css/chatbox.css?v=ai-workspace-20260720-1`;
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
            <aside class="ai-chat-panel" role="dialog" aria-label="Trợ lý tư vấn mua hàng">
                <header class="ai-chat-header">
                    <div class="ai-chat-title">
                        <div class="ai-chat-avatar">AI</div>
                        <div>
                            <strong>AI tư vấn khách hàng</strong>
                            <span id="aiChatStatus" role="status">Hỏi kỹ nhu cầu trước khi gợi ý</span>
                        </div>
                    </div>
                    <div class="ai-chat-header-actions">
                        <a class="ai-chat-expand" href="${root}pages/ai/assistant.html" aria-label="Mở giao diện AI đầy đủ" title="Mở giao diện AI đầy đủ">↗</a>
                        <button class="ai-chat-voice" type="button" aria-label="Bật đọc câu trả lời" aria-pressed="false" title="Đọc câu trả lời bằng giọng nói"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg></button>
                        <button class="ai-chat-close" type="button" aria-label="Đóng chat">×</button>
                    </div>
                </header>
                <div class="ai-chat-body" id="aiChatBody"></div>
                <form class="ai-chat-form" id="aiChatForm">
                    <button class="ai-chat-mic" type="button" aria-label="Nhập bằng giọng nói" title="Nhập bằng giọng nói"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/></svg></button>
                    <input class="ai-chat-input" id="aiChatInput" type="text" placeholder="Nhập nhu cầu mua hàng..." autocomplete="off">
                    <button class="ai-chat-send" type="submit" aria-label="Gửi tin nhắn">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-6-6 6 6-6 6"></path>
                        </svg>
                    </button>
                </form>
            </aside>
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

    function renderChatProducts(body, products) {
        const old = body.querySelector('.ai-chat-products');
        if (old) old.remove();
        if (!Array.isArray(products) || !products.length) return;

        const list = document.createElement('section');
        list.className = 'ai-chat-products';
        list.setAttribute('aria-label', 'Sản phẩm chatbot gợi ý');
        list.innerHTML = products.slice(0, 3).map(product => `
            <a class="ai-chat-product" href="${root}pages/catalog/product.html?id=${encodeURIComponent(product._id)}">
                <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">
                <span>
                    <strong>${escapeHTML(product.name)}</strong>
                    <small>${escapeHTML(product.recommendation?.reason || product.category || '')}</small>
                    <b>${Number(product.price || 0).toLocaleString('vi-VN')} đ</b>
                </span>
            </a>
        `).join('');
        body.appendChild(list);
        body.scrollTop = body.scrollHeight;
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
        let voiceEnabled = localStorage.getItem('chatVoiceEnabled') === 'true';

        const updateVoiceButton = () => {
            voiceButton.classList.toggle('active', voiceEnabled);
            voiceButton.setAttribute('aria-pressed', String(voiceEnabled));
            voiceButton.setAttribute('aria-label', voiceEnabled ? 'Tắt đọc câu trả lời' : 'Bật đọc câu trả lời');
        };

        const speak = text => {
            if (!voiceEnabled || !('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(String(text || '').replace(/^[-•]\s*/gm, ''));
            utterance.lang = 'vi-VN';
            utterance.rate = 1;
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
                input.placeholder = 'Đang nghe tiếng Việt...';
                status.textContent = 'Đang nghe · nói tự nhiên, dừng lại để gửi';
            };
            recognition.onresult = event => {
                const finalParts = [];
                const interimParts = [];
                Array.from(event.results).forEach(result => {
                    (result.isFinal ? finalParts : interimParts).push(result[0].transcript);
                });
                recognizedText = [...finalParts, ...interimParts].join(' ').trim();
                input.value = recognizedText;
                status.textContent = 'Đang nghe · dừng nói khoảng 1 giây để gửi';
                window.clearTimeout(recognitionSilenceTimer);
                recognitionSilenceTimer = window.setTimeout(() => recognition.stop(), 1200);
            };
            recognition.onspeechend = () => {
                window.clearTimeout(recognitionSilenceTimer);
                recognitionSilenceTimer = window.setTimeout(() => recognition.stop(), 1200);
            };
            recognition.onerror = event => {
                if (!['no-speech', 'aborted'].includes(event.error)) {
                    appendMessage(body, 'ai', 'Không nhận được giọng nói. Bạn hãy cấp quyền micro và thử lại.');
                }
            };
            recognition.onend = () => {
                window.clearTimeout(recognitionSilenceTimer);
                micButton.classList.remove('listening');
                micButton.setAttribute('aria-label', 'Nhập bằng giọng nói');
                input.placeholder = 'Nhập nhu cầu mua hàng...';
                status.textContent = 'Hỏi kỹ nhu cầu trước khi gợi ý';
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

        const send = async (value) => {
            const message = String(value || input.value || '').trim();
            if (!message) {
                input.setAttribute('aria-invalid', 'true');
                panel.dataset.state = 'error';
                return;
            }

            input.value = '';
            input.removeAttribute('aria-invalid');
            appendMessage(body, 'user', message);
            const typing = appendMessage(body, 'ai ai-typing', 'Đang tìm thông tin phù hợp...');
            sendButton.disabled = true;
            panel.dataset.state = 'loading';

            try {
                const data = await askAssistant(message, consultationContext);
                if (data.context && typeof data.context === 'object') consultationContext = data.context;
                typing.remove();
                const reply = data.reply || 'Mình chưa có câu trả lời phù hợp.';
                appendMessage(body, 'ai', reply);
                renderChatProducts(body, data.products);
                renderSuggestions(body, data.suggestions, send);
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

        chat.querySelector('.ai-chat-toggle').addEventListener('click', () => {
            chat.classList.toggle('open');
            if (chat.classList.contains('open')) input.focus();
        });

        chat.querySelector('.ai-chat-close').addEventListener('click', () => {
            chat.classList.remove('open');
            if (recognition && micButton.classList.contains('listening')) recognition.abort();
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            send();
        });

        appendMessage(body, 'ai', 'Xin chào. Bạn đang cần sản phẩm nào hoặc quan tâm nhóm nào của cửa hàng? Mình sẽ hỏi thêm ngân sách, người sử dụng và điều bạn ưu tiên trước khi gợi ý sản phẩm.');
        renderSuggestions(body, starterSuggestions, send);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
