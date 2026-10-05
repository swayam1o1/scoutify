const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { isSessionValid, JWT_SECRET } = require('../middleware/auth');
const { verifyTotp } = require('./reauthService');

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Scoutify';

// Resolves the Bearer token owner for the /2fa/* endpoints, which do their own
// token check instead of using requireAuth.
async function getAuthedUser(authHeader) {
  if (!authHeader) {
    throw new HttpError(401, 'No token provided.');
  }
  let decoded;
  let user;
  try {
    const token = authHeader.split(' ')[1];
    decoded = jwt.verify(token, JWT_SECRET);
    user = await User.findById(decoded.id);
  } catch (err) {
    throw new HttpError(401, 'Invalid token.');
  }
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  if (!isSessionValid(decoded, user)) {
    throw new HttpError(401, 'Session expired. Please sign in again.', { code: 'SESSION_REVOKED' });
  }
  return user;
}

// 6. GOOGLE AUTHENTICATOR SETUP (QR) — does not enable until /2fa/enable
async function setup(user) {
  if (user.twoFactorEnabled) {
    throw new HttpError(400, 'Authenticator is already enabled. Disable it first to set up again.');
  }

  const generated = speakeasy.generateSecret({
    length: 20,
    name: `${TOTP_ISSUER} (${user.email})`,
    issuer: TOTP_ISSUER
  });

  user.twoFactorSecret = generated.base32;
  user.twoFactorEnabled = false;
  await user.save();

  const qrDataUrl = await QRCode.toDataURL(generated.otpauth_url);
  return {
    qrDataUrl,
    manualKey: generated.base32,
    otpauthUrl: generated.otpauth_url
  };
}

async function enable(user, code) {
  if (!user.twoFactorSecret) {
    throw new HttpError(400, 'Start authenticator setup first.');
  }
  if (user.twoFactorEnabled) {
    throw new HttpError(400, 'Authenticator is already enabled.');
  }

  if (!verifyTotp(user.twoFactorSecret, code)) {
    throw new HttpError(400, 'Invalid authenticator code. Scan the QR again if needed.');
  }

  user.twoFactorEnabled = true;
  await user.save();
  return {
    message: 'Google Authenticator enabled for login.',
    twoFactorEnabled: true
  };
}

async function disable(user, code) {
  if (user.role === 'admin') {
    throw new HttpError(403, 'Administrators cannot disable two-factor authentication.', {
      code: 'ADMIN_2FA_MANDATORY'
    });
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    return { message: 'Authenticator is already off.', twoFactorEnabled: false };
  }

  if (!verifyTotp(user.twoFactorSecret, code)) {
    throw new HttpError(400, 'Invalid authenticator code.');
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();
  return {
    message: 'Google Authenticator disabled.',
    twoFactorEnabled: false
  };
}

module.exports = { getAuthedUser, setup, enable, disable };
