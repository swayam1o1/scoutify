const Artisan = require('../models/Artisan');
const { buildEmbeddingText } = require('../utils/artisanFields');
const { embedText } = require('./geminiService');

// Recomputes a listing's profile embedding so it can be matched by text and photo
// search even without catalogue photos. Never throws: a failed embed must not break a save.
async function refreshListingEmbedding(listingId) {
  try {
    const listing = await Artisan.findById(listingId).select('-embedding -catalogue.embedding').lean();
    if (!listing) return false;
    const embedding = await embedText(buildEmbeddingText(listing));
    if (!embedding) return false;
    await Artisan.updateOne({ _id: listingId }, { $set: { embedding } });
    return true;
  } catch (err) {
    console.warn('Listing embedding skipped:', err.message);
    return false;
  }
}

module.exports = { refreshListingEmbedding };
