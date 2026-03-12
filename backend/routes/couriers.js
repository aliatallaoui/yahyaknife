const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect);
const {
    getCouriers,
    createCourier,
    updateCourier,
    settleCourierCash,
    getSettlementHistory,
    assignOrdersToCourier,
    testCourierConnection
} = require('../controllers/courierController');

const {
    getCourierKPIs,
    getRegionalPerformance
} = require('../controllers/courierAnalyticsController');

const {
    getCourierCoverage,
    calculateCourierPrice,
    recommendCourier
} = require('../controllers/courierEngineController');

const {
    getPricingRules,
    addPricingRule,
    updatePricingRule,
    deletePricingRule
} = require('../controllers/courierPricingController');

const {
    getCoverage,
    upsertCoverage,
    deleteCoverage,
    syncEcotrackCoverage
} = require('../controllers/courierCoverageController');

router.route('/')
    .get(requirePermission('couriers.view'), getCouriers)
    .post(requirePermission('couriers.create'), createCourier);

router.get('/analytics/kpis', requirePermission('couriers.view'), getCourierKPIs);
router.get('/analytics/regions', requirePermission('couriers.view'), getRegionalPerformance);

// Test API connection proxy
router.post('/test-connection', requirePermission('couriers.api.connect'), testCourierConnection);

// Engine routes
router.get('/engine/coverage', requirePermission('couriers.view'), getCourierCoverage);
router.post('/engine/calculate-price', requirePermission('couriers.view'), calculateCourierPrice);
router.get('/engine/recommend', requirePermission('couriers.view'), recommendCourier);

router.route('/:id')
    .put(requirePermission('couriers.edit'), updateCourier);

router.post('/:id/settle', requirePermission('finance.settle.courier'), settleCourierCash);
router.get('/:id/settlements', requirePermission('finance.settle.courier'), getSettlementHistory);
router.post('/:id/dispatch', requirePermission('couriers.edit'), assignOrdersToCourier);

// Pricing Rules
router.route('/:id/pricing')
    .get(requirePermission('couriers.view'), getPricingRules)
    .post(requirePermission('couriers.edit'), addPricingRule);
router.route('/:id/pricing/:ruleId')
    .put(requirePermission('couriers.edit'), updatePricingRule)
    .delete(requirePermission('couriers.edit'), deletePricingRule);

// Coverage Areas
router.route('/:id/coverage')
    .get(requirePermission('couriers.view'), getCoverage)
    .post(requirePermission('couriers.edit'), upsertCoverage);
router.post('/:id/coverage/sync', requirePermission('couriers.edit'), syncEcotrackCoverage);
router.route('/:id/coverage/:coverageId')
    .delete(requirePermission('couriers.edit'), deleteCoverage);

module.exports = router;
