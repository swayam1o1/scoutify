const bcrypt = require('bcryptjs');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { signToken, bumpTokenVersion } = require('../middleware/auth');
const { sendEmailOtp, sendPhoneOtp, sendPasswordChangedNotice, normalizePhone } = require('./otpDeliveryService');
const { verifyTotp } = require('./reauthService');

const FIRM_TYPES = new Set([
  'architectural_firm',
  'design_firm',
  'company',
  'firm',
  'architect_firm'
]);

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
    onboardingCompleted: user.role === 'client' ? !!user.onboardingCompleted : true,
    onboardingStep: user.role === 'client' ? Number(user.onboardingStep || 0) : 0,
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender || null,
    profilePictureUrl: user.profilePictureUrl || null,
    isVerified: user.isVerified,
    isSuspended: user.isSuspended,
    clientProfile: user.clientProfile,
    artisanProfile: user.artisanProfile
  };
}

// Throws a 403 when an account may no longer sign in.
function assertNotBlocked(user) {
  if (user.isDeleted) {
    throw new HttpError(403, 'This account has been deleted. Contact Scoutify support to restore it.');
  }
  if (user.isSuspended) {
    throw new HttpError(403, 'This account is suspended. Contact Scoutify support.');
  }
}

function sessionPayload(message, user) {
  return { message, token: signToken(user), user: publicUser(user) };
}

function twoFactorChallenge(user) {
  return {
    message: 'Enter the 6-digit code from Google Authenticator.',
    email: user.email,
    requires2FA: true
  };
}

