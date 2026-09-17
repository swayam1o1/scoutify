const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

function verifyTotp(secret, code) {
  const token = String(code || '').replace(/\s/g, '');
  if (!secret || !/^\d{6}$/.test(token)) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1
  });
}

/**
 * Re-authentication for sensitive actions.
 * - Password accounts: currentPassword required
 * - If 2FA on: totpCode also required
 * - Google-only (no password, no 2FA): emailOtp from /auth/reauth-challenge
 *
 * Returns null on success, or { status, message, code } on failure.
 */
async function assertReauth(user, { currentPassword, totpCode, emailOtp } = {}) {
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!verifyTotp(user.twoFactorSecret, totpCode)) {
      return {
        status: 401,
        message: 'Enter your current Google Authenticator code to continue.',
        code: 'REAUTH_TOTP_REQUIRED'
      };
    }
  }

  if (user.passwordHash) {
    if (!currentPassword) {
      return {
        status: 401,
        message: 'Enter your current password to continue.',
        code: 'REAUTH_PASSWORD_REQUIRED'
      };
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return {
        status: 401,
        message: 'Current password is incorrect.',
        code: 'REAUTH_PASSWORD_INVALID'
      };
    }
  } else if (!(user.twoFactorEnabled && user.twoFactorSecret)) {
    const otp = String(emailOtp || '').trim();
    if (
      !user.reauthOtp ||
      user.reauthOtp !== otp ||
      !user.reauthOtpExpires ||
      user.reauthOtpExpires < new Date()
    ) {
      return {
        status: 401,
        message: 'Request and enter the email re-auth code to continue.',
        code: 'REAUTH_EMAIL_OTP_REQUIRED'
      };
    }
  }

  return null;
}

function clearReauthChallenge(user) {
  user.reauthOtp = undefined;
  user.reauthOtpExpires = undefined;
}

function companyNameChanged(previous, next) {
  const a = String(previous || '').trim().toLowerCase();
  const b = String(next || '').trim().toLowerCase();
  return a !== b;
}

module.exports = {
  verifyTotp,
  assertReauth,
  clearReauthChallenge,
  companyNameChanged
};
