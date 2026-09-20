const mongoose = require('mongoose');

const experimentSchema = new mongoose.Schema(
  {
    experimentNumber: { type: Number, required: true },
    algorithm: { type: String, required: true },
    datasetVersion: { type: String },
    featureCount: { type: Number },
    trainSplitPct: { type: Number, default: 80 },
    testSplitPct: { type: Number, default: 20 },
    metrics: { type: mongoose.Schema.Types.Mixed }, // accuracy, precision, recall, f1, roc_auc, confusion_matrix, training_time
    wasSelected: { type: Boolean, default: false },
    recordedBy: { type: String },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Experiment', experimentSchema);