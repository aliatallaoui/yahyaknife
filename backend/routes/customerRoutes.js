const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');
const wrap = require('../shared/middleware/asyncHandler');
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
    .get(protect, requirePermission(PERMS.CUSTOMERS_VIEW), paginate, wrap(getCustomers))
    .post(protect, requirePermission(PERMS.CUSTOMERS_EDIT), wrap(createCustomer));

router.get('/lookup', protect, requirePermission(PERMS.CUSTOMERS_VIEW), wrap(lookupCustomerByPhone));

router.route('/:id')
    .put(protect, requirePermission(PERMS.CUSTOMERS_EDIT), wrap(updateCustomer))
    .delete(protect, requirePermission(PERMS.CUSTOMERS_EDIT), wrap(deleteCustomer));

router.route('/:id/orders')
    .get(protect, requirePermission(PERMS.CUSTOMERS_VIEW), paginate, wrap(getCustomerOrders));

router.get('/metrics', protect, requirePermission(PERMS.CUSTOMERS_VIEW), wrap(getCustomerMetrics));
router.get('/feedback', protect, requirePermission(PERMS.CUSTOMERS_VIEW), wrap(getFeedback));

module.exports = router;
