const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerOrders,
    getCustomerMetrics,
    getFeedback,
    lookupCustomerByPhone
} = require('../controllers/customerController');

router.route('/')
    .get(protect, requirePermission('customers.view'), getCustomers)
    .post(protect, requirePermission('customers.edit'), createCustomer);

router.get('/lookup', protect, requirePermission('customers.view'), lookupCustomerByPhone);

router.route('/:id')
    .put(protect, requirePermission('customers.edit'), updateCustomer)
    .delete(protect, requirePermission('customers.edit'), deleteCustomer);

router.route('/:id/orders')
    .get(protect, requirePermission('customers.view'), getCustomerOrders);

router.get('/metrics', protect, requirePermission('customers.view'), getCustomerMetrics);
router.get('/feedback', protect, requirePermission('customers.view'), getFeedback);

module.exports = router;
