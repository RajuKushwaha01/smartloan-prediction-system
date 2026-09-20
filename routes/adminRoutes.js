const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const asyncHandler = require('../utils/asyncHandler');

router.get('/dashboard', requireAuth, requireAdmin, asyncHandler(adminController.dashboard));
router.get('/analytics', requireAuth, requireAdmin, asyncHandler(adminController.analytics));
router.get('/prediction-monitoring', requireAuth, requireAdmin, asyncHandler(adminController.predictionMonitoring));

router.get('/users', requireAuth, requireAdmin, asyncHandler(adminController.usersList));
router.post('/users/:id/toggle-status', requireAuth, requireAdmin, asyncHandler(adminController.toggleUserStatus));
router.post('/users/:id/role', requireAuth, requireAdmin, asyncHandler(adminController.changeUserRole));

router.get('/applications', requireAuth, requireAdmin, asyncHandler(adminController.applicationsList));
router.get('/applications/:id', requireAuth, requireAdmin, asyncHandler(adminController.applicationDetail));
router.post('/applications/:id/status', requireAuth, requireAdmin, asyncHandler(adminController.updateWorkflowStatus));
router.post('/applications/:id/note', requireAuth, requireAdmin, asyncHandler(adminController.addNote));

router.get('/predictions', requireAuth, requireAdmin, asyncHandler(adminController.predictionsList));

router.get('/review-queue', requireAuth, requireAdmin, asyncHandler(adminController.reviewQueue));
router.post('/review-queue/:id/decide', requireAuth, requireAdmin, asyncHandler(adminController.submitReview));

router.get('/explainability', requireAuth, requireAdmin, asyncHandler(adminController.globalExplainability));

router.get('/model-lab', requireAuth, requireAdmin, asyncHandler(adminController.modelLab));
router.get('/model', requireAuth, requireAdmin, asyncHandler(adminController.modelInfo));
router.get('/model-registry', requireAuth, requireAdmin, asyncHandler(adminController.modelRegistryList));
router.get('/dataset-management', requireAuth, requireAdmin, asyncHandler(adminController.datasetManagement));
router.get('/experiment-tracking', requireAuth, requireAdmin, asyncHandler(adminController.experimentTracking));
router.get('/retraining', requireAuth, requireAdmin, asyncHandler(adminController.retrainingWorkflow));
router.post('/retraining/approve', requireAuth, requireAdmin, asyncHandler(adminController.approveAndRegisterModel));
router.get('/fairness', requireAuth, requireAdmin, asyncHandler(adminController.fairnessAnalysis));

router.get('/audit-logs', requireAuth, requireAdmin, asyncHandler(adminController.auditLogs));
router.get('/security', requireAuth, requireAdmin, asyncHandler(adminController.security));
router.get('/system-health', requireAuth, requireAdmin, asyncHandler(adminController.systemHealth));

router.get('/settings', requireAuth, requireAdmin, asyncHandler(adminController.getSettings));
router.post('/settings/update', requireAuth, requireAdmin, asyncHandler(adminController.updateSettings));
router.post('/settings/password', requireAuth, requireAdmin, asyncHandler(adminController.changeAdminPassword));

router.get('/reports', requireAuth, requireAdmin, asyncHandler(adminController.reportsCenter));
router.get('/reports/pdf', requireAuth, requireAdmin, asyncHandler(adminController.downloadAdminReportPDF));
router.get('/reports/excel', requireAuth, requireAdmin, asyncHandler(adminController.downloadAdminReportExcel));

router.get('/export/csv', requireAuth, requireAdmin, asyncHandler(adminController.exportCSV));
router.get('/export/excel', requireAuth, requireAdmin, asyncHandler(adminController.exportExcel));

module.exports = router;