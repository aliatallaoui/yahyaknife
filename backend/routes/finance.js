const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);

// /api/finance/overview
router.get('/overview', requirePermission(PERMS.FINANCE_VIEW), financeController.getFinancialOverview);

// /api/finance/expenses
router.get('/expenses', requirePermission(PERMS.FINANCE_VIEW), paginate, financeController.getExpenses);

// /api/finance/revenue
router.get('/revenue', requirePermission(PERMS.FINANCE_VIEW), paginate, financeController.getRevenues);

// COURIER SETTLEMENT (LEDGER)
router.get('/courier-balances', requirePermission(PERMS.FINANCE_SETTLE_COURIER), financeController.getCourierBalances);
router.get('/courier-deliveries/:courierId', requirePermission(PERMS.FINANCE_SETTLE_COURIER), financeController.getCourierDeliveries);
router.post('/settle-courier', requirePermission(PERMS.FINANCE_SETTLE_COURIER), financeController.settleCourierCash);

module.exports = router;
