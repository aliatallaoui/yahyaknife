const mongoose = require('mongoose');

const agentProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    compensationModel: {
        type: String,
        enum: ['Fixed', 'Commission', 'Hybrid'],
        default: 'Fixed'
    },
    baseSalary: {
        type: Number,
        default: 40000 // default DZD
    },
    commissionPerDelivery: {
        type: Number,
        default: 100 // default DZD per delivered order
    },
    assignmentMode: {
        type: String,
        enum: ['Manual', 'Auto_RoundRobin', 'Region'],
        default: 'Manual'
    },
    assignedRegions: [{
        type: String // Wilaya names for region-based routing
    }],
    dailyOrderLimit: {
        type: Number,
        default: 50
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AgentProfile', agentProfileSchema);
