/**
 * The API reuses the same express-session cookie as the website (no
 * separate JWT layer — keeps one source of truth for auth). Responses
 * are JSON instead of redirects/renders.
 */
function apiRequireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function apiRequireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { apiRequireAuth, apiRequireAdmin };