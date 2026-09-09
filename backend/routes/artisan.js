const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Artisan = require('../models/Artisan');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

// Helper middleware for auth
async function requireArtisanAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized. Token required.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'artisan') {
      return res.status(403).json({ message: 'Access denied. Artisan only.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

// 1. GET PROFILE
router.get('/profile', requireArtisanAuth, async (req, res) => {
  res.json({ profile: req.user.artisanProfile });
});

// 2. UPDATE PROFILE & SYNC WITH PUBLIC ARTISAN ENTRY
router.post('/profile', requireArtisanAuth, async (req, res) => {
  try {
    const { companyName, phoneNumber, instagram, city, personOfContact, specialization, portfolio } = req.body;

    // Update User Document
    req.user.artisanProfile = {
      companyName,
      phoneNumber,
      instagram,
      city,
      personOfContact,
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      portfolio: Array.isArray(portfolio) ? portfolio : [portfolio]
    };
    await req.user.save();

    // Sync with public Artisan Collection (Linked by userId)
    await Artisan.findOneAndUpdate(
      { userId: req.user._id },
      {
        companyName,
        phoneNumber,
        instagram,
        city,
        personOfContact,
        contactStatus: 'verified',
        specialization: Array.isArray(specialization) ? specialization : [specialization],
        portfolio: Array.isArray(portfolio) ? portfolio : [portfolio],
        userId: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Artisan profile updated and synced successfully.',
      profile: req.user.artisanProfile
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating artisan profile.' });
  }
});

module.exports = router;
