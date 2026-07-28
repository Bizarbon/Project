(() => {
    const page = document.body.dataset.authPage || '';

    function setStatus(message, state = '') {
        const status = document.getElementById('authFormStatus');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = state;
    }

    function setButtonLoading(button, loading, idleLabel, loadingLabel) {
        if (!button) return;
        button.disabled = loading;
        button.dataset.state = loading ? 'loading' : 'default';
        button.textContent = loading ? loadingLabel : idleLabel;
    }

    function showSuccess(title, message, linkLabel = 'Đăng nhập ngay', linkHref = 'login.html') {
        const formContent = document.getElementById('authFormContent');
        const successPanel = document.getElementById('authSuccessPanel');
        if (!formContent || !successPanel) return;
        formContent.hidden = true;
        successPanel.hidden = false;
        const titleElement = successPanel.querySelector('h2');
        const messageElement = successPanel.querySelector('p');
        const link = successPanel.querySelector('a');
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        if (link) {
            link.textContent = linkLabel;
            link.href = linkHref;
        }
        successPanel.focus();
    }

    function setFieldError(input, message = '') {
        if (!input) return;
        const help = document.getElementById(input.getAttribute('aria-describedby'));
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        input.dataset.state = message ? 'error' : (input.value ? 'success' : 'default');
        if (help) {
            help.textContent = message || help.dataset.defaultText || '';
            help.dataset.state = message ? 'error' : '';
        }
    }

    function validatePassword(input) {
        const value = input.value;
        if (!value) return 'Hãy nhập mật khẩu.';
        if (value.length < 8 || value.length > 72) return 'Mật khẩu cần từ 8 đến 72 ký tự.';
        if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
            return 'Mật khẩu cần có chữ hoa, chữ thường và chữ số.';
        }
        return '';
    }

    function initializeTouchedValidation() {
        document.querySelectorAll('.auth-field input').forEach(input => {
            const help = document.getElementById(input.getAttribute('aria-describedby'));
            if (help) help.dataset.defaultText = help.textContent;
            input.addEventListener('blur', () => {
                let message = '';
                if (!input.checkValidity()) {
                    message = input.validity.typeMismatch
                        ? 'Địa chỉ email chưa đúng định dạng.'
                        : 'Thông tin này chưa hợp lệ. Hãy kiểm tra lại.';
                }
                if (input.type === 'password' && input.id !== 'loginPassword') {
                    message = validatePassword(input);
                }
                setFieldError(input, message);
            });
            input.addEventListener('input', () => {
                if (input.getAttribute('aria-invalid') !== 'true') return;
                const message = input.type === 'password' && input.id !== 'loginPassword'
                    ? validatePassword(input)
                    : (input.checkValidity() ? '' : 'Thông tin này chưa hợp lệ. Hãy kiểm tra lại.');
                setFieldError(input, message);
            });
        });
    }

    function initializePasswordToggles() {
        document.querySelectorAll('[data-password-toggle]').forEach(button => {
            const input = document.getElementById(button.dataset.passwordToggle);
            if (!input) return;
            button.addEventListener('click', () => {
                const shouldShow = input.type === 'password';
                input.type = shouldShow ? 'text' : 'password';
                button.textContent = shouldShow ? 'Ẩn' : 'Hiện';
                button.setAttribute('aria-label', shouldShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
                input.focus({ preventScroll: true });
            });
        });
    }

    function initializeStorefrontContext() {
        const locationLabel = document.querySelector('[data-auth-location]');
        if (locationLabel) {
            locationLabel.textContent = localStorage.getItem('shoppingLocation') || 'Hồ Chí Minh';
        }

        const cartBadge = document.querySelector('[data-auth-cart-badge]');
        if (!cartBadge || !window.auth) return;
        try {
            const cart = JSON.parse(localStorage.getItem(auth.getCartStorageKey()) || '[]');
            const count = Array.isArray(cart)
                ? cart.reduce((sum, item) => sum + Math.max(Number(item.quantity) || 0, 0), 0)
                : 0;
            cartBadge.textContent = String(count);
            cartBadge.hidden = count === 0;
        } catch (error) {
            cartBadge.hidden = true;
        }
    }

    async function request(path, payload) {
        const response = await fetch(`${window.API_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Máy chủ chưa thể xử lý yêu cầu.');
        return data;
    }

    function initializeLogin() {
        const form = document.getElementById('loginForm');
        if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const button = document.getElementById('submitBtn');
            setStatus('');
            setButtonLoading(button, true, 'Đăng nhập', 'Đang xác thực…');
            try {
                const data = await request('/auth/login', {
                    identifier: document.getElementById('identifier').value.trim(),
                    password: document.getElementById('loginPassword').value
                });
                setStatus('Đăng nhập thành công. Đang mở tài khoản của bạn…', 'success');
                auth.saveAuth(data.token, data.user);
                window.setTimeout(() => {
                    window.location.href = data.user.isAdmin
                        ? '../../admin/products.html'
                        : '../../index.html';
                }, 600);
            } catch (error) {
                setStatus(error.message, 'error');
                setButtonLoading(button, false, 'Đăng nhập', 'Đang xác thực…');
            }
        });
    }

    function initializeRegister() {
        const form = document.getElementById('registerForm');
        if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const password = document.getElementById('registerPassword');
            const confirmation = document.getElementById('confirmPassword');
            const passwordError = validatePassword(password);
            if (passwordError) {
                setFieldError(password, passwordError);
                password.focus();
                return;
            }
            if (password.value !== confirmation.value) {
                setFieldError(confirmation, 'Mật khẩu nhập lại chưa trùng khớp.');
                confirmation.focus();
                return;
            }

            const button = document.getElementById('submitBtn');
            setStatus('');
            setButtonLoading(button, true, 'Tạo tài khoản', 'Đang tạo tài khoản…');
            try {
                await request('/auth/register', {
                    name: document.getElementById('name').value.trim(),
                    phone: document.getElementById('phone').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    username: document.getElementById('username').value.trim(),
                    password: password.value
                });
                showSuccess(
                    'Tài khoản đã sẵn sàng',
                    'Bạn có thể đăng nhập để lưu sản phẩm, theo dõi đơn hàng và quản lý địa chỉ giao hàng.'
                );
            } catch (error) {
                setStatus(error.message, 'error');
                setButtonLoading(button, false, 'Tạo tài khoản', 'Đang tạo tài khoản…');
            }
        });
    }

    function initializeForgotPassword() {
        const phoneForm = document.getElementById('forgotPasswordForm');
        const verifyForm = document.getElementById('verifyOtpForm');
        const resetForm = document.getElementById('otpResetPasswordForm');
        if (!phoneForm || !verifyForm || !resetForm) return;

        const phoneInput = document.getElementById('recoveryPhone');
        const codeInput = document.getElementById('verificationCode');
        const otpDestination = document.getElementById('otpDestination');
        const resendButton = document.getElementById('resendOtpBtn');
        const title = document.getElementById('forgotTitle');
        const intro = document.getElementById('forgotIntro');
        let recoveryPhone = '';
        let resetToken = '';
        let resendTimer = null;

        function showStep(step) {
            const content = {
                phone: {
                    title: 'Quên mật khẩu',
                    intro: 'Nhập số điện thoại đã dùng để tạo tài khoản TechEcommerce.'
                },
                verify: {
                    title: 'Nhập mã xác nhận',
                    intro: 'Nhập mã OTP trong tin nhắn để xác nhận bạn sở hữu số điện thoại này.'
                },
                password: {
                    title: 'Tạo mật khẩu mới',
                    intro: 'Dùng ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.'
                }
            };

            phoneForm.hidden = step !== 'phone';
            verifyForm.hidden = step !== 'verify';
            resetForm.hidden = step !== 'password';
            document.querySelectorAll('[data-recovery-step]').forEach(item => {
                if (item.dataset.recoveryStep === step) {
                    item.setAttribute('aria-current', 'step');
                } else {
                    item.removeAttribute('aria-current');
                }
            });
            if (title) title.textContent = content[step].title;
            if (intro) intro.textContent = content[step].intro;
            setStatus('');

            const nextInput = step === 'phone'
                ? phoneInput
                : (step === 'verify' ? codeInput : document.getElementById('newPassword'));
            window.setTimeout(() => nextInput?.focus({ preventScroll: true }), 0);
        }

        function startResendTimer(seconds = 30) {
            window.clearInterval(resendTimer);
            let remaining = Math.max(Number(seconds) || 30, 1);
            resendButton.disabled = true;
            resendButton.textContent = `Gửi lại sau ${remaining}s`;

            resendTimer = window.setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    window.clearInterval(resendTimer);
                    resendButton.disabled = false;
                    resendButton.textContent = 'Gửi lại mã';
                    return;
                }
                resendButton.textContent = `Gửi lại sau ${remaining}s`;
            }, 1000);
        }

        async function sendOtp(button, isResend = false) {
            let sent = false;
            setStatus('');
            setButtonLoading(
                button,
                true,
                isResend ? 'Gửi lại mã' : 'Gửi mã xác nhận',
                'Đang gửi SMS…'
            );

            try {
                const data = await request('/auth/forgot-password', {
                    phone: recoveryPhone
                });
                otpDestination.textContent = `Mã xác nhận đã được gửi tới ${recoveryPhone}.`;
                showStep('verify');
                setStatus(data.message, 'success');
                startResendTimer(data.retryAfterSeconds);
                sent = true;
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                if (button === resendButton && sent) {
                    button.dataset.state = 'default';
                } else {
                    setButtonLoading(
                        button,
                        false,
                        isResend ? 'Gửi lại mã' : 'Gửi mã xác nhận',
                        'Đang gửi SMS…'
                    );
                }
            }
        }

        phoneForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!phoneForm.checkValidity()) {
                phoneForm.reportValidity();
                return;
            }

            recoveryPhone = phoneInput.value.trim();
            await sendOtp(document.getElementById('requestOtpBtn'));
        });

        verifyForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!verifyForm.checkValidity()) {
                verifyForm.reportValidity();
                return;
            }

            const button = document.getElementById('verifyOtpBtn');
            setStatus('');
            setButtonLoading(button, true, 'Xác nhận mã', 'Đang xác nhận…');
            try {
                const data = await request('/auth/verify-reset-otp', {
                    phone: recoveryPhone,
                    code: codeInput.value.trim()
                });
                resetToken = data.resetToken || '';
                if (!/^[a-f0-9]{64}$/i.test(resetToken)) {
                    throw new Error('Phiên đặt lại mật khẩu không hợp lệ. Hãy yêu cầu mã mới.');
                }
                codeInput.value = '';
                window.clearInterval(resendTimer);
                showStep('password');
                setStatus(data.message, 'success');
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                setButtonLoading(button, false, 'Xác nhận mã', 'Đang xác nhận…');
            }
        });

        resetForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!resetForm.checkValidity()) {
                resetForm.reportValidity();
                return;
            }

            const password = document.getElementById('newPassword');
            const confirmation = document.getElementById('confirmNewPassword');
            const passwordError = validatePassword(password);
            if (passwordError) {
                setFieldError(password, passwordError);
                password.focus();
                return;
            }
            if (password.value !== confirmation.value) {
                setFieldError(confirmation, 'Mật khẩu nhập lại chưa trùng khớp.');
                confirmation.focus();
                return;
            }

            const button = document.getElementById('savePasswordBtn');
            setStatus('');
            setButtonLoading(button, true, 'Lưu mật khẩu mới', 'Đang cập nhật…');
            try {
                const data = await request('/auth/reset-password', {
                    token: resetToken,
                    password: password.value
                });
                resetToken = '';
                showSuccess(
                    'Mật khẩu đã được thay đổi',
                    data.message,
                    'Đăng nhập ngay',
                    'login.html'
                );
            } catch (error) {
                setStatus(error.message, 'error');
                setButtonLoading(button, false, 'Lưu mật khẩu mới', 'Đang cập nhật…');
            }
        });

        document.getElementById('editPhoneBtn')?.addEventListener('click', () => {
            window.clearInterval(resendTimer);
            codeInput.value = '';
            resetToken = '';
            showStep('phone');
        });

        resendButton?.addEventListener('click', async () => {
            if (!recoveryPhone || resendButton.disabled) return;
            await sendOtp(resendButton, true);
        });
    }

    function initializeResetPassword() {
        const form = document.getElementById('resetPasswordForm');
        if (!form) return;
        const token = new URLSearchParams(window.location.search).get('token') || '';
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            form.querySelectorAll('input, button').forEach(element => {
                element.disabled = true;
            });
            setStatus('Phiên đặt lại mật khẩu không hợp lệ. Hãy yêu cầu mã xác nhận mới.', 'error');
            return;
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            const password = document.getElementById('resetPassword');
            const confirmation = document.getElementById('confirmPassword');
            const passwordError = validatePassword(password);
            if (passwordError) {
                setFieldError(password, passwordError);
                password.focus();
                return;
            }
            if (password.value !== confirmation.value) {
                setFieldError(confirmation, 'Mật khẩu nhập lại chưa trùng khớp.');
                confirmation.focus();
                return;
            }

            const button = document.getElementById('submitBtn');
            setStatus('');
            setButtonLoading(button, true, 'Lưu mật khẩu mới', 'Đang cập nhật…');
            try {
                const data = await request('/auth/reset-password', {
                    token,
                    password: password.value
                });
                showSuccess('Mật khẩu đã được thay đổi', data.message);
            } catch (error) {
                setStatus(error.message, 'error');
                setButtonLoading(button, false, 'Lưu mật khẩu mới', 'Đang cập nhật…');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initializeStorefrontContext();
        initializePasswordToggles();
        initializeTouchedValidation();

        if (page === 'login') initializeLogin();
        if (page === 'register') initializeRegister();
        if (page === 'forgot') initializeForgotPassword();
        if (page === 'reset') initializeResetPassword();
    });
})();
