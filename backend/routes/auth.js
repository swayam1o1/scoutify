const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { requireAuth, signToken, bumpTokenVersion, isSessionValid } = require('../middleware/auth');
const { sendEmailOtp, sendPhoneOtp, sendPasswordChangedNotice, sendPlainEmail, normalizePhone } = require('../utils/otpDelivery');
const { assertReauth, clearReauthChallenge, companyNameChanged, verifyTotp } = require('../utils/reauth');
const { deleteUserAccount } = require('../utils/accountDeletion');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';
const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Scoutify';
const FIRM_TYPES = new Set(['architectural_firm', 'design_firm', 'company', 'firm']);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber || null,
    phoneVerified: !!user.phoneVerified,
    role: user.role,
    subscriptionPlan: user.subscriptionPlan,
    twoFactorEnabled: user.twoFactorEnabled,
    hasPassword: !!user.passwordHash,
    mustEnable2FA: user.role === 'admin' && !user.twoFactorEnabled,
    isVerified: user.isVerified,
    isSuspended: user.isSuspended,
    clientProfile: user.clientProfile,
    artisanProfile: user.artisanProfile
  };
}

// Returns a 403/400 payload when an account may no longer sign in.
function blockedAccountResponse(user, res) {
  if (user.isDeleted) {
    res.status(403).json({ message: 'This account has been deleted. Contact Scoutify support to restore it.' });
    return true;
  }
  if (user.isSuspended) {
    res.status(403).json({ message: 'This account is suspended. Contact Scoutify support.' });
    return true;
  }
  return false;
}

async function getAuthedUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'No token provided.' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return null;
    }
    if (!isSessionValid(decoded, user)) {
      res.status(401).json({ message: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
      return null;
    }
    return user;
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
    return null;
  }
}

