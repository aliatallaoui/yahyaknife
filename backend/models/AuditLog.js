// backend/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
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

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
