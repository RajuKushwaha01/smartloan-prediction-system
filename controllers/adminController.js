const axios = require('axios');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const xss = require('xss');
const mongoose = require('mongoose');
const os = require('os');

const LoanApplication = require('../models/LoanApplication');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const ReviewDecision = require('../models/ReviewDecision');
const AuditLog = require('../models/AuditLog');
const SecurityEvent = require('../models/SecurityEvent');
const ModelRegistry = require('../models/ModelRegistry');
const Experiment = require('../models/Experiment');

const { generateAdminReportPDF, generateAdminReportExcel } = require('../services/adminReportService');
const { logAudit, logSecurityEvent } = require('../services/securityService');
const { pushStage } = require('../utils/workflowStages');
const { sendStatusUpdatedEmail } = require('../services/emailService');

const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

/* ============================================================
   DASHBOARD
   ============================================================ */
exports.dashboard = async (req, res) => {
  const totalUsers = await User.countDocuments({ role: 'user' });
  const totalApplications = await LoanApplication.countDocuments({ isDraft: { $ne: true } });
  const totalPredictions = await Prediction.countDocuments();

  const eligible = await Prediction.countDocuments({ prediction: 'Eligible' });
  const review = await Prediction.countDocuments({ prediction: 'Review' });
  const notEligible = await Prediction.countDocuments({ prediction: 'Not Eligible' });

  const recentApplications = await LoanApplication.find({ isDraft: { $ne: true } })
    .populate('user', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(8);

  res.render('admin/dashboard', {
    title: 'Admin Dashboard — SmartLoan AI',
    active: 'dashboard',
    totalUsers, totalApplications, totalPredictions,
    eligible, review, notEligible,
    recentApplications
  });
};

/* ============================================================
   ANALYTICS (advanced, filterable, with KPIs)
   ============================================================ */
async function getMonthlyTrendFiltered(baseFilter) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() });
  }
  const trend = [];
  for (const m of months) {
    const start = new Date(m.year, m.month, 1);
    const end = new Date(m.year, m.month + 1, 1);
    const count = await LoanApplication.countDocuments({ ...baseFilter, createdAt: { $gte: start,$lt: end } });
    trend.push({ month: m.label, count });
  }
  return trend;
}

