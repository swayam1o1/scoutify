/**
 * Public (guest) vs authenticated artisan payload shaping.
 * Guests: name, categories, city, summary only — no contact fields.
 */

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

function sanitizeArtisanForGuest(artisan) {
  const plain = toPlain(artisan);
  if (!plain) return null;

  const publicView = {};
  for (const key of PUBLIC_FIELDS) {
    if (plain[key] !== undefined) publicView[key] = plain[key];
  }

  // Keep AI/search extras if present, without leaking contact
  if (plain.matchPercentage !== undefined) publicView.matchPercentage = plain.matchPercentage;
  if (plain.aiReasoning !== undefined) publicView.aiReasoning = plain.aiReasoning;
  if (plain.combinedScore !== undefined) publicView.combinedScore = plain.combinedScore;

  publicView.contactLocked = true;
  return publicView;
}

function sanitizeArtisanForUser(artisan) {
  const plain = toPlain(artisan);
  if (!plain) return null;
  // Never send large embedding vectors to the client
  const { embedding, ...rest } = plain;
  return { ...rest, contactLocked: false };
}

function sanitizeArtisans(artisans, { isLoggedIn }) {
  const list = Array.isArray(artisans) ? artisans : [];
  return list.map(artisan =>
    isLoggedIn ? sanitizeArtisanForUser(artisan) : sanitizeArtisanForGuest(artisan)
  );
}

module.exports = {
  sanitizeArtisanForGuest,
  sanitizeArtisanForUser,
  sanitizeArtisans
};
