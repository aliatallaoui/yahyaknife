const mongoose = require('mongoose');

/**
 * AssignmentRule — configurable product-agent and store-agent mappings.
 *
 * Types:
 *   - product: maps a product to an agent (orders containing that product → agent)
 *   - store:   maps a sales channel/source to an agent (orders from that store → agent)
 *
 * Priority order (enforced in assignment engine):
 *   1. Manual assignment (order.assignedAgent set explicitly)
 *   2. Product-based (this model, type='product')
 *   3. Store-based (this model, type='store')
 *   4. Round-robin (default fallback)
 */
const assignmentRuleSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    type: {
        type: String,
        enum: ['product', 'store'],
        required: true
    },
    // For type='product': the Product ObjectId
    // For type='store': the SalesChannel ObjectId
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    // The agent user this maps to
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Each source can only be mapped to one agent per tenant
assignmentRuleSchema.index({ tenant: 1, type: 1, sourceId: 1 }, { unique: true });
assignmentRuleSchema.index({ tenant: 1, type: 1, agent: 1 });

module.exports = mongoose.model('AssignmentRule', assignmentRuleSchema);
