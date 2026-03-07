const mongoose = require('mongoose');

const stockMovementLedgerSchema = new mongoose.Schema({
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse', // Can be null if global or not yet assigned to specific warehouse
    },
    type: {
        type: String,
        enum: ['RECEIPT', 'RESERVATION', 'DEDUCTION', 'RESTORATION', 'ADJUSTMENT', 'TRANSFER'],
        required: true
    },
    quantity: {
        type: Number,
        required: true // Positive for additions, negative for deductions
    },
    referenceId: {
        type: String, // e.g. Order ID, PO ID, or Manual Adjustment ID
        required: true
    },
    referenceModel: {
        type: String,
        enum: ['Order', 'PurchaseOrder', 'Manual', 'Transfer'],
        required: true
    },
    notes: {
        type: String
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Who performed the action (can be system automated)
    }
}, { timestamps: true });

// Index for fast chronological queries per variant
stockMovementLedgerSchema.index({ variantId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovementLedger', stockMovementLedgerSchema);
