const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const { checkPlanLimit } = require('../middleware/planLimits');
const wrap = require('../shared/middleware/asyncHandler');

// Setup global protection for all sales routes (provides req.user and enforces tenant security)
router.use(protect);

// /api/sales/orders
router.route('/orders')
    .get(requirePermission(PERMS.ORDERS_VIEW), wrap(salesController.getOrders))
    .post(requirePermission(PERMS.ORDERS_CREATE), checkPlanLimit('orders'), wrap(salesController.createOrder));

// /api/sales/orders/advanced
router.get('/orders/advanced', requirePermission(PERMS.ORDERS_VIEW), wrap(salesController.getAdvancedOrders));

// /api/sales/orders/operations-kpi
router.get('/orders/operations-kpi', requirePermission(PERMS.ORDERS_VIEW), wrap(salesController.getOrdersKPIs));

// /api/sales/orders/bulk/update
router.post('/orders/bulk/update', requirePermission(PERMS.ORDERS_BULK), wrap(salesController.updateBulkOrders));

// /api/sales/orders/bulk/delete  (soft delete → trash)
router.post('/orders/bulk/delete', requirePermission(PERMS.ORDERS_DELETE), wrap(salesController.bulkDeleteOrders));

// /api/sales/orders/bulk/restore  (restore from trash)
router.post('/orders/bulk/restore', requirePermission(PERMS.ORDERS_RESTORE), wrap(salesController.restoreOrders));

// /api/sales/orders/bulk/purge  (permanent delete from trash)
router.post('/orders/bulk/purge', requirePermission(PERMS.ORDERS_PURGE), wrap(salesController.purgeOrders));

// /api/sales/orders/sync-ecotrack
router.post('/orders/sync-ecotrack', requirePermission(PERMS.ORDERS_BULK), wrap(salesController.triggerEcotrackSync));

router.route('/orders/:id')
    .put(requirePermission(PERMS.ORDERS_EDIT), wrap(salesController.updateOrder))
    .delete(requirePermission(PERMS.ORDERS_DELETE), wrap(salesController.deleteOrder));

// /api/sales/performance
router.get('/performance', requirePermission(PERMS.ORDERS_VIEW), wrap(salesController.getSalesPerformance));

module.exports = router;
