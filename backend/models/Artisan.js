const mongoose = require('mongoose');
const { CONTACT_STATUSES } = require('../constants/artisan');

const ArtisanSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  phoneNumber: { type: String },
  email: { type: String },
  instagram: { type: String },
  city: { type: String },
  personOfContact: { type: String },
  website: { type: String },
  serviceArea: { type: String },
  contactStatus: { type: String, enum: CONTACT_STATUSES, default: 'pending' },
  specialization: [{ type: String }],
  products: [{ type: String }],
  customTags: [{ type: String }],
  portfolio: [{ type: String }],
  description: { type: String, default: '' },
  searchText: { type: String, default: '' },
  embedding: { type: [Number], default: undefined, validate: {
    validator: value => !value || value.length === 768 || value.length === 3072,
    message: 'Embedding must contain 768 or 3072 dimensions.'
  } },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Create text index for search query speed and flexibility
ArtisanSchema.index({
  companyName: 'text',
  city: 'text',
  personOfContact: 'text',
  specialization: 'text',
  searchText: 'text'
});

module.exports = mongoose.model('Artisan', ArtisanSchema);
