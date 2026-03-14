/**
 * WooCommerce API request helper — Axios wrapper with circuit breaker and rate limiting.
 *
 * Each WooCommerce store (SalesChannel) gets its own rate bucket.
 * Follows the same pattern as yalidineRequest.js.
 *
 * Authentication: WC REST API uses Basic Auth (consumerKey:consumerSecret).
 */

const axios = require('axios');
const logger = require('../shared/logger');
const CircuitBreaker = require('../shared/CircuitBreaker');

// Per-channel circuit breakers (Map<channelId, CircuitBreaker>)
const breakers = new Map();

function getBreaker(channelId) {
    const id = channelId.toString();
    if (!breakers.has(id)) {
        breakers.set(id, new CircuitBreaker({
            name: `woocommerce-${id}`,
            failureThreshold: 5,
            resetTimeoutMs: 30_000,
        }));
    }
    return breakers.get(id);
}

// Per-channel rate limiter (simple: max 30 requests/minute)
const rateBuckets = new Map();

function checkRateLimit(channelId) {
    const now = Date.now();
    const id = channelId.toString();

    let bucket = rateBuckets.get(id);
    if (!bucket) {
        bucket = [];
        rateBuckets.set(id, bucket);
    }

    // Purge timestamps older than 1 minute
    const oneMinAgo = now - 60_000;
    while (bucket.length > 0 && bucket[0] <= oneMinAgo) {
        bucket.shift();
    }

    if (bucket.length >= 30) {
        throw new Error('WooCommerce rate limit: max 30 requests/minute per store. Please wait.');
    }

    bucket.push(now);
}

/**
 * Make an authenticated request to a WooCommerce store.
 *
 * @param {string} method - 'GET', 'POST', 'PUT', 'DELETE'
 * @param {string} endpoint - e.g., '/wp-json/wc/v3/orders'
 * @param {object} config - { storeUrl, consumerKey, consumerSecret, channelId }
 * @param {object} [data] - Request body
 * @param {object} [params] - Query parameters
 * @returns {Promise<{ data: object, headers: object }>}
 */
async function woocommerceRequest(method, endpoint, config, data = null, params = {}) {
    const { storeUrl, consumerKey, consumerSecret, channelId } = config;

    if (!storeUrl || !consumerKey || !consumerSecret) {
        throw new Error('WooCommerce store URL and API keys are not configured.');
    }

    checkRateLimit(channelId);

    const baseUrl = storeUrl.replace(/\/$/, '');
    const url = `${baseUrl}${endpoint}`;

    const axiosConfig = {
        method,
        url,
        auth: {
            username: consumerKey,
            password: consumerSecret,
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        params,
        timeout: 15_000,
    };
    if (data) axiosConfig.data = data;

    const breaker = getBreaker(channelId);
    return breaker.fire(async () => {
        try {
            const response = await axios(axiosConfig);
            return { data: response.data, headers: response.headers };
        } catch (error) {
            logger.error(
                { method, endpoint, channelId, status: error.response?.status, responseData: error.response?.data?.message },
                'WooCommerce API Error'
            );
            throw error;
        }
    });
}

module.exports = { woocommerceRequest };
