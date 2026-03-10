const express = require('express');
const router = express.Router();
const {
    getCouriers,
    createCourier,
    updateCourier,
    settleCourierCash,
    assignOrdersToCourier
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
    deleteCoverage
} = require('../controllers/courierCoverageController');

router.route('/')
    .get(getCouriers)
    .post(createCourier);

router.get('/analytics/kpis', getCourierKPIs);
router.get('/analytics/regions', getRegionalPerformance);

// Engine routes
router.get('/engine/coverage', getCourierCoverage);
router.post('/engine/calculate-price', calculateCourierPrice);
router.get('/engine/recommend', recommendCourier);

router.route('/:id')
    .put(updateCourier);

router.post('/:id/settle', settleCourierCash);
router.post('/:id/dispatch', assignOrdersToCourier);

// Pricing Rules
router.route('/:id/pricing')
    .get(getPricingRules)
    .post(addPricingRule);
router.route('/:id/pricing/:ruleId')
    .put(updatePricingRule)
    .delete(deletePricingRule);

// Coverage Areas
router.route('/:id/coverage')
    .get(getCoverage)
    .post(upsertCoverage);
router.route('/:id/coverage/:coverageId')
    .delete(deleteCoverage);

module.exports = router;
