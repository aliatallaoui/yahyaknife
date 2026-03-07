const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    joinDate: { type: Date, default: Date.now },
    acquisitionChannel: {
        type: String,
        required: true,
        enum: ['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads', 'Other']
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Churned', 'At Risk'],
        default: 'Active'
    },
    lastLoginDate: { type: Date },
    lastOrderDate: { type: Date },
    totalOrders: { type: Number, default: 0 },
    deliveredOrders: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    netProfitGenerated: { type: Number, default: 0 },
    isReturning: { type: Boolean, default: false },

    // Retention & Cohort Analytics
    cohortMonth: { type: String }, // e.g. "2024-03" for retention graphs
    segment: {
        type: String,
        enum: ['Whale', 'VIP', 'Repeat Buyer', 'One-Time Buyer', 'Dormant'],
        default: 'One-Time Buyer'
    },
    churnRiskScore: { type: Number, default: 0, min: 0, max: 100 }, // AI calculated risk of leaving
    lastInteractionDate: { type: Date, default: Date.now },

    // Risk and Fraud Management (COD Specific)
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    deliverySuccessRate: { type: Number, default: 0 }, // Delivered / Total Sent
    totalRefusals: { type: Number, default: 0 },
    refusalRate: { type: Number, default: 0 },
    fraudProbability: { type: Number, default: 0, min: 0, max: 100 },
    repeatedRefusalFlag: { type: Boolean, default: false },
    requiresDeliveryVerification: { type: Boolean, default: false }, // Force manual call before dispatch
    isSuspicious: { type: Boolean, default: false },
    blacklisted: { type: Boolean, default: false } // Auto-blocked from future orders
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
