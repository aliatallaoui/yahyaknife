const mongoose = require('mongoose');

const mappingSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    salesChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesChannel', required: true },

    // External store identifiers
    externalProductId: { type: String, required: true, maxlength: 200 },
    externalVariantId: { type: String, maxlength: 200 },
    externalProductName: { type: String, maxlength: 300 },
    externalSku: { type: String, maxlength: 100 },

    // Internal mapping
    internalProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    internalVariant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },

    lastSyncedAt: { type: Date },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Unique external product+variant per channel (active only)
mappingSchema.index(
    { tenant: 1, salesChannel: 1, externalProductId: 1, externalVariantId: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);
// Reverse lookup: find all channels mapping to a given internal variant
mappingSchema.index({ tenant: 1, salesChannel: 1, internalVariant: 1 });

module.exports = mongoose.model('SalesChannelProductMapping', mappingSchema);
