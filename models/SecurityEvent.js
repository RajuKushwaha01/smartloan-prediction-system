const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['failed_login', 'password_change', 'account_status_change', 'role_change', 'suspicious_pattern'],
      required: true
    },
    email: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    details: { type: String },
    ip: { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

securityEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);