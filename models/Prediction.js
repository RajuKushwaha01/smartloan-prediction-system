const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    applicationId: { type: String }, // denormalized for quick storage/audit lookup

    prediction: { type: String, enum: ['Eligible', 'Review', 'Not Eligible'], required: true },
    probability: { type: Number, required: true }, // stored as 0-1 scale (matches API contract)

    modelName: { type: String, default: 'Random Forest' },
    modelVersion: { type: String, default: 'RF-v1.1' },
    featureVersion: { type: String, default: 'v1.2' },

    featureValues: { type: mongoose.Schema.Types.Mixed }, // raw feature dict sent to the model
    interpretation: { type: String }, // spec-compliant interpretation sentence

    explanationMethod: { type: String, default: 'Global Feature Importance' },
    factors: [
      { name: String, contribution: Number, impact: { type: String, enum: ['Positive', 'Negative', 'Neutral'] } }
    ],

    financialHealth: {
      incomeStability: { type: Number, default: 0 },
      loanAffordability: { type: Number, default: 0 },
      debtBurden: { type: Number, default: 0 }
    },

    recommendation: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true } // createdAt serves as the prediction timestamp
);

predictionSchema.index({ application: 1, createdAt: -1 });
predictionSchema.index({ user: 1, createdAt: -1 });
predictionSchema.index({ prediction: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);