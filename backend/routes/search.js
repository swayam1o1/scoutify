const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { sanitizeArtisans } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const { getClientPreferences, scorePreferences } = require('../utils/clientPreferences');

const { JWT_SECRET, isSessionValid } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { service, location } = req.query;

    // Build query — only admin-approved (or legacy verified) vendors are public.
    const conditions = [PUBLIC_STATUS_FILTER];

    if (service) {
      conditions.push({ specialization: { $regex: service.trim(), $options: 'i' } });
    }
    if (location) {
      conditions.push({ city: { $regex: location.trim(), $options: 'i' } });
    }

    const query = { $and: conditions };

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
        if (user && isSessionValid(decoded, user) && !user.isDeleted && !user.isSuspended) {
          userPlan = user.subscriptionPlan;
          isLoggedIn = true;
        } else {
          user = null;
        }
      } catch (err) {
        // Token expired/invalid, treat as guest / basic
      }
    }

    const totalResults = await Artisan.countDocuments(query);
    let results = [];
    const basicLimit = userPlan === 'basic' ? 10 : null;

    // Newest updates first so recently approved demo/test listings are visible.
    const findQuery = Artisan.find(query)
      .select('-embedding -catalogue.embedding -approvedSnapshot')
      .sort({ updatedAt: -1, _id: -1 });

    const prefs = getClientPreferences(user);
    if (prefs) {
      // Rank the whole match set by onboarding preferences before applying the plan cap.
      const candidates = await findQuery.lean();
      results = candidates
        .map((artisan, index) => {
          const { interestHits, locationHit, reasons } = scorePreferences(artisan, prefs, { explicitLocation: Boolean(location?.trim()) });
          return { artisan: { ...artisan, preferenceReasons: reasons }, score: (locationHit ? 3 : 0) + (interestHits.length ? 2 : 0), index };
        })
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map(entry => entry.artisan);
      if (basicLimit) results = results.slice(0, basicLimit);
    } else if (basicLimit) {
      // Basic / Guest view: limit to 10 results maximum
      results = await findQuery.limit(basicLimit);
    } else {
      // Pro / Enterprise: unlimited results
      results = await findQuery;
    }

    const paywallActive = totalResults > 10 && userPlan === 'basic';

    // Guests: names/categories/summary only — no phone/email/Instagram (roles doc §2.1)
    res.json({
      results: sanitizeArtisans(results, { isLoggedIn }),
      totalResults,
      paywallActive,
      isLoggedIn,
      userPlan,
      personalized: Boolean(prefs),
      contactLocked: !isLoggedIn
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error performing search.' });
  }
});

module.exports = router;
