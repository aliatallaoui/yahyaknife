const mongoose = require('mongoose');

/**
 * AssignmentHistory — immutable audit trail for order reassignment.
 *
 * Every time an order changes hands (agent → agent), a record is created.
 * This prevents disputes and enables manager auditing.
 */
const assignmentHistorySchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    previousAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    newAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignmentMode: {
        type: String,
        enum: ['manual', 'product', 'store', 'round_robin', 'claim', 'auto_least_loaded'],
        required: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true // createdAt = when the reassignment happened
});

assignmentHistorySchema.index({ tenant: 1, order: 1, createdAt: -1 });
assignmentHistorySchema.index({ tenant: 1, newAgent: 1, createdAt: -1 });

module.exports = mongoose.model('AssignmentHistory', assignmentHistorySchema);
