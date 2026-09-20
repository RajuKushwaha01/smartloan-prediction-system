const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const ModelRegistry = require('../../models/ModelRegistry');
const Experiment = require('../../models/Experiment');
const { logAudit } = require('../../services/securityService');
const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

/**
 * Triggers train.py as a child process. Long-running — responds
 * immediately with "started" status; the admin checks /model/compare
 * afterward to see results. Kept deliberately manual/reviewed, matching
 * Part 6's "no automatic production replacement" requirement.
 */
exports.trainModel = (req, res) => {
  const mlDir = path.join(__dirname, '..', '..', 'ml');
  exec('python train.py', { cwd: mlDir }, (error, stdout, stderr) => {
    if (error) console.error('Training process error:', error.message);
  });
  res.status(202).json({ success: true, message: 'Training started. This runs in the background — check /api/admin/model/compare shortly for results.' });
};

exports.compareModels = async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    res.json({ comparison: response.data.all_models, selected: response.data.selected_model });
  } catch (e) { res.status(503).json({ error: 'ML service unreachable' }); }
};

exports.versions = async (req, res) => {
  const versions = await ModelRegistry.find().sort({ registeredAt: -1 });
  res.json({ versions });
};

exports.experiments = async (req, res) => {
  const experiments = await Experiment.find().sort({ experimentNumber: -1 });
  res.json({ experiments });
};