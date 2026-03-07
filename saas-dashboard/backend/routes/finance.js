const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

// /api/finance/overview
router.get('/overview', financeController.getFinancialOverview);

// /api/finance/expenses
router.get('/expenses', financeController.getExpenses);

// /api/finance/revenue
router.get('/revenue', financeController.getRevenues);

module.exports = router;
