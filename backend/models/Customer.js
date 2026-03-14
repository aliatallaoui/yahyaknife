const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    phone: { type: String }, // Primary identifier - uniqueness handled via compound index below
    email: { type: String },
    joinDate: { type: Date, default: Date.now },
    acquisitionChannel: {
        type: String,
        enum: ['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads', 'Other'],
        default: 'Direct Traffic'
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
    cancelledOrders: { type: Number, default: 0 },
    returnRate: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
    requiresDeliveryVerification: { type: Boolean, default: false }, // Force manual call before dispatch
    blacklisted: { type: Boolean, default: false }, // Auto-blocked from future orders
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Tenant Isolating Unique Constraints & Speedy Lookups
customerSchema.index(
    { tenant: 1, phone: 1 }, 
    { unique: true, partialFilterExpression: { phone: { $exists: true, $type: "string" } } }
);
customerSchema.index(
    { tenant: 1, email: 1 }, 
    { unique: true, partialFilterExpression: { email: { $exists: true, $type: "string" } } }
);

// Advanced Full-Text Index for instant global searches
customerSchema.index(
    { name: 'text', phone: 'text', email: 'text' },
    { weights: { phone: 10, name: 5, email: 1 }, name: "customer_text_idx" }
);
customerSchema.index({ tenant: 1, riskLevel: 1, _id: -1 });
customerSchema.index({ tenant: 1, status: 1, _id: -1 }); // Segment analysis & active customer lists
customerSchema.index({ tenant: 1, lifetimeValue: -1 }); // Top customer analytics sort

module.exports = mongoose.model('Customer', customerSchema);
