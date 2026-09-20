const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/userApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.get('/profile', apiRequireAuth, asyncHandler(ctrl.getProfile));
router.put('/profile', apiRequireAuth, asyncHandler(ctrl.updateProfile));
router.put('/password', apiRequireAuth, asyncHandler(ctrl.updatePassword));
router.get('/activity', apiRequireAuth, asyncHandler(ctrl.getActivity));

module.exports = router;