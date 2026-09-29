/**
 * Onboarding preferences (SRS §4) used to personalise vendor ranking. They only
 * boost ordering — explicit search terms always win and nothing is filtered out.
 */
const { normalizeCity, nearestCity } = require('./indianCities');

function getClientPreferences(user) {
  const profile = user?.role === 'client' ? user.clientProfile : null;
  if (!profile) return null;

  const interests = (profile.interests || []).map(item => String(item).trim()).filter(Boolean);
  const geoCity = profile.geoAllowed ? nearestCity(Number(profile.geoLat), Number(profile.geoLng)) : null;

  const locationLabels = [];
  for (const value of [profile.preferredLocation, profile.serviceArea, geoCity]) {
    for (const part of String(value || '').split(/[,/]/)) {
      const label = part.trim();
      if (label && !locationLabels.some(existing => normalizeCity(existing) === normalizeCity(label))) {
        locationLabels.push(label);
      }
    }
  }

  if (interests.length === 0 && locationLabels.length === 0) return null;
  return { interests, locations: locationLabels, geoCity };
}

function includesLoose(haystack, needle) {
  const left = String(haystack || '').toLowerCase();
  const right = String(needle || '').toLowerCase();
  return Boolean(left && right) && (left.includes(right) || right.includes(left));
}

function interestMatches(artisan, prefs) {
  const offered = [
    ...(artisan.specialization || []),
    ...(artisan.products || []),
    ...(artisan.customTags || []),
    ...(artisan.catalogue || []).map(item => item.category)
  ].filter(Boolean);
  return prefs.interests.filter(interest => offered.some(item => includesLoose(item, interest)));
}

function locationMatch(artisan, prefs) {
  const vendorPlaces = [artisan.city, ...String(artisan.serviceArea || '').split(/[,/]/)]
    .map(normalizeCity)
    .filter(Boolean);
  return prefs.locations.find(label => {
    const wanted = normalizeCity(label);
    if (wanted.length < 3) return false;
    return vendorPlaces.some(place => place === wanted || place.includes(wanted) || wanted.includes(place));
  }) || null;
}

/**
 * @param {object} options.explicitLocation - true when the search already names a place;
 *   the client's saved location then no longer applies.
 */
function scorePreferences(artisan, prefs, { explicitLocation = false } = {}) {
  if (!prefs) return { interestHits: [], locationHit: null, reasons: [] };
  const interestHits = interestMatches(artisan, prefs);
  const locationHit = explicitLocation ? null : locationMatch(artisan, prefs);
  const reasons = [];
  if (interestHits.length) reasons.push(`Matches your interest: ${interestHits.slice(0, 2).join(', ')}`);
  if (locationHit) reasons.push(`Serves your area: ${locationHit}`);
  return { interestHits, locationHit, reasons };
}

module.exports = { getClientPreferences, scorePreferences };
