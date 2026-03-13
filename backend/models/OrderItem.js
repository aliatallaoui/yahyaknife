const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    sku: { type: String },
    name: { type: String, required: true }, // Snapshot of the name at time of order
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
    weightPerUnit: { type: Number, default: 0 }
}, { timestamps: true });

// Pre-save to ensure lineTotal is calculated if not provided
orderItemSchema.pre('save', function (next) {
    this.lineTotal = this.quantity * this.unitPrice;
    next();
});

orderItemSchema.index({ tenant: 1, orderId: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
