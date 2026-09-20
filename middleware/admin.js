module.exports = function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('<h1 style="font-family:sans-serif;text-align:center;margin-top:80px;">403 — Access Denied</h1>');
  }
  next();
};