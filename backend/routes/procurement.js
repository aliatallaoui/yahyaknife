const express = require('express');
const router = express.Router();
const paginate = require('../shared/middleware/paginate');
const {
    getSuppliers,
    createSupplier,
    updateSupplier,
    getPurchaseOrders,
    createPurchaseOrder,
    receivePurchaseOrder
} = require('../controllers/procurementController');

const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);

// Supplier Routes
router.route('/suppliers')
    .get(requirePermission(PERMS.PROCUREMENT_VIEW), paginate, getSuppliers)
    .post(requirePermission(PERMS.PROCUREMENT_CREATE_PO), createSupplier);

router.route('/suppliers/:id')
    .put(requirePermission(PERMS.PROCUREMENT_UPDATE_PO), updateSupplier);

// Purchase Order Routes
router.route('/orders')
    .get(requirePermission(PERMS.PROCUREMENT_VIEW), paginate, getPurchaseOrders)
    .post(requirePermission(PERMS.PROCUREMENT_CREATE_PO), createPurchaseOrder);

// Active Delivery Receiving Hook
router.route('/orders/:id/receive')
    .post(requirePermission(PERMS.PROCUREMENT_RECEIVE), receivePurchaseOrder);

module.exports = router;
