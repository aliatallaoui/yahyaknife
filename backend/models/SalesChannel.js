const mongoose = require('mongoose');

const salesChannelSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },

    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    description: { type: String, maxlength: 500 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

    // ── Domain / URL Settings ───────────────────────────────────────────────
    domain: {
        type: { type: String, enum: ['subdomain', 'custom'], default: 'subdomain' },
        subdomain: { type: String, trim: true, lowercase: true, maxlength: 60 },
        customDomain: { type: String, trim: true, lowercase: true, maxlength: 253 },
        sslStatus: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' }
    },

    // ── Pixel & Tracking (channel-level defaults) ───────────────────────────
    pixels: {
        metaPixelId: { type: String, trim: true, maxlength: 30 },
        metaAccessToken: { type: String, trim: true, maxlength: 250 },
        tiktokPixelId: { type: String, trim: true, maxlength: 30 },
        googleAnalyticsId: { type: String, trim: true, maxlength: 30 },
        googleTagManagerId: { type: String, trim: true, maxlength: 30 }
    },

    // ── Branding ────────────────────────────────────────────────────────────
    branding: {
        logo: { type: String },
        favicon: { type: String },
        primaryColor: { type: String, default: '#2563eb' },
        accentColor: { type: String, default: '#f59e0b' },
        fontFamily: { type: String, default: 'Inter' }
    },

    // ── Defaults ────────────────────────────────────────────────────────────
    defaultCourier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' },

    // ── Denormalized Stats ──────────────────────────────────────────────────
    stats: {
        totalPages: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 }
    },

    deletedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// Unique slug per tenant (only active records)
salesChannelSchema.index({ tenant: 1, slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
salesChannelSchema.index({ tenant: 1, status: 1 });
salesChannelSchema.index({ 'domain.subdomain': 1 }, { sparse: true });
salesChannelSchema.index({ 'domain.customDomain': 1 }, { sparse: true });

module.exports = mongoose.model('SalesChannel', salesChannelSchema);
