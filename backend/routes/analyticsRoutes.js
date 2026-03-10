const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
const { getSkuIntelligence, getSupplierIntelligence, getEcommerceAnalytics } = require('../controllers/analyticsController');

// All endpoints should be protected in production, but we will leave them default for now while testing
router.get('/sku', getSkuIntelligence);
router.get('/supplier', getSupplierIntelligence);
router.get('/ecommerce', getEcommerceAnalytics);

module.exports = router;