// 1. REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, clientProfile, artisanProfile, phoneNumber } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !['client', 'artisan'].includes(role)) {
      return res.status(400).json({ message: 'Name, email, password, and a valid role are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const phone = normalizePhone(phoneNumber || artisanProfile?.phoneNumber || clientProfile?.phoneNumber);

    if (role === 'client' && FIRM_TYPES.has(clientProfile?.type) && !clientProfile?.companyName?.trim()) {
      return res.status(400).json({ message: 'Company name is required for firm / company registration.' });
    }
    if (role === 'artisan' && !artisanProfile?.companyName?.trim()) {
      return res.status(400).json({ message: 'Company name is required for vendor registration.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    if (phone) {
      if (phone.length < 10) {
        return res.status(400).json({ message: 'Enter a valid 10-digit phone number.' });
      }
      const phoneTaken = await User.findOne({ phoneNumber: phone, isDeleted: { $ne: true } });
      if (phoneTaken) {
        return res.status(400).json({ message: 'Phone number already registered.' });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      phoneNumber: phone || undefined,
      passwordHash,
      role,
      otp,
      otpExpires,
      isVerified: false,
      clientProfile: role === 'client' ? {
        type: clientProfile?.type,
        companyName: clientProfile?.companyName?.trim() || undefined,
        plannedUse: clientProfile?.plannedUse,
        phoneNumber: phone || clientProfile?.phoneNumber
      } : undefined,
      artisanProfile: role === 'artisan' ? {
        ...artisanProfile,
        phoneNumber: phone || artisanProfile?.phoneNumber,
        email: normalizedEmail
      } : undefined
    });

    await user.save();

    const delivery = await sendEmailOtp({ to: normalizedEmail, otp, purpose: 'verification' });

    res.status(201).json({
      message: delivery.mode === 'smtp'
        ? 'Registration successful. Check your email for the OTP.'
        : 'Registration successful. OTP sent (check server console in development).',
      email: normalizedEmail,
      otpRequired: true,
      deliveryMode: delivery.mode,
      phoneNumber: phone || null
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'email';
      return res.status(400).json({
        message: field === 'phoneNumber'
          ? 'Phone number already registered.'
          : 'Email already registered.'
      });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// 2. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (blockedAccountResponse(user, res)) return;

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = signToken(user);

    res.json({
      message: 'Email verified successfully.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during OTP verification.' });
  }
});

// 2b. SEND PHONE OTP (optional verification after signup / from portal)
router.post('/send-phone-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const phone = normalizePhone(req.body.phoneNumber);

    if (!email || !phone || phone.length < 10) {
      return res.status(400).json({ message: 'Valid email and 10-digit phone number are required.' });
    }

    const user = await User.findOne({ email });
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (blockedAccountResponse(user, res)) return;

    const phoneTaken = await User.findOne({
      phoneNumber: phone,
      _id: { $ne: user._id },
      isDeleted: { $ne: true }
    });
    if (phoneTaken) {
      return res.status(400).json({ message: 'Phone number already registered to another account.' });
    }

    const otp = generateOTP();
    user.phoneNumber = phone;
    user.phoneVerified = false;
    user.phoneOtp = otp;
    user.phoneOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    if (user.role === 'client') {
      user.clientProfile = { ...(user.clientProfile?.toObject?.() || user.clientProfile || {}), phoneNumber: phone };
    }
    if (user.role === 'artisan') {
      user.artisanProfile = { ...(user.artisanProfile?.toObject?.() || user.artisanProfile || {}), phoneNumber: phone };
    }
    await user.save();

    const delivery = await sendPhoneOtp({ phone, otp, purpose: 'verification' });

    res.json({
      message: delivery.mode === 'twilio'
        ? 'OTP sent to your phone.'
        : 'OTP sent (check server console in development).',
      phoneNumber: phone,
      deliveryMode: delivery.mode
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error sending phone OTP.' });
  }
});

// 2c. VERIFY PHONE OTP
router.post('/verify-phone-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (blockedAccountResponse(user, res)) return;

    if (!user.phoneOtp || user.phoneOtp !== String(otp) || !user.phoneOtpExpires || user.phoneOtpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired phone OTP.' });
    }

    user.phoneVerified = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    await user.save();

    res.json({
      message: 'Phone number verified successfully.',
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error verifying phone OTP.' });
  }
});

// 3. LOGIN
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (blockedAccountResponse(user, res)) return;

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Account is linked with Google Sign-In. Use Google to log in.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (!user.isVerified) {
      // Re-trigger OTP
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendEmailOtp({ to: email, otp, purpose: 'verification' });

      return res.status(403).json({
        message: 'Account not verified. OTP sent.',
        email,
        otpRequired: true
      });
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return res.json({
        message: 'Enter the 6-digit code from Google Authenticator.',
        email: user.email,
        requires2FA: true
      });
    }

    const token = signToken(user);
    res.json({
      message: 'Login successful.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// 4. VERIFY 2FA (Google Authenticator TOTP)
router.post('/verify-2fa', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Authenticator login is not enabled for this account.' });
    }

    if (blockedAccountResponse(user, res)) return;

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(400).json({ message: 'Invalid authenticator code. Try the current 6-digit number.' });
    }

    const token = signToken(user);
    res.json({
      message: '2FA verified successfully.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during 2FA verification.' });
  }
});

// 5. GOOGLE LOGIN — prefers verified Google ID token (credential); falls back to mocked payload in dev.
router.post('/google-login', async (req, res) => {
  try {
    let { name, email, googleId, role, credential } = req.body;

    if (credential) {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!googleRes.ok) {
        return res.status(401).json({ message: 'Invalid Google credential.' });
      }
      const payload = await googleRes.json();
      if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(401).json({ message: 'Google client ID mismatch.' });
      }
      email = payload.email;
      name = payload.name || payload.email;
      googleId = payload.sub;
    }

    if (!email?.trim() || !googleId) {
      return res.status(400).json({ message: 'Google account details are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      if (!role || !['client', 'artisan'].includes(role)) {
        return res.status(400).json({
          message: 'Account not found. Please choose Consumer or Vendor to register with Google.',
          needsRegistration: true,
          email: normalizedEmail,
          name,
          googleId
        });
      }

      user = new User({
        name: name || normalizedEmail,
        email: normalizedEmail,
        googleId,
        role,
        isVerified: true
      });
      await user.save();
    } else {
      if (blockedAccountResponse(user, res)) return;
      if (!user.googleId) {
        user.googleId = googleId;
        user.isVerified = true;
        await user.save();
      }
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return res.json({
        message: 'Enter the 6-digit code from Google Authenticator.',
        email: user.email,
        requires2FA: true
      });
    }

    const token = signToken(user);

    res.json({
      message: 'Google login successful.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during Google login.' });
  }
});

