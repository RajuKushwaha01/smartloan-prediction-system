const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { firstError } = require('../middleware/validators');
const { sendPasswordResetEmail, sendRegistrationEmail } = require('../services/emailService');
const { logSecurityEvent } = require('../services/securityService');
const { logActivity } = require('../services/activityService');

exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Create Account — SmartLoan AI', error: null, old: {} });
};

exports.postRegister = async (req, res) => {
  const err = firstError(req);
  if (err) return res.render('auth/register', { title: 'Create Account', error: err, old: req.body });

  try {
    const { fullName, email, phone, address, city, state, pincode, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.render('auth/register', { title: 'Create Account', error: 'Email already registered', old: req.body });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, email, phone, address, city, state, pincode, password: hashedPassword });

    sendRegistrationEmail(user.email, user.fullName);

    req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
    res.redirect('/loan/dashboard');
  } catch (e) {
    console.error(e);
    res.render('auth/register', { title: 'Create Account', error: 'Something went wrong. Try again.', old: req.body });
  }
};

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login — SmartLoan AI', error: null, old: {} });
};

exports.postLogin = async (req, res) => {
  const err = firstError(req);
  if (err) return res.render('auth/login', { title: 'Login', error: err, old: req.body });

  try {
    const { email, password, rememberMe } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      await logSecurityEvent({ type: 'failed_login', email, details: 'No account with this email', ip: req.ip });
      return res.render('auth/login', { title: 'Login', error: 'Invalid email or password', old: req.body });
    }

    if (user.accountStatus === 'Suspended') {
      return res.render('auth/login', { title: 'Login', error: 'Your account has been suspended. Contact support.', old: req.body });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logSecurityEvent({ type: 'failed_login', email, userId: user._id, details: 'Incorrect password', ip: req.ip });
      return res.render('auth/login', { title: 'Login', error: 'Invalid email or password', old: req.body });
    }

    req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
    if (rememberMe === 'on') req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

    await logActivity(user._id, 'Login', '');

    if (user.role === 'admin') return res.redirect('/admin/dashboard');
    res.redirect('/loan/dashboard');
  } catch (e) {
    console.error(e);
    res.render('auth/login', { title: 'Login', error: 'Something went wrong. Try again.', old: req.body });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

/* ---------- FORGOT PASSWORD ---------- */

exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password — SmartLoan AI', error: null, message: null, devResetUrl: null });
};

exports.postForgotPassword = async (req, res) => {
  const err = firstError(req);
  if (err) {
    return res.render('auth/forgot-password', { title: 'Forgot Password', error: err, message: null, devResetUrl: null });
  }

  try {
    const user = await User.findOne({ email: req.body.email });

    // Always show generic success message (don't leak which emails are registered)
    const genericMessage = 'If that email is registered, a password reset link has been sent.';

    if (!user) {
      return res.render('auth/forgot-password', { title: 'Forgot Password', error: null, message: genericMessage, devResetUrl: null });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    const resetUrl = `${process.env.APP_BASE_URL}/auth/reset-password/${rawToken}`;
    const result = await sendPasswordResetEmail(user.email, resetUrl);

    res.render('auth/forgot-password', {
      title: 'Forgot Password',
      error: null,
      message: genericMessage,
      devResetUrl: result.devMode ? resetUrl : null // shown only when no SMTP configured (demo mode)
    });
  } catch (e) {
    console.error(e);
    res.render('auth/forgot-password', { title: 'Forgot Password', error: 'Something went wrong. Try again.', message: null, devResetUrl: null });
  }
};

exports.getResetPassword = async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } });

  if (!user) {
    return res.render('auth/reset-password', { title: 'Reset Password', error: 'This reset link is invalid or has expired.', token: null });
  }

  res.render('auth/reset-password', { title: 'Reset Password — SmartLoan AI', error: null, token: req.params.token });
};

exports.postResetPassword = async (req, res) => {
  const err = firstError(req);
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  if (err) {
    return res.render('auth/reset-password', { title: 'Reset Password', error: err, token: req.params.token });
  }

  try {
    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
      return res.render('auth/reset-password', { title: 'Reset Password', error: 'This reset link is invalid or has expired.', token: null });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.redirect('/auth/login');
  } catch (e) {
    console.error(e);
    res.render('auth/reset-password', { title: 'Reset Password', error: 'Something went wrong. Try again.', token: req.params.token });
  }
};