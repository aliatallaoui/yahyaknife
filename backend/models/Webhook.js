const mongoose = require('mongoose');

/**
 * Webhook — tenant-configured HTTP callback for real-time event notifications.
 *
 * Tenants register a URL + events they want to listen to.
 * When a matching event occurs, the system POSTs a JSON payload to the URL.
 */
const webhookSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    url: {
        type: String,
        required: [true, 'Webhook URL is required'],
        validate: {
            validator: v => /^https?:\/\/.+/.test(v),
            message: 'URL must start with http:// or https://',
        },
    },
    events: {
        type: [String],
        required: true,
        validate: {
            validator: v => v.length > 0,
            message: 'At least one event is required',
        },
    },
    secret: {
        type: String,
        default: null,   // HMAC signing secret for payload verification
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    description: {
        type: String,
        default: '',
    },
    // Delivery stats
    stats: {
        totalDeliveries:  { type: Number, default: 0 },
        successCount:     { type: Number, default: 0 },
        failureCount:     { type: Number, default: 0 },
        lastDeliveredAt:  { type: Date, default: null },
        lastFailedAt:     { type: Date, default: null },
        lastStatusCode:   { type: Number, default: null },
        consecutiveFailures: { type: Number, default: 0 },
    },
    // Auto-disable after too many consecutive failures
    autoDisabledAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

webhookSchema.index({ tenant: 1, isActive: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);
