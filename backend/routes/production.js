const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);

// --- Raw Materials ---
router.get('/raw-materials', requirePermission(PERMS.WORKSHOP_VIEW), paginate, productionController.getRawMaterials);
router.post('/raw-materials', requirePermission(PERMS.WORKSHOP_EDIT), productionController.createRawMaterial);
router.put('/raw-materials/:id', requirePermission(PERMS.WORKSHOP_EDIT), productionController.updateRawMaterial);
router.delete('/raw-materials/:id', requirePermission(PERMS.WORKSHOP_EDIT), productionController.deleteRawMaterial);

// --- Bill Of Materials (BOM) ---
router.get('/boms', requirePermission(PERMS.WORKSHOP_VIEW), paginate, productionController.getBOMs);
router.post('/boms', requirePermission(PERMS.WORKSHOP_EDIT), productionController.createBOM);
router.put('/boms/:id', requirePermission(PERMS.WORKSHOP_EDIT), productionController.updateBOM);
router.delete('/boms/:id', requirePermission(PERMS.WORKSHOP_EDIT), productionController.deleteBOM);

// --- Production Orders ---
router.get('/production-orders', requirePermission(PERMS.WORKSHOP_VIEW), paginate, productionController.getProductionOrders);
router.post('/production-orders', requirePermission(PERMS.WORKSHOP_EDIT), productionController.createProductionOrder);
router.put('/production-orders/:id/status', requirePermission(PERMS.WORKSHOP_EDIT), productionController.updateProductionOrderStatus);
router.get('/analytics', requirePermission(PERMS.WORKSHOP_VIEW), productionController.getProductionAnalytics);

module.exports = router;
