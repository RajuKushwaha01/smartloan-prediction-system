const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/mlAdminApiController');
const { apiRequireAuth, apiRequireAdmin } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/model/train', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.trainModel));
router.get('/model/compare', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.compareModels));
router.get('/model/versions', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.versions));
router.get('/model/experiments', apiRequireAuth, apiRequireAdmin, asyncHandler(ctrl.experiments));

module.exports = router;