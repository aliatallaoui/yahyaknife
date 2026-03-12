const mongoose = require('mongoose');

/**
 * CourierSettlement — immutable record of each COD cash settlement event.
 *
 * When a courier hands over collected cash, `settleCourierCash` creates one
 * of these documents. This gives finance:
 * - Full audit trail of all settlements
 * - Which orders were covered by each settlement
 * - Who authorized each settlement and when
 * - Unsettled balance tracking over time
 */
const courierSettlementSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    courier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Courier',
        required: true
    },
    // The user who recorded/authorized this settlement
    settledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Total cash received from courier in this settlement event
    amountSettled: {
        type: Number,
        required: true,
        min: 0
    },
    // Orders that were flipped to 'Paid' by this settlement
    ordersSettled: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }],
    // How many orders were left partially covered (amount was insufficient)
    remainingAmount: {
        type: Number,
        default: 0
    },
    // Snapshot of courier's pending remittance BEFORE this settlement
    previousPendingRemittance: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    settledAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false  // settledAt is the canonical timestamp
});

// Financial queries: all settlements for a tenant in a date range
courierSettlementSchema.index({ tenant: 1, settledAt: -1 });
// Per-courier settlement history
courierSettlementSchema.index({ courier: 1, settledAt: -1 });

module.exports = mongoose.model('CourierSettlement', courierSettlementSchema);