exports.analytics = async (req, res) => {
  const { dateFrom, dateTo, loanPurpose, employmentType, predictionFilter, status, minIncome, maxIncome, minLoan, maxLoan } = req.query;

  const filter = { isDraft: { $ne: true } };
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59');
  }
  if (loanPurpose && loanPurpose !== 'all') filter.loanPurpose = loanPurpose;
  if (employmentType && employmentType !== 'all') filter.employmentType = employmentType;
  if (status && status !== 'all') filter.status = status;
  if (minIncome || maxIncome) {
    filter.annualIncome = {};
    if (minIncome) filter.annualIncome.$gte = Number(minIncome);
    if (maxIncome) filter.annualIncome.$lte = Number(maxIncome);
  }
  if (minLoan || maxLoan) {
    filter.loanAmount = {};
    if (minLoan) filter.loanAmount.$gte = Number(minLoan);
    if (maxLoan) filter.loanAmount.$lte = Number(maxLoan);
  }

  const applications = await LoanApplication.find(filter);
  const appIds = applications.map(a => a._id);

  const predictions = await Prediction.find({ application: { $in: appIds } });
  const filteredPredictions = predictionFilter && predictionFilter !== 'all'
    ? predictions.filter(p => p.prediction === predictionFilter)
    : predictions;

  const totalApplications = applications.length;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const applicationsToday = applications.filter(a => a.createdAt >= startOfToday).length;
  const applicationsThisMonth = applications.filter(a => a.createdAt >= startOfMonth).length;
  const analyzedCount = applications.filter(a => a.status === 'Analyzed').length;
  const predictionRate = totalApplications > 0 ? (analyzedCount / totalApplications) * 100 : 0;
  const reviewCount = applications.filter(a => a.workflowStage === 'Under Review' || a.workflowStage === 'Administrative Decision').length;
  const manualReviewRate = totalApplications > 0 ? (reviewCount / totalApplications) * 100 : 0;

  let totalProcessingMs = 0, processedCount = 0;
  for (const p of predictions) {
    const app = applications.find(a => String(a._id) === String(p.application));
    if (app) { totalProcessingMs += (p.createdAt - app.createdAt); processedCount++; }
  }
  const avgProcessingSeconds = processedCount > 0 ? Math.round(totalProcessingMs / processedCount / 1000) : 0;

  const monthlyTrend = await getMonthlyTrendFiltered(filter);

  const eligible = filteredPredictions.filter(p => p.prediction === 'Eligible').length;
  const review = filteredPredictions.filter(p => p.prediction === 'Review').length;
  const notEligible = filteredPredictions.filter(p => p.prediction === 'Not Eligible').length;

  const loanBuckets = { '0-1L': 0, '1L-3L': 0, '3L-5L': 0, '5L-10L': 0, '10L+': 0 };
  applications.forEach(a => {
    const amt = a.loanAmount;
    if (amt <= 100000) loanBuckets['0-1L']++;
    else if (amt <= 300000) loanBuckets['1L-3L']++;
    else if (amt <= 500000) loanBuckets['3L-5L']++;
    else if (amt <= 1000000) loanBuckets['5L-10L']++;
    else loanBuckets['10L+']++;
  });

  const incomeBuckets = { '<3L': 0, '3L-6L': 0, '6L-10L': 0, '10L-20L': 0, '20L+': 0 };
  applications.forEach(a => {
    const inc = a.annualIncome || 0;
    if (inc < 300000) incomeBuckets['<3L']++;
    else if (inc < 600000) incomeBuckets['3L-6L']++;
    else if (inc < 1000000) incomeBuckets['6L-10L']++;
    else if (inc < 2000000) incomeBuckets['10L-20L']++;
    else incomeBuckets['20L+']++;
  });

  const completionRate = totalApplications > 0 ? Math.round((analyzedCount / totalApplications) * 100) : 0;
  const reviewRatePct = Math.round(manualReviewRate);

  const distinctPurposes = await LoanApplication.distinct('loanPurpose');
  const distinctEmploymentTypes = await LoanApplication.distinct('employmentType');

  res.render('admin/analytics', {
    title: 'Analytics — Admin', active: 'analytics',
    kpis: {
      totalApplications, applicationsToday, applicationsThisMonth,
      predictionRate: predictionRate.toFixed(1), manualReviewRate: manualReviewRate.toFixed(1),
      avgProcessingSeconds
    },
    eligible, review, notEligible, monthlyTrend, loanBuckets, incomeBuckets,
    completionRate, reviewRatePct,
    distinctPurposes, distinctEmploymentTypes,
    filters: {
      dateFrom: dateFrom || '', dateTo: dateTo || '', loanPurpose: loanPurpose || 'all',
      employmentType: employmentType || 'all', predictionFilter: predictionFilter || 'all',
      status: status || 'all', minIncome: minIncome || '', maxIncome: maxIncome || '',
      minLoan: minLoan || '', maxLoan: maxLoan || ''
    }
  });
};

/* ============================================================
   PREDICTION MONITORING
   ============================================================ */
exports.predictionMonitoring = async (req, res) => {
  const totalPredictions = await Prediction.countDocuments();
  const eligible = await Prediction.countDocuments({ prediction: 'Eligible' });
  const review = await Prediction.countDocuments({ prediction: 'Review' });
  const notEligible = await Prediction.countDocuments({ prediction: 'Not Eligible' });

  const now = new Date();
  const monthlyPredictions = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const count = await Prediction.countDocuments({ createdAt: { $gte: start,$lt: end } });
    monthlyPredictions.push({ month: d.toLocaleString('default', { month: 'short', year: '2-digit' }), count });
  }

  const byModelVersion = await Prediction.aggregate([
    { $group: { _id: '$modelVersion', count: {$sum: 1 } } }
  ]);

  const byLoanType = await Prediction.aggregate([
    { $lookup: { from: 'loanapplications', localField: 'application', foreignField: '_id', as: 'app' } },
    { $unwind: '$app' },
    { $group: { _id: '$app.loanPurpose', count: {$sum: 1 } } }
  ]);

  res.render('admin/prediction-monitoring', {
    title: 'Prediction Monitoring — Admin', active: 'predictions-monitor',
    totalPredictions, eligible, review, notEligible,
    monthlyPredictions, byModelVersion, byLoanType
  });
};

/* ============================================================
   USERS MANAGEMENT
   ============================================================ */
