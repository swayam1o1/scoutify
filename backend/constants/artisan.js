// Vendor listing moderation states.
// 'verified' is the legacy value written by the CSV importer and is treated as
// approved so bulk-imported vendors keep showing up in search.
const CONTACT_STATUSES = ['pending', 'approved', 'rejected', 'verified'];

// Statuses that are allowed to appear in public search results.
const PUBLIC_CONTACT_STATUSES = ['approved', 'verified'];

// Statuses an admin may assign by hand.
const ADMIN_ASSIGNABLE_STATUSES = ['pending', 'approved', 'rejected'];

const PUBLIC_STATUS_FILTER = { contactStatus: { $in: PUBLIC_CONTACT_STATUSES } };

// Vendor login credentials / challenges stored on the Artisan document. Schema marks
// them `select: false`; auth code opts in with ARTISAN_ACCOUNT_SELECT.
const ARTISAN_SECRET_FIELDS = [
  'passwordHash',
  'tokenVersion',
  'googleId',
  'otp',
  'otpExpires',
  'phoneOtp',
  'phoneOtpExpires',
  'twoFactorSecret',
  'passwordResetOtp',
  'passwordResetExpires',
  'reauthOtp',
  'reauthOtpExpires',
  'pendingEmail',
  'pendingEmailOtp',
  'pendingEmailExpires',
  'pendingPhone',
  'pendingPhoneOtp',
  'pendingPhoneExpires'
];

// Account state that belongs to the vendor login, not the public listing.
const ARTISAN_ACCOUNT_FIELDS = [
  ...ARTISAN_SECRET_FIELDS,
  'hasAccount',
  'name',
  'isVerified',
  'phoneVerified',
  'subscriptionPlan',
  'twoFactorEnabled',
  'onboardingCompleted',
  'isSuspended',
  'isDeleted',
  'deletedAt'
];

const ARTISAN_ACCOUNT_SELECT = `-embedding -catalogue.embedding ${ARTISAN_SECRET_FIELDS.map(field => `+${field}`).join(' ')}`;

module.exports = {
  CONTACT_STATUSES,
  PUBLIC_CONTACT_STATUSES,
  ADMIN_ASSIGNABLE_STATUSES,
  PUBLIC_STATUS_FILTER,
  ARTISAN_SECRET_FIELDS,
  ARTISAN_ACCOUNT_FIELDS,
  ARTISAN_ACCOUNT_SELECT
};
