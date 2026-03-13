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
    // Assignment engine endpoints
    getMyQueue,
    getUnassignedQueue,
    claimOrder,
    reassignOrder,
    getAssignmentHistory,
    getAssignmentRules,
    createAssignmentRule,
    updateAssignmentRule,
    deleteAssignmentRule,
    getAgentsList,
} = require('../controllers/callCenterController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const wrap = require('../shared/middleware/asyncHandler');

// Agent Routes
router.get('/agent-dashboard', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getAgentDashboard));
router.post('/log-call', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(logCallAction));
router.get('/calls/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getOrderCallHistory));
router.get('/order-intel/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getOrderIntel));
router.post('/order/:id/lock', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(lockOrder));
router.post('/order/:id/unlock', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(unlockOrder));
router.post('/send-message', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(sendCustomerMessage));
router.get('/message-templates', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getMessageTemplates));
router.post('/quick-dispatch/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(quickDispatchOrder));
router.get('/tracking/:orderId', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getOrderTracking));
router.get('/follow-up-queue', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getFollowUpQueue));

// Agents list (for dropdowns — any authenticated user in the tenant)
router.get('/agents', protect, wrap(getAgentsList));

// Assignment Engine — Agent Routes
router.get('/my-queue', protect, requirePermission(PERMS.CALLCENTER_PROCESS), wrap(getMyQueue));
router.get('/unassigned-queue', protect, requirePermission(PERMS.CALLCENTER_VIEW_UNASSIGNED), wrap(getUnassignedQueue));
router.post('/claim/:orderId', protect, requirePermission(PERMS.CALLCENTER_CLAIM_ORDERS), wrap(claimOrder));

// Manager / Admin Routes
router.post('/assign-orders', protect, requirePermission(PERMS.CALLCENTER_MANAGE_ASSIGNMENTS), wrap(assignOrders));
router.get('/manager-analytics', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getManagerAnalytics));
router.get('/agent-performance/:agentId', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getAgentPerformanceDetail));
router.get('/manager-operations', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getManagerOperations));
router.get('/analytics', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getCallCenterAnalytics));
router.get('/supervisor-queue', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getSupervisorQueue));
router.get('/best-time-to-call', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getBestTimeToCall));
router.post('/bulk-update', protect, requirePermission(PERMS.CALLCENTER_MANAGE_ASSIGNMENTS), wrap(bulkUpdateOrders));

// Assignment Engine — Manager Routes
router.post('/reassign', protect, requirePermission(PERMS.CALLCENTER_REASSIGN), wrap(reassignOrder));
router.get('/assignment-history/:orderId', protect, requirePermission(PERMS.CALLCENTER_VIEW_REPORTS), wrap(getAssignmentHistory));
router.get('/assignment-rules', protect, requirePermission(PERMS.CALLCENTER_MANAGE_RULES), wrap(getAssignmentRules));
router.post('/assignment-rules', protect, requirePermission(PERMS.CALLCENTER_MANAGE_RULES), wrap(createAssignmentRule));
router.put('/assignment-rules/:id', protect, requirePermission(PERMS.CALLCENTER_MANAGE_RULES), wrap(updateAssignmentRule));
router.delete('/assignment-rules/:id', protect, requirePermission(PERMS.CALLCENTER_MANAGE_RULES), wrap(deleteAssignmentRule));

module.exports = router;
