const mongoose = require('mongoose');

/**
 * TenantMembership — tracks which tenants a user belongs to.
 *
 * A user can have memberships in multiple tenants (e.g., an agency admin
 * managing several client businesses). Each membership carries its own role
 * within that tenant.
 *
 * The User.tenant field remains the "active" tenant (set at login / switch).
 * This model is the source of truth for "which tenants can this user access?"
 */
const tenantMembershipSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null,
    },
    status: {
        type: String,
        enum: ['active', 'invited', 'suspended'],
        default: 'active',
    },
    invitedAt: {
        type: Date,
        default: null,
    },
    joinedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// One membership per user per tenant
tenantMembershipSchema.index({ user: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('TenantMembership', tenantMembershipSchema);
