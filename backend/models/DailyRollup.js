const mongoose = require('mongoose');

/**
 * DailyRollup — append-only daily metrics snapshot per tenant.
 *
 * Unlike KPISnapshot (which overwrites every 5 minutes), each DailyRollup
 * document represents ONE calendar day and is never deleted. This gives
 * the business week-over-week, month-over-month, and year-over-year trends.
 *
 * The nightly rollup job (jobs/dailyRollup.js) upserts this document at 00:30
 * for the PREVIOUS day, making all figures final by the time they're written.
 */

const dailyRollupSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    // ISO date string YYYY-MM-DD (not a Date object — avoids timezone drift issues)
    date: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/
    },

    // ── Order metrics ──────────────────────────────────────────────────────────
    orders: {
        created:     { type: Number, default: 0 },  // New orders placed that day
        confirmed:   { type: Number, default: 0 },  // Reached Confirmed status that day
        dispatched:  { type: Number, default: 0 },  // Reached Dispatched that day
        delivered:   { type: Number, default: 0 },  // Reached Delivered that day
        returned:    { type: Number, default: 0 },  // Reached Returned that day
        refused:     { type: Number, default: 0 },  // Reached Refused that day
        cancelled:   { type: Number, default: 0 },  // Reached Cancelled that day
    },

    // ── Revenue metrics ────────────────────────────────────────────────────────
    revenue: {
        gross:        { type: Number, default: 0 },  // Sum of totalAmount on delivered orders
        cogs:         { type: Number, default: 0 },  // Sum of financials.cogs on delivered orders
        courierFees:  { type: Number, default: 0 },  // Sum of financials.courierFee on delivered orders
        gatewayFees:  { type: Number, default: 0 },  // Sum of financials.gatewayFees on delivered orders
        netProfit:    { type: Number, default: 0 },  // Sum of financials.netProfit on delivered orders
        codCollected: { type: Number, default: 0 },  // Sum of financials.codAmount on Paid orders
    },

    // ── HR metrics ─────────────────────────────────────────────────────────────
    hr: {
        present:         { type: Number, default: 0 },
        absent:          { type: Number, default: 0 },
        late:            { type: Number, default: 0 },
        overtimeMinutes: { type: Number, default: 0 },
    },

    // ── Stock metrics ──────────────────────────────────────────────────────────
    stock: {
        lowStockVariants: { type: Number, default: 0 },  // Variants at or below reorder level
    },

    generatedAt: { type: Date, default: Date.now }
}, {
    timestamps: false  // generatedAt is explicit
});

// One document per tenant per date — idempotent upsert safe
dailyRollupSchema.index({ tenant: 1, date: 1 }, { unique: true });

// Fast range queries for trend charts: GET /api/analytics/daily?from=2025-01-01&to=2025-01-31
dailyRollupSchema.index({ tenant: 1, date: -1 });

module.exports = mongoose.model('DailyRollup', dailyRollupSchema);
