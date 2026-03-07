const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    category: {
        type: String,
        required: true,
        enum: ['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other']
    },
    description: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
