const mongoose = require('mongoose');

const reorderAlertSchema = new mongoose.Schema({
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true
    },
    sku: { type: String },
    productName: { type: String },
    currentStock: { type: Number, required: true },
    reservedStock: { type: Number, default: 0 },
    availableStock: { type: Number, required: true },
    reorderLevel: { type: Number, required: true },
    suggestedQuantity: { type: Number, required: true },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    status: {
        type: String,
        enum: ['Open', 'PO Created', 'Dismissed'],
        default: 'Open'
    },
    linkedPO: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder'
    },
    detectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// One open alert per variant at a time
reorderAlertSchema.index({ variantId: 1, status: 1 });
reorderAlertSchema.index({ status: 1, detectedAt: -1 });

module.exports = mongoose.model('ReorderAlert', reorderAlertSchema);