// 6. GOOGLE AUTHENTICATOR SETUP (QR) — does not enable until /2fa/enable
router.post('/2fa/setup', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Authenticator is already enabled. Disable it first to set up again.' });
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
    res.json({
      qrDataUrl,
      manualKey: generated.base32,
      otpauthUrl: generated.otpauth_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating authenticator setup.' });
  }
});

router.post('/2fa/enable', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Start authenticator setup first.' });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Authenticator is already enabled.' });
    }

    if (!verifyTotp(user.twoFactorSecret, req.body.code)) {
      return res.status(400).json({ message: 'Invalid authenticator code. Scan the QR again if needed.' });
    }

    user.twoFactorEnabled = true;
    await user.save();
    res.json({
      message: 'Google Authenticator enabled for login.',
      twoFactorEnabled: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error enabling authenticator.' });
  }
});

router.post('/2fa/disable', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (user.role === 'admin') {
      return res.status(403).json({
        message: 'Administrators cannot disable two-factor authentication.',
        code: 'ADMIN_2FA_MANDATORY'
      });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save();
      return res.json({ message: 'Authenticator is already off.', twoFactorEnabled: false });
    }

    if (!verifyTotp(user.twoFactorSecret, req.body.code)) {
      return res.status(400).json({ message: 'Invalid authenticator code.' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.json({
      message: 'Google Authenticator disabled.',
      twoFactorEnabled: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error disabling authenticator.' });
  }
});

// 7. DEMO LOGIN FOR YC HUD
router.post('/demo-login', async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== 'client_basic' && role !== 'client_pro' && role !== 'artisan') {
      return res.status(400).json({ message: 'Invalid demo role.' });
    }

    let email, name, plan;
    if (role === 'client_basic') {
      email = 'john.basic@demo.scoutify.com';
      name = 'John (Basic Client)';
      plan = 'basic';
    } else if (role === 'client_pro') {
      email = 'john.pro@demo.scoutify.com';
      name = 'John (Pro Client)';
      plan = 'pro';
    } else {
      email = 'sarah.smith@demo.scoutify.com';
      name = 'Sarah Smith';
      plan = 'basic';
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name,
        email,
        role: role === 'artisan' ? 'artisan' : 'client',
        isVerified: true,
        subscriptionPlan: plan,
        twoFactorEnabled: false
      });
      if (role === 'artisan') {
        user.artisanProfile = {
          companyName: 'Apex Architectural Studio',
          phoneNumber: '9876543210',
          instagram: 'apex_studios',
          city: 'Tirupati',
          personOfContact: 'Sarah Smith',
          specialization: ['Architectural Services', 'Interior Designing'],
          portfolio: ['https://behance.net/apex-designs']
        };
      }
      await user.save();
    } else {
      // Ensure the plan is updated back to the requested role plan
      if (user.subscriptionPlan !== plan) {
        user.subscriptionPlan = plan;
        await user.save();
      }
    }



    const token = signToken(user);

    res.json({
      message: 'Demo login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during demo login.' });
  }
});

// 8. CURRENT USER
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const payload = {
      ...publicUser(user),
      createdAt: user.createdAt
    };

    // Artisans need their public listing state to know if they are searchable yet.
    if (user.role === 'artisan') {
      const listing = await Artisan.findOne({ userId: user._id }).select('contactStatus updatedAt');
      payload.artisanListing = listing
        ? { id: listing._id, contactStatus: listing.contactStatus, updatedAt: listing.updatedAt }
        : null;
    }

    res.json({ user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading account.' });
  }
});

// 9. UPDATE OWN PROFILE (name + role specific profile)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { name, clientProfile, artisanProfile, currentPassword, totpCode, emailOtp } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'Name cannot be empty.' });
      }
      user.name = String(name).trim();
    }

    if (user.role === 'client' && clientProfile) {
      const nextCompany = clientProfile.companyName !== undefined
        ? String(clientProfile.companyName || '').trim()
        : user.clientProfile?.companyName;

      if (companyNameChanged(user.clientProfile?.companyName, nextCompany)) {
        const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
        if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
        clearReauthChallenge(user);
      }

      if (FIRM_TYPES.has(clientProfile.type ?? user.clientProfile?.type) && !nextCompany) {
        return res.status(400).json({ message: 'Company name is required for firm / company profiles.' });
      }

      user.clientProfile = {
        type: clientProfile.type ?? user.clientProfile?.type,
        plannedUse: clientProfile.plannedUse ?? user.clientProfile?.plannedUse,
        companyName: nextCompany || undefined,
        phoneNumber: clientProfile.phoneNumber ?? user.clientProfile?.phoneNumber
      };
    }

    if (user.role === 'artisan' && artisanProfile) {
      const existing = user.artisanProfile?.toObject?.() || user.artisanProfile || {};
      if (
        artisanProfile.companyName !== undefined &&
        companyNameChanged(existing.companyName, artisanProfile.companyName)
      ) {
        const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
        if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
        clearReauthChallenge(user);
      }
      user.artisanProfile = { ...existing, ...artisanProfile };
    }

    await user.save();
    res.json({ message: 'Profile updated.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
});

