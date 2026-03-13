// backend/models/Role.js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    isSystemRole: {
        type: Boolean,
        default: false, // Core roles cannot be deleted
    },
    permissions: [{
        type: String
    }],
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null  // null for system roles (shared across all tenants)
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// Compound unique: role name must be unique within a tenant (or within system roles)
roleSchema.index({ name: 1, tenant: 1 }, { unique: true });

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
