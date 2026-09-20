const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../models/User');
const { firstError } = require('../../middleware/validators');
const { sendPasswordResetEmail, sendRegistrationEmail } = require('../../services/emailService');
const { logActivity } = require('../../services/activityService');
const { logSecurityEvent } = require('../../services/securityService');

exports.register = async (req, res) => {
  const err = firstError(req);
  if (err) return res.status(400).json({ error: err });

  const { fullName, email, phone, address, city, state, pincode, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ fullName, email, phone, address, city, state, pincode, password: hashedPassword });

  req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
  sendRegistrationEmail(user.email, user.fullName);

  res.status(201).json({ success: true, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role } });
};

exports.login = async (req, res) => {
  const err = firstError(req);
  if (err) return res.status(400).json({ error: err });

  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    await logSecurityEvent({ type: 'failed_login', email, details: 'No account with this email', ip: req.ip });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.accountStatus === 'Suspended') return res.status(403).json({ error: 'Account suspended' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    await logSecurityEvent({ type: 'failed_login', email, userId: user._id, details: 'Incorrect password', ip: req.ip });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
  await logActivity(user._id, 'Login', '');

  res.json({ success: true, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role } });
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
};

exports.forgotPassword = async (req, res) => {
  const err = firstError(req);
  if (err) return res.status(400).json({ error: err });

  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60;
  await user.save();

  const resetUrl = `${process.env.APP_BASE_URL}/auth/reset-password/${rawToken}`;
  const result = await sendPasswordResetEmail(user.email, resetUrl);

  res.json({ success: true, message: 'If that email is registered, a reset link has been sent.', devResetUrl: result.devMode ? resetUrl : undefined });
};

exports.resetPassword = async (req, res) => {
  const err = firstError(req);
  if (err) return res.status(400).json({ error: err });

  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true });
};