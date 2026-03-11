const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect);
const {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
} = require('../controllers/transactionController');

router.route('/')
    .get(requirePermission('finance.view'), getTransactions)
    .post(requirePermission('finance.view'), addTransaction);

router.route('/:id')
    .put(requirePermission('finance.view'), updateTransaction)
    .delete(requirePermission('finance.view'), deleteTransaction);

module.exports = router;
