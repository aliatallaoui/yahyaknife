const mongoose = require('mongoose');

/**
 * UsageRecord — tracks metered resource usage per tenant per billing period.
 *
 * One document per tenant per month. Updated incrementally as events occur.
 * Platform admin / billing system reads these to generate invoices.
 */
const usageRecordSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    period: {
        type: String,         // 'YYYY-MM' format
        required: true,
    },
    counters: {
        orders:       { type: Number, default: 0 },
        smsSent:      { type: Number, default: 0 },
        exports:      { type: Number, default: 0 },
        apiCalls:     { type: Number, default: 0 },
        storageBytes: { type: Number, default: 0 },
    },
    // Snapshot of limits at period start (for billing reconciliation)
    planTier: {
        type: String,
        default: 'Free',
    },
    limits: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});

usageRecordSchema.index({ tenant: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
