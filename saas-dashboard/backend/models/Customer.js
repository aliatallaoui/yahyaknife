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
    lifetimeValue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    netProfitGenerated: { type: Number, default: 0 },
    isReturning: { type: Boolean, default: false },

    // Risk and Fraud Management
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    totalRefusals: { type: Number, default: 0 },
    refusalRate: { type: Number, default: 0 },
    isSuspicious: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
