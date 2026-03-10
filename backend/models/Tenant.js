const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tenant name is required'],
        trim: true
    },
    planTier: {
        type: String,
        enum: ['Free', 'Basic', 'Pro', 'Enterprise'],
        default: 'Free'
    },
    settings: {
        currency: { type: String, default: 'DZD' },
        timezone: { type: String, default: 'Africa/Algiers' }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
