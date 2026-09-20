const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const LoanApplication = require('../models/LoanApplication');
const Prediction = require('../models/Prediction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Scenario = require('../models/Scenario');
const ReviewDecision = require('../models/ReviewDecision');
const ActivityLog = require('../models/ActivityLog');

const { getPrediction, simulatePrediction } = require('../services/predictionService');
const { createReportRecord, generateReportPDF } = require('../services/reportService');
const { notify } = require('../services/notificationService');
const { firstError } = require('../middleware/validators');
const { generateRecommendation, calculateEMI } = require('../services/recommendationService');
const { generateApplicationId, calculateDTI } = require('../utils/helpers');
const {  
  sendApplicationSubmittedEmail,  
  sendPredictionGeneratedEmail,  
  sendReportReadyEmail  
} = require('../services/emailService');

// New microservice-aligned services & utils
const { runDataQualityChecks } = require('../services/dataQualityService');
const { detectAnomalies } = require('../services/anomalyService');
const { pushStage } = require('../utils/workflowStages');
const { logActivity } = require('../services/activityService');

// ==========================================
// Dashboard & Application Flow Controllers
// ==========================================

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const applications = await LoanApplication.find({ user: userId, isDraft: false }).sort({ createdAt: -1 });
    const draft = await LoanApplication.findOne({ user: userId, isDraft: true }).sort({ updatedAt: -1 });

    const totalApplications = applications.length;
    const completedPredictions = applications.filter(a => a.status === 'Analyzed').length;
    const underReview = applications.filter(a => a.status === 'Pending').length;
    const reportsCount = await Prediction.countDocuments({ user: userId });

    const recentApplications = applications.slice(0, 6);
    const predictionsForRecent = await Prediction.find({
      application: { $in: recentApplications.map(a => a._id) }
    });

    const predictionMap = {};
    predictionsForRecent.forEach(p => { 
      predictionMap[String(p.application)] = p; 
    });

    res.render('user/dashboard', {
      title: 'Dashboard — SmartLoan AI',
      stats: { totalApplications, completedPredictions, underReview, reportsCount },
      recentApplications,
      applications, // included for backward compatibility
      predictionMap,
      draft
    });
  } catch (err) {
    next(err);
  }
};

/* ============ APPLY FORM (loads existing draft if present) ============ */
exports.getApplyForm = async (req, res, next) => {
  try {
    const draft = await LoanApplication.findOne({ user: req.session.user.id, isDraft: true }).sort({ updatedAt: -1 });
    res.render('loan/apply', { title: 'New Loan Application — SmartLoan AI', error: null, old: {}, draft });
  } catch (err) {
    next(err);
  }
};

/* ============ AUTO-SAVE DRAFT (AJAX) ============ */
exports.saveDraft = async (req, res) => {
  try {
    const body = req.body;
    const updateData = {
      fullName: body.fullName, 
      age: Number(body.age) || undefined, 
      gender: body.gender,
      maritalStatus: body.maritalStatus, 
      dependents: Number(body.dependents) || 0,
      education: body.education, 
      residentialStatus: body.residentialStatus,
      employmentType: body.employmentType, 
      occupation: body.occupation, 
      employer: body.employer,
      yearsOfEmployment: Number(body.yearsOfEmployment) || 0, 
      selfEmployed: body.selfEmployed === 'on' || body.selfEmployed === true,
      employmentStability: body.employmentStability,
      annualIncome: Number(body.annualIncome) || undefined, 
      monthlyIncome: Number(body.monthlyIncome) || undefined,
      coApplicantIncome: Number(body.coApplicantIncome) || 0, 
      monthlyExpenses: Number(body.monthlyExpenses) || 0,
      hasExistingLoan: body.hasExistingLoan === 'on' || body.hasExistingLoan === true,
      existingEMI: Number(body.existingEMI) || 0, 
      assets: Number(body.assets) || 0, 
      liabilities: Number(body.liabilities) || 0,
      loanAmount: Number(body.loanAmount) || undefined, 
      loanTenure: Number(body.loanTenure) || undefined,
      loanPurpose: body.loanPurpose, 
      repaymentPreference: body.repaymentPreference,
      creditHistory: body.creditHistory, 
      previousLoanStatus: body.previousLoanStatus,
      existingCredit: Number(body.existingCredit) || 0,
      creditScore: body.creditScore ? Number(body.creditScore) : undefined,
      currentStep: Number(body.currentStep) || 1,
      isDraft: true, 
      status: 'Draft'
    };

    let draft;
    if (body.draftId) {
      draft = await LoanApplication.findOneAndUpdate(
        { _id: body.draftId, user: req.session.user.id, isDraft: true },
        updateData, 
        { new: true }
      );
    }
    if (!draft) {
      draft = await LoanApplication.create({
        ...updateData,
        user: req.session.user.id,
        applicationId: generateApplicationId()
      });
    }

    res.json({ success: true, draftId: draft._id, savedAt: new Date() });
  } catch (e) {
    console.error('Draft save error:', e.message);
    res.status(500).json({ success: false });
  }
};