exports.usersList = async (req, res) => {
  const { search, status } = req.query;
  const filter = { role: 'user' };
  if (search) filter.$or = [
    { fullName: { $regex: search,$options: 'i' } },
    { email: { $regex: search,$options: 'i' } }
  ];
  if (status && status !== 'all') filter.accountStatus = status;

  const users = await User.find(filter).sort({ createdAt: -1 });

  const appCounts = await LoanApplication.aggregate([
    { $match: { isDraft: {$ne: true } } },
    { $group: { _id: '$user', count: {$sum: 1 } } }
  ]);
  const countMap = {};
  appCounts.forEach(c => { countMap[String(c._id)] = c.count; });

  res.render('admin/users', {
    title: 'User Management — Admin',
    active: 'users',
    users, countMap,
    filters: { search: search || '', status: status || 'all' }
  });
};

exports.toggleUserStatus = async (req, res) => {
  const before = await User.findById(req.params.id, 'accountStatus fullName');
  if (!before) return res.redirect('/admin/users');

  const newStatus = before.accountStatus === 'Active' ? 'Suspended' : 'Active';
  await User.findByIdAndUpdate(req.params.id, { accountStatus: newStatus });

  await logAudit({
    userId: req.session.user.id, userName: req.session.user.fullName,
    action: 'toggle_user_status', resource: 'User', resourceId: req.params.id,
    previousValue: before.accountStatus, newValue: newStatus, ip: req.ip
  });
  await logSecurityEvent({
    type: 'account_status_change', userId: req.params.id,
    details: `Changed by admin ${req.session.user.fullName} to ${newStatus}`, ip: req.ip
  });

  res.redirect('/admin/users');
};

exports.changeUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.redirect('/admin/users');

  const before = await User.findById(req.params.id, 'role');
  await User.findByIdAndUpdate(req.params.id, { role });

  await logAudit({
    userId: req.session.user.id, userName: req.session.user.fullName,
    action: 'change_user_role', resource: 'User', resourceId: req.params.id,
    previousValue: before ? before.role : null, newValue: role, ip: req.ip
  });
  await logSecurityEvent({
    type: 'role_change', userId: req.params.id,
    details: `Role changed to ${role} by admin ${req.session.user.fullName}`, ip: req.ip
  });

  const { notify } = require('../services/notificationService');
  await notify(
    req.params.id,
    `Your account role has been updated to "${role}" by an administrator.`,
    'info',
    role === 'admin' ? '/admin/dashboard' : '/loan/dashboard'
  );

  res.redirect('/admin/users');
};

/* ============================================================
   APPLICATIONS MANAGEMENT
   ============================================================ */
exports.applicationsList = async (req, res) => {
  const { status, workflowStatus, search, sort, minAmount, maxAmount, userId, page } = req.query;
  const filter = { isDraft: { $ne: true } };
  if (status && status !== 'all') filter.status = status;
  if (workflowStatus && workflowStatus !== 'all') filter.workflowStatus = workflowStatus;
  if (search) filter.applicationId = { $regex: search,$options: 'i' };
  if (userId) filter.user = userId;
  if (minAmount || maxAmount) {
    filter.loanAmount = {};
    if (minAmount) filter.loanAmount.$gte = Number(minAmount);
    if (maxAmount) filter.loanAmount.$lte = Number(maxAmount);
  }

  const currentPage = Math.max(1, parseInt(page) || 1);
  const perPage = 15;
  const totalCount = await LoanApplication.countDocuments(filter);

  let query = LoanApplication.find(filter).populate('user', 'fullName email');
  query = sort === 'oldest' ? query.sort({ createdAt: 1 })
    : sort === 'amount' ? query.sort({ loanAmount: -1 })
    : query.sort({ createdAt: -1 });

  const applications = await query.skip((currentPage - 1) * perPage).limit(perPage);

  const predictions = await Prediction.find({ application: { $in: applications.map(a => a._id) } });
  const predictionMap = {};
  predictions.forEach(p => { predictionMap[String(p.application)] = p; });

  res.render('admin/applications', {
    title: 'Applications — Admin', active: 'applications',
    applications, predictionMap,
    pagination: { currentPage, totalPages: Math.ceil(totalCount / perPage), totalCount },
    filters: {
      status: status || 'all', workflowStatus: workflowStatus || 'all', search: search || '',
      sort: sort || 'newest', minAmount: minAmount || '', maxAmount: maxAmount || '', userId: userId || ''
    }
  });
};

