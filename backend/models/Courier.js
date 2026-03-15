const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    logo: { type: String }, // URL or path
    status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' },
    
    // API & Integration Settings
    integrationType: { type: String, enum: ['Manual', 'API'], default: 'Manual' },
    apiProvider: { type: String, enum: ['Ecotrack', 'Yalidin', 'Other'], default: 'Ecotrack' },
    apiBaseUrl: { type: String },
    authType: { type: String, enum: ['Bearer Token', 'API Key', 'None'], default: 'Bearer Token' },
    apiId: { type: String, select: false }, // Used for Yalidin X-API-ID
    apiToken: { type: String, select: false },
    accountReference: { type: String },
    testConnectionStatus: { type: String, enum: ['Untested', 'Success', 'Failed'], default: 'Untested' },
    lastSyncAt: { type: Date },

    // Status Mapping Dictionary
    statusMapping: {
        type: Map,
        of: String, // Maps external status strings to internal COD_STATUSES
        default: {}
    },

    notes: { type: String },

    // Generic Settings
    vehicleType: { type: String, enum: ['Motorcycle', 'Van', 'Truck', 'Car'], default: 'Motorcycle' },
    coverageZones: [{ type: String }],
    
    // Pricing (Legacy fallback, advanced pricing in CourierPricing)
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
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

courierSchema.index({ tenant: 1, status: 1 });

// Pre-save hook to calculate pending remittance + normalize URL
courierSchema.pre('save', function () {
    this.pendingRemittance = this.cashCollected - this.cashSettled;
    if (this.isModified('apiBaseUrl') && this.apiBaseUrl) {
        this.apiBaseUrl = this.apiBaseUrl.trim().replace(/\/+$/, '');
    }
});

module.exports = mongoose.model('Courier', courierSchema);
