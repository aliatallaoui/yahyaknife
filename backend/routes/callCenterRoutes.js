const express = require('express');
const router = express.Router();
const {
    getAgentDashboard,
    logCallAction,
    assignOrders,
    getManagerAnalytics,
    getOrderCallHistory,
    getOrderIntel,
    getManagerOperations,
    getCallCenterAnalytics,
    getSupervisorQueue,
    getBestTimeToCall,
    bulkUpdateOrders,
    lockOrder,
    unlockOrder,
    getAgentPerformanceDetail,
    sendCustomerMessage,
    getMessageTemplates,
    quickDispatchOrder,
    getOrderTracking,
    getFollowUpQueue,
} = require('../controllers/callCenterController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

// Agent Routes
router.get('/agent-dashboard', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getAgentDashboard);
router.post('/log-call', protect, requirePermission(PERMS.CALLCENTER_PROCESS), logCallAction);
router.get('/calls/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getOrderCallHistory);
router.get('/order-intel/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getOrderIntel);
router.post('/order/:id/lock', protect, requirePermission(PERMS.CALLCENTER_PROCESS), lockOrder);
router.post('/order/:id/unlock', protect, requirePermission(PERMS.CALLCENTER_PROCESS), unlockOrder);
router.post('/send-message', protect, requirePermission(PERMS.CALLCENTER_PROCESS), sendCustomerMessage);
router.get('/message-templates', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getMessageTemplates);
router.post('/quick-dispatch/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), quickDispatchOrder);
router.get('/tracking/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getOrderTracking);
router.get('/follow-up-queue', protect, requirePermission(PERMS.CALLCENTER_PROCESS), getFollowUpQueue);

// Manager / Admin Routes
router.post('/assign-orders', protect, requirePermission(PERMS.CALLCENTER_MANAGE_ASSIGNMENTS), assignOrders);
router.get('/manager-analytics', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getManagerAnalytics);
router.get('/agent-performance/:agentId', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getAgentPerformanceDetail);
router.get('/manager-operations', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getManagerOperations);
router.get('/analytics', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getCallCenterAnalytics);
router.get('/supervisor-queue', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getSupervisorQueue);
router.get('/best-time-to-call', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), getBestTimeToCall);
router.post('/bulk-update', protect, requirePermission(PERMS.CALLCENTER_MANAGE_ASSIGNMENTS), bulkUpdateOrders);

module.exports = router;
