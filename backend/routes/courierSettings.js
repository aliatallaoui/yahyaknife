const express = require('express');
const router = express.Router();
const courierSettingsController = require('../controllers/courierSettingsController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.get('/', protect, requirePermission(PERMS.COURIERS_VIEW), courierSettingsController.getSettings);
router.put('/', protect, requirePermission(PERMS.COURIERS_API_CONNECT), courierSettingsController.updateSettings);

module.exports = router;
