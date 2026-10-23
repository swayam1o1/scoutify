const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { toList, buildSearchText, pickListingSnapshot, LISTING_FIELDS } = require('../utils/artisanFields');
const { PUBLIC_CONTACT_STATUSES } = require('../constants/artisan');
const { refreshListingEmbedding } = require('./listingEmbeddingService');
const { assertReauth, clearReauthChallenge, companyNameChanged } = require('./reauthService');
const { normalizeVendorType, assessVendorListing, assertReadyForReview } = require('../utils/vendorVerification');

// Listing fields of a vendor account, in the shape the frontend knows as `artisanProfile`.
function artisanProfileOf(account) {
  const profile = {};
  for (const { key, list } of LISTING_FIELDS) {
    profile[key] = list ? [...(account[key] || [])] : account[key];
  }
  profile.vendorType = normalizeVendorType(account.vendorType);
  return profile;
}

function listingFieldsFrom(source = {}) {
  return {
    companyName: String(source.companyName || '').trim(),
    vendorType: normalizeVendorType(source.vendorType),
    instagram: source.instagram,
    city: source.city,
    personOfContact: source.personOfContact,
    website: source.website,
    serviceArea: source.serviceArea,
    description: source.description || '',
    specialization: toList(source.specialization),
    products: toList(source.products),
    customTags: toList(source.customTags),
    portfolio: toList(source.portfolio)
  };
}

/**
 * Unsaved vendor account + listing. New vendors start in admin moderation.
 * `account` holds login fields (email, phoneNumber, passwordHash, otp, googleId...).
 */
function newArtisanAccount({ name, listing = {}, ...account }) {
  const fields = listingFieldsFrom(listing);
  fields.personOfContact = fields.personOfContact || name;
  return new Artisan({
    ...fields,
    ...account,
    name,
    vendorType: fields.vendorType,
    hasAccount: true,
    tokenVersion: 0,
    isVerified: Boolean(account.isVerified),
    phoneVerified: false,
    subscriptionPlan: account.subscriptionPlan || 'basic',
    twoFactorEnabled: false,
    onboardingCompleted: true,
    isSuspended: false,
    isDeleted: false,
    contactStatus: 'pending',
    changeRequestedAt: new Date(),
    searchText: buildSearchText(fields)
  });
}

async function getProfile(account) {
  const profile = artisanProfileOf(account);
  return {
    profile,
    contactStatus: account.contactStatus || null,
    approvalPending: account.contactStatus === 'pending',
    verification: assessVendorListing({ ...profile, catalogue: account.catalogue, phoneNumber: account.phoneNumber })
  };
}

// Any edit re-enters admin moderation, so the listing goes back to 'pending'.
// Company name changes require re-authentication (SRS 3.2).
// Email and phone are the vendor's login identity; they change via account settings.
async function saveProfile(account, body) {
  const { companyName, currentPassword, totpCode, emailOtp } = body;

  if (!companyName?.trim()) {
    throw new HttpError(400, 'Company name is required.');
  }

  if (companyNameChanged(account.companyName, companyName)) {
    const reauthErr = await assertReauth(account, { currentPassword, totpCode, emailOtp });
    if (reauthErr) {
      throw new HttpError(reauthErr.status, reauthErr.message, { status: reauthErr.status, code: reauthErr.code });
    }
    clearReauthChallenge(account);
  }

  // Listings approved before snapshots existed: keep the live version as the review baseline.
  if (!account.approvedSnapshot && PUBLIC_CONTACT_STATUSES.includes(account.contactStatus)) {
    account.approvedSnapshot = pickListingSnapshot(account);
    account.lastApprovedAt = account.updatedAt;
    account.markModified('approvedSnapshot');
  }

  const fields = listingFieldsFrom(body);
  // Login phone is the listing contact phone for verification checks.
  const reviewListing = {
    ...fields,
    phoneNumber: account.phoneNumber,
    catalogue: account.catalogue
  };
  try {
    assertReadyForReview(reviewListing, fields.vendorType);
  } catch (err) {
    throw new HttpError(err.statusCode || 400, err.message, { verification: err.assessment });
  }

  account.set(fields);
  account.contactStatus = 'pending';
  account.changeRequestedAt = new Date();
  account.searchText = buildSearchText({ ...fields, personOfContact: account.personOfContact });
  await account.save();
  refreshListingEmbedding(account._id);

  const profile = artisanProfileOf(account);
  const verification = assessVendorListing({ ...profile, catalogue: account.catalogue, phoneNumber: account.phoneNumber });
  return {
    message: fields.vendorType === 'firm'
      ? 'Firm listing saved for a lighter admin review. It stays hidden until approved.'
      : 'Listing saved for full verification. A Scoutify admin will review it before it appears in search.',
    profile,
    contactStatus: account.contactStatus,
    approvalPending: account.contactStatus === 'pending',
    verification
  };
}

module.exports = { artisanProfileOf, newArtisanAccount, getProfile, saveProfile };