exports.applicationDetail = async (req, res) => {
  const application = await LoanApplication.findById(req.params.id).populate('user', 'fullName email phone');
  if (!application) return res.redirect('/admin/applications');

  await logAudit({
    userId: req.session.user.id, userName: req.session.user.fullName,
    action: 'view_application', resource: 'LoanApplication', resourceId: req.params.id, ip: req.ip
  });

  const prediction = await Prediction.findOne({ application: application._id }).sort({ createdAt: -1 });
  res.render('admin/application-detail', {
    title: `Application ${application.applicationId} — Admin`,
    active: 'applications',
    application, prediction
  });
};

exports.updateWorkflowStatus = async (req, res) => {
  const before = await LoanApplication.findById(req.params.id, 'workflowStatus');
  if (!before) return res.redirect(req.get('Referrer') || '/admin/applications');

  const application = await LoanApplication.findById(req.params.id).populate('user', 'email preferences fullName');
  application.workflowStatus = req.body.workflowStatus;
  await application.save();

  await logAudit({
    userId: req.session.user.id, userName: req.session.user.fullName,
    action: 'change_status', resource: 'LoanApplication', resourceId: req.params.id,
    previousValue: before.workflowStatus, newValue: req.body.workflowStatus, ip: req.ip
  });

  if (application.user) {
    const { notify } = require('../services/notificationService');
    await notify(
      application.user._id,
      `Your application ${application.applicationId} status was updated to "${req.body.workflowStatus}"`,
      req.body.workflowStatus === 'Approved' ? 'success' : req.body.workflowStatus === 'Rejected' ? 'warning' : 'info',
      `/loan/application/${application._id}`
    );

    if (application.user.preferences && application.user.preferences.emailNotifications) {
      sendStatusUpdatedEmail(application.user.email, application.applicationId, req.body.workflowStatus);
    }
  }

  res.redirect(req.get('Referrer') || '/admin/applications');
};

exports.addNote = async (req, res) => {
  const { note } = req.body;
  if (note && note.trim()) {
    await LoanApplication.findByIdAndUpdate(
      req.params.id,
      { $push: { internalNotes: { note: xss(note.trim()), addedBy: req.session.user.fullName } } },
      { new: true }
    );
  }
  res.redirect(req.get('Referrer') || '/admin/applications');
};

/* ============================================================
   PREDICTIONS LIST
   ============================================================ */
exports.predictionsList = async (req, res) => {
  const { outcome, sort } = req.query;
  const filter = {};
  if (outcome && outcome !== 'all') filter.prediction = outcome;

  let query = Prediction.find(filter)
    .populate({ path: 'application', select: 'applicationId loanAmount' })
    .populate('user', 'fullName email');

  query = sort === 'oldest' ? query.sort({ createdAt: 1 }) : query.sort({ createdAt: -1 });
  const predictions = await query;

  res.render('admin/predictions', {
    title: 'Predictions — Admin', active: 'predictions',
    predictions,
    filters: { outcome: outcome || 'all', sort: sort || 'newest' }
  });
};

/* ============================================================
   HUMAN-IN-THE-LOOP REVIEW QUEUE
   ============================================================ */
exports.reviewQueue = async (req, res) => {
  const applications = await LoanApplication.find({ workflowStage: 'Under Review' })
    .populate('user', 'fullName email')
    .sort({ updatedAt: -1 });

  const predictions = await Prediction.find({ application: { $in: applications.map(a => a._id) } }).sort({ createdAt: -1 });
  const predictionMap = {};
  predictions.forEach(p => { if (!predictionMap[String(p.application)]) predictionMap[String(p.application)] = p; });

  res.render('admin/review-queue', {
    title: 'Review Queue — Admin', active: 'review',
    applications, predictionMap
  });
};

