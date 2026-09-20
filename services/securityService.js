const AuditLog = require('../models/AuditLog');
const SecurityEvent = require('../models/SecurityEvent');

async function logAudit({ userId, userName, action, resource, resourceId, previousValue, newValue, ip }) {
  try {
    await AuditLog.create({ userId, userName, action, resource, resourceId, previousValue, newValue, ip });
  } catch (e) {
    console.error('Audit log write failed:', e.message);
  }
}

async function logSecurityEvent({ type, email, userId, details, ip }) {
  try {
    await SecurityEvent.create({ type, email, userId, details, ip });
  } catch (e) {
    console.error('Security event log failed:', e.message);
  }
}

module.exports = { logAudit, logSecurityEvent };