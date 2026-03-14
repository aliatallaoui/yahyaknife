const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const { checkPlanLimit } = require('../middleware/planLimits');
const wrap = require('../shared/middleware/asyncHandler');

router.use(protect);
const {
    getCouriers,
    getCourierById,
    createCourier,
    updateCourier,
    deleteCourier,
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
    deletePricingRule,
    syncYalidinePricing
} = require('../controllers/courierPricingController');

const {
    getCoverage,
    upsertCoverage,
    deleteCoverage,
    syncEcotrackCoverage
} = require('../controllers/courierCoverageController');

router.route('/')
    .get(requirePermission(PERMS.COURIERS_VIEW), wrap(getCouriers))
    .post(requirePermission(PERMS.COURIERS_CREATE), checkPlanLimit('couriers'), wrap(createCourier));

router.get('/analytics/kpis', requirePermission(PERMS.COURIERS_VIEW), wrap(getCourierKPIs));
router.get('/analytics/regions', requirePermission(PERMS.COURIERS_VIEW), wrap(getRegionalPerformance));

// Test API connection proxy
router.post('/test-connection', requirePermission(PERMS.COURIERS_API_CONNECT), wrap(testCourierConnection));

// Engine routes
router.get('/engine/coverage', requirePermission(PERMS.COURIERS_VIEW), wrap(getCourierCoverage));
router.post('/engine/calculate-price', requirePermission(PERMS.COURIERS_VIEW), wrap(calculateCourierPrice));
router.get('/engine/recommend', requirePermission(PERMS.COURIERS_VIEW), wrap(recommendCourier));

router.route('/:id')
    .get(requirePermission(PERMS.COURIERS_VIEW), wrap(getCourierById))
    .put(requirePermission(PERMS.COURIERS_EDIT), wrap(updateCourier))
    .delete(requirePermission(PERMS.COURIERS_DELETE), wrap(deleteCourier));

router.post('/:id/settle', requirePermission(PERMS.FINANCE_SETTLE_COURIER), wrap(settleCourierCash));
router.get('/:id/settlements', requirePermission(PERMS.FINANCE_SETTLE_COURIER), wrap(getSettlementHistory));
router.post('/:id/dispatch', requirePermission(PERMS.COURIERS_EDIT), wrap(assignOrdersToCourier));

// Pricing Rules — sync must come before /:id/pricing to avoid Express matching /:id/pricing first
router.post('/:id/pricing/sync', requirePermission(PERMS.COURIERS_EDIT), wrap(syncYalidinePricing));
router.route('/:id/pricing')
    .get(requirePermission(PERMS.COURIERS_VIEW), wrap(getPricingRules))
    .post(requirePermission(PERMS.COURIERS_EDIT), wrap(addPricingRule));
router.route('/:id/pricing/:ruleId')
    .put(requirePermission(PERMS.COURIERS_EDIT), wrap(updatePricingRule))
    .delete(requirePermission(PERMS.COURIERS_EDIT), wrap(deletePricingRule));

// Coverage Areas
router.route('/:id/coverage')
    .get(requirePermission(PERMS.COURIERS_VIEW), wrap(getCoverage))
    .post(requirePermission(PERMS.COURIERS_EDIT), wrap(upsertCoverage));
router.post('/:id/coverage/sync', requirePermission(PERMS.COURIERS_EDIT), wrap(syncEcotrackCoverage));
router.route('/:id/coverage/:coverageId')
    .delete(requirePermission(PERMS.COURIERS_EDIT), wrap(deleteCoverage));

module.exports = router;