exports.submitReview = async (req, res) => {
  const { decision, note } = req.body;
  const application = await LoanApplication.findById(req.params.id).populate('user', 'email preferences fullName');
  if (!application) return res.redirect('/admin/review-queue');

  const prediction = await Prediction.findOne({ application: application._id }).sort({ createdAt: -1 });

  await ReviewDecision.create({
    application: application._id,
    prediction: prediction ? prediction._id : undefined,
    decision, note,
    reviewer: req.session.user.id,
    reviewerName: req.session.user.fullName
  });

  application.workflowStatus = decision === 'Approved' ? 'Approved' : decision === 'Rejected' ? 'Rejected' : 'Under Review';

  await pushStage(application, 'Administrative Decision');
  await pushStage(application, 'Completed');

  if (application.user) {
    const { notify } = require('../services/notificationService');
    await notify(
      application.user._id,
      `A decision has been made on your application ${application.applicationId}: ${decision}`,
      decision === 'Approved' ? 'success' : decision === 'Rejected' ? 'warning' : 'info',
      `/loan/application/${application._id}`
    );

    if (application.user.preferences && application.user.preferences.emailNotifications) {
      sendStatusUpdatedEmail(application.user.email, application.applicationId, decision);
    }
  }

  res.redirect('/admin/review-queue');
};

/* ============================================================
   GLOBAL EXPLAINABILITY
   ============================================================ */
exports.globalExplainability = async (req, res) => {
  let metrics = null, error = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    metrics = response.data;
    if (metrics.error) { error = metrics.error; metrics = null; }
  } catch (e) { error = 'ML service is unreachable.'; }
  res.render('admin/explainability', { title: 'Global Explainability — Admin', active: 'explainability', metrics, error });
};

/* ============================================================
   MODEL LAB / REGISTRY / DATASETS / EXPERIMENTS
   ============================================================ */
exports.modelLab = async (req, res) => {
  let metrics = null, error = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    metrics = response.data;
    if (metrics.error) { error = metrics.error; metrics = null; }
  } catch (e) { error = 'ML service is unreachable.'; }
  res.render('admin/model-lab', { title: 'Model Comparison Lab — Admin', active: 'model-lab', metrics, error });
};

exports.modelInfo = async (req, res) => {
  let metrics = null, error = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    metrics = response.data;
    if (metrics.error) { error = metrics.error; metrics = null; }
  } catch (e) { error = 'ML service is unreachable. Start the FastAPI service (uvicorn) to view model metrics.'; }
  res.render('admin/model', { title: 'ML Model Dashboard — Admin', active: 'model', metrics, error });
};

exports.modelRegistryList = async (req, res) => {
  const models = await ModelRegistry.find().sort({ registeredAt: -1 });
  res.render('admin/model-registry', { title: 'Model Registry — Admin', active: 'registry', models });
};

exports.datasetManagement = async (req, res) => {
  let metrics = null, error = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    metrics = response.data;
    if (metrics.error) { error = metrics.error; metrics = null; }
    else if (!metrics.dataset_stats) {
      error = 'Dataset statistics not available. Retrain the model with the latest train.py to generate this data.';
      metrics = null;
    }
  } catch (e) {
    error = 'ML service is unreachable.';
  }
  res.render('admin/dataset-management', { title: 'Dataset Management — Admin', active: 'datasets', metrics, error });
};

exports.experimentTracking = async (req, res) => {
  const experiments = await Experiment.find().sort({ experimentNumber: -1 });
  res.render('admin/experiment-tracking', { title: 'Experiment Tracking — Admin', active: 'experiments', experiments });
};

/* ============================================================
   RETRAINING WORKFLOW + APPROVAL GATE
   ============================================================ */
exports.retrainingWorkflow = async (req, res) => {
  const totalApplications = await LoanApplication.countDocuments({ isDraft: false });
  const totalPredictions = await Prediction.countDocuments();
  const currentRegistered = await ModelRegistry.findOne({ status: 'Current' });

  let metrics = null, mlError = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    if (!response.data.error) metrics = response.data;
    else mlError = response.data.error;
  } catch (e) { mlError = 'ML service is unreachable — train and start it to see the latest pipeline results.'; }

  const alreadyRegistered = metrics && currentRegistered
    ? currentRegistered.trainingDate && new Date(currentRegistered.trainingDate).toISOString() === metrics.trained_at
    : false;

  res.render('admin/retraining', {
    title: 'Retraining — Admin', active: 'retraining',
    totalApplications, totalPredictions, metrics, mlError,
    currentRegistered, alreadyRegistered,
    approved: req.query.approved
  });
};

