const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

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

router.route('/orders/:id')
    .put(salesController.updateOrder)
    .delete(salesController.deleteOrder);

// /api/sales/performance
router.get('/performance', salesController.getSalesPerformance);

module.exports = router;
