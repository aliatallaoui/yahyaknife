const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    location: {
        address: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    manager: {
        name: String,
        phone: String,
        email: String
    },
    capacity: {
        type: Number, // Optional capacity limits in units or volume
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Maintenance', 'Closed'],
        default: 'Active'
    }
}, { timestamps: true });

warehouseSchema.index({ tenant: 1, code: 1 }, { unique: true });
warehouseSchema.index({ tenant: 1, status: 1 });
warehouseSchema.index({ tenant: 1, name: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
