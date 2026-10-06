const path = require('path');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');

let googleClientInstance = null;

function getClientId() {
    if (!process.env.GOOGLE_CLIENT_ID) {
        dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    }
    return String(process.env.GOOGLE_CLIENT_ID || '').trim();
}

function getGoogleClient() {
    const clientId = getClientId();
    if (!googleClientInstance) {
        googleClientInstance = new OAuth2Client(clientId || undefined);
    }
    return googleClientInstance;
}

/**
 * Verify Google ID Token using official google-auth-library.
 * Strictly verifies signature, expiration, audience, and email verification.
 * 
 * @param {string} idToken Google ID Token (credential)
 * @returns {Promise<{ sub: string, email: string, emailVerified: boolean, name: string, picture: string }>}
 */
async function verifyGoogleIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        const err = new Error('Thiếu mã xác thực Google (credential).');
        err.statusCode = 400;
        throw err;
    }

    const clientId = getClientId();
    if (!clientId) {
        const err = new Error('Hệ thống chưa cấu hình GOOGLE_CLIENT_ID.');
        err.statusCode = 503;
        console.error('[GoogleAuth] GOOGLE_CLIENT_ID chưa được thiết lập trong file .env');
        throw err;
    }

    const client = getGoogleClient();

    let ticket;
    try {
        ticket = await client.verifyIdToken({
            idToken: idToken.trim(),
            audience: clientId
        });
    } catch (verifyError) {
        const err = new Error('Mã xác thực Google không hợp lệ hoặc đã hết hạn.');
        err.statusCode = 401;
        err.originalMessage = verifyError.message;
        throw err;
    }

    const payload = ticket.getPayload();
    if (!payload) {
        const err = new Error('Không thể đọc dữ liệu từ token Google.');
        err.statusCode = 401;
        throw err;
    }

    // Verify sub
    if (!payload.sub || typeof payload.sub !== 'string') {
        const err = new Error('Token Google không chứa định danh người dùng (sub).');
        err.statusCode = 401;
        throw err;
    }

    // Verify audience explicitly
    if (payload.aud !== clientId) {
        const err = new Error('Token Google không thuộc về ứng dụng này (audience mismatch).');
        err.statusCode = 401;
        throw err;
    }

    // Verify email presence
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
        const err = new Error('Tài khoản Google không có địa chỉ email.');
        err.statusCode = 400;
        throw err;
    }

    // Verify email_verified === true
    const isEmailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!isEmailVerified) {
        const err = new Error('Email tài khoản Google chưa được xác minh bởi Google.');
        err.statusCode = 401;
        throw err;
    }

    const name = String(payload.name || payload.given_name || email.split('@')[0]).trim();
    const picture = typeof payload.picture === 'string' ? payload.picture : '';

    return {
        sub: payload.sub,
        email,
        emailVerified: true,
        name,
        picture
    };
}

module.exports = {
    getClientId,
    verifyGoogleIdToken
};
