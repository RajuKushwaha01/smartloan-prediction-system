const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/api/notificationsApiController');
const { apiRequireAuth } = require('../../middleware/apiAuth');
const asyncHandler = require('../../utils/asyncHandler');

router.get('/', apiRequireAuth, asyncHandler(ctrl.list));
router.put('/:id/read', apiRequireAuth, asyncHandler(ctrl.markRead));
router.put('/read-all', apiRequireAuth, asyncHandler(ctrl.markAllRead));

module.exports = router;