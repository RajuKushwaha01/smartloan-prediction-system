const Prediction = require('../../models/Prediction');
const User = require('../../models/User');
const Report = require('../../models/Report');
const { createReportRecord } = require('../../services/reportService');
const { logActivity } = require('../../services/activityService');

exports.generate = async (req, res) => {
  const prediction = await Prediction.findOne({ application: req.params.applicationId, user: req.session.user.id }).populate('application').sort({ createdAt: -1 });
  if (!prediction) return res.status(404).json({ error: 'No prediction found for this application' });

  const user = await User.findById(req.session.user.id);
  const report = await createReportRecord({ application: prediction.application, prediction, user });
  await logActivity(req.session.user.id, 'Report Downloaded', report.reportId);

  res.status(201).json({
    success: true,
    reportId: report.reportId,
    downloadUrl: `/loan/report/${prediction._id}`,
    verifyUrl: `/verify/${report.reportId}`
  });
};

exports.getOne = async (req, res) => {
  const report = await Report.findOne({ reportId: req.params.id });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ report });
};