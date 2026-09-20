const { logAudit } = require('../services/securityService');

/**
 * Wraps an admin route handler to automatically log an audit entry
 * after the action completes successfully. Usage:
 *   auditWrap('view_application', 'LoanApplication', req => req.params.id)(controllerFn)
 */
function auditWrap(action, resource, resourceIdFn) {
  return function (handler) {
    return async function (req, res, next) {
      try {
        await handler(req, res, next);
        // Only log if response wasn't an error (best-effort, fire-and-forget)
        logAudit({
          userId: req.session.user.id,
          userName: req.session.user.fullName,
          action,
          resource,
          resourceId: resourceIdFn ? resourceIdFn(req) : undefined,
          ip: req.ip
        });
      } catch (err) {
        next(err);
      }
    };
  };
}

module.exports = { auditWrap };