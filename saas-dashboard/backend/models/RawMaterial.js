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
    minimumStock: { type: Number, required: true, default: 10 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }
}, { timestamps: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
