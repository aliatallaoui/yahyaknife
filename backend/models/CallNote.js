const mongoose = require('mongoose');

/**
 * CallNote — one document per call attempt made by a call center agent.
 *
 * Fixes vs original:
 * - Added `tenant` (required) — was completely unscoped
 * - Fixed `actionType` enum to match ACTION_STATUS_MAP keys in callCenterController
 * - Added `statusBefore` / `statusAfter` for full order audit trail
 * - Added `callAttemptNumber` (1st, 2nd, 3rd call on this order)
 */
const callNoteSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    actionType: {
        type: String,
        enum: [
            // Direct confirmation/cancellation
            'Confirmed',
            'Cancelled',
            // Call attempt outcomes
            'Call 1',
            'Call 2',
            'Call 3',
            'No Answer',
            'Postponed',
            'Wrong Number',
            'Out of Coverage',
            // Non-call actions
            'Address_Updated',
            'General_Note'
        ],
        required: true
    },
    note: {
        type: String,
        default: ''
    },
    callDurationSeconds: {
        type: Number,
        default: 0
    },
    // Order status before and after this action (audit trail)
    statusBefore: { type: String },
    statusAfter:  { type: String },
    // Which call attempt number this was on this order (1, 2, 3...)
    callAttemptNumber: { type: Number },
    // VoIP recording URL if integration is enabled
    recordingUrl: { type: String, default: '' }
}, {
    timestamps: true
});

// Fast lookups: all calls for a tenant today, all calls on an order
callNoteSchema.index({ tenant: 1, createdAt: -1 });
callNoteSchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('CallNote', callNoteSchema);
