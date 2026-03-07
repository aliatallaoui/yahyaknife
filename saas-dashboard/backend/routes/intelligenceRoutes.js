const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');

// AI Predictions & Optimizations
router.get('/stockout-predictions', intelligenceController.getStockoutPredictions);
router.get('/order-risk/:orderId', intelligenceController.evaluateOrderRisk);
router.get('/courier-optimization', intelligenceController.optimizeCourierSelection);
router.get('/global-summary', intelligenceController.getGlobalIntelligence);

module.exports = router;
