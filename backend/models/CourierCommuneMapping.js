const mongoose = require('mongoose');

/**
 * CourierCommuneMapping — How a specific courier refers to each commune,
 * plus delivery support flags.
 *
 * Tenant-scoped: each tenant's courier account may have different coverage.
 * Populated when courier coverage is synced from the courier API.
 */
const courierCommuneMappingSchema = new mongoose.Schema({
    tenant:                { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    courierId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true },
    internalCommune:       { type: mongoose.Schema.Types.ObjectId, ref: 'InternalCommune', required: true },
    courierCommuneCode:    { type: String, trim: true, default: '' },
    courierCommuneName:    { type: String, required: true, trim: true },
    supportsHomeDelivery:  { type: Boolean, default: true },
    supportsStopDesk:      { type: Boolean, default: false },
    officeCount:           { type: Number, default: 0 },
    nearestOfficeCommune:  { type: mongoose.Schema.Types.ObjectId, ref: 'InternalCommune', default: null }
}, { timestamps: true });

// One mapping per courier per commune per tenant
courierCommuneMappingSchema.index(
    { tenant: 1, courierId: 1, internalCommune: 1 },
    { unique: true }
);
// Lookup by courier + wilaya (via internalCommune.wilayaCode in aggregation, or separate field)
courierCommuneMappingSchema.index({ tenant: 1, courierId: 1 });

module.exports = mongoose.model('CourierCommuneMapping', courierCommuneMappingSchema);
