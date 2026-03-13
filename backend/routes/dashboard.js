const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);

const wrap = require('../shared/middleware/asyncHandler');
router.get('/metrics', requirePermission(PERMS.OVERVIEW_READ), wrap(dashboardController.getDashboardData));
router.get('/setup-progress', wrap(dashboardController.getSetupProgress));

module.exports = router;
