const mongoose = require('mongoose');

const scenarioSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    basePrediction: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction', required: true },

    label: { type: String, default: '' }, // e.g. "Loan ₹8L → ₹6L"

    changedInputs: { type: mongoose.Schema.Types.Mixed }, // { loanAmount: 600000, ... }
    simulatedPrediction: { type: String },
    simulatedProbability: { type: Number },
    simulatedEMI: { type: Number },
    simulatedDTI: { type: Number }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Scenario', scenarioSchema);