// 10. CHANGE PASSWORD
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, totpCode, emailOtp } = req.body;
    const user = req.user;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ message: 'This account has no password set. Use “Forgot password” to create one.' });
    }

    const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
    clearReauthChallenge(user);

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // Invalidate other sessions; this request gets a fresh token (SRS 3.3).
    bumpTokenVersion(user);
    await user.save();

    await sendPasswordChangedNotice({ to: user.email, reason: 'changed' });

    res.json({
      message: 'Password changed successfully. A confirmation was sent to your email. Other sessions were signed out.',
      token: signToken(user),
      user: publicUser(user),
      sessionsRevoked: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error changing password.' });
  }
});

// 11. FORGOT PASSWORD (OTP logged to server console in dev)
router.post('/forgot-password', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });

    // Always answer the same way so the endpoint cannot be used to probe emails.
    const genericResponse = {
      message: 'If that email is registered, a 6-digit reset code has been sent.',
      email,
      otpRequired: true
    };

    if (!user || user.isDeleted) {
      return res.json(genericResponse);
    }

    const otp = generateOTP();
    user.passwordResetOtp = otp;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    await sendEmailOtp({ to: email, otp, purpose: 'reset' });

    res.json(genericResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error starting password reset.' });
  }
});

// 12. RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user || user.isDeleted) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    if (!user.passwordResetOtp || user.passwordResetOtp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetOtp = undefined;
    user.passwordResetExpires = undefined;
    // All existing JWTs become invalid after reset (SRS 3.3).
    bumpTokenVersion(user);
    await user.save();

    await sendPasswordChangedNotice({ to: user.email, reason: 'reset' });

    res.json({
      message: 'Password reset successfully. Other sessions were signed out. You can now sign in.',
      sessionsRevoked: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
});

// 13. DELETE OWN ACCOUNT (SRS 3.4) — confirm + re-auth, then soft-delete & anonymize
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { currentPassword, totpCode, emailOtp, confirmText } = req.body || {};

    const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) return res.status(reauthErr.status).json(reauthErr);

    const noticeEmail = user.email;
    const result = await deleteUserAccount(user, { confirmText });
    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
        code: result.code
      });
    }

    await sendPlainEmail({
      to: noticeEmail,
      subject: 'Scoutify account deletion confirmed',
      text:
        'Your Scoutify account deletion request was completed. Personal information was anonymized, your public profile (if any) was removed from search, and any paid plan was set back to basic. Legally required records may be retained.',
      logLabel: 'Account deletion confirmation'
    });

    res.json({
      message: result.message,
      sessionsRevoked: true,
      subscriptionCancelled: !!result.meta?.subscriptionCancelled
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting account.' });
  }
});

// 14. Re-auth email challenge (Google-only accounts without TOTP)
router.post('/reauth-challenge', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.passwordHash || (user.twoFactorEnabled && user.twoFactorSecret)) {
      return res.status(400).json({
        message: 'Use your password and/or authenticator code instead of an email challenge.'
      });
    }

    const otp = generateOTP();
    user.reauthOtp = otp;
    user.reauthOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const delivery = await sendEmailOtp({ to: user.email, otp, purpose: 'verification' });
    res.json({
      message: delivery.mode === 'console'
        ? 'Re-auth code logged to server console.'
        : 'Re-auth code sent to your email.',
      deliveryMode: delivery.mode
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error starting re-auth challenge.' });
  }
});

