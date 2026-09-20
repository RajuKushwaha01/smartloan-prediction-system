const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');

router.get('/:reportId', asyncHandler(async (req, res) => {
  const report = await Report.findOne({ reportId: req.params.reportId })
    .populate('application', 'applicationId')
    .populate('user', 'fullName');

  res.render('verify/result', {
    title: `Verify ${req.params.reportId} — SmartLoan AI`,
    report,
    found: !!report
  });
}));

module.exports = router;