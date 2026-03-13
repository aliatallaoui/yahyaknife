const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');
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
    .get(protect, requirePermission(PERMS.CUSTOMERS_VIEW), paginate, getCustomers)
    .post(protect, requirePermission(PERMS.CUSTOMERS_EDIT), createCustomer);

router.get('/lookup', protect, requirePermission(PERMS.CUSTOMERS_VIEW), lookupCustomerByPhone);

router.route('/:id')
    .put(protect, requirePermission(PERMS.CUSTOMERS_EDIT), updateCustomer)
    .delete(protect, requirePermission(PERMS.CUSTOMERS_EDIT), deleteCustomer);

router.route('/:id/orders')
    .get(protect, requirePermission(PERMS.CUSTOMERS_VIEW), paginate, getCustomerOrders);

router.get('/metrics', protect, requirePermission(PERMS.CUSTOMERS_VIEW), getCustomerMetrics);
router.get('/feedback', protect, requirePermission(PERMS.CUSTOMERS_VIEW), getFeedback);

module.exports = router;
