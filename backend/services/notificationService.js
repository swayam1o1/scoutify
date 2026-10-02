const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const HttpError = require('../utils/httpError');

const PUBLIC_FIELDS = 'type title message data read readAt createdAt';

function countUnread(userId) {
  return Notification.countDocuments({ userId, read: false });
}

async function listNotifications(userId, { limit, before }) {
  const pageSize = Math.min(Number(limit) || 30, 100);
  const filter = { userId };
  if (before && !Number.isNaN(Date.parse(before))) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).limit(pageSize + 1).lean(),
    countUnread(userId)
  ]);

  return {
    notifications: notifications.slice(0, pageSize),
    hasMore: notifications.length > pageSize,
    unreadCount
  };
}

async function markAllRead(userId) {
  await Notification.updateMany({ userId, read: false }, { $set: { read: true, readAt: new Date() } });
}

async function markRead(userId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) throw new HttpError(404, 'Notification not found.');
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  ).select(PUBLIC_FIELDS);
  if (!notification) throw new HttpError(404, 'Notification not found.');
  return { notification, unreadCount: await countUnread(userId) };
}

module.exports = { listNotifications, countUnread, markAllRead, markRead };
