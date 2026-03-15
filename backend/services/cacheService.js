const logger = require('../shared/logger');
const redis = require('./redisClient');

// Stampede protection: in-flight promises keyed by cache key
const inFlight = new Map();

const cacheService = {
    /**
     * Get or Set a cached value with stampede protection.
     * If multiple callers request the same key concurrently on a cache miss,
     * only one fetch runs — the rest wait on the same promise.
     */
    async getOrSet(key, fetchFunction, ttl = 300) {
        try {
            const cached = await redis.get(key);
            if (cached !== null) {
                return JSON.parse(cached);
            }
        } catch (err) {
            logger.error({ err, cacheKey: key }, 'Redis get error — falling through to fetch');
        }

        // Stampede guard: reuse in-flight fetch if one already started
        if (inFlight.has(key)) {
            return inFlight.get(key);
        }

        const promise = (async () => {
            try {
                const freshData = await fetchFunction();
                // Fire-and-forget set to Redis
                redis.setex(key, ttl, JSON.stringify(freshData)).catch(err => {
                    logger.error({ err, cacheKey: key }, 'Redis set error');
                });
                return freshData;
            } catch (error) {
                logger.error({ err: error, cacheKey: key }, 'Cache Service Error');
                throw error;
            } finally {
                inFlight.delete(key);
            }
        })();

        inFlight.set(key, promise);
        return promise;
    },

    /**
     * Direct get — returns undefined on miss.
     */
    async get(key) {
        try {
            const val = await redis.get(key);
            return val !== null ? JSON.parse(val) : undefined;
        } catch (err) {
            logger.error({ err, cacheKey: key }, 'Redis get error');
            return undefined;
        }
    },

    /**
     * Direct set.
     */
    set(key, value, ttl = 300) {
        redis.setex(key, ttl, JSON.stringify(value)).catch(err => {
            logger.error({ err, cacheKey: key }, 'Redis set error');
        });
    },

    /**
     * Delete a specific cache key. Call this when data mutates.
     */
    del(key) {
        redis.del(key).catch(err => {
            logger.error({ err, cacheKey: key }, 'Redis del error');
        });
    },

    /**
     * Flush all keys matching a specific prefix (e.g., flush all tenant KPIs).
     * Uses SCAN to avoid blocking Redis with KEYS command.
     */
    async flushByPrefix(prefix) {
        try {
            const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
            const pipeline = redis.pipeline();
            let count = 0;

            for await (const keys of stream) {
                if (keys.length > 0) {
                    keys.forEach(k => pipeline.del(k));
                    count += keys.length;
                }
            }

            if (count > 0) {
                await pipeline.exec();
            }
        } catch (err) {
            logger.error({ err, prefix }, 'Redis flushByPrefix error');
        }
    },

    /**
     * Flush the entire cache (all keys in current DB).
     */
    flushAll() {
        redis.flushdb().catch(err => {
            logger.error({ err }, 'Redis flushAll error');
        });
    }
};

module.exports = cacheService;
