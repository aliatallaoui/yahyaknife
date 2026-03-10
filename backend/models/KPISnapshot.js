const mongoose = require('mongoose');

const kpiSnapshotSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['operations', 'courier', 'sales'],
        default: 'operations'
    },
    metrics: {
        newOrdersToday: { type: Number, default: 0 },
        pendingConfirmation: { type: Number, default: 0 },
        confirmedOrders: { type: Number, default: 0 },
        readyForDispatch: { type: Number, default: 0 },
        sentToCourier: { type: Number, default: 0 },
        shippedToday: { type: Number, default: 0 },
        deliveredToday: { type: Number, default: 0 },
        shippedEver: { type: Number, default: 0 },
        returnedEver: { type: Number, default: 0 },
        returnRate: { type: Number, default: 0 }
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// We only need one snapshot per tenant per type (latest snapshot pattern)
// We use upserting, so a unique compound index is ideal:
kpiSnapshotSchema.index({ tenant: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('KPISnapshot', kpiSnapshotSchema);
