const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerOrders,
    getCustomerMetrics,
    getFeedback
} = require('../controllers/customerController');

router.route('/')
    .get(protect, getCustomers)
    .post(protect, createCustomer);

router.route('/:id')
    .put(protect, updateCustomer)
    .delete(protect, deleteCustomer);

router.route('/:id/orders')
    .get(protect, getCustomerOrders);

router.get('/metrics', protect, getCustomerMetrics);
router.get('/feedback', protect, getFeedback);

module.exports = router;
