const mongoose = require('mongoose');

const pageEventSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    landingPage: { type: mongoose.Schema.Types.ObjectId, ref: 'LandingPage', required: true },
    salesChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesChannel', required: true },

    event: {
        type: String,
        required: true,
        enum: ['page_view', 'product_view', 'form_start', 'form_submit', 'order_created']
    },

    // ── Session Tracking ────────────────────────────────────────────────────
    sessionId: { type: String, required: true, maxlength: 64 },
    visitorId: { type: String, maxlength: 64 }, // persistent cookie for unique visitor tracking

    // ── UTM Parameters ──────────────────────────────────────────────────────
    utm: {
        source: { type: String, maxlength: 100 },
        medium: { type: String, maxlength: 100 },
        campaign: { type: String, maxlength: 200 },
        term: { type: String, maxlength: 100 },
        content: { type: String, maxlength: 200 }
    },

    // ── Device Info ─────────────────────────────────────────────────────────
    device: {
        type: { type: String, enum: ['mobile', 'desktop', 'tablet'] },
        browser: { type: String, maxlength: 50 },
        os: { type: String, maxlength: 50 }
    },

    referrer: { type: String, maxlength: 500 },
    ipHash: { type: String, maxlength: 64 }, // SHA-256 hashed IP for privacy

    // ── Event-specific Data ─────────────────────────────────────────────────
    data: { type: mongoose.Schema.Types.Mixed },

    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: false // only createdAt, no updatedAt
});

// ── Indexes for Analytics Queries ───────────────────────────────────────────

pageEventSchema.index({ landingPage: 1, event: 1, createdAt: -1 });
pageEventSchema.index({ salesChannel: 1, event: 1, createdAt: -1 });
pageEventSchema.index({ tenant: 1, createdAt: -1 });
pageEventSchema.index({ landingPage: 1, visitorId: 1 }); // unique visitor counting
pageEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: 90 days

module.exports = mongoose.model('PageEvent', pageEventSchema);
