const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin, signToken } = require('../middleware/auth');
const { toList, buildSearchText, pickListingSnapshot, diffListing } = require('../utils/artisanFields');
const { sanitizeArtisanForUser, sanitizeCatalogue } = require('../utils/sanitizeArtisan');
const { deleteImage } = require('../utils/storage');
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

// 1. ADMIN LOGIN — admin-role accounts only, separate from the consumer login.
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    // One generic message so this endpoint cannot be used to enumerate admins.
    if (!user || user.role !== 'admin' || !user.passwordHash || user.isDeleted || user.isSuspended) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    await writeAudit(user, 'admin.login', 'User', user._id, { email });

    res.json({
      message: 'Admin login successful.',
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during admin login.' });
  }
});

// Everything below requires an admin token.
router.use(requireAuth, requireAdmin);

// 2. DASHBOARD STATS
router.get('/stats', async (req, res) => {
  try {
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

    res.json({
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading admin stats.' });
  }
});

// 3. VENDOR LISTINGS
router.get('/vendors', async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      if (!CONTACT_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${CONTACT_STATUSES.join(', ')}.` });
      }
      query.contactStatus = status;
    }
    if (search?.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ companyName: regex }, { city: regex }, { email: regex }];
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const docs = await Artisan.find(query)
      .select('-embedding -catalogue.embedding')
      .sort({ updatedAt: -1 })
      .limit(limit);

    const vendors = docs.map(doc => {
      const review = reviewSummary(doc);
      return { ...doc.toJSON(), changeCount: review.changes.length, newCatalogueCount: review.newCatalogueCount, isFirstSubmission: review.isFirstSubmission };
    });

    res.json({ vendors, count: vendors.length, total: await Artisan.countDocuments(query) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading vendors.' });
  }
});

// 3b. VENDOR DETAIL — full listing, owner account, and what changed since the last approval.
router.get('/vendors/:id', async (req, res) => {
  try {
    const vendor = await Artisan.findById(req.params.id).select('-embedding -catalogue.embedding');
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });

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

    res.json({
      vendor: { ...vendor.toJSON(), catalogue },
      owner,
      review: {
        ...review,
        lastApprovedAt: vendor.lastApprovedAt || null,
        changeRequestedAt: vendor.changeRequestedAt || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading vendor details.' });
  }
});

// 4. APPROVE / REJECT / RESET A VENDOR LISTING
router.patch('/vendors/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!ADMIN_ASSIGNABLE_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${ADMIN_ASSIGNABLE_STATUSES.join(', ')}.` });
    }

    const vendor = await Artisan.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });

    const previousStatus = vendor.contactStatus;
    vendor.contactStatus = status;
    if (status === 'approved') {
      vendor.approvedSnapshot = pickListingSnapshot(vendor);
      vendor.lastApprovedAt = new Date();
      vendor.markModified('approvedSnapshot');
    }
    await vendor.save();

    await writeAudit(req.user, 'vendor.status_changed', 'Artisan', vendor._id, {
      companyName: vendor.companyName,
      previousStatus,
      status
    });

    res.json({ message: `Vendor marked ${status}.`, vendor: sanitizeArtisanForUser(vendor) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating vendor status.' });
  }
});

// 5. MANUALLY CREATE A VENDOR LISTING
router.post('/vendors', async (req, res) => {
  try {
    const { companyName, status } = req.body;
    if (!companyName?.trim()) {
      return res.status(400).json({ message: 'Company name is required.' });
    }
    if (status && !ADMIN_ASSIGNABLE_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${ADMIN_ASSIGNABLE_STATUSES.join(', ')}.` });
    }

    const payload = {
      companyName: companyName.trim(),
      phoneNumber: req.body.phoneNumber,
      email: req.body.email,
      instagram: req.body.instagram,
      city: req.body.city,
      personOfContact: req.body.personOfContact,
      website: req.body.website,
      serviceArea: req.body.serviceArea,
      description: req.body.description || '',
      specialization: toList(req.body.specialization),
      products: toList(req.body.products),
      customTags: toList(req.body.customTags),
      portfolio: toList(req.body.portfolio),
      contactStatus: status || 'approved'
    };
    payload.searchText = buildSearchText(payload);
    if (payload.contactStatus === 'approved') {
      payload.approvedSnapshot = pickListingSnapshot(payload);
      payload.lastApprovedAt = new Date();
    }

    const vendor = await Artisan.create(payload);
    await writeAudit(req.user, 'vendor.created', 'Artisan', vendor._id, {
      companyName: vendor.companyName,
      status: vendor.contactStatus
    });

    res.status(201).json({ message: 'Vendor listing created.', vendor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating vendor.' });
  }
});

// 6. DELETE A VENDOR LISTING
router.delete('/vendors/:id', async (req, res) => {
  try {
    const vendor = await Artisan.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });
    await Promise.all((vendor.catalogue || []).map(item => deleteImage(item.imageKey)));

    await writeAudit(req.user, 'vendor.deleted', 'Artisan', vendor._id, {
      companyName: vendor.companyName,
      city: vendor.city
    });

    res.json({ message: 'Vendor listing deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting vendor.' });
  }
});

// 7. CONSUMER (CLIENT) ACCOUNTS
router.get('/consumers', async (req, res) => {
  try {
    const query = { role: 'client' };
    if (req.query.includeDeleted !== 'true') Object.assign(query, NOT_DELETED);
    if (req.query.search?.trim()) {
      const regex = { $regex: req.query.search.trim(), $options: 'i' };
      query.$or = [{ name: regex }, { email: regex }];
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const consumers = await User.find(query)
      .select(SAFE_USER_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ consumers, count: consumers.length, total: await User.countDocuments(query) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading consumers.' });
  }
});

// 8. SUSPEND / REINSTATE A CONSUMER
router.patch('/consumers/:id', async (req, res) => {
  try {
    const { isSuspended } = req.body;
    if (typeof isSuspended !== 'boolean') {
      return res.status(400).json({ message: 'isSuspended must be true or false.' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'client') return res.status(404).json({ message: 'Consumer not found.' });

    user.isSuspended = isSuspended;
    await user.save();

    await writeAudit(req.user, isSuspended ? 'consumer.suspended' : 'consumer.reinstated', 'User', user._id, {
      email: user.email
    });

    res.json({
      message: isSuspended ? 'Consumer suspended.' : 'Consumer reinstated.',
      consumer: { id: user._id, email: user.email, isSuspended: user.isSuspended }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating consumer.' });
  }
});

// 9. SOFT DELETE A CONSUMER
router.delete('/consumers/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'client') return res.status(404).json({ message: 'Consumer not found.' });

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    await writeAudit(req.user, 'consumer.deleted', 'User', user._id, { email: user.email });

    res.json({ message: 'Consumer account deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting consumer.' });
  }
});

// 10. RECENT AUDIT LOGS
router.get('/audit-logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'name email');

    res.json({
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        actor: log.actorId ? { id: log.actorId._id, name: log.actorId.name, email: log.actorId.email } : null,
        targetType: log.targetType,
        targetId: log.targetId,
        meta: log.meta,
        createdAt: log.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error loading audit logs.' });
  }
});

module.exports = router;
