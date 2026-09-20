const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true }, // e.g. SLR-2026-000123
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    prediction: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    modelVersion: { type: String },
    reportHash: { type: String, required: true }, // SHA-256 of the report's source data
    generatedAt: { type: Date, default: Date.now },
    verificationStatus: { type: String, enum: ['Valid', 'Revoked'], default: 'Valid' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);