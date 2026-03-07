const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    vehicleType: { type: String, enum: ['Motorcycle', 'Van', 'Truck', 'Car'], default: 'Motorcycle' },
    coverageZones: [{ type: String }],
    pricingRules: {
        type: String,
        enum: ['Flat', 'Distance-Based'],
        default: 'Flat'
    },
    serviceLevelAgreements: {
        expectedDeliveryWindowHours: { type: Number, default: 48 }
    },

    // Settlement Tracking
    cashCollected: { type: Number, default: 0 },
    cashSettled: { type: Number, default: 0 },
    pendingRemittance: { type: Number, default: 0 },

    // KPIs
    totalDeliveries: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    averageDeliveryTimeMinutes: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 100 },

    status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' }
}, { timestamps: true });

// Pre-save hook to calculate pending remittance
courierSchema.pre('save', function (next) {
    this.pendingRemittance = this.cashCollected - this.cashSettled;
    next();
});

module.exports = mongoose.model('Courier', courierSchema);
