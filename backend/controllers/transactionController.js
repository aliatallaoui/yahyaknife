const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const audit = require('../shared/utils/auditLog');

// @desc    Get all transactions (revenues and expenses)
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const filter = { tenant: tenantId };

        // Count both collections in parallel
        const [expenseCount, revenueCount] = await Promise.all([
            Expense.countDocuments(filter),
            Revenue.countDocuments(filter)
        ]);
        const total = expenseCount + revenueCount;

        // Fetch paginated from both, sorted by date desc
        const [expenses, revenues] = await Promise.all([
            Expense.find(filter).sort({ date: -1 }).limit(req.skip + req.limit).lean(),
            Revenue.find(filter).sort({ date: -1 }).limit(req.skip + req.limit).lean()
        ]);

        const formattedExpenses = expenses.map(e => ({ ...e, type: 'expense' }));
        const formattedRevenues = revenues.map(r => ({
            ...r,
            type: 'revenue',
            category: r.source
        }));

        const allTransactions = [...formattedRevenues, ...formattedExpenses]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(req.skip, req.skip + req.limit);

        res.json({ data: allTransactions, pagination: req.paginationMeta(total) });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching transactions');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Add a new transaction
// @route   POST /api/transactions
// @access  Private
exports.addTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { type, amount, date, description, category } = req.body;

        if (!type || !amount || !date || !description || !category) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        if (type === 'revenue') {
            const newRevenue = await Revenue.create({
                tenant: tenantId, amount, date, description,
                source: category
            });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'CREATE_REVENUE', module: 'finance', metadata: { id: newRevenue._id, amount: parsedAmount, category } });
            return res.status(201).json({ ...newRevenue.toObject(), type: 'revenue', category: newRevenue.source });
        } else if (type === 'expense') {
            const newExpense = await Expense.create({
                tenant: tenantId, amount, date, description, category
            });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'CREATE_EXPENSE', module: 'finance', metadata: { id: newExpense._id, amount: parsedAmount, category } });
            return res.status(201).json({ ...newExpense.toObject(), type: 'expense' });
        } else {
            return res.status(400).json({ message: 'Invalid transaction type' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Error adding transaction');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid transaction ID' });
        const { type, amount, date, description, category } = req.body;

        if (amount !== undefined) {
            const parsedAmount = Number(amount);
            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
                return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        if (type === 'revenue') {
            const updated = await Revenue.findOneAndUpdate(
                { _id: id, tenant: tenantId },
                { amount, date, description, source: category },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ message: 'Revenue not found' });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'UPDATE_REVENUE', module: 'finance', metadata: { id, amount, category } });
            return res.json({ ...updated.toObject(), type: 'revenue', category: updated.source });
        } else if (type === 'expense') {
            const updated = await Expense.findOneAndUpdate(
                { _id: id, tenant: tenantId },
                { amount, date, description, category },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ message: 'Expense not found' });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'UPDATE_EXPENSE', module: 'finance', metadata: { id, amount, category } });
            return res.json({ ...updated.toObject(), type: 'expense' });
        } else {
            return res.status(400).json({ message: 'Invalid transaction type' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Error updating transaction');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid transaction ID' });
        const { type } = req.query;

        if (type === 'revenue') {
            const deleted = await Revenue.findOneAndDelete({ _id: id, tenant: tenantId });
            if (!deleted) return res.status(404).json({ message: 'Revenue not found' });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'DELETE_REVENUE', module: 'finance', metadata: { id, amount: deleted.amount, source: deleted.source } });
            return res.json({ message: 'Transaction removed' });
        } else if (type === 'expense') {
            const deleted = await Expense.findOneAndDelete({ _id: id, tenant: tenantId });
            if (!deleted) return res.status(404).json({ message: 'Expense not found' });
            audit({ tenant: tenantId, actorUserId: req.user._id, action: 'DELETE_EXPENSE', module: 'finance', metadata: { id, amount: deleted.amount, category: deleted.category } });
            return res.json({ message: 'Transaction removed' });
        } else {
            // No type specified — try both collections
            const deletedExpense = await Expense.findOneAndDelete({ _id: id, tenant: tenantId });
            if (deletedExpense) {
                audit({ tenant: tenantId, actorUserId: req.user._id, action: 'DELETE_EXPENSE', module: 'finance', metadata: { id, amount: deletedExpense.amount } });
                return res.json({ message: 'Transaction removed' });
            }
            const deletedRevenue = await Revenue.findOneAndDelete({ _id: id, tenant: tenantId });
            if (deletedRevenue) {
                audit({ tenant: tenantId, actorUserId: req.user._id, action: 'DELETE_REVENUE', module: 'finance', metadata: { id, amount: deletedRevenue.amount } });
                return res.json({ message: 'Transaction removed' });
            }
            return res.status(404).json({ message: 'Transaction not found in any collection' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Error deleting transaction');
        res.status(500).json({ message: 'Server Error' });
    }
};
