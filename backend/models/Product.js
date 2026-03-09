const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String },
    description: { type: String },
    images: [{ type: String }],
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    isActive: { type: Boolean, default: true },

    // Manufacturing Phase 2 Additions
    isManufactured: { type: Boolean, default: false },
    activeBom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial' }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

productSchema.virtual('variants', {
    ref: 'ProductVariant',
    localField: '_id',
    foreignField: 'productId'
});

module.exports = mongoose.model('Product', productSchema);
