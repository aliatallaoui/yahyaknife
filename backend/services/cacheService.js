const NodeCache = require('node-cache');

// Standard TTL: 5 minutes (300 seconds) for KPI dashboards
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const cacheService = {
    /**
     * Get or Set a cached value.
     * @param {string} key - Cache key (e.g. `tenant:${tenantId}:dashboardKPIs`)
     * @param {Function} fetchFunction - Async function that returns the data if cache misses.
     * @param {number} [ttl=300] - Override default TTL in seconds.
     * @returns {Promise<any>} The cached or newly fetched data.
     */
    async getOrSet(key, fetchFunction, ttl = 300) {
        const cachedData = cache.get(key);
        if (cachedData !== undefined) {
            return cachedData;
        }

        try {
            const freshData = await fetchFunction();
            // Cache the fresh data
            cache.set(key, freshData, ttl);
            return freshData;
        } catch (error) {
            console.error(`Cache Service Error for key [${key}]:`, error.message);
            throw error;
        }
    },

    /**
     * Delete a specific cache key. Call this when data mutates (e.g. an order is updated).
     * @param {string} key 
     */
    del(key) {
        cache.del(key);
    },

    /**
     * Flush all keys matching a specific prefix (e.g., flush all tenant KPIs).
     * @param {string} prefix 
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
