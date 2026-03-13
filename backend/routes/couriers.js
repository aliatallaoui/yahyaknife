const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

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
    .get(requirePermission(PERMS.COURIERS_VIEW), getCouriers)
    .post(requirePermission(PERMS.COURIERS_CREATE), createCourier);

router.get('/analytics/kpis', requirePermission(PERMS.COURIERS_VIEW), getCourierKPIs);
router.get('/analytics/regions', requirePermission(PERMS.COURIERS_VIEW), getRegionalPerformance);

// Test API connection proxy
router.post('/test-connection', requirePermission(PERMS.COURIERS_API_CONNECT), testCourierConnection);

// Engine routes
router.get('/engine/coverage', requirePermission(PERMS.COURIERS_VIEW), getCourierCoverage);
router.post('/engine/calculate-price', requirePermission(PERMS.COURIERS_VIEW), calculateCourierPrice);
router.get('/engine/recommend', requirePermission(PERMS.COURIERS_VIEW), recommendCourier);

router.route('/:id')
    .put(requirePermission(PERMS.COURIERS_EDIT), updateCourier);

router.post('/:id/settle', requirePermission(PERMS.FINANCE_SETTLE_COURIER), settleCourierCash);
router.get('/:id/settlements', requirePermission(PERMS.FINANCE_SETTLE_COURIER), getSettlementHistory);
router.post('/:id/dispatch', requirePermission(PERMS.COURIERS_EDIT), assignOrdersToCourier);

// Pricing Rules
router.route('/:id/pricing')
    .get(requirePermission(PERMS.COURIERS_VIEW), getPricingRules)
    .post(requirePermission(PERMS.COURIERS_EDIT), addPricingRule);
router.route('/:id/pricing/:ruleId')
    .put(requirePermission(PERMS.COURIERS_EDIT), updatePricingRule)
    .delete(requirePermission(PERMS.COURIERS_EDIT), deletePricingRule);

// Coverage Areas
router.route('/:id/coverage')
    .get(requirePermission(PERMS.COURIERS_VIEW), getCoverage)
    .post(requirePermission(PERMS.COURIERS_EDIT), upsertCoverage);
router.post('/:id/coverage/sync', requirePermission(PERMS.COURIERS_EDIT), syncEcotrackCoverage);
router.route('/:id/coverage/:coverageId')
    .delete(requirePermission(PERMS.COURIERS_EDIT), deleteCoverage);

module.exports = router;
