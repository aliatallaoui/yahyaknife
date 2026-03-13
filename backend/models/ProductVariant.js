const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    sku: {
        type: String,
        required: true,
        // unique per tenant — enforced by compound index below
    },
    attributes: {
        type: Map,
        of: String, // e.g., { Color: 'Black', Size: 'M' }
        default: {}
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    cost: {
        type: Number,
        required: true,
        min: 0
    },
    totalStock: {
        type: Number,
        required: true,
        default: 0
    },
    reservedStock: {
        type: Number,
        required: true,
        default: 0
    },
    totalSold: {
        type: Number,
        required: true,
        default: 0
    },
    reorderLevel: {
        type: Number,
        required: true,
        default: 10
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    warehouseLocations: [{
        warehouseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Warehouse'
        },
        stock: { type: Number, default: 0 },
        binLocation: { type: String } // e.g., 'A1-B2'
    }],
    callScript: {
        type: String,
        default: ''
    },
    skuGeneratorRules: {
        prefix: String,
        sequentialId: Number
    },
    status: {
        type: String,
        enum: ['Active', 'Draft', 'Archived'],
        default: 'Active'
    },
    lifecycleStatus: {
        type: String,
        enum: ['New', 'Stable', 'Phasing Out', 'Dead Stock'],
        default: 'New'
    },
    analytics: {
        turnoverRate: { type: Number, default: 0 },
        averageMargin: { type: Number, default: 0 },
        restockFrequency: { type: Number, default: 0 }, // days between restocks
        historicalDemand30Days: { type: Number, default: 0 } // Sold last 30 days
    }
}, { timestamps: true });

// --- Performance Indexes ---
productVariantSchema.index({ tenant: 1, sku: 1 }, { unique: true }); // SKU unique per tenant
productVariantSchema.index({ tenant: 1, productId: 1, status: 1 }); // Product detail page
productVariantSchema.index({ tenant: 1, status: 1, totalStock: 1 }); // Low-stock alert scan

productVariantSchema.virtual('availableStock').get(function () {
    return this.totalStock - this.reservedStock;
});

// Ensure virtuals are included when converting to JSON/Object
productVariantSchema.set('toJSON', { virtuals: true });
productVariantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProductVariant', productVariantSchema);
