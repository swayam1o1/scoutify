const AuditLog = require('../models/AuditLog');
const Artisan = require('../models/Artisan');
const { bumpTokenVersion } = require('../middleware/auth');

/**
 * Soft-delete + anonymize a consumer/vendor account (SRS 3.4).
 * - Marks account deleted and revokes sessions
 * - Scrubs personal fields while freeing email/phone for reuse
 * - Hides public vendor listing and clears portfolio links
 * - Downgrades subscription to basic (MVP payment rule)
 * - Writes an audit row with pre-delete identifiers for legal retention
 */
async function deleteUserAccount(user, { confirmText } = {}) {
  if (!user) {
    return { ok: false, status: 404, message: 'User not found.' };
  }
  if (user.role === 'admin') {
    return { ok: false, status: 403, message: 'Admin accounts cannot be self-deleted.' };
  }
  if (user.isDeleted) {
    return { ok: false, status: 400, message: 'This account is already deleted.' };
  }
  if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
    return {
      ok: false,
      status: 400,
      message: 'Type DELETE to confirm account deletion.',
      code: 'CONFIRMATION_REQUIRED'
    };
  }

  const previousEmail = user.email;
  const previousPhone = user.phoneNumber || null;
  const previousPlan = user.subscriptionPlan || 'basic';
  const previousName = user.name;
  const role = user.role;

  let listing = null;
  if (role === 'artisan') {
    listing = await Artisan.findOne({ userId: user._id });
  }

  // Legal / audit retention before PII scrub
  try {
    await AuditLog.create({
      actorId: user._id,
      action: 'account.self_deleted',
      targetType: 'User',
      targetId: String(user._id),
      meta: {
        email: previousEmail,
        phoneNumber: previousPhone,
        name: previousName,
        role,
        subscriptionPlan: previousPlan,
        listingId: listing?._id ? String(listing._id) : null,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Account deletion audit failed:', err.message);
  }

  const anonEmail = `deleted+${user._id}@deleted.scoutify.local`;

  user.name = 'Deleted User';
  user.email = anonEmail;
  user.set('phoneNumber', undefined);
  user.phoneVerified = false;
  user.phoneOtp = undefined;
  user.phoneOtpExpires = undefined;
  user.set('googleId', undefined);
  user.set('passwordHash', undefined);
  user.isVerified = false;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.passwordResetOtp = undefined;
  user.passwordResetExpires = undefined;
  user.reauthOtp = undefined;
  user.reauthOtpExpires = undefined;
  user.pendingEmail = undefined;
  user.pendingEmailOtp = undefined;
  user.pendingEmailExpires = undefined;
  user.pendingPhone = undefined;
  user.pendingPhoneOtp = undefined;
  user.pendingPhoneExpires = undefined;
  user.twoFactorEnabled = false;
  user.set('twoFactorSecret', undefined);
  // Cancel / downgrade active subscription (MVP payment rule).
  user.subscriptionPlan = 'basic';
  user.searchCount = 0;
  user.set('clientProfile', undefined);
  user.set('artisanProfile', undefined);
  user.boards = [];
  user.isDeleted = true;
  user.deletedAt = new Date();
  bumpTokenVersion(user);

  await user.save();

  // Hide + anonymize public vendor listing; clear portfolio image/links
  if (role === 'artisan') {
    await Artisan.updateOne(
      { userId: user._id },
      {
        $set: {
          companyName: 'Deleted Studio',
          phoneNumber: '',
          email: '',
          instagram: '',
          city: '',
          personOfContact: '',
          website: '',
          serviceArea: '',
          description: '',
          specialization: [],
          products: [],
          customTags: [],
          portfolio: [],
          searchText: '',
          contactStatus: 'rejected'
        },
        $unset: { embedding: 1 }
      }
    );
  }

  return {
    ok: true,
    message:
      'Account marked for deletion. Personal data was anonymized, public profile hidden, and subscription set to basic. Sessions are now invalid.',
    meta: {
      previousEmail,
      role,
      subscriptionCancelled: previousPlan !== 'basic'
    }
  };
}

module.exports = {
  deleteUserAccount
};
