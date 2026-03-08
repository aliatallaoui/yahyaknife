const mongoose = require('mongoose');

const bomComponentSchema = new mongoose.Schema({
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantityRequired: { type: Number, required: true, min: 0.01 },
    unit: { type: String }, // e.g., 'mm', 'kg'
    estimatedCost: { type: Number, default: 0 }
}, { _id: false });

const billOfMaterialSchema = new mongoose.Schema({
    // A BOM can belong to either a standard product variant OR a Knife Model
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    knifeModelRef: { type: mongoose.Schema.Types.ObjectId, ref: 'KnifeModel' },

    version: { type: String, default: '1.0' },
    components: [bomComponentSchema],
    totalEstimatedCost: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // For custom knives that deviate from standard template
    customOverride: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BillOfMaterial', billOfMaterialSchema);
