const express = require('express');
const router = express.Router();
const {
    getSuppliers,
    createSupplier,
    updateSupplier,
    getPurchaseOrders,
    createPurchaseOrder,
    receivePurchaseOrder
} = require('../controllers/procurementController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Supplier Routes
router.route('/suppliers')
    .get(getSuppliers)
    .post(createSupplier);

router.route('/suppliers/:id')
    .put(updateSupplier);

// Purchase Order Routes
router.route('/orders')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

// Active Delivery Receiving Hook
router.route('/orders/:id/receive')
    .post(receivePurchaseOrder);

module.exports = router;
