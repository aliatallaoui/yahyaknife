const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    source: {
        type: String,
        required: true,
        enum: ['Product Sales', 'Service Revenue', 'Subscription Income', 'Other']
    },
    description: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Revenue', revenueSchema);
