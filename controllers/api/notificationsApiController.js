const Notification = require('../../models/Notification');

exports.list = async (req, res) => {
  const notifications = await Notification.find({ user: req.session.user.id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.session.user.id, read: false });
  res.json({ notifications, unreadCount });
};

exports.markRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.session.user.id }, { read: true }, { new: true });
  if (!notification) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, notification });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.session.user.id, read: false }, { read: true });
  res.json({ success: true });
};