require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan');
const methodOverride = require('method-override');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const sanitizeInputs = require('./middleware/sanitize');
const i18nMiddleware = require('./middleware/i18n');
const { csrfProtection, verifyCsrf } = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const loanRoutes = require('./routes/loanRoutes');
const adminRoutes = require('./routes/adminRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const apiRoutes = require('./routes/api/index');

const LoanApplication = require('./models/LoanApplication');
const Prediction = require('./models/Prediction');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Request timeouts configuration to prevent hung requests
server.timeout = 30000;          // 30s request timeout
server.keepAliveTimeout = 65000;

// Make io accessible to controllers via app.locals
app.locals.io = io;

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

/* ============ BODY PARSING ============ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(methodOverride('_method')); // allows PUT/DELETE from HTML forms via ?_method=DELETE

/* ============ SECURITY HEADERS ============ */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-eval' is required for Tailwind's CDN JIT compiler to run in the browser
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          'https://cdn.tailwindcss.com', 
          'https://cdn.jsdelivr.net', 
          'https://unpkg.com'
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

/* ============ INPUT SANITIZATION ============ */
app.use(sanitizeInputs);

/* ============ RATE LIMITING ============ */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);

/* ============ SESSION ============ */
const isSecure = process.env.FORCE_HTTPS_COOKIES === 'true';
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax'
  }
});
app.use(sessionMiddleware);

// Share session with Socket.IO so we can identify admin sockets
io.engine.use(sessionMiddleware);

/* ============ VIEW LOCALS ============ */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

/* ============ INTERNATIONALIZATION ============ */
app.use(i18nMiddleware);

/* ============ CSRF PROTECTION ============ */
app.use(csrfProtection);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next(); // API uses session auth, not CSRF tokens
  verifyCsrf(req, res, next);
});

/* ============ REQUEST LOGGING ============ */
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

/* ============ ROUTES ============ */
app.get('/', async (req, res, next) => {
  try {
    const totalApplications = await LoanApplication.countDocuments();
    const totalPredictions = await Prediction.countDocuments();
    const agg = await Prediction.aggregate([{ $group: { _id: null, avgProb: { $avg: '$probability' } } }]);
    const modelPerformance = agg.length ? agg[0].avgProb.toFixed(2) : '0.00';

    res.render('home', {
      title: 'SmartLoan AI — Smarter Loan Decisions',
      stats: { applications: totalApplications, predictions: totalPredictions, modelPerformance }
    });
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRoutes);
app.use('/loan', loanRoutes);
app.use('/admin', adminRoutes);
app.use('/verify', verifyRoutes);
app.use('/api', apiRoutes);

/* ============ SOCKET.IO: JOIN ADMIN ROOM ============ */
io.on('connection', (socket) => {
  const session = socket.request.session;
  if (session && session.user && session.user.role === 'admin') {
    socket.join('admins');
  }
});

/* ============ ERROR HANDLING ============ */
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 SmartLoan AI running at http://localhost:${PORT}`);
});

// Keep the ML service warm during active use (harmless if it fails —
// this is best-effort and never blocks app startup or requests)
if (process.env.NODE_ENV === 'production' && process.env.ML_API_URL) {
  const axios = require('axios');
  setInterval(() => {
    axios.get(`${process.env.ML_API_URL}/health`, { timeout: 5000 }).catch(() => {});
  }, 10 * 60 * 1000); // ping every 10 minutes
}

/* ============ GRACEFUL SHUTDOWN ============ */
function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    require('mongoose').connection.close(false, () => {
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  });
  // Force-exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  // Don't exit immediately — log and let the process continue serving other requests where possible
});

module.exports = app;