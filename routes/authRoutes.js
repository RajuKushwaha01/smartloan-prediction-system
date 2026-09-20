const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules } = require('../middleware/validators');
const asyncHandler = require('../utils/asyncHandler');

router.get('/register', asyncHandler(authController.getRegister));
router.post('/register', registerRules, asyncHandler(authController.postRegister));
router.get('/login', asyncHandler(authController.getLogin));
router.post('/login', loginRules, asyncHandler(authController.postLogin));
router.get('/logout', asyncHandler(authController.logout));
router.get('/forgot-password', asyncHandler(authController.getForgotPassword));
router.post('/forgot-password', forgotPasswordRules, asyncHandler(authController.postForgotPassword));
router.get('/reset-password/:token', asyncHandler(authController.getResetPassword));
router.post('/reset-password/:token', resetPasswordRules, asyncHandler(authController.postResetPassword));

module.exports = router;