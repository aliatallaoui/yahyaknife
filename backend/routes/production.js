const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');

// --- Raw Materials ---
router.get('/raw-materials', productionController.getRawMaterials);
router.post('/raw-materials', productionController.createRawMaterial);
router.put('/raw-materials/:id', productionController.updateRawMaterial);
router.delete('/raw-materials/:id', productionController.deleteRawMaterial);

// --- Bill Of Materials (BOM) ---
router.get('/boms', productionController.getBOMs);
router.post('/boms', productionController.createBOM);
router.put('/boms/:id', productionController.updateBOM);
router.delete('/boms/:id', productionController.deleteBOM);

// --- Production Orders ---
router.get('/production-orders', productionController.getProductionOrders);
router.post('/production-orders', productionController.createProductionOrder);
router.put('/production-orders/:id/status', productionController.updateProductionOrderStatus);
router.get('/analytics', productionController.getProductionAnalytics);

module.exports = router;
