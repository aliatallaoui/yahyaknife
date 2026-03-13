const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    source: {
        type: String,
        required: true,
        enum: ['Product Sales', 'Service Revenue', 'Subscription Income', 'Other']
    },
    description: { type: String, required: true }
}, { timestamps: true });

// --- Performance Indexes ---
revenueSchema.index({ tenant: 1, date: -1 });                        // Finance page sorted listing

module.exports = mongoose.model('Revenue', revenueSchema);
