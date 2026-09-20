const express = require('express');
const router = express.Router();

const authApi = require('./authApi');
const userApi = require('./userApi');
const loansApi = require('./loansApi');
const predictionApi = require('./predictionApi');
const financialApi = require('./financialApi');
const reportsApi = require('./reportsApi');
const notificationsApi = require('./notificationsApi');
const adminApi = require('./adminApi');
const mlAdminApi = require('./mlAdminApi');

const predictionApiController = require('../../controllers/api/predictionApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.use('/auth', authApi);
router.use('/user', userApi);
router.use('/loans', loansApi);

router.use('/predictions', predictionApi);
router.post('/predict', apiRequireAuth, asyncHandler(predictionApiController.predict));

router.use('/', financialApi);
router.use('/reports', reportsApi);
router.use('/notifications', notificationsApi);
router.use('/admin', adminApi);
router.use('/admin', mlAdminApi);

module.exports = router;