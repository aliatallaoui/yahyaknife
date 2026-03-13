const AuditLog = require('../../models/AuditLog');
const logger = require('../logger');

/**
 * Fire-and-forget audit log helper.
 * Never throws — failures are logged to stderr but don't affect the request.
 *
 * @param {Object} opts
 * @param {import('mongoose').Types.ObjectId} opts.tenant
 * @param {import('mongoose').Types.ObjectId} opts.actorUserId
 * @param {string} opts.action   - e.g. 'CREATE_TRANSACTION', 'APPROVE_PAYROLL'
 * @param {string} opts.module   - e.g. 'finance', 'hr', 'auth'
 * @param {Object} [opts.metadata]      - free-form context
 * @param {import('mongoose').Types.ObjectId} [opts.targetUserId]
 */
function audit({ tenant, actorUserId, action, module, metadata, targetUserId }) {
    AuditLog.create({
        tenant,
        actorUserId,
        targetUserId: targetUserId || null,
        action,
        module,
        metadata: metadata || {}
    }).catch(err => {
        logger.error({ err }, '[AuditLog] Failed to write');
    });
}

module.exports = audit;
