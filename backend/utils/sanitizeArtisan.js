/**
 * Public (guest) vs authenticated artisan payload shaping.
 * Guests: name, categories, city, summary only — no contact fields.
 */
const { ARTISAN_ACCOUNT_FIELDS } = require('../constants/artisan');

const PUBLIC_FIELDS = [
  '_id',
  'companyName',
  'city',
  'specialization',
  'products',
  'customTags',
  'serviceArea',
  'description',
  'contactStatus',
  'createdAt',
  'updatedAt'
];

function toPlain(artisan) {
  if (!artisan) return null;
  if (typeof artisan.toObject === 'function') return artisan.toObject();
  return { ...artisan };
}

function sanitizeCatalogueItem(item) {
  if (!item) return null;
  const { embedding, imageKey, ...rest } = typeof item.toObject === 'function' ? item.toObject() : item;
  return rest;
}

function sanitizeCatalogue(catalogue) {
  return Array.isArray(catalogue) ? catalogue.map(sanitizeCatalogueItem).filter(Boolean) : [];
}

function sanitizeArtisanForGuest(artisan) {
  const plain = toPlain(artisan);
  if (!plain) return null;

  const publicView = {};
  for (const key of PUBLIC_FIELDS) {
    if (plain[key] !== undefined) publicView[key] = plain[key];
  }
  publicView.catalogue = sanitizeCatalogue(plain.catalogue);

  // Keep AI/search extras if present, without leaking contact
  if (plain.matchPercentage !== undefined) publicView.matchPercentage = plain.matchPercentage;
  if (plain.aiReasoning !== undefined) publicView.aiReasoning = plain.aiReasoning;
  if (plain.combinedScore !== undefined) publicView.combinedScore = plain.combinedScore;
  if (plain.matchedItems !== undefined) publicView.matchedItems = plain.matchedItems;

  publicView.contactLocked = true;
  return publicView;
}

function sanitizeArtisanForUser(artisan) {
  const plain = toPlain(artisan);
  if (!plain) return null;
  // Never send large embedding vectors or vendor login/account state to the client
  const { embedding, approvedSnapshot, ...rest } = plain;
  for (const field of ARTISAN_ACCOUNT_FIELDS) delete rest[field];
  return { ...rest, catalogue: sanitizeCatalogue(plain.catalogue), contactLocked: false };
}

function sanitizeArtisans(artisans, { isLoggedIn }) {
  const list = Array.isArray(artisans) ? artisans : [];
  return list.map(artisan =>
    isLoggedIn ? sanitizeArtisanForUser(artisan) : sanitizeArtisanForGuest(artisan)
  );
}

module.exports = {
  sanitizeCatalogue,
  sanitizeArtisanForGuest,
  sanitizeArtisanForUser,
  sanitizeArtisans
};
