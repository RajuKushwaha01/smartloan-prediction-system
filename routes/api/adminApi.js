const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/adminApiController');
const { apiRequireAuth, apiRequireAdmin } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.get('/dashboard', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.dashboard));
router.get('/users', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.users));
router.get('/applications', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.applications));
router.get('/analytics', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.analytics));
router.get('/predictions', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.predictions));
router.get('/models', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.models));
router.get('/datasets', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.datasets));
router.get('/experiments', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.experiments));
router.get('/audit-logs', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.auditLogs));
router.get('/security-events', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.securityEvents));
router.get('/system-health', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.systemHealth));

module.exports = router;