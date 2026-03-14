const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const cacheService = require('../services/cacheService');
const logger = require('../shared/logger');
const { LEGACY_PERMISSION_MAP } = require('../config/permissions');

const AUTH_CACHE_TTL = 600; // 10 minutes
const TENANT_SUB_CACHE_TTL = 120; // 2 minutes (subscription status can change)

// Paths that are protected (need auth) but exempt from subscription + tenant check
// so the frontend can always fetch user/subscription info
const SUBSCRIPTION_EXEMPT_PATHS = ['/api/auth/me', '/api/auth/refresh', '/api/auth/tenants', '/api/auth/switch-tenant'];

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            // Verify token (CPU-only, no DB hit)
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Cache user + populated role to avoid DB hit on every request
            const cacheKey = `auth:user:${decoded.id}`;
            const user = await cacheService.getOrSet(cacheKey, async () => {
                const u = await User.findById(decoded.id).select('-password').populate('role', 'name permissions');
                return u ? u.toObject() : null;
            }, AUTH_CACHE_TTL);

            if (!user || !user.isActive) {
                return res.status(401).json({ message: 'Your account is inactive or not found. Please contact support.' });
            }

            req.user = user;

            // Prefer tenant from JWT claim (authoritative, set at login)
            // Fall back to user.tenant for tokens issued before this change
            if (decoded.tenant) {
                req.user.tenant = decoded.tenant;
            }

            // Impersonation flag — platform admin viewing another tenant
            if (decoded.impersonating) {
                req.user.impersonating = true;
                req.user.realTenant = decoded.realTenant;
            }

            // Compute effective permissions
            let effectivePermissions = new Set(user.role ? user.role.permissions : []);

            // Apply granular user overrides
            if (user.permissionOverrides && user.permissionOverrides.length > 0) {
                user.permissionOverrides.forEach(override => {
                    const perm = override.permission;
                    if (override.effect === 'allow') {
                        effectivePermissions.add(perm);
                    } else if (override.effect === 'deny') {
                        effectivePermissions.delete(perm);
                    }
                });
            }

            // Normalise legacy permission strings → new PERMS constants
            const snapshot = [...effectivePermissions];
            for (const perm of snapshot) {
                const mapped = LEGACY_PERMISSION_MAP[perm];
                if (mapped) effectivePermissions.add(mapped);
            }

            req.user.computedPermissions = Array.from(effectivePermissions);

            // ─── Subscription / Trial Gate ───────────────────────────────
            // Skip for exempt paths (e.g. /me so frontend can always read subscription status)
            const isExempt = SUBSCRIPTION_EXEMPT_PATHS.some(p => req.originalUrl.startsWith(p));

            // Platform admins and /api/platform routes bypass subscription + tenant guards
            const isPlatformAdmin = user.platformRole === 'platform_admin';
            const isPlatformRoute = req.originalUrl.startsWith('/api/platform');
            if (isPlatformAdmin && isPlatformRoute) {
                return next();
            }

            if (!isExempt && user.tenant) {
                const subCacheKey = `tenant:sub:${user.tenant}`;
                const tenant = await cacheService.getOrSet(subCacheKey, async () => {
                    return Tenant.findById(user.tenant).select('subscription isActive planTier').lean();
                }, TENANT_SUB_CACHE_TTL);

                // Attach plan tier for downstream middleware (e.g. tenant rate limiter)
                if (tenant) req.tenantPlanTier = tenant.planTier || 'Free';

                if (!tenant || !tenant.isActive) {
                    return res.status(403).json({ message: 'Tenant is inactive.' });
                }

                const sub = tenant.subscription;
                if (sub) {
                    const now = new Date();

                    if (sub.status === 'active') {
                        if (sub.currentPeriodEnd && now > new Date(sub.currentPeriodEnd)) {
                            await Tenant.findByIdAndUpdate(user.tenant, { 'subscription.status': 'expired' });
                            cacheService.del(subCacheKey);
                            return res.status(402).json({
                                code: 'SUBSCRIPTION_EXPIRED',
                                message: 'Your subscription has expired. Please renew your plan.',
                            });
                        }
                    } else if (sub.status === 'trialing') {
                        if (sub.trialEndsAt && now > new Date(sub.trialEndsAt)) {
                            await Tenant.findByIdAndUpdate(user.tenant, { 'subscription.status': 'expired' });
                            cacheService.del(subCacheKey);
                            return res.status(402).json({
                                code: 'TRIAL_EXPIRED',
                                message: 'Your 14-day free trial has ended. Please choose a plan to continue.',
                            });
                        }
                    } else if (['past_due', 'canceled', 'expired'].includes(sub.status)) {
                        return res.status(402).json({
                            code: 'SUBSCRIPTION_INACTIVE',
                            message: 'Your subscription is not active. Please renew your plan.',
                        });
                    }
                }
                // Legacy tenants without subscription field — allow through
            }

            // ─── Tenant Guard ─────────────────────────────────────────────
            // After auth + subscription checks, ensure user has a tenant context.
            // Exempt paths (e.g. /me) skip this — they need to work for orphan users too.
            if (!isExempt && !req.user.tenant) {
                logger.warn({ userId: req.user._id, path: req.originalUrl }, 'protect: user has no tenant context');
                return res.status(400).json({
                    message: 'No tenant context. Contact your administrator.',
                    code: 'NO_TENANT',
                });
            }

            return next();
        } catch (error) {
            logger.error({ err: error }, 'Auth token verification failed');
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
    }

    return res.status(401).json({ message: 'Authentication required. Please log in.' });
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required. Please log in.' });
        }

        // Legacy check for string role fallback
        if (req.user.role === 'Super Admin' || (req.user.role && req.user.role.name === 'Super Admin')) {
            return next();
        }

        const userRoleName = req.user.role ? req.user.role.name : null;

        if (!roles.includes(userRoleName)) {
            return res.status(403).json({
                message: 'You don\'t have permission to perform this action.'
            });
        }
        next();
    };
};

/**
 * Modern RBAC permission guard.
 * @param {string} permission - The module.action to require (e.g. 'financial.read')
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required. Please log in.' });
        }

        // Check computed permissions
        if (req.user.computedPermissions && req.user.computedPermissions.includes(permission)) {
            return next();
        }

        // Fallback for ultimate super admins who might not have permissions populated properly
        if (req.user.role && req.user.role.name === 'Super Admin') {
            return next();
        }

        return res.status(403).json({
            message: 'You don\'t have permission to perform this action.'
        });
    };
};

module.exports = { protect, authorizeRoles, requirePermission };
