const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    description: { type: String },
    category: {
        type: String,
        required: true,
        enum: ['Fabric', 'Metal', 'Electronics', 'Packaging', 'Plastic', 'Chemicals', 'Wood', 'Other']
    },
    costPerUnit: { type: Number, required: true },
    unitOfMeasure: {
        type: String,
        required: true,
        enum: ['kg', 'meters', 'units', 'liters', 'rolls', 'sheets', 'boxes']
    },
    stockLevel: { type: Number, required: true, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    minimumStock: { type: Number, required: true, default: 10 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    warehouseStock: [{
        warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
        quantity: { type: Number, default: 0 },
        binLocation: { type: String }
    }]
}, { timestamps: true });

// Virtual field for actual available quantity
rawMaterialSchema.virtual('availableQuantity').get(function () {
    return (this.stockLevel || 0) - (this.reservedQuantity || 0);
});

rawMaterialSchema.set('toJSON', { virtuals: true });
rawMaterialSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
