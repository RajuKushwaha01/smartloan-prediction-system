function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      return;
    }
    if (obj[key] && typeof obj[key] === 'object') sanitizeObject(obj[key]);
  });
}

module.exports = function sanitizeInputs(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.params) sanitizeObject(req.params);
  if (req.query) sanitizeObject(req.query); // mutates in place — never reassigns req.query
  next();
};