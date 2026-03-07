const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// /api/sales/orders
router.route('/orders')
    .get(salesController.getOrders)
    .post(salesController.createOrder);

router.route('/orders/:id')
    .put(salesController.updateOrder)
    .delete(salesController.deleteOrder);

// /api/sales/performance
router.get('/performance', salesController.getSalesPerformance);

module.exports = router;
