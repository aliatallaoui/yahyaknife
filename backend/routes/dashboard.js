const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/metrics', requirePermission('overview.read'), dashboardController.getDashboardData);

module.exports = router;
