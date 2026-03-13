const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
    poNumber: { type: String, required: true, unique: true },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Partial', 'Received', 'Cancelled'],
        default: 'Draft'
    },
    items: [{
        itemModel: {
            type: String,
            enum: ['ProductVariant']
        },
        itemRef: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'items.itemModel'
        },
        quantity: { type: Number, required: true, min: 1 },
        receivedQuantity: { type: Number, default: 0 },
        unitCost: { type: Number, required: true, min: 0 }
    }],
    totalAmount: {
        type: Number,
        required: true,
        default: 0
    },
    expectedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    notes: {
        type: String
    }
}, { timestamps: true });

// Pre-save calc for totalAmount
purchaseOrderSchema.pre('save', function () {
    if (this.items && this.items.length > 0) {
        this.totalAmount = this.items.reduce((total, item) => total + (item.quantity * item.unitCost), 0);
    } else {
        this.totalAmount = 0;
    }
});

purchaseOrderSchema.index({ supplier: 1, status: 1 });
purchaseOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
