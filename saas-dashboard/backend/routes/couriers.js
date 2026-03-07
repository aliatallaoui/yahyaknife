const express = require('express');
const router = express.Router();
const {
    getCouriers,
    createCourier,
    updateCourier,
    settleCourierCash,
    assignOrdersToCourier
} = require('../controllers/courierController');

router.route('/')
    .get(getCouriers)
    .post(createCourier);

router.route('/:id')
    .put(updateCourier);

router.post('/:id/settle', settleCourierCash);
router.post('/:id/dispatch', assignOrdersToCourier);

module.exports = router;
