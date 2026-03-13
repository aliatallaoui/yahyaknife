const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');
const wrap = require('../shared/middleware/asyncHandler');

router.use(protect);

// /api/finance/overview
router.get('/overview', requirePermission(PERMS.FINANCE_VIEW), wrap(financeController.getFinancialOverview));

// /api/finance/expenses
router.get('/expenses', requirePermission(PERMS.FINANCE_VIEW), paginate, wrap(financeController.getExpenses));

// /api/finance/revenue
router.get('/revenue', requirePermission(PERMS.FINANCE_VIEW), paginate, wrap(financeController.getRevenues));

// COURIER SETTLEMENT (LEDGER)
router.get('/courier-balances', requirePermission(PERMS.FINANCE_SETTLE_COURIER), wrap(financeController.getCourierBalances));
router.get('/courier-deliveries/:courierId', requirePermission(PERMS.FINANCE_SETTLE_COURIER), wrap(financeController.getCourierDeliveries));
router.post('/settle-courier', requirePermission(PERMS.FINANCE_SETTLE_COURIER), wrap(financeController.settleCourierCash));

module.exports = router;
