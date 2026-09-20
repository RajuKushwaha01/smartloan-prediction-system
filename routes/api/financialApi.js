const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/financialApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/emi/calculate', apiRequireAuth, asyncHandler(ctrl.calculateEmi));
router.post('/recommendation', apiRequireAuth, asyncHandler(ctrl.recommendation));
router.post('/scenario', apiRequireAuth, asyncHandler(ctrl.scenario));
router.get('/financial-health/:applicationId', apiRequireAuth, asyncHandler(ctrl.financialHealth));

module.exports = router;