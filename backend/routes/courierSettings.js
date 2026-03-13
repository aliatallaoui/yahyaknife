const express = require('express');
const router = express.Router();
const courierSettingsController = require('../controllers/courierSettingsController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

const wrap = require('../shared/middleware/asyncHandler');
router.get('/', protect, requirePermission(PERMS.COURIERS_VIEW), wrap(courierSettingsController.getSettings));
router.put('/', protect, requirePermission(PERMS.COURIERS_API_CONNECT), wrap(courierSettingsController.updateSettings));

module.exports = router;
