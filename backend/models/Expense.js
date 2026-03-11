const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    category: {
        type: String,
        required: true,
        enum: ['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other']
    },
    description: { type: String, required: true },
    source: { type: String }, // e.g. 'payroll_sync' — for programmatic entries
    linkedPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
