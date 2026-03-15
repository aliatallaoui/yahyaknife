const axios = require('axios');
const logger = require('../shared/logger');
const CourierSetting = require('../models/CourierSetting');
const CircuitBreaker = require('../shared/CircuitBreaker');

// Single circuit breaker instance for the Ecotrack external API
const ecotrackBreaker = new CircuitBreaker({
    name: 'ecotrack',
    failureThreshold: 5,   // 5 consecutive failures → OPEN
    resetTimeoutMs: 30_000, // probe again after 30 seconds
});

/**
 * Validates current rate limits before allowing an API call.
 * Uses atomic $inc to prevent race conditions on concurrent requests.
 */
const checkRateLimits = async (settings) => {
    const now = new Date();
    const usage = settings.currentUsage || {};
    const limits = settings.rateLimits || {};

    // Determine which counters need resetting based on time window changes
    const resetFields = {};
    if (!usage.lastRequestAt || now.getDate() !== usage.lastRequestAt.getDate()) {
        resetFields['currentUsage.dayCount'] = 0;
        resetFields['currentUsage.hourCount'] = 0;
        resetFields['currentUsage.minuteCount'] = 0;
    } else if (now.getHours() !== usage.lastRequestAt.getHours()) {
        resetFields['currentUsage.hourCount'] = 0;
        resetFields['currentUsage.minuteCount'] = 0;
    } else if (now.getMinutes() !== usage.lastRequestAt.getMinutes()) {
        resetFields['currentUsage.minuteCount'] = 0;
    }

    // Check limits before incrementing (use current values after potential reset)
    const currentMinute = resetFields['currentUsage.minuteCount'] !== undefined ? 0 : (usage.minuteCount || 0);
    const currentHour = resetFields['currentUsage.hourCount'] !== undefined ? 0 : (usage.hourCount || 0);
    const currentDay = resetFields['currentUsage.dayCount'] !== undefined ? 0 : (usage.dayCount || 0);

    if (currentMinute >= (limits.requestsPerMinute || 50)) {
        throw new Error('Rate limit exceeded: too many requests per minute. Please wait a moment and try again.');
    }
    if (currentHour >= (limits.requestsPerHour || 1500)) {
        throw new Error('Rate limit exceeded: too many requests this hour. Please wait a few minutes and try again.');
    }
    if (currentDay >= (limits.requestsPerDay || 15000)) {
        throw new Error('Rate limit exceeded: daily request limit reached. Please try again tomorrow.');
    }

    // Atomic increment + reset in a single operation (no race condition)
    await CourierSetting.updateOne(
        { _id: settings._id },
        {
            $inc: {
                'currentUsage.minuteCount': 1,
                'currentUsage.hourCount': 1,
                'currentUsage.dayCount': 1,
            },
            $set: {
                ...resetFields,
                'currentUsage.lastRequestAt': now,
            },
        }
    );
};

/**
 * Wrapper for Axios to handle ECOTRACK authentication, rate limits, and circuit breaking.
 * @param {string} method - 'GET', 'POST', 'PUT', 'DELETE'
 * @param {string} endpoint - e.g., '/api/v1/create/order'
 * @param {object} data - Payload body
 * @param {string|ObjectId} tenantId - Tenant context for credential isolation
 */
const ecotrackRequest = async (method, endpoint, data = null, tenantId = null) => {
    const query = { providerName: 'ECOTRACK' };
    if (tenantId) query.tenant = tenantId;

    const settings = await CourierSetting.findOne(query).select('+apiToken');

    if (!settings || !settings.apiToken) {
        throw new Error('Courier API is not configured. Please go to Settings and add your courier API token.');
    }

    if (settings.connectionStatus !== 'Valid' && !endpoint.includes('/validate/token') && !endpoint.includes('/get/wilayas') && !endpoint.includes('/get/fees')) {
        // Allow validation/ping endpoints to bypass connection check
        throw new Error(`Courier connection status is "${settings.connectionStatus}". Please verify your API token in Settings and test the connection.`);
    }

    // Enforce rate limiting
    await checkRateLimits(settings);

    const url = `${settings.apiUrl.replace(/\/+$/, '')}${endpoint}`;

    const config = {
        method: method,
        url: url,
        headers: {
            'Authorization': `Bearer ${settings.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeout: endpoint.includes('/get/fees') ? 30_000 : 10_000, // 30s for fees bulk fetch, 10s otherwise
        data: data
    };

    // Route through circuit breaker
    // Only count 5xx and network errors as breaker failures (not 4xx client errors)
    return ecotrackBreaker.fire(async () => {
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error({ method, endpoint, responseData: error.response?.data }, 'ECOTRACK API Error');
            // 4xx = client error (bad payload, auth issue) — don't trip the breaker
            const status = error.response?.status;
            if (status && status >= 400 && status < 500) {
                error._skipBreakerFailure = true;
            }
            throw error;
        }
    });
};

module.exports = {
    ecotrackRequest,
    checkRateLimits,
    ecotrackBreaker, // exposed for health-check endpoint
};
