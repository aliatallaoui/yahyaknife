const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

// Setup global protection for all sales routes (provides req.user and enforces tenant security)
router.use(protect);

// /api/sales/orders
router.route('/orders')
    .get(requirePermission('orders.view'), salesController.getOrders)
    .post(requirePermission('orders.create'), salesController.createOrder);

// /api/sales/orders/advanced
router.get('/orders/advanced', requirePermission('orders.view'), salesController.getAdvancedOrders);

// /api/sales/orders/operations-kpi
router.get('/orders/operations-kpi', requirePermission('orders.view'), salesController.getOrdersKPIs);

// /api/sales/orders/bulk/update
router.post('/orders/bulk/update', requirePermission('orders.bulk'), salesController.updateBulkOrders);

// /api/sales/orders/bulk/delete  (soft delete → trash)
router.post('/orders/bulk/delete', requirePermission('orders.delete'), salesController.bulkDeleteOrders);

// /api/sales/orders/bulk/restore  (restore from trash)
router.post('/orders/bulk/restore', requirePermission('orders.restore'), salesController.restoreOrders);

// /api/sales/orders/bulk/purge  (permanent delete from trash)
router.post('/orders/bulk/purge', requirePermission('orders.purge'), salesController.purgeOrders);

// /api/sales/orders/sync-ecotrack
router.post('/orders/sync-ecotrack', requirePermission('orders.bulk'), salesController.triggerEcotrackSync);

router.route('/orders/:id')
    .put(requirePermission('orders.edit'), salesController.updateOrder)
    .delete(requirePermission('orders.delete'), salesController.deleteOrder);

// /api/sales/performance
router.get('/performance', requirePermission('orders.view'), salesController.getSalesPerformance);

module.exports = router;
