const logger = require('../shared/logger');
const redis = require('../services/redisClient');

/**
 * Per-tenant rate limiter backed by Redis.
 *
 * Uses a sliding window counter per tenant with atomic Redis operations.
 * Works correctly across PM2 cluster workers.
 */

// Plan tier → requests per minute
const PLAN_RATE_LIMITS = {
    Free:       60,
    Basic:      150,
    Pro:        400,
    Enterprise: 1000,
};

// Window size in seconds
const WINDOW_SEC = 60;

async function tenantRateLimit(req, res, next) {
    // Only apply after auth populates req.user
    if (!req.user || !req.user.tenant) {
        return next();
    }

    const tenantId = req.user.tenant.toString();
    const planTier = req.tenantPlanTier || 'Free';
    const limit = PLAN_RATE_LIMITS[planTier] || PLAN_RATE_LIMITS.Free;
    const key = `rl:tenant:${tenantId}`;

    try {
        // Atomic increment + TTL in one pipeline
        const results = await redis.pipeline()
            .incr(key)
            .ttl(key)
            .exec();

        const count = results[0][1];   // Current request count
        const ttl = results[1][1];     // Remaining TTL

        // Set expiry on first request in window
        if (ttl === -1) {
            await redis.expire(key, WINDOW_SEC);
        }

        const remaining = Math.max(0, limit - count);

        // Standard rate-limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + (ttl > 0 ? ttl : WINDOW_SEC));

        if (count > limit) {
            const retryAfter = ttl > 0 ? ttl : WINDOW_SEC;
            res.setHeader('Retry-After', retryAfter);

            logger.warn({ tenantId, limit, planTier, count }, 'Tenant rate limit exceeded');

            return res.status(429).json({
                message: 'Rate limit exceeded for your workspace. Please try again shortly.',
                code: 'TENANT_RATE_LIMITED',
                retryAfter,
            });
        }
    } catch (err) {
        // Redis failure — fail open (allow request through)
        logger.error({ err, tenantId }, 'Tenant rate limiter Redis error — failing open');
    }

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
