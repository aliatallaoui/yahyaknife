const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);

router.get('/metrics', requirePermission(PERMS.OVERVIEW_READ), dashboardController.getDashboardData);

module.exports = router;
