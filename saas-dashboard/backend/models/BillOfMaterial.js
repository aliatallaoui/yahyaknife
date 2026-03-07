const mongoose = require('mongoose');

const bomComponentSchema = new mongoose.Schema({
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantityRequired: { type: Number, required: true, min: 0.01 }
}, { _id: false });

const billOfMaterialSchema = new mongoose.Schema({
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true, unique: true },
    version: { type: String, default: '1.0' },
    components: [bomComponentSchema],
    totalEstimatedCost: { type: Number, default: 0 }, // Calculated sum of (material.cost * quantity)
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('BillOfMaterial', billOfMaterialSchema);
