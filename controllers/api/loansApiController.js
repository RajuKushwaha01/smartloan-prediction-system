const LoanApplication = require('../../models/LoanApplication');
const { generateApplicationId, calculateDTI } = require('../../utils/helpers');
const { runDataQualityChecks } = require('../../services/dataQualityService');
const { detectAnomalies } = require('../../services/anomalyService');
const { pushStage } = require('../../utils/workflowStages');
const { logActivity } = require('../../services/activityService');

exports.create = async (req, res) => {
  const body = req.body;
  const monthlyIncome = Number(body.monthlyIncome) || (Number(body.annualIncome) / 12);
  const coApplicantIncome = Number(body.coApplicantIncome) || 0;
  const existingEMI = Number(body.existingEMI) || 0;

  const data = {
    ...body,
    monthlyIncome, coApplicantIncome, existingEMI,
    debtToIncomeRatio: calculateDTI(monthlyIncome, coApplicantIncome, existingEMI),
    isDraft: body.isDraft === true, status: body.isDraft ? 'Draft' : 'Pending'
  };

  const quality = runDataQualityChecks(data);
  if (!quality.passed && !body.isDraft) return res.status(400).json({ error: quality.issues[0], issues: quality.issues });

  const application = await LoanApplication.create({
    ...data, user: req.session.user.id, applicationId: generateApplicationId()
  });

  res.status(201).json({ success: true, application });
};

exports.list = async (req, res) => {
  const applications = await LoanApplication.find({ user: req.session.user.id, isDraft: false }).sort({ createdAt: -1 });
  res.json({ applications });
};

exports.getOne = async (req, res) => {
  const application = await LoanApplication.findOne({ _id: req.params.id, user: req.session.user.id });
  if (!application) return res.status(404).json({ error: 'Not found' });
  res.json({ application });
};

exports.update = async (req, res) => {
  const application = await LoanApplication.findOneAndUpdate(
    { _id: req.params.id, user: req.session.user.id, status: { $ne: 'Analyzed' } },
    req.body, { new: true }
  );
  if (!application) return res.status(404).json({ error: 'Not found or already analyzed' });
  res.json({ success: true, application });
};

exports.remove = async (req, res) => {
  const result = await LoanApplication.deleteOne({ _id: req.params.id, user: req.session.user.id, isDraft: true });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Draft not found' });
  res.json({ success: true });
};

exports.submit = async (req, res) => {
  const application = await LoanApplication.findOne({ _id: req.params.id, user: req.session.user.id });
  if (!application) return res.status(404).json({ error: 'Not found' });

  application.isDraft = false;
  application.status = 'Pending';
  await application.save();
  await pushStage(application, 'Submitted');
  await pushStage(application, 'Validation');

  const anomalyFlags = await detectAnomalies(application.toObject(), req.session.user.id);
  if (anomalyFlags.length > 0) { application.anomalyFlags.push(...anomalyFlags); await application.save(); }

  await logActivity(req.session.user.id, 'Application Submitted', application.applicationId);

  const io = req.app.locals.io;
  if (io) io.to('admins').emit('new_application', { applicationId: application.applicationId, applicant: application.fullName, loanAmount: application.loanAmount, timestamp: new Date() });

  res.json({ success: true, application });
};