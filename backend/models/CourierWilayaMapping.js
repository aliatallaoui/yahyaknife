const mongoose = require('mongoose');

/**
 * CourierWilayaMapping — How a specific courier refers to each wilaya.
 *
 * Tenant-scoped: each tenant's courier account may have different mappings.
 * Populated when courier coverage is synced from the courier API.
 */
const courierWilayaMappingSchema = new mongoose.Schema({
    tenant:           { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    courierId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true },
    internalWilaya:   { type: mongoose.Schema.Types.ObjectId, ref: 'InternalWilaya', required: true },
    courierWilayaCode: { type: String, required: true },
    courierWilayaName: { type: String, required: true, trim: true }
}, { timestamps: true });

// One mapping per courier per wilaya per tenant
courierWilayaMappingSchema.index(
    { tenant: 1, courierId: 1, internalWilaya: 1 },
    { unique: true }
);
courierWilayaMappingSchema.index({ tenant: 1, courierId: 1, courierWilayaCode: 1 });

module.exports = mongoose.model('CourierWilayaMapping', courierWilayaMappingSchema);
