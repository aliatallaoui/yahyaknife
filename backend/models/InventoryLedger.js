const mongoose = require('mongoose');

const inventoryLedgerSchema = new mongoose.Schema({
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true,
        index: true
    },
    changeAmount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['Received', 'Shipped', 'Adjusted', 'Reserved', 'Returned'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        // Could refer to an Order, PurchaseOrder, or a manual adjustment record
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String,
        enum: ['Order', 'PurchaseOrder', 'User'], // User for manual adjustments
    },
    notes: {
        type: String
    }
}, { timestamps: true });

// --- Performance Indexes ---
inventoryLedgerSchema.index({ variantId: 1, type: 1, createdAt: -1 }); // Analytics aggregation

// Prevent accidental updates to the ledger - it should be immutable
inventoryLedgerSchema.pre('findOneAndUpdate', function (next) {
    this.options.runValidators = true;
    next(new Error('InventoryLedger records are immutable and cannot be updated.'));
});

inventoryLedgerSchema.pre('updateOne', function (next) {
    next(new Error('InventoryLedger records are immutable and cannot be updated.'));
});

module.exports = mongoose.model('InventoryLedger', inventoryLedgerSchema);
