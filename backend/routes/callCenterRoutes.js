const express = require('express');
const router = express.Router();
const {
    getAgentDashboard,
    logCallAction,
    assignOrders,
    getManagerAnalytics,
    getOrderCallHistory
} = require('../controllers/callCenterController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

// Agent Routes
router.get('/agent-dashboard', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getAgentDashboard);
router.post('/log-call', protect, requirePermission(PERMS.CALLCENTER_PROCESS), logCallAction);
router.get('/calls/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getOrderCallHistory);

// Manager / Admin Routes
router.post('/assign-orders', protect, requirePermission(PERMS.CALLCENTER_MANAGE_ASSIGNMENTS), assignOrders);
router.get('/manager-analytics', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getManagerAnalytics);

module.exports = router;
