const bcrypt = require('bcryptjs');
const HttpError = require('../utils/httpError');
const { signToken, bumpTokenVersion } = require('../middleware/auth');
const { sendEmailOtp, sendPhoneOtp, sendPasswordChangedNotice, sendPlainEmail, normalizePhone } = require('./otpDeliveryService');
const { assertReauth, clearReauthChallenge, companyNameChanged } = require('./reauthService');
const { deleteUserAccount } = require('./accountDeletionService');
const { FIRM_TYPES, generateOTP, publicUser } = require('./authService');
const { isEmailTaken, isPhoneTaken } = require('./accountLookupService');

// assertReauth failures were answered with the failure object itself, so the
// body keeps its `status` field alongside message + code.
async function requireReauth(user, credentials) {
  const failure = await assertReauth(user, credentials);
  if (failure) {
    throw new HttpError(failure.status, failure.message, { status: failure.status, code: failure.code });
  }
}

// 8. CURRENT USER
async function getCurrentUser(user) {
  const payload = {
    ...publicUser(user),
    createdAt: user.createdAt
  };

  // Artisans need their public listing state to know if they are searchable yet.
  // A vendor account is its own listing document.
  if (user.role === 'artisan') {
    payload.artisanListing = { id: user._id, contactStatus: user.contactStatus, updatedAt: user.updatedAt };
  }

  return { user: payload };
}

// 8b. ONBOARDING WIZARD (SRS §4) — draft save + complete
// Body.complete === false → save progress without unlocking restricted features
async function saveOnboarding(user, body) {
  if (user.role !== 'client') {
    user.onboardingCompleted = true;
    await user.save();
    return { message: 'Onboarding not required for this role.', user: publicUser(user) };
  }

  const {
    name,
    dateOfBirth,
    gender,
    profilePictureUrl,
    accountType,
    companyName,
    plannedUse,
    usageType,
    interests,
    preferredLocation,
    serviceArea,
    geoLat,
    geoLng,
    geoAllowed,
    onboardingStep,
    complete
  } = body;

  const finishing = complete !== false && complete !== 'false';

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) {
      throw new HttpError(400, 'Full name is required.');
    }
    user.name = trimmed;
  } else if (finishing && !String(user.name || '').trim()) {
    throw new HttpError(400, 'Full name is required to finish onboarding.');
  }

  if (dateOfBirth !== undefined) {
    if (!dateOfBirth) {
      user.dateOfBirth = undefined;
    } else {
      const dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        throw new HttpError(400, 'Enter a valid date of birth.');
      }
      user.dateOfBirth = dob;
    }
  }

  if (gender !== undefined) {
    user.gender = String(gender || '').trim() || undefined;
  }

  if (profilePictureUrl !== undefined) {
    const url = String(profilePictureUrl || '').trim();
    user.profilePictureUrl = url || undefined;
  }

  const interestList = Array.isArray(interests)
    ? interests.map(i => String(i).trim()).filter(Boolean).slice(0, 5)
    : (user.clientProfile?.interests || []);

  if (interestList.length > 5) {
    throw new HttpError(400, 'Select up to 5 areas of interest.');
  }

  const nextType = accountType !== undefined
    ? (accountType || undefined)
    : user.clientProfile?.type;
  const nextCompany = companyName !== undefined
    ? String(companyName || '').trim()
    : user.clientProfile?.companyName;

  if (finishing && FIRM_TYPES.has(nextType) && !nextCompany) {
    throw new HttpError(400, 'Company name is required for firm / company accounts.');
  }

  const prev = user.clientProfile || {};
  user.clientProfile = {
    type: nextType || undefined,
    companyName: nextCompany || undefined,
    plannedUse: plannedUse !== undefined
      ? (plannedUse || undefined)
      : prev.plannedUse,
    usageType: usageType !== undefined
      ? (usageType || undefined)
      : prev.usageType,
    phoneNumber: prev.phoneNumber,
    interests: interestList,
    preferredLocation: preferredLocation !== undefined
      ? String(preferredLocation || '').trim() || undefined
      : prev.preferredLocation,
    serviceArea: serviceArea !== undefined
      ? String(serviceArea || '').trim() || undefined
      : prev.serviceArea,
    geoLat: geoAllowed && geoLat != null ? Number(geoLat) : (geoAllowed === false ? undefined : prev.geoLat),
    geoLng: geoAllowed && geoLng != null ? Number(geoLng) : (geoAllowed === false ? undefined : prev.geoLng),
    geoAllowed: geoAllowed !== undefined ? !!geoAllowed : !!prev.geoAllowed
  };

  if (onboardingStep !== undefined && onboardingStep !== null && onboardingStep !== '') {
    const step = Math.max(0, Math.min(5, Number(onboardingStep)));
    if (!Number.isNaN(step)) user.onboardingStep = step;
  }

  if (finishing) {
    user.onboardingCompleted = true;
    user.onboardingStep = 5;
  }

  await user.save();

  return {
    message: finishing
      ? 'Onboarding completed. Welcome to Scoutify.'
      : 'Onboarding progress saved.',
    completed: !!user.onboardingCompleted,
    user: publicUser(user)
  };
}

