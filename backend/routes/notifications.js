const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const PUBLIC_FIELDS = 'type title message data read readAt createdAt';

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const filter = { userId: req.user._id };
    if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).limit(limit + 1).lean(),
      Notification.countDocuments({ userId: req.user._id, read: false })
    ]);

    res.json({
      notifications: notifications.slice(0, limit),
      hasMore: notifications.length > limit,
      unreadCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading notifications.' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading notifications.' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true, readAt: new Date() } });
    res.json({ message: 'All notifications marked as read.', unreadCount: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating notifications.' });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    ).select(PUBLIC_FIELDS);
    if (!updated) return res.status(404).json({ message: 'Notification not found.' });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ notification: updated, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating notifications.' });
  }
});

module.exports = router;
