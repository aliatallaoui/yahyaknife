const mongoose = require('mongoose');

const orderStatusHistorySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    status: { type: String, required: true },
    previousStatus: { type: String },  // null on initial creation
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: { type: String }
}, { timestamps: false });

// Fast per-order history lookup
orderStatusHistorySchema.index({ orderId: 1, changedAt: 1 });
// Tenant-level status change queries (e.g. how many Confirmed today)
orderStatusHistorySchema.index({ tenant: 1, status: 1, changedAt: -1 });

module.exports = mongoose.model('OrderStatusHistory', orderStatusHistorySchema);
