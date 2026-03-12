const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);
const intelligenceController = require('../controllers/intelligenceController');

// AI Predictions & Optimizations
router.get('/stockout-predictions', requirePermission(PERMS.INTELLIGENCE_VIEW), intelligenceController.getStockoutPredictions);
router.get('/order-risk/:orderId', requirePermission(PERMS.INTELLIGENCE_VIEW), intelligenceController.evaluateOrderRisk);
router.get('/courier-optimization', requirePermission(PERMS.INTELLIGENCE_VIEW), intelligenceController.optimizeCourierSelection);
router.get('/global-summary', requirePermission(PERMS.INTELLIGENCE_VIEW), intelligenceController.getGlobalIntelligence);

module.exports = router;