// 9. UPDATE OWN PROFILE (name + client profile). Vendor listing edits go through
// /artisan/profile so they re-enter admin moderation.
async function updateProfile(user, { name, clientProfile, currentPassword, totpCode, emailOtp }) {
  if (name !== undefined) {
    if (!String(name).trim()) {
      throw new HttpError(400, 'Name cannot be empty.');
    }
    user.name = String(name).trim();
  }

  if (user.role === 'client' && clientProfile) {
    const nextCompany = clientProfile.companyName !== undefined
      ? String(clientProfile.companyName || '').trim()
      : user.clientProfile?.companyName;

    if (companyNameChanged(user.clientProfile?.companyName, nextCompany)) {
      await requireReauth(user, { currentPassword, totpCode, emailOtp });
      clearReauthChallenge(user);
    }

    if (FIRM_TYPES.has(clientProfile.type ?? user.clientProfile?.type) && !nextCompany) {
      throw new HttpError(400, 'Company name is required for firm / company profiles.');
    }

    user.clientProfile = {
      type: clientProfile.type ?? user.clientProfile?.type,
      plannedUse: clientProfile.plannedUse ?? user.clientProfile?.plannedUse,
      companyName: nextCompany || undefined,
      phoneNumber: clientProfile.phoneNumber ?? user.clientProfile?.phoneNumber
    };
  }

  await user.save();
  return { message: 'Profile updated.', user: publicUser(user) };
}

// 10. CHANGE PASSWORD
async function changePassword(user, { currentPassword, newPassword, totpCode, emailOtp }) {
  if (!newPassword) {
    throw new HttpError(400, 'New password is required.');
  }
  if (newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters.');
  }
  if (!user.passwordHash) {
    throw new HttpError(400, 'This account has no password set. Use “Forgot password” to create one.');
  }

  await requireReauth(user, { currentPassword, totpCode, emailOtp });
  clearReauthChallenge(user);

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  // Invalidate other sessions; this request gets a fresh token (SRS 3.3).
  bumpTokenVersion(user);
  await user.save();

  await sendPasswordChangedNotice({ to: user.email, reason: 'changed' });

  return {
    message: 'Password changed successfully. A confirmation was sent to your email. Other sessions were signed out.',
    token: signToken(user),
    user: publicUser(user),
    sessionsRevoked: true
  };
}

// 13. DELETE OWN ACCOUNT (SRS 3.4) — confirm + re-auth, then soft-delete & anonymize
async function deleteAccount(user, { currentPassword, totpCode, emailOtp, confirmText }) {
  await requireReauth(user, { currentPassword, totpCode, emailOtp });

  const noticeEmail = user.email;
  const result = await deleteUserAccount(user, { confirmText });
  if (!result.ok) {
    throw new HttpError(result.status, result.message, { code: result.code });
  }

  await sendPlainEmail({
    to: noticeEmail,
    subject: 'Scoutify account deletion confirmed',
    text:
      'Your Scoutify account deletion request was completed. Personal information was anonymized, your public profile (if any) was removed from search, and any paid plan was set back to basic. Legally required records may be retained.',
    logLabel: 'Account deletion confirmation'
  });

  return {
    message: result.message,
    sessionsRevoked: true,
    subscriptionCancelled: !!result.meta?.subscriptionCancelled
  };
}

// 14. Re-auth email challenge (Google-only accounts without TOTP)
async function startReauthChallenge(user) {
  if (user.passwordHash || (user.twoFactorEnabled && user.twoFactorSecret)) {
    throw new HttpError(400, 'Use your password and/or authenticator code instead of an email challenge.');
  }

  const otp = generateOTP();
  user.reauthOtp = otp;
  user.reauthOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const delivery = await sendEmailOtp({ to: user.email, otp, purpose: 'verification' });
  return {
    message: delivery.mode === 'console'
      ? 'Re-auth code logged to server console.'
      : 'Re-auth code sent to your email.',
    deliveryMode: delivery.mode
  };
}

