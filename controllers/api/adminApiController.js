const LoanApplication = require('../../models/LoanApplication');
const User = require('../../models/User');
const Prediction = require('../../models/Prediction');
const AuditLog = require('../../models/AuditLog');
const SecurityEvent = require('../../models/SecurityEvent');
const mongoose = require('mongoose');
const axios = require('axios');
const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

exports.dashboard = async (req, res) => {
  const totalUsers = await User.countDocuments({ role: 'user' });
  const totalApplications = await LoanApplication.countDocuments();
  const totalPredictions = await Prediction.countDocuments();
  const eligible = await Prediction.countDocuments({ prediction: 'Eligible' });
  const review = await Prediction.countDocuments({ prediction: 'Review' });
  const notEligible = await Prediction.countDocuments({ prediction: 'Not Eligible' });
  res.json({ totalUsers, totalApplications, totalPredictions, eligible, review, notEligible });
};

exports.users = async (req, res) => {
  const users = await User.find({ role: 'user' }).select('-password -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
  res.json({ users });
};

exports.applications = async (req, res) => {
  const applications = await LoanApplication.find().populate('user', 'fullName email').sort({ createdAt: -1 }).limit(200);
  res.json({ applications });
};

exports.analytics = async (req, res) => {
  const eligible = await Prediction.countDocuments({ prediction: 'Eligible' });
  const review = await Prediction.countDocuments({ prediction: 'Review' });
  const notEligible = await Prediction.countDocuments({ prediction: 'Not Eligible' });
  res.json({ eligible, review, notEligible });
};

exports.predictions = async (req, res) => {
  const predictions = await Prediction.find().populate('application', 'applicationId').sort({ createdAt: -1 }).limit(200);
  res.json({ predictions });
};

exports.models = async (req, res) => {
  const ModelRegistry = require('../../models/ModelRegistry');
  const models = await ModelRegistry.find().sort({ registeredAt: -1 });
  res.json({ models });
};

exports.datasets = async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    res.json({ datasetStats: response.data.dataset_stats || null });
  } catch (e) { res.status(503).json({ error: 'ML service unreachable' }); }
};

exports.experiments = async (req, res) => {
  const Experiment = require('../../models/Experiment');
  const experiments = await Experiment.find().sort({ experimentNumber: -1 });
  res.json({ experiments });
};

exports.auditLogs = async (req, res) => {
  const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(200);
  res.json({ logs });
};

exports.securityEvents = async (req, res) => {
  const events = await SecurityEvent.find().sort({ timestamp: -1 }).limit(200);
  res.json({ events });
};

exports.systemHealth = async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  let mlStatus = 'Unavailable', mlHealth = null;
  const start = Date.now();
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 3000 });
    mlHealth = response.data;
    mlStatus = mlHealth.status === 'healthy' ? 'Online' : 'Degraded';
  } catch (e) { /* stays Unavailable */ }
  res.json({ nodeStatus: 'Online', dbStatus, mlStatus, mlHealth, responseTimeMs: Date.now() - start });
};