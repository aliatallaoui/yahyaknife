const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    contactPerson: {
        name: String,
        phone: String,
        email: String
    },
    supplierCategory: {
        type: String,
        enum: ['Steel Foundry', 'Handle Materials', 'Abrasives & Belts', 'Chemicals & Epoxy', 'Packaging', 'General Hardware', 'Other'],
        default: 'General Hardware'
    },
    materialsSupplied: [{ type: String }], // E.g. ['D2 Steel', '1095 Carbon']
    address: {
        street: String,
        city: String,
        country: String
    },
    performanceMetrics: {
        averageLeadTimeDays: { type: Number, default: 0 },
        onTimeDeliveryRate: { type: Number, default: 100 }, // Percentage
        defectRate: { type: Number, default: 0 }, // Percentage
        reliabilityScore: { type: Number, default: 100 } // Calculated score 0-100
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Blacklisted'],
        default: 'Active'
    },
    notes: String
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
