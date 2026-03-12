const express = require('express');
const router = express.Router();
const {
    getAgentDashboard,
    logCallAction,
    assignOrders,
    getManagerAnalytics,
    getOrderCallHistory
} = require('../controllers/callCenterController');
const { protect, requirePermission, authorizeRoles } = require('../middleware/authMiddleware');

// Agent Routes
router.get('/agent-dashboard', protect, requirePermission('overview.read'), getAgentDashboard);
router.post('/log-call', protect, requirePermission('overview.read'), logCallAction);
router.get('/calls/:orderId', protect, requirePermission('overview.read'), getOrderCallHistory);

// Manager / Admin Routes
router.post('/assign-orders', protect, requirePermission('overview.read'), assignOrders);
router.get('/manager-analytics', protect, requirePermission('overview.read'), getManagerAnalytics);

module.exports = router;
