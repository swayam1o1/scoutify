const mongoose = require('mongoose');

const RETENTION_DAYS = Number(process.env.SEARCH_LOG_RETENTION_DAYS) || 180;

// AI search prompts and extracted parameters (SRS §5). Client photos are never stored.
const SearchLogSchema = new mongoose.Schema({
  // Searcher may be a User (client/admin) or an Artisan vendor account.
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  searchType: { type: String, enum: ['ai_text', 'ai_image'], required: true },
  query: { type: String, default: '' },
  extracted: { type: mongoose.Schema.Types.Mixed },
  resultCount: { type: Number, default: 0 },
  resultVendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' }],
  notifiedVendorCount: { type: Number, default: 0 },
  simulated: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

SearchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('SearchLog', SearchLogSchema);
