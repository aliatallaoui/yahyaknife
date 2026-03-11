const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect);

// /api/finance/overview
router.get('/overview', requirePermission('finance.view'), financeController.getFinancialOverview);

// /api/finance/expenses
router.get('/expenses', requirePermission('finance.view'), financeController.getExpenses);

// /api/finance/revenue
router.get('/revenue', requirePermission('finance.view'), financeController.getRevenues);

module.exports = router;
