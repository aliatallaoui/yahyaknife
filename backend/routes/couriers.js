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

router.route('/')
    .get(getCouriers)
    .post(createCourier);

router.get('/analytics/kpis', getCourierKPIs);
router.get('/analytics/regions', getRegionalPerformance);

router.route('/:id')
    .put(updateCourier);

router.post('/:id/settle', settleCourierCash);
router.post('/:id/dispatch', assignOrdersToCourier);

module.exports = router;
