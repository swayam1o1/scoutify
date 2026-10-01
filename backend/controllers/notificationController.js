const handle = require('../utils/handle');
const notificationService = require('../services/notificationService');

const list = handle(async (req, res) => {
  const { limit, before } = req.query;
  res.json(await notificationService.listNotifications(req.user._id, { limit, before }));
}, 'Error loading notifications.');

const unreadCount = handle(async (req, res) => {
  res.json({ unreadCount: await notificationService.countUnread(req.user._id) });
}, 'Error loading notifications.');

const markAllRead = handle(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  res.json({ message: 'All notifications marked as read.', unreadCount: 0 });
}, 'Error updating notifications.');

const markRead = handle(async (req, res) => {
  res.json(await notificationService.markRead(req.user._id, req.params.id));
}, 'Error updating notifications.');

module.exports = { list, unreadCount, markAllRead, markRead };
