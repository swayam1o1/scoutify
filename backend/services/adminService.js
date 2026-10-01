const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const AuditLog = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { signToken } = require('../middleware/auth');
const { toList, buildSearchText, pickListingSnapshot, diffListing } = require('../utils/artisanFields');
const { sanitizeArtisanForUser, sanitizeCatalogue } = require('../utils/sanitizeArtisan');
const { deleteImage } = require('./storageService');
const { refreshListingEmbedding } = require('./listingEmbeddingService');
const {
  CONTACT_STATUSES,
  ADMIN_ASSIGNABLE_STATUSES,
  PUBLIC_STATUS_FILTER
} = require('../constants/artisan');

const NOT_DELETED = { isDeleted: { $ne: true } };
const SAFE_USER_FIELDS = '-passwordHash -otp -otpExpires -twoFactorSecret -passwordResetOtp -passwordResetExpires -reauthOtp -reauthOtpExpires -pendingEmailOtp -pendingPhoneOtp -phoneOtp';

// Audit writes must never break the admin action itself.
async function writeAudit(actor, action, targetType, targetId, meta) {
  try {
    await AuditLog.create({
      actorId: actor?._id,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      meta
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

function reviewSummary(vendor) {
  const hasApprovedVersion = Boolean(vendor.approvedSnapshot);
  const since = vendor.lastApprovedAt;
  return {
    hasApprovedVersion,
    isFirstSubmission: !hasApprovedVersion && vendor.contactStatus === 'pending',
    changes: hasApprovedVersion ? diffListing(vendor.approvedSnapshot, pickListingSnapshot(vendor)) : [],
    newCatalogueCount: since
      ? (vendor.catalogue || []).filter(item => item.createdAt && item.createdAt > since).length
      : 0
  };
}

// Admin-role accounts only, separate from the consumer login.
async function login(rawEmail, password) {
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email });
  // One generic message so this endpoint cannot be used to enumerate admins.
  if (!user || user.role !== 'admin' || !user.passwordHash || user.isDeleted || user.isSuspended) {
    throw new HttpError(401, 'Invalid admin credentials.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new HttpError(401, 'Invalid admin credentials.');
  }

  await writeAudit(user, 'admin.login', 'User', user._id, { email });

  return {
    message: 'Admin login successful.',
    token: signToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}

async function getStats() {
  const [
    consumers,
    vendors,
    artisansPublic,
    pendingApprovals,
    rejected,
    suspended,
    deleted,
    totalArtisans,
    subscriptionBreakdown
  ] = await Promise.all([
    User.countDocuments({ role: 'client', ...NOT_DELETED }),
    User.countDocuments({ role: 'artisan', ...NOT_DELETED }),
    Artisan.countDocuments(PUBLIC_STATUS_FILTER),
    Artisan.countDocuments({ contactStatus: 'pending' }),
    Artisan.countDocuments({ contactStatus: 'rejected' }),
    User.countDocuments({ isSuspended: true, ...NOT_DELETED }),
    User.countDocuments({ isDeleted: true }),
    Artisan.countDocuments({}),
    User.aggregate([
      { $match: { role: 'client', ...NOT_DELETED } },
      { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } }
    ])
  ]);

  const subscriptions = { basic: 0, pro: 0, enterprise: 0 };
  for (const row of subscriptionBreakdown) {
    if (row._id && subscriptions[row._id] !== undefined) {
      subscriptions[row._id] = row.count;
    }
  }

  return {
    stats: {
      consumers,
      vendors,
      artisansPublic,
      pendingApprovals,
      rejected,
      suspended,
      deleted,
      totalArtisans,
      subscriptions
    }
  };
}

async function listVendors({ status, search, limit: rawLimit }) {
  const query = {};

  if (status && status !== 'all') {
    if (!CONTACT_STATUSES.includes(status)) {
      throw new HttpError(400, `Status must be one of: ${CONTACT_STATUSES.join(', ')}.`);
    }
    query.contactStatus = status;
  }
  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    query.$or = [{ companyName: regex }, { city: regex }, { email: regex }];
  }

  const limit = Math.min(Number(rawLimit) || 100, 500);
  const docs = await Artisan.find(query)
    .select('-embedding -catalogue.embedding')
    .sort({ updatedAt: -1 })
    .limit(limit);

  const vendors = docs.map(doc => {
    const review = reviewSummary(doc);
    return { ...doc.toJSON(), changeCount: review.changes.length, newCatalogueCount: review.newCatalogueCount, isFirstSubmission: review.isFirstSubmission };
  });

  return { vendors, count: vendors.length, total: await Artisan.countDocuments(query) };
}

// Full listing, owner account, and what changed since the last approval.
async function getVendorDetail(id) {
  const vendor = await Artisan.findById(id).select('-embedding -catalogue.embedding');
  if (!vendor) throw new HttpError(404, 'Vendor not found.');

  const owner = vendor.userId
    ? await User.findById(vendor.userId)
      .select('name email phoneNumber phoneVerified isVerified isSuspended isDeleted twoFactorEnabled subscriptionPlan createdAt')
      .lean()
    : null;

  const review = reviewSummary(vendor);
  const since = vendor.lastApprovedAt;
  const catalogue = sanitizeCatalogue(vendor.catalogue).map(item => ({
    ...item,
    isNew: since ? new Date(item.createdAt) > new Date(since) : !vendor.approvedSnapshot
  }));

  return {
    vendor: { ...vendor.toJSON(), catalogue },
    owner,
    review: {
      ...review,
      lastApprovedAt: vendor.lastApprovedAt || null,
      changeRequestedAt: vendor.changeRequestedAt || null
    }
  };
}

async function updateVendorStatus(actor, id, status) {
  if (!ADMIN_ASSIGNABLE_STATUSES.includes(status)) {
    throw new HttpError(400, `Status must be one of: ${ADMIN_ASSIGNABLE_STATUSES.join(', ')}.`);
  }

  const vendor = await Artisan.findById(id);
  if (!vendor) throw new HttpError(404, 'Vendor not found.');

  const previousStatus = vendor.contactStatus;
  vendor.contactStatus = status;
  if (status === 'approved') {
    vendor.approvedSnapshot = pickListingSnapshot(vendor);
    vendor.lastApprovedAt = new Date();
    vendor.markModified('approvedSnapshot');
  }
  await vendor.save();

  await writeAudit(actor, 'vendor.status_changed', 'Artisan', vendor._id, {
    companyName: vendor.companyName,
    previousStatus,
    status
  });

  return { message: `Vendor marked ${status}.`, vendor: sanitizeArtisanForUser(vendor) };
}

async function createVendor(actor, body) {
  const { companyName, status } = body;
  if (!companyName?.trim()) {
    throw new HttpError(400, 'Company name is required.');
  }
  if (status && !ADMIN_ASSIGNABLE_STATUSES.includes(status)) {
    throw new HttpError(400, `Status must be one of: ${ADMIN_ASSIGNABLE_STATUSES.join(', ')}.`);
  }

  const payload = {
    companyName: companyName.trim(),
    phoneNumber: body.phoneNumber,
    email: body.email,
    instagram: body.instagram,
    city: body.city,
    personOfContact: body.personOfContact,
    website: body.website,
    serviceArea: body.serviceArea,
    description: body.description || '',
    specialization: toList(body.specialization),
    products: toList(body.products),
    customTags: toList(body.customTags),
    portfolio: toList(body.portfolio),
    contactStatus: status || 'approved'
  };
  payload.searchText = buildSearchText(payload);
  if (payload.contactStatus === 'approved') {
    payload.approvedSnapshot = pickListingSnapshot(payload);
    payload.lastApprovedAt = new Date();
  }

  const vendor = await Artisan.create(payload);
  refreshListingEmbedding(vendor._id);
  await writeAudit(actor, 'vendor.created', 'Artisan', vendor._id, {
    companyName: vendor.companyName,
    status: vendor.contactStatus
  });

  return { message: 'Vendor listing created.', vendor };
}

async function deleteVendor(actor, id) {
  const vendor = await Artisan.findByIdAndDelete(id);
  if (!vendor) throw new HttpError(404, 'Vendor not found.');
  await Promise.all((vendor.catalogue || []).map(item => deleteImage(item.imageKey)));

  await writeAudit(actor, 'vendor.deleted', 'Artisan', vendor._id, {
    companyName: vendor.companyName,
    city: vendor.city
  });
}

async function listConsumers({ includeDeleted, search, limit: rawLimit }) {
  const query = { role: 'client' };
  if (includeDeleted !== 'true') Object.assign(query, NOT_DELETED);
  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    query.$or = [{ name: regex }, { email: regex }];
  }

  const limit = Math.min(Number(rawLimit) || 100, 500);
  const consumers = await User.find(query)
    .select(SAFE_USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(limit);

  return { consumers, count: consumers.length, total: await User.countDocuments(query) };
}

async function setConsumerSuspended(actor, id, isSuspended) {
  if (typeof isSuspended !== 'boolean') {
    throw new HttpError(400, 'isSuspended must be true or false.');
  }

  const user = await User.findById(id);
  if (!user || user.role !== 'client') throw new HttpError(404, 'Consumer not found.');

  user.isSuspended = isSuspended;
  await user.save();

  await writeAudit(actor, isSuspended ? 'consumer.suspended' : 'consumer.reinstated', 'User', user._id, {
    email: user.email
  });

  return {
    message: isSuspended ? 'Consumer suspended.' : 'Consumer reinstated.',
    consumer: { id: user._id, email: user.email, isSuspended: user.isSuspended }
  };
}

async function softDeleteConsumer(actor, id) {
  const user = await User.findById(id);
  if (!user || user.role !== 'client') throw new HttpError(404, 'Consumer not found.');

  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();

  await writeAudit(actor, 'consumer.deleted', 'User', user._id, { email: user.email });
}

async function listAuditLogs({ limit: rawLimit }) {
  const limit = Math.min(Number(rawLimit) || 50, 200);
  const logs = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'name email');

  return {
    logs: logs.map(log => ({
      id: log._id,
      action: log.action,
      actor: log.actorId ? { id: log.actorId._id, name: log.actorId.name, email: log.actorId.email } : null,
      targetType: log.targetType,
      targetId: log.targetId,
      meta: log.meta,
      createdAt: log.createdAt
    }))
  };
}

module.exports = {
  login,
  getStats,
  listVendors,
  getVendorDetail,
  updateVendorStatus,
  createVendor,
  deleteVendor,
  listConsumers,
  setConsumerSuspended,
  softDeleteConsumer,
  listAuditLogs
};