// 15. Start email change (re-auth + OTP to new address)
async function startEmailChange(user, { newEmail, currentPassword, totpCode, emailOtp }) {
  const normalized = String(newEmail || '').trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    throw new HttpError(400, 'Enter a valid new email address.');
  }
  if (normalized === user.email) {
    throw new HttpError(400, 'That is already your current email.');
  }

  await requireReauth(user, { currentPassword, totpCode, emailOtp });

  if (await isEmailTaken(normalized)) {
    throw new HttpError(400, 'Email already registered.');
  }

  const otp = generateOTP();
  user.pendingEmail = normalized;
  user.pendingEmailOtp = otp;
  user.pendingEmailExpires = new Date(Date.now() + 10 * 60 * 1000);
  clearReauthChallenge(user);
  await user.save();

  const delivery = await sendEmailOtp({ to: normalized, otp, purpose: 'verification' });
  return {
    message: delivery.mode === 'console'
      ? 'Confirmation code for the new email was logged to the server console.'
      : 'Confirmation code sent to the new email address.',
    pendingEmail: normalized,
    deliveryMode: delivery.mode,
    otpRequired: true
  };
}

async function confirmEmailChange(user, rawOtp) {
  const otp = String(rawOtp || '').trim();

  if (
    !user.pendingEmail ||
    !user.pendingEmailOtp ||
    user.pendingEmailOtp !== otp ||
    !user.pendingEmailExpires ||
    user.pendingEmailExpires < new Date()
  ) {
    throw new HttpError(400, 'Invalid or expired email confirmation code.');
  }

  if (await isEmailTaken(user.pendingEmail, { excludeId: user._id })) {
    throw new HttpError(400, 'Email already registered.');
  }

  user.email = user.pendingEmail;
  user.pendingEmail = undefined;
  user.pendingEmailOtp = undefined;
  user.pendingEmailExpires = undefined;
  await user.save();

  return { message: 'Email updated successfully.', user: publicUser(user) };
}

// 16. Start phone change (re-auth + OTP to new number)
async function startPhoneChange(user, { newPhone, currentPassword, totpCode, emailOtp }) {
  const phone = normalizePhone(newPhone);

  if (!phone || phone.length < 10) {
    throw new HttpError(400, 'Enter a valid 10-digit phone number.');
  }
  if (phone === user.phoneNumber) {
    throw new HttpError(400, 'That is already your current phone number.');
  }

  await requireReauth(user, { currentPassword, totpCode, emailOtp });

  if (await isPhoneTaken(phone, { excludeId: user._id })) {
    throw new HttpError(400, 'Phone number already registered to another account.');
  }

  const otp = generateOTP();
  user.pendingPhone = phone;
  user.pendingPhoneOtp = otp;
  user.pendingPhoneExpires = new Date(Date.now() + 10 * 60 * 1000);
  clearReauthChallenge(user);
  await user.save();

  const delivery = await sendPhoneOtp({ phone, otp, purpose: 'verification' });
  return {
    message: delivery.mode === 'console'
      ? 'Phone confirmation code logged to the server console.'
      : 'Confirmation code sent to the new phone number.',
    pendingPhone: phone,
    deliveryMode: delivery.mode,
    otpRequired: true
  };
}

async function confirmPhoneChange(user, rawOtp) {
  const otp = String(rawOtp || '').trim();

  if (
    !user.pendingPhone ||
    !user.pendingPhoneOtp ||
    user.pendingPhoneOtp !== otp ||
    !user.pendingPhoneExpires ||
    user.pendingPhoneExpires < new Date()
  ) {
    throw new HttpError(400, 'Invalid or expired phone confirmation code.');
  }

  if (await isPhoneTaken(user.pendingPhone, { excludeId: user._id })) {
    throw new HttpError(400, 'Phone number already registered to another account.');
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
  await user.save();

  return { message: 'Phone number updated successfully.', user: publicUser(user) };
}

module.exports = {
  getCurrentUser,
  saveOnboarding,
  updateProfile,
  changePassword,
  deleteAccount,
  startReauthChallenge,
  startEmailChange,
  confirmEmailChange,
  startPhoneChange,
  confirmPhoneChange
};
