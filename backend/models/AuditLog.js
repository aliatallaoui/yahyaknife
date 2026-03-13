// backend/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    actorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    action: {
        type: String,
        required: true // e.g., 'ROLE_ASSIGNED', 'PAYROLL_APPROVED'
    },
    module: {
        type: String, // e.g., 'hr', 'users'
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// --- Performance Indexes ---
auditLogSchema.index({ tenant: 1, createdAt: -1 });                  // Tenant audit trail
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });             // User activity lookup

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
