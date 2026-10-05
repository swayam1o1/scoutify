const Artisan = require('../models/Artisan');
const { sanitizeArtisans } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const { getClientPreferences, scorePreferences } = require('../utils/clientPreferences');
const { buildSearchTerms, searchTermsFilter, scoreSearchTerms, escapeRegex } = require('../utils/searchTerms');

const BASIC_RESULT_LIMIT = 10;

/** Standard (form) search: service + location, capped for basic plans and guests. */
async function standardSearch({ service, location }, user) {
  // Only admin-approved (or legacy verified) vendors are public.
  const conditions = [PUBLIC_STATUS_FILTER];
  const terms = buildSearchTerms(service);
  const termsFilter = searchTermsFilter(terms);
  if (termsFilter) conditions.push(termsFilter);
  if (location?.trim()) {
    const cityRegex = { $regex: escapeRegex(location.trim()), $options: 'i' };
    conditions.push({ $or: [{ city: cityRegex }, { serviceArea: cityRegex }] });
  }

  const isLoggedIn = Boolean(user);
  const userPlan = user ? user.subscriptionPlan : 'basic';
  const basicLimit = userPlan === 'basic' ? BASIC_RESULT_LIMIT : null;
  const prefs = getClientPreferences(user);

  // Newest updates first so recently approved demo/test listings are visible among equals.
  const candidates = await Artisan.find({ $and: conditions })
    .select('-embedding -catalogue.embedding -approvedSnapshot')
    .sort({ updatedAt: -1, _id: -1 })
    .lean();

  // Vendors matching more of the query words, in what they list as their work, rank first;
  // onboarding preferences only break ties.
  let results = candidates
    .map((artisan, index) => {
      const relevance = scoreSearchTerms(artisan, terms);
      const preference = prefs
        ? scorePreferences(artisan, prefs, { explicitLocation: Boolean(location?.trim()) })
        : null;
      const prefScore = preference ? (preference.locationHit ? 3 : 0) + (preference.interestHits.length ? 2 : 0) : 0;
      return {
        artisan: preference ? { ...artisan, preferenceReasons: preference.reasons } : artisan,
        relevance,
        prefScore,
        index
      };
    })
    .sort((left, right) =>
      right.relevance.matchedWords - left.relevance.matchedWords
      || right.relevance.score - left.relevance.score
      || right.prefScore - left.prefScore
      || left.index - right.index)
    .map(entry => entry.artisan);

  const totalResults = results.length;
  if (basicLimit) results = results.slice(0, basicLimit);

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