exports.deleteDraft = async (req, res, next) => {
  try {
    await LoanApplication.deleteOne({ _id: req.params.id, user: req.session.user.id, isDraft: true });
    res.redirect('/loan/dashboard');
  } catch (err) {
    next(err);
  }
};

/* ============ SUBMIT (converts draft to final, or creates fresh) ============ */
exports.postApply = async (req, res) => {
  const err = firstError(req);
  if (err) {
    return res.render('loan/apply', { title: 'New Loan Application — SmartLoan AI', error: err, old: req.body, draft: null });
  }

  try {
    const monthlyIncome = Number(req.body.monthlyIncome) || (Number(req.body.annualIncome) / 12);
    const coApplicantIncome = Number(req.body.coApplicantIncome) || 0;
    const existingEMI = Number(req.body.existingEMI) || 0;
    const totalMonthlyIncome = monthlyIncome + coApplicantIncome;
    const dti = totalMonthlyIncome > 0 ? (existingEMI / totalMonthlyIncome) * 100 : 0;

    const finalData = {
      fullName: req.body.fullName, 
      age: Number(req.body.age), 
      gender: req.body.gender,
      maritalStatus: req.body.maritalStatus, 
      dependents: Number(req.body.dependents) || 0,
      education: req.body.education, 
      residentialStatus: req.body.residentialStatus,
      employmentType: req.body.employmentType, 
      occupation: req.body.occupation, 
      employer: req.body.employer,
      yearsOfEmployment: Number(req.body.yearsOfEmployment) || 0, 
      selfEmployed: req.body.selfEmployed === 'on',
      employmentStability: req.body.employmentStability,
      annualIncome: Number(req.body.annualIncome), 
      monthlyIncome, 
      coApplicantIncome,
      monthlyExpenses: Number(req.body.monthlyExpenses) || 0, 
      hasExistingLoan: req.body.hasExistingLoan === 'on',
      existingEMI, 
      assets: Number(req.body.assets) || 0, 
      liabilities: Number(req.body.liabilities) || 0,
      loanAmount: Number(req.body.loanAmount), 
      loanTenure: Number(req.body.loanTenure),
      loanPurpose: req.body.loanPurpose, 
      repaymentPreference: req.body.repaymentPreference,
      creditHistory: req.body.creditHistory, 
      previousLoanStatus: req.body.previousLoanStatus,
      existingCredit: Number(req.body.existingCredit) || 0,
      creditScore: req.body.creditScore ? Number(req.body.creditScore) : undefined,
      debtToIncomeRatio: Math.round(dti * 10) / 10,
      isDraft: false, 
      status: 'Pending', 
      currentStep: 6
    };

    // ============ DATA QUALITY ENGINE — bad data must not reach ML ============
    const quality = runDataQualityChecks(finalData);
    if (!quality.passed) {
      return res.render('loan/apply', {
        title: 'New Loan Application — SmartLoan AI',
        error: quality.issues[0], // show first issue; all are logged server-side
        old: req.body, 
        draft: null
      });
    }

    let application;
    if (req.body.draftId) {
      application = await LoanApplication.findOneAndUpdate(
        { _id: req.body.draftId, user: req.session.user.id }, 
        finalData, 
        { new: true }
      );
    }
    if (!application) {
      application = await LoanApplication.create({
        ...finalData, 
        user: req.session.user.id, 
        applicationId: generateApplicationId()
      });
    }

    // ============ WORKFLOW: Draft → Submitted → Validation ============
    await pushStage(application, 'Submitted');
    await pushStage(application, 'Validation');

    // ============ ANOMALY DETECTION (separate system) ============
    const anomalyFlags = await detectAnomalies(application.toObject(), req.session.user.id);
    if (anomalyFlags.length > 0) {
      application.anomalyFlags.push(...anomalyFlags);
      await application.save();
    }

    await logActivity(req.session.user.id, 'Application Submitted', application.applicationId);

    // ============ SOCKET.IO: notify admins in real time ============
    const io = req.app.locals.io;
    if (io) {
      io.to('admins').emit('new_application', {
        applicationId: application.applicationId,
        applicant: application.fullName,
        loanAmount: application.loanAmount,
        timestamp: new Date()
      });
    }

    await notify(
      req.session.user.id, 
      `Application ${application.applicationId} submitted successfully`, 
      'success', 
      `/loan/application/${application._id}`
    );

    const submittingUser = await User.findById(req.session.user.id);
    if (submittingUser && submittingUser.preferences && submittingUser.preferences.emailNotifications) {
      sendApplicationSubmittedEmail(submittingUser.email, application.applicationId);
    }

    res.redirect(`/loan/analyze/${application._id}`);
  } catch (e) {
    console.error(e);
    res.render('loan/apply', { title: 'New Loan Application — SmartLoan AI', error: 'Please check your inputs and try again.', old: req.body, draft: null });
  }
};

