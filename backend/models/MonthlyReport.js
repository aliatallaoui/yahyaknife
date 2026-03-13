const mongoose = require('mongoose');

/**
 * MonthlyReport — persisted monthly business summary.
 *
 * Generated on the 1st of each month at 01:00 for the previous month.
 * Keyed on { tenant, month } — one document per tenant per calendar month.
 * Provides month-over-month comparison and quarterly/annual rollups.
 */
const monthlyReportSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    // YYYY-MM format (e.g., '2026-03')
    month: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}$/
    },

    orders: {
        total:            { type: Number, default: 0 },
        confirmed:        { type: Number, default: 0 },
        delivered:        { type: Number, default: 0 },
        returned:         { type: Number, default: 0 },
        refused:          { type: Number, default: 0 },
        cancelled:        { type: Number, default: 0 },
        confirmationRate: { type: Number, default: 0 }, // %
        returnRate:       { type: Number, default: 0 }, // %
        deliveryRate:     { type: Number, default: 0 }, // %
        avgOrderValue:    { type: Number, default: 0 },
    },

    revenue: {
        gross:        { type: Number, default: 0 },
        netProfit:    { type: Number, default: 0 },
        cogs:         { type: Number, default: 0 },
        courierFees:  { type: Number, default: 0 },
        gatewayFees:  { type: Number, default: 0 },
        codCollected: { type: Number, default: 0 },
        profitMargin: { type: Number, default: 0 }, // %
    },

    hr: {
        avgPresent:      { type: Number, default: 0 },
        totalAbsent:     { type: Number, default: 0 },
        totalLate:       { type: Number, default: 0 },
        totalOvertimeHrs:{ type: Number, default: 0 },
    },

    stock: {
        avgLowStockVariants: { type: Number, default: 0 },
    },

    // Agent/team productivity
    agents: {
        totalAssigned:    { type: Number, default: 0 },
        avgOrdersPerAgent:{ type: Number, default: 0 },
        topAgentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        topAgentOrders:   { type: Number, default: 0 },
    },

    daysInMonth: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now }
}, {
    timestamps: false
});

monthlyReportSchema.index({ tenant: 1, month: 1 }, { unique: true });
monthlyReportSchema.index({ tenant: 1, month: -1 });

module.exports = mongoose.model('MonthlyReport', monthlyReportSchema);
