const mongoose = require('mongoose');
const { CONTACT_STATUSES } = require('../constants/artisan');

const embeddingField = {
  type: [Number],
  default: undefined,
  validate: {
    validator: value => !value || value.length === 768 || value.length === 3072,
    message: 'Embedding must contain 768 or 3072 dimensions.'
  }
};

const CatalogueItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, default: '' },
  material: { type: String, default: '' },
  style: { type: String, default: '' },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  imageUrl: { type: String, required: true },
  imageKey: { type: String },
  aiDescription: { type: String, default: '' },
  embedding: embeddingField
}, { timestamps: true });

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
  embedding: embeddingField,
  catalogue: { type: [CatalogueItemSchema], default: [] },
  // Listing fields as last approved by an admin, so re-submissions can be diffed.
  approvedSnapshot: { type: mongoose.Schema.Types.Mixed, default: undefined },
  lastApprovedAt: { type: Date },
  changeRequestedAt: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.embedding;
      delete ret.approvedSnapshot;
      if (Array.isArray(ret.catalogue)) {
        ret.catalogue = ret.catalogue.map(({ embedding, imageKey, ...item }) => item);
      }
      return ret;
    }
  }
});

// Create text index for search query speed and flexibility
ArtisanSchema.index({
  companyName: 'text',
  city: 'text',
  personOfContact: 'text',
  specialization: 'text',
  searchText: 'text'
});

module.exports = mongoose.model('Artisan', ArtisanSchema);
