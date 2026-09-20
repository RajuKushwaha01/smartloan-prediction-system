const mongoose = require('mongoose');

const modelRegistrySchema = new mongoose.Schema(
  {
    modelName: { type: String, required: true },
    version: { type: String, required: true },        // e.g. RF-v1.1
    algorithm: { type: String, required: true },
    datasetVersion: { type: String },
    featureVersion: { type: String },
    metrics: { type: mongoose.Schema.Types.Mixed },     // full selected_model_metrics snapshot
    trainingDate: { type: Date },
    modelFile: { type: String, default: 'model.pkl' },
    status: { type: String, enum: ['Current', 'Archived'], default: 'Archived' },
    registeredBy: { type: String },
    registeredAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ModelRegistry', modelRegistrySchema);