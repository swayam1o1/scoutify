const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Artisan = require('../models/Artisan');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

router.get('/', async (req, res) => {
  try {
    const { service, location } = req.query;

    // Build query
    let query = {};
    const conditions = [];

    if (service) {
      conditions.push({ specialization: { $regex: service.trim(), $options: 'i' } });
    }
    if (location) {
      conditions.push({ city: { $regex: location.trim(), $options: 'i' } });
    }

    if (conditions.length > 0) {
      query = { $and: conditions };
    }

    // Determine user subscription plan from auth header
    let userPlan = 'basic';
    let isLoggedIn = false;
    let user = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await User.findById(decoded.id);
        if (user) {
          userPlan = user.subscriptionPlan;
          isLoggedIn = true;
        }
      } catch (err) {
        // Token expired/invalid, treat as guest / basic
      }
    }

    const totalResults = await Artisan.countDocuments(query);
    let results = [];

    if (userPlan === 'basic') {
      // Basic / Guest view: limit to 10 results maximum
      results = await Artisan.find(query).limit(10);
    } else {
      // Pro / Enterprise: unlimited results
      results = await Artisan.find(query);
    }

    const paywallActive = totalResults > 10 && userPlan === 'basic';

    res.json({
      results,
      totalResults,
      paywallActive,
      isLoggedIn,
      userPlan
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error performing search.' });
  }
});

module.exports = router;