exports.approveAndRegisterModel = async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    const metrics = response.data;
    if (metrics.error) return res.redirect('/admin/retraining');

    await ModelRegistry.updateMany({ status: 'Current' }, { status: 'Archived' });

    await ModelRegistry.create({
      modelName: metrics.selected_model,
      version: metrics.model_version,
      algorithm: metrics.selected_model,
      datasetVersion: metrics.dataset_version,
      featureVersion: metrics.feature_version,
      metrics: metrics.selected_model_metrics,
      trainingDate: metrics.trained_at,
      status: 'Current',
      registeredBy: req.session.user.fullName
    });

    const lastExp = await Experiment.findOne().sort({ experimentNumber: -1 });
    let nextNum = lastExp ? lastExp.experimentNumber + 1 : 1;

    for (const [name, stats] of Object.entries(metrics.all_models)) {
      await Experiment.create({
        experimentNumber: nextNum++,
        algorithm: name,
        datasetVersion: metrics.dataset_version,
        featureCount: metrics.feature_columns ? metrics.feature_columns.length : undefined,
        trainSplitPct: 80, testSplitPct: 20,
        metrics: stats,
        wasSelected: name === metrics.selected_model,
        recordedBy: req.session.user.fullName
      });
    }

    await logAudit({
      userId: req.session.user.id, userName: req.session.user.fullName,
      action: 'approve_model', resource: 'ModelRegistry',
      newValue: { model: metrics.selected_model, version: metrics.model_version }, ip: req.ip
    });

    res.redirect('/admin/retraining?approved=1');
  } catch (e) {
    console.error(e);
    res.redirect('/admin/retraining');
  }
};

/* ============================================================
   MODEL FAIRNESS ANALYSIS
   ============================================================ */
exports.fairnessAnalysis = async (req, res) => {
  let metrics = null, error = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    metrics = response.data;
    if (metrics.error) { error = metrics.error; metrics = null; }
  } catch (e) { error = 'ML service is unreachable.'; }
  res.render('admin/fairness', { title: 'Model Fairness Analysis — Admin', active: 'fairness', metrics, error });
};

/* ============================================================
   AUDIT LOGS
   ============================================================ */
exports.auditLogs = async (req, res) => {
  const { action, resource } = req.query;
  const filter = {};
  if (action && action !== 'all') filter.action = action;
  if (resource && resource !== 'all') filter.resource = resource;

  const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(200);
  const distinctActions = await AuditLog.distinct('action');
  const distinctResources = await AuditLog.distinct('resource');

  res.render('admin/audit-logs', {
    title: 'Audit Logs — Admin', active: 'audit',
    logs, distinctActions, distinctResources,
    filters: { action: action || 'all', resource: resource || 'all' }
  });
};

/* ============================================================
   SECURITY MONITORING
   ============================================================ */
exports.security = async (req, res) => {
  const failedLogins = await SecurityEvent.find({ type: 'failed_login' }).sort({ timestamp: -1 }).limit(50);
  const passwordChanges = await SecurityEvent.find({ type: 'password_change' }).sort({ timestamp: -1 }).limit(50);
  const accountStatusChanges = await SecurityEvent.find({ type: 'account_status_change' }).sort({ timestamp: -1 }).limit(50);
  const roleChanges = await SecurityEvent.find({ type: 'role_change' }).sort({ timestamp: -1 }).limit(50);

  const recentFailures = await SecurityEvent.aggregate([
    { $match: { type: 'failed_login', timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } } },     {$group: { _id: '$email', count: {$sum: 1 } } },
    { $match: { count: {$gte: 5 } } }
  ]);

  res.render('admin/security', {
    title: 'Security Monitoring — Admin', active: 'security',
    failedLogins, passwordChanges, accountStatusChanges, roleChanges, recentFailures
  });
};

/* ============================================================
   SYSTEM HEALTH (uses ML /health, not /model-info)
   ============================================================ */
exports.systemHealth = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'Connected' : 'Disconnected';

  let mlStatus = 'Unavailable';
  let mlHealth = null;
  let responseTimeMs = null;

  const start = Date.now();
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 8000 });
    responseTimeMs = Date.now() - start;
    mlHealth = response.data;
    mlStatus = mlHealth.status === 'healthy' ? 'Online' : 'Degraded';
  } catch (e) {
    responseTimeMs = Date.now() - start;
  }

  res.render('admin/system-health', {
    title: 'System Health — Admin', active: 'health',
    nodeStatus: 'Online', dbStatus, mlStatus, mlHealth, responseTimeMs
  });
};

