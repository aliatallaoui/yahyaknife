const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);
const { getSkuIntelligence, getSupplierIntelligence, getEcommerceAnalytics } = require('../controllers/analyticsController');
const { getDailyRollups, triggerDailyRollup } = require('../controllers/dailyRollupController');
const { getWeeklyReports } = require('../controllers/weeklyReportController');

router.get('/sku', requirePermission(PERMS.ANALYTICS_VIEW), getSkuIntelligence);
router.get('/supplier', requirePermission(PERMS.ANALYTICS_VIEW), getSupplierIntelligence);
router.get('/ecommerce', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), getEcommerceAnalytics);

// Daily historical rollups — powers trend charts
router.get('/daily', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), getDailyRollups);
// Manual backfill trigger (admin only — same permission as financial view)
router.post('/daily/trigger', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), triggerDailyRollup);

// Weekly historical reports — powers week-over-week comparison charts
router.get('/weekly', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), getWeeklyReports);

module.exports = router;
