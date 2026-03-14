const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    salesChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesChannel', required: true },

    syncType: {
        type: String,
        enum: ['webhook_received', 'poll_sync', 'manual_import', 'test_connection'],
        required: true
    },
    status: {
        type: String,
        enum: ['success', 'partial', 'failed'],
        required: true
    },

    ordersImported: { type: Number, default: 0 },
    ordersSkipped: { type: Number, default: 0 },
    syncErrors: [{
        message: { type: String },
        externalOrderId: { type: String }
    }],
    duration: { type: Number }, // milliseconds
    metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

syncLogSchema.index({ tenant: 1, salesChannel: 1, createdAt: -1 });
syncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 }); // TTL 90 days

module.exports = mongoose.model('SalesChannelSyncLog', syncLogSchema);
