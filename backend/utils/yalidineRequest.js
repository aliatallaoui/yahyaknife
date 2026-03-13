const axios = require('axios');
const logger = require('../shared/logger');
const CircuitBreaker = require('../shared/CircuitBreaker');

const YALIDINE_BASE_URL = 'https://api.yalidine.com/v1';

// Circuit breaker instance for Yalidine API
const yalidineBreaker = new CircuitBreaker({
    name: 'yalidine',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
});

/**
 * Per-courier in-memory rate limiter for Yalidine (5 req/sec).
 * Keyed by courierId to isolate tenants using different Yalidine accounts.
 */
const rateBuckets = new Map();

function checkRateLimit(courierId) {
    const now = Date.now();
    const windowMs = 1000; // 1-second sliding window
    const maxRequests = 5;

    let bucket = rateBuckets.get(courierId);
    if (!bucket) {
        bucket = [];
        rateBuckets.set(courierId, bucket);
    }

    // Purge timestamps older than the window
    while (bucket.length > 0 && bucket[0] <= now - windowMs) {
        bucket.shift();
    }

    if (bucket.length >= maxRequests) {
        throw new Error('Yalidine rate limit exceeded: max 5 requests per second. Please wait.');
    }

    bucket.push(now);
}

/**
 * Wrapper for Axios to handle Yalidine authentication, rate limits, and circuit breaking.
 *
 * Unlike Ecotrack which uses a global CourierSetting document, Yalidine credentials
 * are stored per-courier in the Courier model (apiId + apiToken).
 *
 * @param {string}  method   - 'GET', 'POST', 'PUT', 'DELETE'
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
    checkRateLimit(courier._id.toString());

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
        timeout: 15_000, // 15s — Yalidine can be slower on bulk ops
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
