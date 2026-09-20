const mongoose = require('mongoose');

const reviewDecisionSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    prediction: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction' }, // linked but independent

    decision: { type: String, enum: ['Approved', 'Rejected', 'More Information Required'], required: true },
    note: { type: String, default: '' },

    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerName: { type: String }, // denormalized for quick display
    decidedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReviewDecision', reviewDecisionSchema);