/* ============================================================
   ADMIN SETTINGS
   ============================================================ */
exports.getSettings = async (req, res) => {
  const admin = await User.findById(req.session.user.id);
  res.render('admin/settings', {
    title: 'Settings — Admin', active: 'settings', admin,
    updated: req.query.updated, pwUpdated: req.query.pwUpdated, pwError: req.query.pwError
  });
};

exports.updateSettings = async (req, res) => {
  const { fullName, phone } = req.body;
  await User.findByIdAndUpdate(req.session.user.id, { fullName, phone });
  req.session.user.fullName = fullName;
  res.redirect('/admin/settings?updated=1');
};

exports.changeAdminPassword = async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const admin = await User.findById(req.session.user.id);

  const match = await bcrypt.compare(currentPassword, admin.password);
  if (!match) return res.redirect('/admin/settings?pwError=current');
  if (newPassword !== confirmNewPassword) return res.redirect('/admin/settings?pwError=match');
  if (newPassword.length < 6) return res.redirect('/admin/settings?pwError=length');

  admin.password = await bcrypt.hash(newPassword, 10);
  await admin.save();

  await logSecurityEvent({ type: 'password_change', userId: admin._id, details: 'Admin changed their own password', ip: req.ip });

  res.redirect('/admin/settings?pwUpdated=1');
};

/* ============================================================
   REPORTS CENTER
   ============================================================ */
exports.reportsCenter = async (req, res) => {
  res.render('admin/reports', { title: 'Reports — Admin', active: 'reports' });
};

async function gatherReportData() {
  const totalUsers = await User.countDocuments({ role: 'user' });
  const totalApplications = await LoanApplication.countDocuments({ isDraft: { $ne: true } });
  const totalPredictions = await Prediction.countDocuments();
  const eligible = await Prediction.countDocuments({ prediction: 'Eligible' });
  const review = await Prediction.countDocuments({ prediction: 'Review' });
  const notEligible = await Prediction.countDocuments({ prediction: 'Not Eligible' });
  const monthlyTrend = await getMonthlyTrendFiltered({ isDraft: { $ne: true } });

  let modelMetrics = null;
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`, { timeout: 5000 });
    if (!response.data.error) modelMetrics = response.data;
  } catch (e) { /* ML unreachable — leave null */ }

  return { totalUsers, totalApplications, totalPredictions, eligible, review, notEligible, monthlyTrend, modelMetrics };
}

exports.downloadAdminReportPDF = async (req, res) => {
  const data = await gatherReportData();
  await logAudit({ userId: req.session.user.id, userName: req.session.user.fullName, action: 'generate_report', resource: 'AdminReport', ip: req.ip });
  generateAdminReportPDF(res, data);
};

exports.downloadAdminReportExcel = async (req, res) => {
  const data = await gatherReportData();
  generateAdminReportExcel(res, data);
};

exports.exportCSV = async (req, res) => {
  try {
    const applications = await LoanApplication.find({ isDraft: { $ne: true } })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 });

    const fields = [
      'Application ID',
      'Applicant Name',
      'Applicant Email',
      'Loan Amount',
      'Loan Purpose',
      'Employment Type',
      'Annual Income',
      'Status',
      'Workflow Stage',
      'Created At'
    ];

    const rows = applications.map(app => [
      `"${app.applicationId || ''}"`,
      `"${app.user ? app.user.fullName : ''}"`,
      `"${app.user ? app.user.email : ''}"`,
      app.loanAmount || 0,
      `"${app.loanPurpose || ''}"`,
      `"${app.employmentType || ''}"`,
      app.annualIncome || 0,
      `"${app.status || ''}"`,
      `"${app.workflowStage || ''}"`,
      `"${app.createdAt ? new Date(app.createdAt).toISOString() : ''}"`
    ]);

    const csvContent = [fields.join(','), ...rows.map(row => row.join(','))].join('\n');

    await logAudit({
      userId: req.session.user.id,
      userName: req.session.user.fullName,
      action: 'export_csv',
      resource: 'LoanApplication',
      ip: req.ip
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="loan_applications_export.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return res.redirect(req.get('Referrer') || '/admin/applications');
  }
};