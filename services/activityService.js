const ActivityLog = require('../models/ActivityLog');

async function logActivity(userId, action, details = '') {
  try {
    await ActivityLog.create({ user: userId, action, details });
  } catch (e) {
    console.error('Activity log failed:', e.message);
  }
}

module.exports = { logActivity };