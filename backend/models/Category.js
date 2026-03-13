const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: {
        type: String,
        required: true,
        // unique per tenant — enforced by compound index below
    },
    description: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

categorySchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
