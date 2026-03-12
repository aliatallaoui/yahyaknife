const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

// @desc    Get all transactions (revenues and expenses)
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const [expenses, revenues] = await Promise.all([
            Expense.find({ tenant: tenantId }).lean(),
            Revenue.find({ tenant: tenantId }).lean()
        ]);

        const formattedExpenses = expenses.map(e => ({ ...e, type: 'expense' }));
        const formattedRevenues = revenues.map(r => ({
            ...r,
            type: 'revenue',
            category: r.source // map source → category for uniform table rendering
        }));

        const allTransactions = [...formattedRevenues, ...formattedExpenses]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(allTransactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
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

        if (type === 'revenue') {
            const newRevenue = await Revenue.create({
                tenant: tenantId, amount, date, description,
                source: category
            });
            return res.status(201).json({ ...newRevenue.toObject(), type: 'revenue', category: newRevenue.source });
        } else if (type === 'expense') {
            const newExpense = await Expense.create({
                tenant: tenantId, amount, date, description, category
            });
            return res.status(201).json({ ...newExpense.toObject(), type: 'expense' });
        } else {
            return res.status(400).json({ message: 'Invalid transaction type' });
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: error.message });
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

        if (type === 'revenue') {
            const updated = await Revenue.findOneAndUpdate(
                { _id: id, tenant: tenantId },
                { amount, date, description, source: category },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ message: 'Revenue not found' });
            return res.json({ ...updated.toObject(), type: 'revenue', category: updated.source });
        } else if (type === 'expense') {
            const updated = await Expense.findOneAndUpdate(
                { _id: id, tenant: tenantId },
                { amount, date, description, category },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ message: 'Expense not found' });
            return res.json({ ...updated.toObject(), type: 'expense' });
        } else {
            return res.status(400).json({ message: 'Invalid transaction type' });
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ message: error.message });
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
            return res.json({ message: 'Transaction removed' });
        } else if (type === 'expense') {
            const deleted = await Expense.findOneAndDelete({ _id: id, tenant: tenantId });
            if (!deleted) return res.status(404).json({ message: 'Expense not found' });
            return res.json({ message: 'Transaction removed' });
        } else {
            // No type specified — try both collections
            const deletedExpense = await Expense.findOneAndDelete({ _id: id, tenant: tenantId });
            if (deletedExpense) return res.json({ message: 'Transaction removed' });
            const deletedRevenue = await Revenue.findOneAndDelete({ _id: id, tenant: tenantId });
            if (deletedRevenue) return res.json({ message: 'Transaction removed' });
            return res.status(404).json({ message: 'Transaction not found in any collection' });
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ message: error.message });
    }
};
