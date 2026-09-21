/**
 * OTP delivery helpers.
 * - Email: uses SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are set; otherwise logs to console (dev).
 * - Phone: logs to console until an SMS provider (e.g. Twilio) is configured.
 */

async function sendEmailOtp({ to, otp, purpose = 'verification' }) {
  const subject =
    purpose === 'reset'
      ? 'Scoutify password reset code'
      : 'Scoutify email verification code';
  const text = `Your Scoutify ${purpose} code is ${otp}. It expires in 10 minutes.`;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      // Lazy-require so local installs without nodemailer still boot if unused.
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: String(SMTP_PORT) === '465',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject,
        text
      });
      return { channel: 'email', delivered: true, mode: 'smtp' };
    } catch (err) {
      console.error('SMTP send failed, falling back to console OTP:', err.message);
    }
  }

  console.log(`\n==========================================`);
  console.log(`[DEV OTP] Email ${purpose} for ${to}: ${otp}`);
  console.log(`==========================================\n`);
  return { channel: 'email', delivered: true, mode: 'console' };
}

async function sendPhoneOtp({ phone, otp, purpose = 'verification' }) {
  // Twilio hook: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM when ready.
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const body = new URLSearchParams({
        To: phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`,
        From: TWILIO_FROM,
        Body: `Your Scoutify ${purpose} code is ${otp}. Expires in 10 minutes.`
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      return { channel: 'phone', delivered: true, mode: 'twilio' };
    } catch (err) {
      console.error('Twilio send failed, falling back to console OTP:', err.message);
    }
  }

  console.log(`\n==========================================`);
  console.log(`[DEV OTP] Phone ${purpose} for ${phone}: ${otp}`);
  console.log(`==========================================\n`);
  return { channel: 'phone', delivered: true, mode: 'console' };
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

/** Confirmation notice after password change or reset (SRS 3.3). */
async function sendPasswordChangedNotice({ to, reason = 'changed' }) {
  const subject = 'Scoutify password updated';
  const text =
    reason === 'reset'
      ? 'Your Scoutify password was reset successfully. If you did not do this, contact support immediately.'
      : 'Your Scoutify password was changed successfully. If you did not do this, reset your password and contact support.';

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: String(SMTP_PORT) === '465',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject,
        text
      });
      return { channel: 'email', delivered: true, mode: 'smtp' };
    } catch (err) {
      console.error('SMTP password notice failed, falling back to console:', err.message);
    }
  }

  console.log(`\n==========================================`);
  console.log(`[DEV NOTICE] Password ${reason} confirmation for ${to}`);
  console.log(`==========================================\n`);
  return { channel: 'email', delivered: true, mode: 'console' };
}

module.exports = {
  sendEmailOtp,
  sendPhoneOtp,
  sendPasswordChangedNotice,
  normalizePhone
};
