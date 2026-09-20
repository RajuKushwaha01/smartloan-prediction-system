const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/loansApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/', apiRequireAuth, asyncHandler(ctrl.create));
router.get('/', apiRequireAuth, asyncHandler(ctrl.list));
router.get('/:id', apiRequireAuth, asyncHandler(ctrl.getOne));
router.put('/:id', apiRequireAuth, asyncHandler(ctrl.update));
router.delete('/:id', apiRequireAuth, asyncHandler(ctrl.remove));
router.post('/:id/submit', apiRequireAuth, asyncHandler(ctrl.submit));

module.exports = router;