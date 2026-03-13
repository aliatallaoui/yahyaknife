const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);
const wrap = require('../shared/middleware/asyncHandler');
const { getSkuIntelligence, getSupplierIntelligence, getEcommerceAnalytics } = require('../controllers/analyticsController');
const { getDailyRollups, triggerDailyRollup } = require('../controllers/dailyRollupController');
const { getWeeklyReports } = require('../controllers/weeklyReportController');
const { getMonthlyReports, triggerMonthlyReport } = require('../controllers/monthlyReportController');

router.get('/sku', requirePermission(PERMS.ANALYTICS_VIEW), wrap(getSkuIntelligence));
router.get('/supplier', requirePermission(PERMS.ANALYTICS_VIEW), wrap(getSupplierIntelligence));
router.get('/ecommerce', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(getEcommerceAnalytics));

// Daily historical rollups — powers trend charts
router.get('/daily', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(getDailyRollups));
// Manual backfill trigger (admin only — same permission as financial view)
router.post('/daily/trigger', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(triggerDailyRollup));

// Weekly historical reports — powers week-over-week comparison charts
router.get('/weekly', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(getWeeklyReports));

// Monthly historical reports — powers month-over-month comparison
router.get('/monthly', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(getMonthlyReports));
router.post('/monthly/trigger', requirePermission(PERMS.ANALYTICS_FINANCIAL_VIEW), wrap(triggerMonthlyReport));

module.exports = router;
