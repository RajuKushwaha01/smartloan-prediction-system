const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const requireAuth = require('../middleware/auth');
const { loanApplicationRules } = require('../middleware/validators');
const { uploadProfilePicture } = require('../services/uploadService');
const asyncHandler = require('../utils/asyncHandler');
const { verifyCsrfAfterMulter } = require('../middleware/csrf');


router.get('/dashboard', requireAuth, asyncHandler(loanController.dashboard));

router.get('/apply', requireAuth, asyncHandler(loanController.getApplyForm));
router.post('/apply', requireAuth, loanApplicationRules, asyncHandler(loanController.postApply));
router.get('/analyze/:id', requireAuth, asyncHandler(loanController.analyzeScreen));
router.post('/predict/:id', requireAuth, asyncHandler(loanController.runPrediction));
router.get('/result/:id', requireAuth, asyncHandler(loanController.result));

router.get('/history', requireAuth, asyncHandler(loanController.history));
router.get('/application/:id', requireAuth, asyncHandler(loanController.applicationDetails));

router.get('/profile', requireAuth, asyncHandler(loanController.profile));
router.post('/profile/update', requireAuth, asyncHandler(loanController.updateProfile));

router.post(
  '/profile/picture',
  requireAuth,
  uploadProfilePicture.single('profilePicture'),
  verifyCsrfAfterMulter,
  asyncHandler(loanController.uploadPicture)
);

router.post('/profile/password', requireAuth, asyncHandler(loanController.changePassword));

router.get('/settings', requireAuth, asyncHandler(loanController.settings));

router.get('/report/:id', requireAuth, asyncHandler(loanController.downloadReport));

router.get('/notifications', requireAuth, asyncHandler(loanController.getNotifications));
router.post('/notifications/read', requireAuth, asyncHandler(loanController.markNotificationsRead));

router.post('/apply/draft', requireAuth, asyncHandler(loanController.saveDraft));
router.post('/apply/draft/:id/delete', requireAuth, asyncHandler(loanController.deleteDraft));

router.get('/calculator', requireAuth, asyncHandler(loanController.getCalculator));
router.post('/calculator/compute', requireAuth, asyncHandler(loanController.calculateEMIRoute));

router.get('/simulate/:predictionId', requireAuth, asyncHandler(loanController.getSimulator));
router.post('/simulate/:predictionId/run', requireAuth, asyncHandler(loanController.runSimulation));
router.post('/simulate/scenario/save', requireAuth, asyncHandler(loanController.saveScenario));
router.post('/simulate/scenario/:id/delete', requireAuth, asyncHandler(loanController.deleteScenario));
router.get('/notifications/history', requireAuth, asyncHandler(loanController.notificationHistory));
router.post('/notifications/:id/read', requireAuth, asyncHandler(loanController.markSingleNotificationRead));
router.get('/activity', requireAuth, asyncHandler(loanController.activityPage));

router.get('/language/:lang', (req, res) => {
  const supported = ['en', 'hi', 'te'];
  if (supported.includes(req.params.lang)) req.session.lang = req.params.lang;
  res.redirect(req.get('Referrer') || '/');
});


module.exports = router;