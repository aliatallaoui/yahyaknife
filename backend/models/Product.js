const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String },
    description: { type: String },
    images: [{ type: String }],
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    isActive: { type: Boolean, default: true },

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
