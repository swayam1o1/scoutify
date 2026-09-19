const express = require('express');
const router = express.Router();
const Artisan = require('../models/Artisan');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toList, buildSearchText } = require('../utils/artisanFields');
const { assertReauth, clearReauthChallenge, companyNameChanged } = require('../utils/reauth');

// Every route here is for the signed-in vendor managing their own listing.
router.use(requireAuth, requireRole('artisan'));

// 1. GET PROFILE
router.get('/profile', async (req, res) => {
  try {
    const listing = await Artisan.findOne({ userId: req.user._id }).select('contactStatus updatedAt');
    res.json({
      profile: req.user.artisanProfile,
      contactStatus: listing?.contactStatus || null,
      approvalPending: listing ? listing.contactStatus === 'pending' : false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading artisan profile.' });
  }
});

// 2. UPDATE PROFILE & SYNC WITH PUBLIC ARTISAN ENTRY
// Any edit re-enters admin moderation, so the listing goes back to 'pending'.
// Company name changes require re-authentication (SRS 3.2).
router.post('/profile', async (req, res) => {
  try {
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
    } = req.body;

    if (!companyName?.trim()) {
      return res.status(400).json({ message: 'Company name is required.' });
    }

    const existing = req.user.artisanProfile?.toObject?.() || req.user.artisanProfile || {};
    if (companyNameChanged(existing.companyName, companyName)) {
      const reauthErr = await assertReauth(req.user, { currentPassword, totpCode, emailOtp });
      if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
      clearReauthChallenge(req.user);
    }

    const specialization = toList(req.body.specialization);
    const products = toList(req.body.products);
    const customTags = toList(req.body.customTags);

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
      portfolio: toList(req.body.portfolio)
    };

    req.user.artisanProfile = profile;
    await req.user.save();

    const listing = await Artisan.findOneAndUpdate(
      { userId: req.user._id },
      {
        ...profile,
        contactStatus: 'pending',
        searchText: buildSearchText(profile),
        userId: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Listing saved. A Scoutify admin will review it before it appears in search.',
      profile: req.user.artisanProfile,
      contactStatus: listing.contactStatus,
      approvalPending: listing.contactStatus === 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating artisan profile.' });
  }
});

module.exports = router;
