const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);
const intelligenceController = require('../controllers/intelligenceController');
const wrap = require('../shared/middleware/asyncHandler');

// AI Predictions & Optimizations
router.get('/stockout-predictions', requirePermission(PERMS.INTELLIGENCE_VIEW), wrap(intelligenceController.getStockoutPredictions));
router.get('/order-risk/:orderId', requirePermission(PERMS.INTELLIGENCE_VIEW), wrap(intelligenceController.evaluateOrderRisk));
router.get('/courier-optimization', requirePermission(PERMS.INTELLIGENCE_VIEW), wrap(intelligenceController.optimizeCourierSelection));
router.get('/global-summary', requirePermission(PERMS.INTELLIGENCE_VIEW), wrap(intelligenceController.getGlobalIntelligence));

module.exports = router;
