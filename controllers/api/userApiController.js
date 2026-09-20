const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const ActivityLog = require('../../models/ActivityLog');
const { logActivity } = require('../../services/activityService');

exports.getProfile = async (req, res) => {
  const user = await User.findById(req.session.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
  res.json({ user });
};

exports.updateProfile = async (req, res) => {
  const { fullName, phone, address, city, state, pincode } = req.body;
  const user = await User.findByIdAndUpdate(
    req.session.user.id,
    { fullName, phone, address, city, state, pincode },
    { new: true }
  ).select('-password -resetPasswordToken -resetPasswordExpires');

  req.session.user.fullName = fullName;
  await logActivity(req.session.user.id, 'Profile Updated', '');
  res.json({ success: true, user });
};

exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.session.user.id);

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  await logActivity(user._id, 'Password Changed', '');

  res.json({ success: true });
};

exports.getActivity = async (req, res) => {
  const activities = await ActivityLog.find({ user: req.session.user.id }).sort({ timestamp: -1 }).limit(100);
  res.json({ activities });
};