const Artisan = require('../models/Artisan');
const { sanitizeArtisans } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const { getClientPreferences, scorePreferences } = require('../utils/clientPreferences');

const BASIC_RESULT_LIMIT = 10;

/** Standard (form) search: service + location, capped for basic plans and guests. */
async function standardSearch({ service, location }, user) {
  // Only admin-approved (or legacy verified) vendors are public.
  const conditions = [PUBLIC_STATUS_FILTER];
  if (service) {
    conditions.push({ specialization: { $regex: service.trim(), $options: 'i' } });
  }
  if (location) {
    conditions.push({ city: { $regex: location.trim(), $options: 'i' } });
  }
  const query = { $and: conditions };

  const isLoggedIn = Boolean(user);
  const userPlan = user ? user.subscriptionPlan : 'basic';
  const basicLimit = userPlan === 'basic' ? BASIC_RESULT_LIMIT : null;

  const totalResults = await Artisan.countDocuments(query);

  // Newest updates first so recently approved demo/test listings are visible.
  const findQuery = Artisan.find(query)
    .select('-embedding -catalogue.embedding -approvedSnapshot')
    .sort({ updatedAt: -1, _id: -1 });

  let results;
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
    results = await findQuery.limit(basicLimit);
  } else {
    results = await findQuery;
  }

  // Guests: names/categories/summary only — no phone/email/Instagram (roles doc §2.1)
  return {
    results: sanitizeArtisans(results, { isLoggedIn }),
    totalResults,
    paywallActive: totalResults > BASIC_RESULT_LIMIT && userPlan === 'basic',
    isLoggedIn,
    userPlan,
    personalized: Boolean(prefs),
    contactLocked: !isLoggedIn
  };
}

module.exports = { standardSearch };
