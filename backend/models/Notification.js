const mongoose = require('mongoose');

const RETENTION_DAYS = Number(process.env.NOTIFICATION_RETENTION_DAYS) || 90;

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['search_match'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  // Anonymous search summary only — never the client's identity or raw prompt.
  data: {
    searchType: { type: String },
    productType: { type: String },
    service: { type: String },
    material: { type: String },
    useCase: { type: String },
    quantity: { type: String },
    city: { type: String },
    matchPercentage: { type: Number },
    matchedProduct: { type: String }
  },
  dedupeKey: { type: String },
  read: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, dedupeKey: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', NotificationSchema);
