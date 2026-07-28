const axios = require('axios');
const crypto = require('crypto');

const TWILIO_VERIFY_BASE_URL = 'https://verify.twilio.com/v2';
const DEMO_OTP_TTL_MS = 10 * 60 * 1000;
const demoVerifications = new Map();

function envValue(name) {
    return String(process.env[name] || '').trim();
}

function twilioCredentials() {
    const apiKey = envValue('TWILIO_API_KEY');
    const apiSecret = envValue('TWILIO_API_SECRET');

    if (apiKey && apiSecret) {
        return {
            username: apiKey,
            password: apiSecret
        };
    }

    const accountSid = envValue('TWILIO_ACCOUNT_SID');
    const authToken = envValue('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
        return {
            username: accountSid,
            password: authToken
        };
    }

    return null;
}

function smsEnabled() {
    return String(process.env.SMS_ENABLED || '').toLowerCase() === 'true'
        && Boolean(envValue('TWILIO_VERIFY_SERVICE_SID'))
        && Boolean(twilioCredentials());
}

function demoSmsEnabled() {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return false;

    const configured = envValue('SMS_DEMO_MODE').toLowerCase();
    if (configured) return configured === 'true';

    return !smsEnabled();
}

function passwordResetOtpEnabled() {
    return smsEnabled() || demoSmsEnabled();
}

function verifyEndpoint(resource) {
    const serviceSid = encodeURIComponent(envValue('TWILIO_VERIFY_SERVICE_SID'));
    return `${TWILIO_VERIFY_BASE_URL}/Services/${serviceSid}/${resource}`;
}

async function postVerify(resource, payload) {
    if (!smsEnabled()) {
        const error = new Error('Dịch vụ SMS OTP chưa được cấu hình.');
        error.code = 'SMS_NOT_CONFIGURED';
        throw error;
    }

    const body = new URLSearchParams(payload);
    const response = await axios.post(
        verifyEndpoint(resource),
        body.toString(),
        {
            auth: twilioCredentials(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000,
            maxRedirects: 0
        }
    );

    return response.data;
}

async function sendPasswordResetOtp(phone) {
    if (demoSmsEnabled() && !smsEnabled()) {
        const code = String(crypto.randomInt(100000, 1000000));
        demoVerifications.set(phone, {
            code,
            expiresAt: Date.now() + DEMO_OTP_TTL_MS
        });
        return {
            status: 'pending',
            provider: 'demo',
            developmentOtp: code
        };
    }

    const payload = {
        To: phone,
        Channel: 'sms'
    };
    const locale = envValue('TWILIO_VERIFY_LOCALE');
    if (locale) payload.Locale = locale;

    const verification = await postVerify('Verifications', payload);
    return {
        sid: verification.sid,
        status: verification.status
    };
}

async function verifyPasswordResetOtp(phone, code) {
    if (demoSmsEnabled() && !smsEnabled()) {
        const verification = demoVerifications.get(phone);
        const approved = Boolean(
            verification
            && verification.expiresAt > Date.now()
            && verification.code === String(code).trim()
        );

        if (approved || !verification || verification.expiresAt <= Date.now()) {
            demoVerifications.delete(phone);
        }
        return approved;
    }

    const verification = await postVerify('VerificationCheck', {
        To: phone,
        Code: code
    });

    return verification.status === 'approved';
}

function safeSmsError(error) {
    const providerCode = Number(error?.response?.data?.code || 0);

    if (providerCode === 20404) {
        return 'Mã xác nhận không đúng hoặc đã hết hạn.';
    }
    if (providerCode === 60202) {
        return 'Bạn đã nhập sai mã quá nhiều lần. Hãy yêu cầu mã mới.';
    }
    if (providerCode === 60203) {
        return 'Số điện thoại đã nhận quá nhiều mã. Vui lòng thử lại sau.';
    }
    if (providerCode === 60205) {
        return 'Số điện thoại này không thể nhận tin nhắn SMS.';
    }
    if (error?.code === 'SMS_NOT_CONFIGURED') {
        return 'Dịch vụ gửi mã xác nhận qua SMS chưa được cấu hình.';
    }

    return 'Chưa thể kết nối dịch vụ SMS. Vui lòng thử lại sau.';
}

module.exports = {
    smsEnabled,
    demoSmsEnabled,
    passwordResetOtpEnabled,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    safeSmsError
};