// 15. Start email change (re-auth + OTP to new address)
router.post('/change-email', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { newEmail, currentPassword, totpCode, emailOtp } = req.body;
    const normalized = String(newEmail || '').trim().toLowerCase();

    if (!normalized || !normalized.includes('@')) {
      return res.status(400).json({ message: 'Enter a valid new email address.' });
    }
    if (normalized === user.email) {
      return res.status(400).json({ message: 'That is already your current email.' });
    }

    const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) return res.status(reauthErr.status).json(reauthErr);

    const taken = await User.findOne({ email: normalized, isDeleted: { $ne: true } });
    if (taken) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const otp = generateOTP();
    user.pendingEmail = normalized;
    user.pendingEmailOtp = otp;
    user.pendingEmailExpires = new Date(Date.now() + 10 * 60 * 1000);
    clearReauthChallenge(user);
    await user.save();

    const delivery = await sendEmailOtp({ to: normalized, otp, purpose: 'verification' });
    res.json({
      message: delivery.mode === 'console'
        ? 'Confirmation code for the new email was logged to the server console.'
        : 'Confirmation code sent to the new email address.',
      pendingEmail: normalized,
      deliveryMode: delivery.mode,
      otpRequired: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error starting email change.' });
  }
});

router.post('/confirm-email-change', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const otp = String(req.body.otp || '').trim();

    if (
      !user.pendingEmail ||
      !user.pendingEmailOtp ||
      user.pendingEmailOtp !== otp ||
      !user.pendingEmailExpires ||
      user.pendingEmailExpires < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired email confirmation code.' });
    }

    const taken = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: user._id },
      isDeleted: { $ne: true }
    });
    if (taken) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.pendingEmailOtp = undefined;
    user.pendingEmailExpires = undefined;
    if (user.role === 'artisan' && user.artisanProfile) {
      user.artisanProfile.email = user.email;
    }
    await user.save();

    res.json({ message: 'Email updated successfully.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error confirming email change.' });
  }
});

// 16. Start phone change (re-auth + OTP to new number)
router.post('/change-phone', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { newPhone, currentPassword, totpCode, emailOtp } = req.body;
    const phone = normalizePhone(newPhone);

    if (!phone || phone.length < 10) {
      return res.status(400).json({ message: 'Enter a valid 10-digit phone number.' });
    }
    if (phone === user.phoneNumber) {
      return res.status(400).json({ message: 'That is already your current phone number.' });
    }

    const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) return res.status(reauthErr.status).json(reauthErr);

    const taken = await User.findOne({
      phoneNumber: phone,
      _id: { $ne: user._id },
      isDeleted: { $ne: true }
    });
    if (taken) {
      return res.status(400).json({ message: 'Phone number already registered to another account.' });
    }

    const otp = generateOTP();
    user.pendingPhone = phone;
    user.pendingPhoneOtp = otp;
    user.pendingPhoneExpires = new Date(Date.now() + 10 * 60 * 1000);
    clearReauthChallenge(user);
    await user.save();

    const delivery = await sendPhoneOtp({ phone, otp, purpose: 'verification' });
    res.json({
      message: delivery.mode === 'console'
        ? 'Phone confirmation code logged to the server console.'
        : 'Confirmation code sent to the new phone number.',
      pendingPhone: phone,
      deliveryMode: delivery.mode,
      otpRequired: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error starting phone change.' });
  }
});

router.post('/confirm-phone-change', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const otp = String(req.body.otp || '').trim();

    if (
      !user.pendingPhone ||
      !user.pendingPhoneOtp ||
      user.pendingPhoneOtp !== otp ||
      !user.pendingPhoneExpires ||
      user.pendingPhoneExpires < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired phone confirmation code.' });
    }

    const taken = await User.findOne({
      phoneNumber: user.pendingPhone,
      _id: { $ne: user._id },
      isDeleted: { $ne: true }
    });
    if (taken) {
      return res.status(400).json({ message: 'Phone number already registered to another account.' });
    }

    user.phoneNumber = user.pendingPhone;
    user.phoneVerified = true;
    user.pendingPhone = undefined;
    user.pendingPhoneOtp = undefined;
    user.pendingPhoneExpires = undefined;
    if (user.role === 'client') {
      user.clientProfile = {
        ...(user.clientProfile?.toObject?.() || user.clientProfile || {}),
        phoneNumber: user.phoneNumber
      };
    }
    if (user.role === 'artisan') {
      user.artisanProfile = {
        ...(user.artisanProfile?.toObject?.() || user.artisanProfile || {}),
        phoneNumber: user.phoneNumber
      };
    }
    await user.save();

    res.json({ message: 'Phone number updated successfully.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error confirming phone change.' });
  }
});

module.exports = router;

