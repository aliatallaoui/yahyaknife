const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);
const paginate = require('../shared/middleware/paginate');
const {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
} = require('../controllers/transactionController');

router.route('/')
    .get(requirePermission(PERMS.FINANCE_VIEW), paginate, getTransactions)
    .post(requirePermission(PERMS.FINANCE_VIEW), addTransaction);

router.route('/:id')
    .put(requirePermission(PERMS.FINANCE_VIEW), updateTransaction)
    .delete(requirePermission(PERMS.FINANCE_VIEW), deleteTransaction);

module.exports = router;
