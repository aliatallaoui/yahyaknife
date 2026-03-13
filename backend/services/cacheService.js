const logger = require('../shared/logger');
const NodeCache = require('node-cache');

// Standard TTL: 5 minutes (300 seconds) for KPI dashboards
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// Stampede protection: in-flight promises keyed by cache key
const inFlight = new Map();

const cacheService = {
    /**
     * Get or Set a cached value with stampede protection.
     * If multiple callers request the same key concurrently on a cache miss,
     * only one fetch runs — the rest wait on the same promise.
     */
    async getOrSet(key, fetchFunction, ttl = 300) {
        const cachedData = cache.get(key);
        if (cachedData !== undefined) {
            return cachedData;
        }

        // Stampede guard: reuse in-flight fetch if one already started
        if (inFlight.has(key)) {
            return inFlight.get(key);
        }

        const promise = (async () => {
            try {
                const freshData = await fetchFunction();
                cache.set(key, freshData, ttl);
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
    get(key) {
        return cache.get(key);
    },

    /**
     * Direct set.
     */
    set(key, value, ttl = 300) {
        cache.set(key, value, ttl);
    },

    /**
     * Delete a specific cache key. Call this when data mutates.
     */
    del(key) {
        cache.del(key);
    },

    /**
     * Flush all keys matching a specific prefix (e.g., flush all tenant KPIs).
     */
    flushByPrefix(prefix) {
        const keys = cache.keys();
        const keysToDelete = keys.filter(key => key.startsWith(prefix));
        if (keysToDelete.length > 0) {
            cache.del(keysToDelete);
        }
    },

    /**
     * Flush the entire cache.
     */
    flushAll() {
        cache.flushAll();
    }
};

module.exports = cacheService;
