const mongoose = require('mongoose');
const { CONTACT_STATUSES, ARTISAN_ACCOUNT_FIELDS } = require('../constants/artisan');

const secret = type => ({ type, select: false });

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

  // Vendor login account. Vendors sign in with this document (never the users
  // collection); `email` / `phoneNumber` above double as the login identity.
  // Imported listings have no account until the vendor registers.
  hasAccount: { type: Boolean },
  name: { type: String },
  passwordHash: secret(String),
  tokenVersion: { type: Number, default: 0, select: false },
  googleId: secret(String),
  isVerified: { type: Boolean },
  otp: secret(String),
  otpExpires: secret(Date),
  phoneVerified: { type: Boolean },
  phoneOtp: secret(String),
  phoneOtpExpires: secret(Date),
  subscriptionPlan: { type: String, enum: ['basic', 'pro', 'enterprise'] },
  twoFactorSecret: secret(String),
  twoFactorEnabled: { type: Boolean },
  passwordResetOtp: secret(String),
  passwordResetExpires: secret(Date),
  reauthOtp: secret(String),
  reauthOtpExpires: secret(Date),
  pendingEmail: secret(String),
  pendingEmailOtp: secret(String),
  pendingEmailExpires: secret(Date),
  pendingPhone: secret(String),
  pendingPhoneOtp: secret(String),
  pendingPhoneExpires: secret(Date),
  onboardingCompleted: { type: Boolean },
  isSuspended: { type: Boolean },
  isDeleted: { type: Boolean },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.embedding;
      delete ret.approvedSnapshot;
      for (const field of ARTISAN_ACCOUNT_FIELDS) delete ret[field];
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

// Login identity is unique among vendor accounts; imported listings may share contacts.
ArtisanSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { hasAccount: true } });
ArtisanSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { hasAccount: true, phoneNumber: { $type: 'string' } } }
);

// Vendor accounts behave like users for auth code (signToken, publicUser, guards).
ArtisanSchema.virtual('role').get(function role() {
  return 'artisan';
});

module.exports = mongoose.model('Artisan', ArtisanSchema);
