const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tenant name is required'],
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null  // set on registration; the first user who creates the tenant
    },
    planTier: {
        type: String,
        enum: ['Free', 'Basic', 'Pro', 'Enterprise'],
        default: 'Free'
    },
    subscription: {
        status: {
            type: String,
            enum: ['trialing', 'active', 'past_due', 'canceled', 'expired'],
            default: 'trialing'
        },
        trialEndsAt: { type: Date, default: null },
        currentPeriodEnd: { type: Date, default: null },
    },

    // ── Plan Limits ─────────────────────────────────────────────────────────
    limits: {
        maxUsers:          { type: Number, default: 2 },      // Free plan default
        maxOrdersPerMonth: { type: Number, default: 100 },
        maxProducts:       { type: Number, default: 20 },
        maxCouriers:       { type: Number, default: 1 },
        smsPerMonth:       { type: Number, default: 0 },
        exportEnabled:     { type: Boolean, default: false },
        apiEnabled:        { type: Boolean, default: false },
    },

    // ── Tenant Settings ─────────────────────────────────────────────────────
    settings: {
        // Regional
        currency:   { type: String, default: 'DZD' },
        timezone:   { type: String, default: 'Africa/Algiers' },
        locale:     { type: String, default: 'ar-DZ' },

        // Branding
        companyName:  { type: String, default: '' },
        logo:         { type: String, default: '' },
        brandColor:   { type: String, default: '#4F46E5' },

        // Business
        businessPhone:   { type: String, default: '' },
        businessAddress: { type: String, default: '' },
        businessHours: {
            open:     { type: String, default: '08:00' },
            close:    { type: String, default: '18:00' },
            workDays: { type: [Number], default: [0, 1, 2, 3, 4] }, // Sun-Thu
        },

        // COD
        codSettings: {
            defaultFeeType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
            defaultFee:     { type: Number, default: 0 },
            paymentMethods: { type: [String], default: ['cash'] },
        },

        // Notifications
        notifications: {
            orderConfirmSms: { type: Boolean, default: false },
            dispatchSms:     { type: Boolean, default: false },
            deliverySms:     { type: Boolean, default: false },
        },
    },

    onboardingCompletedAt: {
        type: Date,
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
