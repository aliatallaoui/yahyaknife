const mongoose = require('mongoose');

/**
 * WebhookDelivery — log of each webhook dispatch attempt.
 * Kept for debugging/audit. Auto-expires after 7 days via TTL index.
 */
const webhookDeliverySchema = new mongoose.Schema({
    webhook: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Webhook',
        required: true,
        index: true,
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    event: {
        type: String,
        required: true,
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    response: {
        statusCode: { type: Number, default: null },
        body:       { type: String, default: '' },
        durationMs: { type: Number, default: null },
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending',
    },
    attempt: {
        type: Number,
        default: 1,
    },
    error: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

// Auto-expire delivery logs after 7 days
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);
