const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/authApiController');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules } = require('../../middleware/validators');
const asyncHandler = require('../../utils/asyncHandler');

router.post('/register', registerRules, asyncHandler(ctrl.register));
router.post('/login', loginRules, asyncHandler(ctrl.login));
router.post('/logout', asyncHandler(ctrl.logout));
router.post('/forgot-password', forgotPasswordRules, asyncHandler(ctrl.forgotPassword));
router.post('/reset-password/:token', resetPasswordRules, asyncHandler(ctrl.resetPassword));

module.exports = router;