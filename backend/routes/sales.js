const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

// Setup global protection for all sales routes (provides req.user and enforces tenant security)
router.use(protect);

// /api/sales/orders
router.route('/orders')
    .get(salesController.getOrders)
    .post(salesController.createOrder);

// /api/sales/orders/advanced
router.get('/orders/advanced', salesController.getAdvancedOrders);

// /api/sales/orders/operations-kpi
router.get('/orders/operations-kpi', salesController.getOrdersKPIs);

// /api/sales/orders/bulk/update
router.post('/orders/bulk/update', salesController.updateBulkOrders);

// /api/sales/orders/bulk/delete  (soft delete → trash)
router.post('/orders/bulk/delete', salesController.bulkDeleteOrders);

// /api/sales/orders/bulk/restore  (restore from trash)
router.post('/orders/bulk/restore', salesController.restoreOrders);

// /api/sales/orders/bulk/purge  (permanent delete from trash)
router.post('/orders/bulk/purge', salesController.purgeOrders);

// /api/sales/orders/sync-ecotrack
router.post('/orders/sync-ecotrack', salesController.triggerEcotrackSync);

router.route('/orders/:id')
    .put(salesController.updateOrder)
    .delete(salesController.deleteOrder);

// /api/sales/performance
router.get('/performance', salesController.getSalesPerformance);

module.exports = router;