exports.analyzeScreen = async (req, res, next) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application || String(application.user) !== req.session.user.id) {
      return res.redirect('/loan/dashboard');
    }
    res.render('loan/analyzing', { title: 'Analyzing Application — SmartLoan AI', application });
  } catch (err) {
    next(err);
  }
};

exports.runPrediction = async (req, res) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application || String(application.user) !== req.session.user.id) {
      return res.status(404).json({ error: 'Not found' });
    }

    await pushStage(application, 'AI Analysis');

    let result;
    try {
      result = await getPrediction(application.toObject());
    } catch (mlErr) {
      // ML totally unreachable even after the service's own fallback — degrade, don't crash
      return res.status(503).json({ error: 'AI analysis is temporarily unavailable. Please try again.' });
    }

    const prediction = await Prediction.create({
      application: application._id, 
      user: req.session.user.id, 
      applicationId: application.applicationId,
      prediction: result.prediction, 
      probability: result.probability,
      modelName: result.model_name, 
      modelVersion: result.model_version, 
      featureVersion: result.feature_version,
      featureValues: result.feature_values, 
      interpretation: result.interpretation,
      explanationMethod: result.explanation_method, 
      factors: result.factors,
      financialHealth: {
        incomeStability: result.financial_health ? result.financial_health.income_stability : 0,
        loanAffordability: result.financial_health ? result.financial_health.loan_affordability : 0,
        debtBurden: result.financial_health ? result.financial_health.debt_burden : 0
      }
    });

    const recommendation = generateRecommendation(application.toObject(), result);
    prediction.recommendation = recommendation;
    await prediction.save();

    // ============ WORKFLOW: Prediction Generated ============
    await pushStage(application, 'Prediction Generated');

    application.status = 'Analyzed';

    // ============ HUMAN-IN-THE-LOOP: auto-flag for review ============
    if (result.prediction === 'Review' || (application.anomalyFlags && application.anomalyFlags.length > 0)) {
      await pushStage(application, 'Under Review');
    } else {
      await application.save();
    }

    await logActivity(req.session.user.id, 'Prediction Generated', `${application.applicationId} — ${result.prediction}`);

    const notifType = result.prediction === 'Not Eligible' ? 'warning' : 'success';
    await notify(req.session.user.id, `AI prediction generated for ${application.applicationId}: ${result.prediction}`, notifType, `/loan/result/${prediction._id}`);
    if (result.prediction === 'Review') {
      await notify(req.session.user.id, `Application ${application.applicationId} requires additional review`, 'warning', `/loan/result/${prediction._id}`);
    }

    const predictingUser = await User.findById(req.session.user.id);
    if (predictingUser && predictingUser.preferences && predictingUser.preferences.emailNotifications) {
      sendPredictionGeneratedEmail(predictingUser.email, application.applicationId, result.prediction);
    }

    res.json({ redirectUrl: `/loan/result/${prediction._id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Prediction failed' });
  }
};

exports.result = async (req, res, next) => {
  try {
    const prediction = await Prediction.findById(req.params.id).populate('application');
    if (!prediction || String(prediction.user) !== req.session.user.id) {
      return res.redirect('/loan/dashboard');
    }
    res.render('result/prediction', { title: 'Prediction Result — SmartLoan AI', prediction });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// Application History & Details
// ==========================================

exports.history = async (req, res, next) => {
  try {
    const { applicationId, status, prediction, sort, minAmount, maxAmount, dateFrom, dateTo, page } = req.query;
    const filter = { user: req.session.user.id, isDraft: false };

    if (applicationId) filter.applicationId = { $regex: applicationId,$options: 'i' };
    if (status && status !== 'all') filter.status = status;
    
    if (minAmount || maxAmount) {
      filter.loanAmount = {};
      if (minAmount) filter.loanAmount.$gte = Number(minAmount);
      if (maxAmount) filter.loanAmount.$lte = Number(maxAmount);
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59');
    }

    const currentPage = Math.max(1, parseInt(page) || 1);
    const perPage = 10;

    let query = LoanApplication.find(filter);
    query = sort === 'oldest' ? query.sort({ createdAt: 1 })
      : sort === 'amount_high' ? query.sort({ loanAmount: -1 })
      : sort === 'amount_low' ? query.sort({ loanAmount: 1 })
      : query.sort({ createdAt: -1 });

    const totalCount = await LoanApplication.countDocuments(filter);
    let applications = await query.skip((currentPage - 1) * perPage).limit(perPage);

    const predictions = await Prediction.find({ application: { $in: applications.map(a => a._id) } });
    const predictionMap = {};
    predictions.forEach(p => { 
      predictionMap[String(p.application)] = p; 
    });

    if (prediction && prediction !== 'all') {
      applications = applications.filter(a => predictionMap[String(a._id)] && predictionMap[String(a._id)].prediction === prediction);
    }

    res.render('loan/history', {
      title: 'Application History — SmartLoan AI',
      applications,
      predictionMap,
      pagination: { currentPage, totalPages: Math.ceil(totalCount / perPage), totalCount },
      currentStatus: status || 'all',
      currentSort: sort || 'newest',
      filters: {
        applicationId: applicationId || '', 
        status: status || 'all', 
        prediction: prediction || 'all',
        sort: sort || 'newest', 
        minAmount: minAmount || '', 
        maxAmount: maxAmount || '',
        dateFrom: dateFrom || '', 
        dateTo: dateTo || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.applicationDetails = async (req, res, next) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application || String(application.user) !== req.session.user.id) {
      return res.redirect('/loan/history');
    }

    const prediction = await Prediction.findOne({ application: application._id }).sort({ createdAt: -1 });
    const reviewDecision = await ReviewDecision.findOne({ application: application._id }).sort({ createdAt: -1 });

    res.render('loan/details', { 
      title: `Application ${application.applicationId} — SmartLoan AI`, 
      application, 
      prediction,
      reviewDecision
    });
  } catch (err) {
    next(err);
  }
};

/* ============ REPORT DOWNLOAD (creates metadata record each time) ============ */
exports.downloadReport = async (req, res, next) => {
  try {
    const prediction = await Prediction.findById(req.params.id).populate('application');
    if (!prediction || String(prediction.user) !== req.session.user.id) {
      return res.redirect('/loan/dashboard');
    }

    const user = await User.findById(req.session.user.id);
    const report = await createReportRecord({ application: prediction.application, prediction, user });

    await logActivity(req.session.user.id, 'Report Downloaded', report.reportId);

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;

    await notify(
      req.session.user.id, 
      `Report ready for download — ${prediction.application.applicationId} (${report.reportId})`, 
      'success', 
      `/loan/application/${prediction.application._id}`
    );

    if (user && user.preferences && user.preferences.emailNotifications) {
      sendReportReadyEmail(user.email, prediction.application.applicationId, report.reportId);
    }

    await generateReportPDF(res, { application: prediction.application, prediction, report, baseUrl });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// EMI Calculator Controllers
// ==========================================

exports.getCalculator = (req, res) => {
  res.render('loan/calculator', { title: 'EMI Calculator — SmartLoan AI' });
};

exports.calculateEMIRoute = (req, res) => {
  const { loanAmount, interestRate, tenure } = req.body;
  const principal = Number(loanAmount);
  const rate = Number(interestRate);
  const months = Number(tenure);

  if (!principal || !rate || !months || principal <= 0 || rate <= 0 || months <= 0) {
    return res.status(400).json({ error: 'Invalid input values' });
  }

  const emi = calculateEMI(principal, rate, months);
  const totalRepayment = emi * months;
  const totalInterest = totalRepayment - principal;

  res.json({
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalRepayment: Math.round(totalRepayment)
  });
};

// ==========================================
// Notifications Controllers
// ==========================================

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.session.user.id }).sort({ createdAt: -1 }).limit(15);
    const unreadCount = await Notification.countDocuments({ user: req.session.user.id, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.session.user.id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.notificationHistory = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { user: req.session.user.id };
    if (status === 'unread') filter.read = false;
    if (status === 'read') filter.read = true;

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
    res.render('loan/notifications', {
      title: 'Notifications — SmartLoan AI',
      notifications,
      filterStatus: status || 'all'
    });
  } catch (err) {
    console.error(err);
    res.redirect('/loan/dashboard');
  }
};

exports.markSingleNotificationRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, user: req.session.user.id }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// User Profile & Settings Controllers
// ==========================================

exports.profile = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    const totalApplications = await LoanApplication.countDocuments({ user: user._id, isDraft: false });
    res.render('user/profile', {
      title: 'Profile — SmartLoan AI',
      profileUser: user,
      totalApplications,
      updated: req.query.updated,
      pwUpdated: req.query.pwUpdated,
      pwError: req.query.pwError
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, city, state, pincode, emailNotifications, darkMode } = req.body;
    await User.findByIdAndUpdate(req.session.user.id, {
      fullName, phone, address, city, state, pincode,
      preferences: { emailNotifications: emailNotifications === 'on', darkMode: darkMode === 'on' }
    });
    req.session.user.fullName = fullName;

    await logActivity(req.session.user.id, 'Profile Updated', '');

    res.redirect('/loan/profile?updated=1');
  } catch (e) {
    console.error(e);
    res.redirect('/loan/profile?error=1');
  }
};

exports.uploadPicture = async (req, res) => {
  try {
    if (!req.file) return res.redirect('/loan/profile?error=nofile');

    const user = await User.findById(req.session.user.id);

    if (user.profilePicture) {
      const oldPath = path.join(__dirname, '..', 'public', user.profilePicture);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profilePicture = `/uploads/profile-pictures/${req.file.filename}`;
    await user.save();

    res.redirect('/loan/profile?updated=1');
  } catch (e) {
    console.error(e);
    res.redirect('/loan/profile?error=1');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.session.user.id);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.redirect('/loan/profile?pwError=current');

    if (newPassword !== confirmNewPassword) return res.redirect('/loan/profile?pwError=match');
    if (newPassword.length < 6) return res.redirect('/loan/profile?pwError=length');

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logActivity(user._id, 'Password Changed', '');

    res.redirect('/loan/profile?pwUpdated=1');
  } catch (e) {
    console.error(e);
    res.redirect('/loan/profile?pwError=unknown');
  }
};

exports.settings = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('user/settings', {
      title: 'Settings — SmartLoan AI',
      profileUser: user,
      updated: req.query.updated
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// What-If Simulator & Scenario Controllers
// ==========================================

exports.getSimulator = async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.predictionId).populate('application');
    if (!prediction || String(prediction.user) !== req.session.user.id) return res.redirect('/loan/dashboard');

    const scenarios = await Scenario.find({ basePrediction: prediction._id }).sort({ createdAt: -1 });

    res.render('loan/simulator', {
      title: 'What-If Simulator — SmartLoan AI',
      prediction, application: prediction.application, scenarios
    });
  } catch (err) {
    console.error(err);
    res.redirect('/loan/dashboard');
  }
};

exports.runSimulation = async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.predictionId).populate('application');
    if (!prediction || String(prediction.user) !== req.session.user.id) {
      return res.status(404).json({ error: 'Not found' });
    }

    const overrides = {};
    if (req.body.loanAmount) overrides.loanAmount = Number(req.body.loanAmount);
    if (req.body.monthlyIncome) overrides.monthlyIncome = Number(req.body.monthlyIncome);
    if (req.body.monthlyExpenses) overrides.monthlyExpenses = Number(req.body.monthlyExpenses);
    if (req.body.loanTenure) overrides.loanTenure = Number(req.body.loanTenure);
    if (req.body.employmentType) overrides.employmentType = req.body.employmentType;
    if (req.body.coApplicantIncome !== undefined) overrides.coApplicantIncome = Number(req.body.coApplicantIncome);
    if (req.body.existingEMI !== undefined) overrides.existingEMI = Number(req.body.existingEMI);

    const baseData = prediction.application.toObject();
    const result = await simulatePrediction(baseData, overrides);

    const mergedForCalc = { ...baseData, ...overrides };
    const simulatedEMI = Math.round(calculateEMI(mergedForCalc.loanAmount, 10.5, mergedForCalc.loanTenure));
    const simulatedDTI = calculateDTI(mergedForCalc.monthlyIncome, mergedForCalc.coApplicantIncome, mergedForCalc.existingEMI);

    res.json({
      prediction: result.prediction,
      probability: result.probability,
      interpretation: result.interpretation,
      simulatedEMI,
      simulatedDTI,
      overrides
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Simulation failed' });
  }
};

exports.saveScenario = async (req, res) => {
  try {
    const { predictionId, label, changedInputs, simulatedPrediction, simulatedProbability, simulatedEMI, simulatedDTI } = req.body;

    const scenario = await Scenario.create({
      user: req.session.user.id,
      basePrediction: predictionId,
      label: label || 'Untitled Scenario',
      changedInputs: typeof changedInputs === 'string' ? JSON.parse(changedInputs) : changedInputs,
      simulatedPrediction, simulatedProbability, simulatedEMI, simulatedDTI
    });

    res.json({ success: true, scenario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

exports.deleteScenario = async (req, res) => {
  try {
    await Scenario.deleteOne({ _id: req.params.id, user: req.session.user.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

/* ============ USER ACTIVITY DASHBOARD ============ */
exports.activityPage = async (req, res) => {
  try {
    const activities = await ActivityLog.find({ user: req.session.user.id }).sort({ timestamp: -1 }).limit(100);
    res.render('loan/activity', { title: 'Account Activity — SmartLoan AI', activities });
  } catch (err) {
    console.error(err);
    res.redirect('/loan/dashboard');
  }
};