const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { toList, buildSearchText, pickListingSnapshot } = require('../utils/artisanFields');
const { PUBLIC_CONTACT_STATUSES } = require('../constants/artisan');
const { refreshListingEmbedding } = require('./listingEmbeddingService');
const { assertReauth, clearReauthChallenge, companyNameChanged } = require('./reauthService');

async function getProfile(user) {
  const listing = await Artisan.findOne({ userId: user._id }).select('contactStatus updatedAt');
  return {
    profile: user.artisanProfile,
    contactStatus: listing?.contactStatus || null,
    approvalPending: listing ? listing.contactStatus === 'pending' : false
  };
}

// Any edit re-enters admin moderation, so the listing goes back to 'pending'.
// Company name changes require re-authentication (SRS 3.2).
async function saveProfile(user, body) {
  const {
    companyName,
    phoneNumber,
    email,
    instagram,
    city,
    personOfContact,
    website,
    serviceArea,
    description,
    currentPassword,
    totpCode,
    emailOtp
  } = body;

  if (!companyName?.trim()) {
    throw new HttpError(400, 'Company name is required.');
  }

  const existing = user.artisanProfile?.toObject?.() || user.artisanProfile || {};
  if (companyNameChanged(existing.companyName, companyName)) {
    const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) {
      throw new HttpError(reauthErr.status, reauthErr.message, { status: reauthErr.status, code: reauthErr.code });
    }
    clearReauthChallenge(user);
  }

  const specialization = toList(body.specialization);
  const products = toList(body.products);
  const customTags = toList(body.customTags);

  const profile = {
    companyName: companyName.trim(),
    phoneNumber,
    email,
    instagram,
    city,
    personOfContact,
    website,
    serviceArea,
    description,
    specialization,
    products,
    customTags,
    portfolio: toList(body.portfolio)
  };

  user.artisanProfile = profile;
  await user.save();

  // Listings approved before snapshots existed: keep the live version as the review baseline.
  const existingListing = await Artisan.findOne({ userId: user._id }).select('-embedding -catalogue');
  const baseline = existingListing && !existingListing.approvedSnapshot
    && PUBLIC_CONTACT_STATUSES.includes(existingListing.contactStatus)
    ? { approvedSnapshot: pickListingSnapshot(existingListing), lastApprovedAt: existingListing.updatedAt }
    : {};

  const listing = await Artisan.findOneAndUpdate(
    { userId: user._id },
    {
      ...profile,
      ...baseline,
      contactStatus: 'pending',
      changeRequestedAt: new Date(),
      searchText: buildSearchText(profile),
      userId: user._id
    },
    { upsert: true, new: true }
  );
  refreshListingEmbedding(listing._id);

  return {
    message: 'Listing saved. A Scoutify admin will review it before it appears in search.',
    profile: user.artisanProfile,
    contactStatus: listing.contactStatus,
    approvalPending: listing.contactStatus === 'pending'
  };
}

module.exports = { getProfile, saveProfile };
