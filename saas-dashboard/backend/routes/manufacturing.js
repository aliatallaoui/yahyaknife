const express = require('express');
const router = express.Router();
const manufacturingController = require('../controllers/manufacturingController');
const { protect } = require('../middleware/authMiddleware');

// Note: Ensure the auth middleware is required. We'll add 'protect' to securely lock the endpoints.
// We use generic 'protect' for now, but authorize(['admin', 'manager', 'production']) could be used later.

// ============================================
// Raw Materials Routes
// ============================================

router.route('/raw-materials')
    .get(protect, manufacturingController.getAllRawMaterials)
    .post(protect, manufacturingController.createRawMaterial);

router.route('/raw-materials/:id')
    .put(protect, manufacturingController.updateRawMaterial)
    .delete(protect, manufacturingController.deleteRawMaterial);

// ============================================
// BOM (Bill of Materials) Routes
// ============================================

router.route('/boms')
    .get(protect, manufacturingController.getAllBOMs)
    .post(protect, manufacturingController.createBOM);

router.route('/boms/:id')
    .delete(protect, manufacturingController.deleteBOM);

// ============================================
// Production Order Routes
// ============================================

router.route('/orders')
    .get(protect, manufacturingController.getAllProductionOrders)
    .post(protect, manufacturingController.createProductionOrder);

router.route('/orders/:id/status')
    .put(protect, manufacturingController.updateProductionOrderStatus);

module.exports = router;
