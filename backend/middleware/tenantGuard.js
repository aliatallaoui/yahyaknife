/**
 * tenantGuard — ensures every authenticated request has a tenant context.
 *
 * Must be applied AFTER `protect` (auth middleware) so `req.user` is populated.
 * Returns 400 if the authenticated user has no tenant — this prevents
 * orphan users from making tenant-scoped queries that silently return
 * empty results or, worse, leak cross-tenant data.
 */
const logger = require('../shared/logger');

const tenantGuard = (req, res, next) => {
    // Only check if a user is authenticated (protect already ran)
    if (!req.user) return next();

    if (!req.user.tenant) {
        logger.warn({ userId: req.user._id, path: req.originalUrl }, 'tenantGuard: user has no tenant context');
        return res.status(400).json({
            message: 'No tenant context. Contact your administrator.',
            code: 'NO_TENANT',
        });
    }

    next();
};

module.exports = tenantGuard;
