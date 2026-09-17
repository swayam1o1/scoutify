const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['artisan', 'client', 'admin'], required: true },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  subscriptionPlan: { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
  searchCount: { type: Number, default: 0 },
  twoFactorSecret: { type: String },
  twoFactorEnabled: { type: Boolean, default: false },
  passwordResetOtp: { type: String },
  passwordResetExpires: { type: Date },
  isSuspended: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  clientProfile: {
    type: { type: String }, // interior designer, firm, hobbyist, student, etc.
    plannedUse: { type: String }
  },
  artisanProfile: {
    companyName: { type: String },
    phoneNumber: { type: String },
    email: { type: String },
    instagram: { type: String },
    city: { type: String },
    personOfContact: { type: String },
    website: { type: String },
    serviceArea: { type: String },
    description: { type: String },
    specialization: [{ type: String }],
    products: [{ type: String }],
    customTags: [{ type: String }],
    portfolio: [{ type: String }] // Links or uploaded portfolio items
  },
  boards: [{
    name: { type: String, required: true },
    vendors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
