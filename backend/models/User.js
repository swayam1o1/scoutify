const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // Sparse unique: multiple users may omit phone, but two verified numbers cannot collide.
  phoneNumber: { type: String, sparse: true, unique: true },
  phoneVerified: { type: Boolean, default: false },
  phoneOtp: { type: String },
  phoneOtpExpires: { type: Date },
  passwordHash: { type: String },
  // Bumped on password change/reset so older JWTs stop working (SRS 3.3).
  tokenVersion: { type: Number, default: 0 },
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
  // Short-lived challenge for sensitive actions (Google-only accounts without TOTP)
  reauthOtp: { type: String },
  reauthOtpExpires: { type: Date },
  pendingEmail: { type: String },
  pendingEmailOtp: { type: String },
  pendingEmailExpires: { type: Date },
  pendingPhone: { type: String },
  pendingPhoneOtp: { type: String },
  pendingPhoneExpires: { type: Date },
  isSuspended: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  clientProfile: {
    type: { type: String }, // interior_designer, architectural_firm, hobbyist, student, private_client
    companyName: { type: String },
    plannedUse: { type: String },
    phoneNumber: { type: String }
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
    portfolio: [{ type: String }]
  },
  boards: [{
    name: { type: String, required: true },
    vendors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
