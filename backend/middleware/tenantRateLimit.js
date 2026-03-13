const logger = require('../shared/logger');

/**
 * Per-tenant rate limiter.
 *
 * Tracks request counts per tenant in-memory using a sliding window.
 * Limits are derived from the tenant's plan tier.
 *
 * In production at scale, replace the in-memory store with Redis
 * (e.g. ioredis + sliding window script).
 *
 * Must be placed AFTER `protect` middleware (needs req.user.tenant).
 */

// Plan tier → requests per minute
const PLAN_RATE_LIMITS = {
    Free:       60,
    Basic:      150,
    Pro:        400,
    Enterprise: 1000,
};

// In-memory sliding window store: tenantId → { timestamps[] }
const windows = new Map();

// Window size in ms (1 minute)
const WINDOW_MS = 60 * 1000;

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [key, entry] of windows) {
        // Remove entries with no recent activity
        if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
            windows.delete(key);
        }
    }
}, 5 * 60 * 1000);

function tenantRateLimit(req, res, next) {
    // Only apply after auth populates req.user
    if (!req.user || !req.user.tenant) {
        return next();
    }

    const tenantId = req.user.tenant.toString();
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Get or create window entry
    let entry = windows.get(tenantId);
    if (!entry) {
        entry = { timestamps: [], planTier: null };
        windows.set(tenantId, entry);
    }

    // Prune expired timestamps (before window start)
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Determine limit from cached tenant plan or role data
    // The plan tier is attached by the subscription gate in authMiddleware
    // We cache it per-tenant to avoid repeated lookups
    const planTier = req.tenantPlanTier || entry.planTier || 'Free';
    entry.planTier = planTier;

    const limit = PLAN_RATE_LIMITS[planTier] || PLAN_RATE_LIMITS.Free;
    const remaining = Math.max(0, limit - entry.timestamps.length);

    // Set standard rate-limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + WINDOW_MS) / 1000));

    if (entry.timestamps.length >= limit) {
        const retryAfter = Math.ceil((entry.timestamps[0] + WINDOW_MS - now) / 1000);
        res.setHeader('Retry-After', retryAfter);

        logger.warn({ tenantId, limit, planTier }, 'Tenant rate limit exceeded');

        return res.status(429).json({
            message: 'Rate limit exceeded for your workspace. Please try again shortly.',
            code: 'TENANT_RATE_LIMITED',
            retryAfter,
        });
    }

    entry.timestamps.push(now);
    next();
}

/**
 * Middleware to inject tenant plan tier into the request so the rate limiter
 * can read it without an extra DB call. Called from authMiddleware after
 * subscription check.
 */
function attachPlanTier(planTier) {
    return (req, _res, next) => {
        req.tenantPlanTier = planTier;
        next();
    };
}

module.exports = { tenantRateLimit, attachPlanTier, PLAN_RATE_LIMITS };
