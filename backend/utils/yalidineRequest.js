const axios = require('axios');
const logger = require('../shared/logger');
const CircuitBreaker = require('../shared/CircuitBreaker');

const YALIDINE_BASE_URL = 'https://api.yalidine.app/v1';

// Circuit breaker instance for Yalidine API
const yalidineBreaker = new CircuitBreaker({
    name: 'yalidine',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
});

/**
 * Per-courier in-memory rate limiter for Yalidine.
 * Enforces all four Yalidine rate-limit tiers:
 *   5/sec, 50/min, 1000/hour, 10000/day
 *
 * Keyed by courierId to isolate tenants using different Yalidine accounts.
 */
const rateBuckets = new Map();

function checkRateLimit(courierId) {
    const now = Date.now();
    const id = courierId.toString();

    let bucket = rateBuckets.get(id);
    if (!bucket) {
        bucket = [];
        rateBuckets.set(id, bucket);
    }

    // Purge timestamps older than 24h
    const dayAgo = now - 86_400_000;
    while (bucket.length > 0 && bucket[0] <= dayAgo) {
        bucket.shift();
    }

    // Count requests in each window
    const oneSecAgo = now - 1_000;
    const oneMinAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;

    let perSec = 0, perMin = 0, perHour = 0;
    for (let i = bucket.length - 1; i >= 0; i--) {
        const ts = bucket[i];
        if (ts > oneSecAgo) perSec++;
        if (ts > oneMinAgo) perMin++;
        if (ts > oneHourAgo) perHour++;
        else break; // sorted ascending, no need to continue
    }

    if (perSec >= 5) throw new Error('Yalidine rate limit: max 5 requests/second. Please wait.');
    if (perMin >= 50) throw new Error('Yalidine rate limit: max 50 requests/minute. Please wait.');
    if (perHour >= 1000) throw new Error('Yalidine rate limit: max 1000 requests/hour. Please wait.');
    if (bucket.length >= 10000) throw new Error('Yalidine rate limit: max 10000 requests/day. Please wait.');

    bucket.push(now);
}

/**
 * Wrapper for Axios to handle Yalidine authentication, rate limits, and circuit breaking.
 *
 * Unlike Ecotrack which uses a global CourierSetting document, Yalidine credentials
 * are stored per-courier in the Courier model (apiId + apiToken).
 *
 * @param {string}  method   - 'GET', 'POST', 'PATCH', 'DELETE'
 * @param {string}  endpoint - e.g., '/parcels/'
 * @param {object}  courier  - Courier document (must have apiId, apiToken)
 * @param {object}  [data]   - Request body
 * @returns {Promise<object>} - Response data
 */
const yalidineRequest = async (method, endpoint, courier, data = null) => {
    if (!courier.apiId || !courier.apiToken) {
        throw new Error('Yalidine API ID and Token are not configured for this courier.');
    }

    // Rate limit per courier account
    checkRateLimit(courier._id);

    const url = `${YALIDINE_BASE_URL}${endpoint}`;

    const config = {
        method,
        url,
        headers: {
            'X-API-ID': courier.apiId,
            'X-API-TOKEN': courier.apiToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        timeout: 15_000,
        data,
    };

    return yalidineBreaker.fire(async () => {
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error(
                { method, endpoint, status: error.response?.status, responseData: error.response?.data },
                'Yalidine API Error'
            );
            throw error;
        }
    });
};

module.exports = {
    yalidineRequest,
    yalidineBreaker,
    YALIDINE_BASE_URL,
};
