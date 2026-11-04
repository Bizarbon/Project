/**
 * ==========================================================================
 * TechEcommerce AI Chatbot Mascot Controller
 * File: assets/js/mascot.js
 * Quản lý linh vật AI mèo công nghệ, trạng thái cảm xúc và khả năng tiếp cận
 * ==========================================================================
 */

(function initTechMascot() {
    if (window.__techMascotInitialized) return;
    window.__techMascotInitialized = true;

    const ALLOWED_STATES = ['idle', 'listening', 'thinking', 'answering', 'happy', 'sorry'];
    const STORAGE_KEY_VISIBILITY = 'tm_mascot_visible';

    let currentState = 'idle';
    let typingTimer = null;
    let resetTimer = null;
    let answeringStartTime = 0;
    let isStreamingReply = false;
    let mascotWrapper = null;
    let toggleBtn = null;
    let isVisible = true;

    // Đọc cài đặt ẩn/hiện từ localStorage (bọc try/catch an toàn)
    try {
        const savedPref = localStorage.getItem(STORAGE_KEY_VISIBILITY);
        if (savedPref !== null) {
            isVisible = savedPref === 'true';
        }
    } catch (e) {
        console.warn('Không thể đọc cài đặt linh vật từ localStorage:', e);
        isVisible = true;
    }

    /**
     * Chuẩn hóa trạng thái: Giá trị ngoài danh sách cho phép thì quay về idle
     */
    function sanitizeState(state) {
        return ALLOWED_STATES.includes(state) ? state : 'idle';
    }

    /**
     * Tạo chuỗi SVG linh vật mèo công nghệ (Tech AI Cat)
     */
    function createMascotSVG() {
        return `
            <div class="tm-bubble" aria-hidden="true">
                <span class="tm-dot tm-dot-1"></span>
                <span class="tm-dot tm-dot-2"></span>
                <span class="tm-dot tm-dot-3"></span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="84" height="84" class="tm-svg" aria-hidden="true">
                <defs>
                    <linearGradient id="tmFurGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#4e7090"/>
                        <stop offset="100%" stop-color="#31485c"/>
                    </linearGradient>
                    <linearGradient id="tmTieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#00C2FF"/>
                        <stop offset="100%" stop-color="#0068FF"/>
                    </linearGradient>
                </defs>

                <!-- Đuôi mèo (.tm-tail) vẫy nhẹ khi idle/talking/happy -->
                <g class="tm-tail">
                    <path class="tm-tail-body" d="M22 80 C10 72 6 54 14 42 C17 37 23 40 20 46 C14 54 16 66 26 72 Z" fill="url(#tmFurGrad)" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/>
                    <path class="tm-tail-tip" d="M14 42 C17 37 23 40 20 46 C18 44 16 43 14 42 Z" fill="#f8fafc"/>
                </g>

                <!-- Thân & Áo vest công nghệ (.tm-body) -->
                <g class="tm-body">
                    <path d="M26 74 C26 64 74 64 74 74 L74 86 L26 86 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.6"/>
                    <!-- Cổ áo sơ mi trắng -->
                    <polygon points="41,66 50,76 45,66" fill="#ffffff"/>
                    <polygon points="59,66 50,76 55,66" fill="#ffffff"/>
                    <!-- Cà vạt xanh TechEcommerce -->
                    <polygon points="47,75 53,75 54,84 50,87 46,84" fill="url(#tmTieGrad)"/>
                </g>

                <!-- Đầu & Biểu cảm khuôn mặt (.tm-head) -->
                <g class="tm-head">
                    <!-- Tai mèo (.tm-ears) dựng khi listening, cụp khi sorry -->
                    <g class="tm-ears">
                        <g class="tm-ear tm-ear-left">
                            <polygon points="26,38 18,12 40,23" fill="url(#tmFurGrad)" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/>
                            <polygon points="27,33 22,17 36,24" fill="#fca5a5"/>
                        </g>
                        <g class="tm-ear tm-ear-right">
                            <polygon points="74,38 82,12 60,23" fill="url(#tmFurGrad)" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/>
                            <polygon points="73,33 78,17 64,24" fill="#fca5a5"/>
                        </g>
                    </g>

                    <!-- Khung đầu mèo và lông má -->
                    <path d="M25 40 C24 24 76 24 75 40 C83 46 84 57 76 63 C68 69 32 69 24 63 C16 57 17 46 25 40 Z" fill="url(#tmFurGrad)" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="M19 50 L13 52 L18 55 L12 58 L20 59" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-linecap="round"/>
                    <path d="M81 50 L87 52 L82 55 L88 58 L80 59" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-linecap="round"/>

                    <!-- Mõm mèo trắng kem -->
                    <ellipse cx="50" cy="53" rx="14" ry="9" fill="#f8fafc"/>

                    <!-- Mũi mèo đen xám -->
                    <polygon points="47,48 53,48 50,52" fill="#1e293b"/>

                    <!-- Miệng mèo (.tm-mouth) đổi trạng thái theo biểu cảm -->
                    <g class="tm-mouth">
                        <!-- Miệng bình thường chữ ω -->
                        <path class="tm-mouth-default" d="M44 53 Q47 56.5 50 53.5 Q53 56.5 56 53" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
                        <!-- Miệng nói mở đóng khi answering -->
                        <ellipse class="tm-mouth-open" cx="50" cy="55.5" rx="3.5" ry="3.5" fill="#f43f5e" stroke="#1e293b" stroke-width="1.2"/>
                        <!-- Miệng cười rộng khi happy -->
                        <path class="tm-mouth-happy" d="M43 52.5 Q50 61 57 52.5" fill="#f43f5e" stroke="#1e293b" stroke-width="1.4" stroke-linecap="round"/>
                        <!-- Miệng mếu buồn khi sorry -->
                        <path class="tm-mouth-sorry" d="M45 56 Q50 52.5 55 56" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
                    </g>

                    <!-- Ria mép mèo -->
                    <g class="tm-whiskers" stroke="#475569" stroke-width="1.1" stroke-linecap="round">
                        <line x1="33" y1="51" x2="19" y2="49"/>
                        <line x1="32" y1="54" x2="17" y2="55"/>
                        <line x1="67" y1="51" x2="81" y2="49"/>
                        <line x1="68" y1="54" x2="83" y2="55"/>
                    </g>

                    <!-- Mắt mèo (.tm-eyes) chớp mắt, liếc khi thinking, híp khi happy, buồn khi sorry -->
                    <g class="tm-eyes">
                        <!-- Đôi mắt tròn thông minh chuẩn -->
                        <g class="tm-eyes-normal">
                            <g class="tm-eye tm-eye-left">
                                <ellipse class="tm-eye-bg" cx="37.5" cy="40.5" rx="5.5" ry="6.5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2"/>
                                <ellipse class="tm-pupil" cx="38" cy="40.5" rx="3.2" ry="4.5" fill="#0068FF"/>
                                <circle class="tm-pupil-dot" cx="38.5" cy="40.5" r="2" fill="#0f172a"/>
                                <circle class="tm-glint" cx="36.8" cy="38.5" r="1.3" fill="#ffffff"/>
                            </g>
                            <g class="tm-eye tm-eye-right">
                                <ellipse class="tm-eye-bg" cx="62.5" cy="40.5" rx="5.5" ry="6.5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2"/>
                                <ellipse class="tm-pupil" cx="62" cy="40.5" rx="3.2" ry="4.5" fill="#0068FF"/>
                                <circle class="tm-pupil-dot" cx="61.5" cy="40.5" r="2" fill="#0f172a"/>
                                <circle class="tm-glint" cx="60.8" cy="38.5" r="1.3" fill="#ffffff"/>
                            </g>
                        </g>

                        <!-- Mắt híp cười dạng trăng non khi happy -->
                        <g class="tm-eyes-happy">
                            <path d="M33 42 Q37.5 35 42 42" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
                            <path d="M58 42 Q62.5 35 67 42" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
                        </g>

                        <!-- Mắt buồn và giọt mồ hôi khi sorry -->
                        <g class="tm-eyes-sorry">
                            <path d="M33 39 Q37.5 45 42 40" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M58 40 Q62.5 45 67 39" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round"/>
                            <path class="tm-sweat" d="M72 32 C70 34 70 37 72 39 C74 41 76 39 76 37 Z" fill="#38bdf8" opacity="0.9"/>
                        </g>
                    </g>
                </g>

                <!-- Hai chân trước / cánh tay mèo (.tm-arm) ôm nhẹ viền trên của chatbox -->
                <g class="tm-arm">
                    <g class="tm-paw tm-paw-left">
                        <ellipse cx="34" cy="82" rx="6.5" ry="4.5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.3"/>
                        <line x1="32" y1="80" x2="32" y2="84" stroke="#94a3b8" stroke-width="1"/>
                        <line x1="36" y1="80" x2="36" y2="84" stroke="#94a3b8" stroke-width="1"/>
                    </g>
                    <g class="tm-paw tm-paw-right">
                        <ellipse cx="66" cy="82" rx="6.5" ry="4.5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.3"/>
                        <line x1="64" y1="80" x2="64" y2="84" stroke="#94a3b8" stroke-width="1"/>
                        <line x1="68" y1="80" x2="68" y2="84" stroke="#94a3b8" stroke-width="1"/>
                    </g>
                </g>
            </svg>
        `;
    }

    /**
     * Cập nhật trạng thái linh vật
     * @param {string} newState - Một trong: idle, listening, thinking, answering, happy, sorry
     * @param {object} options - Tùy chọn cấu hình
     */
    function setState(newState, options = {}) {
        const validState = sanitizeState(newState);
        if (currentState === validState && !options.force) return;

        // Xóa timer reset đang chờ nếu có
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }

        currentState = validState;
        if (mascotWrapper) {
            mascotWrapper.setAttribute('data-state', validState);
        }

        // Tự động trở về idle sau 4 giây nếu gặp lỗi (trạng thái sorry)
        if (validState === 'sorry') {
            resetTimer = setTimeout(() => {
                if (currentState === 'sorry') {
                    setState('idle');
                }
            }, 4000);
        }
    }

    /**
     * Bật / tắt hiển thị linh vật và lưu lựa chọn vào localStorage
     */
    function setVisibility(visible) {
        isVisible = Boolean(visible);
        try {
            localStorage.setItem(STORAGE_KEY_VISIBILITY, isVisible ? 'true' : 'false');
        } catch (e) {
            console.warn('Không thể lưu cài đặt linh vật vào localStorage:', e);
        }

        if (mascotWrapper) {
            if (isVisible) {
                mascotWrapper.classList.remove('tm-hidden');
            } else {
                mascotWrapper.classList.add('tm-hidden');
            }
        }

        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
            toggleBtn.setAttribute('aria-label', isVisible ? 'Ẩn linh vật trợ lý' : 'Hiện linh vật trợ lý');
            toggleBtn.setAttribute('title', isVisible ? 'Ẩn linh vật trợ lý' : 'Hiện linh vật trợ lý');
            if (isVisible) {
                toggleBtn.classList.remove('tm-off');
            } else {
                toggleBtn.classList.add('tm-off');
            }
        }
    }

    function toggleVisibility() {
        setVisibility(!isVisible);
    }

    /**
     * Gắn mascot vào giao diện chatbox khi phần tử sẵn sàng
     */
    function mount() {
        const chat = document.querySelector('.ai-chat');
        if (!chat) return false;

        // 1. Chèn khung linh vật nếu chưa có
        if (!document.getElementById('tmMascotWrapper')) {
            mascotWrapper = document.createElement('div');
            mascotWrapper.id = 'tmMascotWrapper';
            mascotWrapper.className = `tm-mascot-wrapper${isVisible ? '' : ' tm-hidden'}`;
            mascotWrapper.setAttribute('data-state', currentState);
            mascotWrapper.setAttribute('aria-hidden', 'true');
            mascotWrapper.innerHTML = createMascotSVG();

            // Tương tác chạm/click nhẹ linh vật để chú mèo vui vẻ (happy) trong 2 giây
            mascotWrapper.addEventListener('click', () => {
                if (currentState === 'idle') {
                    setState('happy');
                    setTimeout(() => {
                        if (currentState === 'happy') setState('idle');
                    }, 2000);
                }
            });

            chat.appendChild(mascotWrapper);
        } else {
            mascotWrapper = document.getElementById('tmMascotWrapper');
        }

        // 2. Chèn nút Ẩn/Hiện linh vật vào thanh header actions của chatbox
        const headerActions = chat.querySelector('.ai-chat-header-actions');
        if (headerActions && !document.getElementById('tmMascotToggleBtn')) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'tmMascotToggleBtn';
            toggleBtn.type = 'button';
            toggleBtn.className = `tm-mascot-toggle-btn${isVisible ? '' : ' tm-off'}`;
            toggleBtn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
            toggleBtn.setAttribute('aria-label', isVisible ? 'Ẩn linh vật trợ lý' : 'Hiện linh vật trợ lý');
            toggleBtn.setAttribute('title', isVisible ? 'Ẩn linh vật trợ lý' : 'Hiện linh vật trợ lý');
            toggleBtn.innerHTML = '<span class="tm-toggle-icon" aria-hidden="true">🐱</span>';

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleVisibility();
            });

            // Chèn vào vị trí trước nút đóng chat
            const closeBtn = headerActions.querySelector('.ai-chat-close');
            if (closeBtn) {
                headerActions.insertBefore(toggleBtn, closeBtn);
            } else {
                headerActions.appendChild(toggleBtn);
            }
        }

        // 3. Đảm bảo vùng tin nhắn có role="log" và aria-live="polite"
        const chatBody = chat.querySelector('#aiChatBody');
        if (chatBody) {
            if (!chatBody.getAttribute('role')) {
                chatBody.setAttribute('role', 'log');
            }
            if (!chatBody.getAttribute('aria-live')) {
                chatBody.setAttribute('aria-live', 'polite');
            }
        }

        // 4. Lắng nghe ô nhập tin nhắn (#aiChatInput)
        const input = chat.querySelector('#aiChatInput');
        if (input && !input.__tmListeningAttached) {
            input.__tmListeningAttached = true;
            input.addEventListener('input', () => {
                if (currentState === 'thinking' || isStreamingReply) return;
                setState('listening');

                if (typingTimer) clearTimeout(typingTimer);
                // Về idle nếu 1,5 giây không gõ và chưa gửi
                typingTimer = setTimeout(() => {
                    if (currentState === 'listening') {
                        setState('idle');
                    }
                }, 1500);
            });
        }

        // 5. Lắng nghe form gửi tin (#aiChatForm)
        const form = chat.querySelector('#aiChatForm');
        if (form && !form.__tmSubmitAttached) {
            form.__tmSubmitAttached = true;
            form.addEventListener('submit', () => {
                if (typingTimer) {
                    clearTimeout(typingTimer);
                    typingTimer = null;
                }
                setState('thinking');
            });
        }

        return true;
    }

    /**
     * Móc sự kiện nhận phản hồi từ bot
     */
    function onReplyStart() {
        isStreamingReply = true;
        answeringStartTime = Date.now();
        setState('answering');
    }

    function onReplyComplete(replyLength = 0) {
        isStreamingReply = false;
        const elapsed = Date.now() - answeringStartTime;
        // Nếu không có hiệu ứng gõ chữ hoặc stream kết thúc quá nhanh (< 1.5s),
        // giữ khoảng 1,5–3 giây theo độ dài câu trả lời, xong thì về idle
        const targetDuration = Math.min(3000, Math.max(1500, (replyLength || 60) * 15));
        const remainingTime = Math.max(0, targetDuration - elapsed);

        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            if (currentState === 'answering') {
                setState('idle');
            }
        }, remainingTime);
    }

    function onReplyError() {
        isStreamingReply = false;
        if (typingTimer) {
            clearTimeout(typingTimer);
            typingTimer = null;
        }
        setState('sorry');
    }

    // Tự động gắn kết khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!mount()) {
                // Nếu widget chatbox được chèn trễ bằng script, dùng MutationObserver để đón
                const observer = new MutationObserver(() => {
                    if (mount()) observer.disconnect();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        });
    } else {
        if (!mount()) {
            const observer = new MutationObserver(() => {
                if (mount()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Expose đối tượng toàn cục TechMascot theo yêu cầu
    window.TechMascot = {
        setState,
        getState: () => currentState,
        toggleVisibility,
        setVisibility,
        isVisible: () => isVisible,
        onReplyStart,
        onReplyComplete,
        onReplyError
    };
})();
