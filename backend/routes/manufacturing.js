const express = require('express');
const router = express.Router();
const manufacturingController = require('../controllers/manufacturingController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

// ============================================
// Raw Materials Routes
// ============================================

router.route('/raw-materials')
    .get(protect, requirePermission(PERMS.WORKSHOP_VIEW), manufacturingController.getAllRawMaterials)
    .post(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.createRawMaterial);

router.route('/raw-materials/:id')
    .put(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.updateRawMaterial)
    .delete(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.deleteRawMaterial);

// ============================================
// BOM (Bill of Materials) Routes
// ============================================

router.route('/boms')
    .get(protect, requirePermission(PERMS.WORKSHOP_VIEW), manufacturingController.getAllBOMs)
    .post(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.createBOM);

router.route('/boms/:id')
    .delete(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.deleteBOM);

// ============================================
// Production Order Routes
// ============================================

router.route('/orders')
    .get(protect, requirePermission(PERMS.WORKSHOP_VIEW), manufacturingController.getAllProductionOrders)
    .post(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.createProductionOrder);

router.route('/orders/:id/status')
    .put(protect, requirePermission(PERMS.WORKSHOP_EDIT), manufacturingController.updateProductionOrderStatus);

module.exports = router;
