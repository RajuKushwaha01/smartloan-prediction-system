const crypto = require('crypto');

/**
 * Lightweight double-submit CSRF protection (the 'csurf' npm package is
 * deprecated). A token is generated per session, exposed to views via
 * res.locals.csrfToken, and verified on state-changing requests against
 * a hidden form field of the same name.
 */
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const tokenFromRequest = req.body._csrf || req.headers['x-csrf-token'];
  if (!tokenFromRequest || tokenFromRequest !== req.session.csrfToken) {
    const err = new Error('Invalid or missing security token. Please refresh the page and try again.');
    err.status = 403;
    return next(err);
  }
  next();
}

function verifyCsrfAfterMulter(req, res, next) {
  const tokenFromRequest = req.body._csrf || req.headers['x-csrf-token'];
  if (!tokenFromRequest || tokenFromRequest !== req.session.csrfToken) {
    const err = new Error('Invalid or missing security token. Please refresh the page and try again.');
    err.status = 403;
    return next(err);
  }
  next();
}

module.exports = { csrfProtection, verifyCsrf, verifyCsrfAfterMulter };

