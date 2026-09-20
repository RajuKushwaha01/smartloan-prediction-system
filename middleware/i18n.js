const fs = require('fs');
const path = require('path');

const SUPPORTED_LANGS = ['en', 'hi', 'te'];
const translations = {};

SUPPORTED_LANGS.forEach(lang => {
  const filePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
  translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
});

function i18nMiddleware(req, res, next) {
  let lang = req.session.lang || req.query.lang || 'en';
  if (!SUPPORTED_LANGS.includes(lang)) lang = 'en';
  if (req.query.lang && SUPPORTED_LANGS.includes(req.query.lang)) {
    req.session.lang = req.query.lang;
    lang = req.query.lang;
  }

  res.locals.lang = lang;
  res.locals.t = (key) => translations[lang][key] || translations.en[key] || key;
  next();
}

module.exports = i18nMiddleware;