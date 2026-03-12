const mongoose = require('mongoose');

/**
 * WeeklyReport — persisted weekly business summary.
 *
 * Generated every Sunday at 23:59 by the cron scheduler.
 * Keyed on { tenant, weekStart } — one document per tenant per ISO week.
 * Provides the data for week-over-week comparison charts.
 */
const weeklyReportSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    // ISO date string of the week's Monday (YYYY-MM-DD)
    weekStart: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/
    },
    weekEnd: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/
    },

    orders: {
        total:     { type: Number, default: 0 },
        confirmed: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        returned:  { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 },
        confirmationRate: { type: Number, default: 0 }, // %
        returnRate:       { type: Number, default: 0 }, // %
    },

    revenue: {
        gross:      { type: Number, default: 0 },
        netProfit:  { type: Number, default: 0 },
        cogs:       { type: Number, default: 0 },
        courierFees:{ type: Number, default: 0 },
        profitMargin: { type: Number, default: 0 } // %
    },

    generatedAt: { type: Date, default: Date.now }
}, {
    timestamps: false
});

weeklyReportSchema.index({ tenant: 1, weekStart: 1 }, { unique: true });
weeklyReportSchema.index({ tenant: 1, weekStart: -1 });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
