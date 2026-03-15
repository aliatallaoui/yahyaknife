const mongoose = require('mongoose');

const courierSettingSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    providerName: {
        type: String,
        default: 'ECOTRACK',
        required: true
    },
    apiUrl: {
        type: String,
        required: true,
        default: 'https://api.ecotrack.dz/v1'
    },
    apiToken: {
        type: String,
        default: '',
        select: false
    },
    connectionStatus: {
        type: String,
        enum: ['Valid', 'Invalid Token', 'Not Allowed', 'Unreachable'],
        default: 'Invalid Token'
    },
    lastValidatedAt: {
        type: Date
    },
    rateLimits: {
        requestsPerMinute: { type: Number, default: 50 },
        requestsPerHour: { type: Number, default: 1500 },
        requestsPerDay: { type: Number, default: 15000 }
    },
    currentUsage: {
        minuteCount: { type: Number, default: 0 },
        hourCount: { type: Number, default: 0 },
        dayCount: { type: Number, default: 0 },
        lastRequestAt: { type: Date }
    }
}, { timestamps: true });

// Normalize apiUrl — strip trailing slashes on save
courierSettingSchema.pre('save', function () {
    if (this.isModified('apiUrl') && this.apiUrl) {
        this.apiUrl = this.apiUrl.trim().replace(/\/+$/, '');
    }
});

// One setting per provider per tenant
courierSettingSchema.index({ tenant: 1, providerName: 1 }, { unique: true });

module.exports = mongoose.model('CourierSetting', courierSettingSchema);
