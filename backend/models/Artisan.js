const mongoose = require('mongoose');

const ArtisanSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  phoneNumber: { type: String },
  email: { type: String },
  instagram: { type: String },
  city: { type: String },
  personOfContact: { type: String },
  contactStatus: { type: String, default: 'verified' },
  specialization: [{ type: String }],
  portfolio: [{ type: String }],
  description: { type: String, default: '' },
  searchText: { type: String, default: '' },
  embedding: { type: [Number], default: undefined, validate: {
    validator: value => !value || value.length === 768,
    message: 'Embedding must contain 768 dimensions.'
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
