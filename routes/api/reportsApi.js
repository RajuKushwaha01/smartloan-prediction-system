const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/reportsApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/:applicationId', apiRequireAuth, asyncHandler(ctrl.generate));
router.get('/:id', apiRequireAuth, asyncHandler(ctrl.getOne));

module.exports = router;