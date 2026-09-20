const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { title: '404 — Page Not Found' });
}

function forbiddenHandler(req, res) {
  res.status(403).render('errors/403', { title: '403 — Access Denied' });
}

function serviceUnavailableHandler(req, res, serviceName = 'A required service') {
  res.status(503).render('errors/503', { title: '503 — Service Unavailable', serviceName });
}

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  const status = err.status || 500;

  if (status === 403) return forbiddenHandler(req, res);
  if (status === 503) return serviceUnavailableHandler(req, res, err.serviceName);

  // Never leak stack traces or internal details to the client
  res.status(status).render('errors/500', {
    title: '500 — Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong on our end.'
  });
}

module.exports = { notFoundHandler, forbiddenHandler, serviceUnavailableHandler, errorHandler };