// 1. REGISTER
async function register({ name, email, password, role, clientProfile, artisanProfile, phoneNumber }) {
  try {
    if (!name?.trim() || !email?.trim() || !password || !['client', 'artisan'].includes(role)) {
      throw new HttpError(400, 'Name, email, password, and a valid role are required.');
    }
    if (password.length < 8) {
      throw new HttpError(400, 'Password must be at least 8 characters.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const phone = normalizePhone(phoneNumber || artisanProfile?.phoneNumber || clientProfile?.phoneNumber);

    if (role === 'client' && FIRM_TYPES.has(clientProfile?.type) && !clientProfile?.companyName?.trim()) {
      throw new HttpError(400, 'Company name is required for firm / company registration.');
    }
    if (role === 'artisan' && !artisanProfile?.companyName?.trim()) {
      throw new HttpError(400, 'Company name is required for vendor registration.');
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new HttpError(400, 'Email already registered.');
    }

    if (phone) {
      if (phone.length < 10) {
        throw new HttpError(400, 'Enter a valid 10-digit phone number.');
      }
      const phoneTaken = await User.findOne({ phoneNumber: phone, isDeleted: { $ne: true } });
      if (phoneTaken) {
        throw new HttpError(400, 'Phone number already registered.');
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
      // Consumers complete SRS §4 wizard after verify; vendors fill details at register.
      onboardingCompleted: role !== 'client',
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

    return {
      message: delivery.mode === 'smtp'
        ? 'Registration successful. Check your email for the OTP.'
        : 'Registration successful. OTP sent (check server console in development).',
      email: normalizedEmail,
      otpRequired: true,
      deliveryMode: delivery.mode,
      phoneNumber: phone || null
    };
  } catch (err) {
    // Unique-index races surface as duplicate-key errors from save().
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'email';
      throw new HttpError(400, field === 'phoneNumber'
        ? 'Phone number already registered.'
        : 'Email already registered.');
    }
    throw err;
  }
}

// 2. VERIFY OTP
async function verifyOtp({ email, otp }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  assertNotBlocked(user);

  if (user.otp !== otp || user.otpExpires < new Date()) {
    throw new HttpError(400, 'Invalid or expired OTP.');
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  return sessionPayload('Email verified successfully.', user);
}

// 2b. SEND PHONE OTP (optional verification after signup / from portal)
async function sendPhoneVerificationOtp({ email: rawEmail, phoneNumber }) {
  const email = rawEmail?.trim().toLowerCase();
  const phone = normalizePhone(phoneNumber);

  if (!email || !phone || phone.length < 10) {
    throw new HttpError(400, 'Valid email and 10-digit phone number are required.');
  }

  const user = await User.findOne({ email });
  if (!user || user.isDeleted) {
    throw new HttpError(404, 'User not found.');
  }
  assertNotBlocked(user);

  const phoneTaken = await User.findOne({
    phoneNumber: phone,
    _id: { $ne: user._id },
    isDeleted: { $ne: true }
  });
  if (phoneTaken) {
    throw new HttpError(400, 'Phone number already registered to another account.');
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

  return {
    message: delivery.mode === 'twilio'
      ? 'OTP sent to your phone.'
      : 'OTP sent (check server console in development).',
    phoneNumber: phone,
    deliveryMode: delivery.mode
  };
}

// 2c. VERIFY PHONE OTP
async function verifyPhoneOtp({ email: rawEmail, otp }) {
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !otp) {
    throw new HttpError(400, 'Email and OTP are required.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  assertNotBlocked(user);

  if (!user.phoneOtp || user.phoneOtp !== String(otp) || !user.phoneOtpExpires || user.phoneOtpExpires < new Date()) {
    throw new HttpError(400, 'Invalid or expired phone OTP.');
  }

  user.phoneVerified = true;
  user.phoneOtp = undefined;
  user.phoneOtpExpires = undefined;
  await user.save();

  return {
    message: 'Phone number verified successfully.',
    user: publicUser(user)
  };
}

// 3. LOGIN
async function login({ email: rawEmail, password }) {
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(400, 'Invalid credentials.');
  }

  assertNotBlocked(user);

  if (!user.passwordHash) {
    throw new HttpError(400, 'Account is linked with Google Sign-In. Use Google to log in.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new HttpError(400, 'Invalid credentials.');
  }

  if (!user.isVerified) {
    // Re-trigger OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmailOtp({ to: email, otp, purpose: 'verification' });

    throw new HttpError(403, 'Account not verified. OTP sent.', { email, otpRequired: true });
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return twoFactorChallenge(user);
  }

  return sessionPayload('Login successful.', user);
}

// 4. VERIFY 2FA (Google Authenticator TOTP)
async function verifyLogin2fa({ email: rawEmail, code }) {
  const email = rawEmail?.trim().toLowerCase();

  const user = await User.findOne({ email });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new HttpError(400, 'Authenticator login is not enabled for this account.');
  }

  assertNotBlocked(user);

  if (!verifyTotp(user.twoFactorSecret, code)) {
    throw new HttpError(400, 'Invalid authenticator code. Try the current 6-digit number.');
  }

  return sessionPayload('2FA verified successfully.', user);
}

// 5. GOOGLE LOGIN — prefers verified Google ID token (credential); falls back to mocked payload in dev.
async function googleLogin({ name, email, googleId, role, credential }) {
  if (credential) {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!googleRes.ok) {
      throw new HttpError(401, 'Invalid Google credential.');
    }
    const payload = await googleRes.json();
    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new HttpError(401, 'Google client ID mismatch.');
    }
    email = payload.email;
    name = payload.name || payload.email;
    googleId = payload.sub;
  }

  if (!email?.trim() || !googleId) {
    throw new HttpError(400, 'Google account details are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    if (!role || !['client', 'artisan'].includes(role)) {
      throw new HttpError(400, 'Account not found. Please choose Consumer or Vendor to register with Google.', {
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
      isVerified: true,
      onboardingCompleted: role !== 'client'
    });
    await user.save();
  } else {
    assertNotBlocked(user);
    if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      await user.save();
    }
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return twoFactorChallenge(user);
  }

  return sessionPayload('Google login successful.', user);
}

// 7. DEMO LOGIN FOR YC HUD
async function demoLogin({ role }) {
  if (role !== 'client_basic' && role !== 'client_pro' && role !== 'artisan') {
    throw new HttpError(400, 'Invalid demo role.');
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
      twoFactorEnabled: false,
      onboardingCompleted: true
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

  return {
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
  };
}

// 11. FORGOT PASSWORD (OTP logged to server console in dev)
async function forgotPassword({ email: rawEmail }) {
  const email = rawEmail?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, 'Email is required.');
  }

  const user = await User.findOne({ email });

  // Always answer the same way so the endpoint cannot be used to probe emails.
  const genericResponse = {
    message: 'If that email is registered, a 6-digit reset code has been sent.',
    email,
    otpRequired: true
  };

  if (!user || user.isDeleted) {
    return genericResponse;
  }

  const otp = generateOTP();
  user.passwordResetOtp = otp;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
  await user.save();

  await sendEmailOtp({ to: email, otp, purpose: 'reset' });

  return genericResponse;
}

// 12. RESET PASSWORD
async function resetPassword({ email: rawEmail, otp, newPassword }) {
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !otp || !newPassword) {
    throw new HttpError(400, 'Email, OTP, and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters.');
  }

  const user = await User.findOne({ email });
  if (!user || user.isDeleted) {
    throw new HttpError(400, 'Invalid or expired reset code.');
  }
  if (!user.passwordResetOtp || user.passwordResetOtp !== String(otp).trim()) {
    throw new HttpError(400, 'Invalid or expired reset code.');
  }
  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new HttpError(400, 'Invalid or expired reset code.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetOtp = undefined;
  user.passwordResetExpires = undefined;
  // All existing JWTs become invalid after reset (SRS 3.3).
  bumpTokenVersion(user);
  await user.save();

  await sendPasswordChangedNotice({ to: user.email, reason: 'reset' });

  return {
    message: 'Password reset successfully. Other sessions were signed out. You can now sign in.',
    sessionsRevoked: true
  };
}

module.exports = {
  FIRM_TYPES,
  generateOTP,
  publicUser,
  assertNotBlocked,
  register,
  verifyOtp,
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  login,
  verifyLogin2fa,
  googleLogin,
  demoLogin,
  forgotPassword,
  resetPassword
};
