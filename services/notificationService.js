const Notification = require('../models/Notification');

async function notify(userId, message, type = 'info', link = '') {
  try {
    await Notification.create({ user: userId, message, type, link });
  } catch (e) {
    console.error('Notification creation failed:', e.message);
  }
}

module.exports = { notify };