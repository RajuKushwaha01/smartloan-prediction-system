const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/predictionApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/', apiRequireAuth, asyncHandler(ctrl.predict));
router.get('/:id', apiRequireAuth, asyncHandler(ctrl.getOne));

module.exports = router;