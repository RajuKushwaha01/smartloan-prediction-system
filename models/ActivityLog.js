const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['Login', 'Application Submitted', 'Prediction Generated', 'Report Downloaded', 'Profile Updated', 'Password Changed'],
      required: true
    },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

activityLogSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);