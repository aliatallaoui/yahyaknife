const axios = require('axios');
const CourierSetting = require('../models/CourierSetting');

/**
 * Validates current rate limits before allowing an API call.
 * If limits are exceeded, throws an Error.
 */
const checkRateLimits = async (settings) => {
    const now = new Date();
    const limits = settings.rateLimits;
    const usage = settings.currentUsage;

    // Reset counters if time windows have passed
    if (!usage.lastRequestAt || now.getDate() !== usage.lastRequestAt.getDate()) {
        usage.dayCount = 0;
        usage.hourCount = 0;
        usage.minuteCount = 0;
    } else if (now.getHours() !== usage.lastRequestAt.getHours()) {
        usage.hourCount = 0;
        usage.minuteCount = 0;
    } else if (now.getMinutes() !== usage.lastRequestAt.getMinutes()) {
        usage.minuteCount = 0;
    }

    // Check limits
    if (usage.minuteCount >= limits.requestsPerMinute) {
        throw new Error('ECOTRACK Rate Limit Exceeded: Max 50 requests per minute.');
    }
    if (usage.hourCount >= limits.requestsPerHour) {
        throw new Error('ECOTRACK Rate Limit Exceeded: Max 1500 requests per hour.');
    }
    if (usage.dayCount >= limits.requestsPerDay) {
        throw new Error('ECOTRACK Rate Limit Exceeded: Max 15000 requests per day.');
    }

    // Increment usage
    usage.minuteCount += 1;
    usage.hourCount += 1;
    usage.dayCount += 1;
    usage.lastRequestAt = now;

    await settings.save();
};

/**
 * Wrapper for Axios to handle ECOTRACK authentication and rate limits.
 * @param {string} method - 'GET', 'POST', 'PUT', 'DELETE'
 * @param {string} endpoint - e.g., '/api/v1/create/order'
 * @param {object} data - Payload body
 */
const ecotrackRequest = async (method, endpoint, data = null) => {
    const settings = await CourierSetting.findOne({ providerName: 'ECOTRACK' });

    if (!settings || !settings.apiToken) {
        throw new Error('ECOTRACK is not configured. Please add an API token in Settings.');
    }

    if (settings.connectionStatus !== 'Valid' && endpoint !== '/api/v1/getWilayas') {
        // Allow the ping endpoint to bypass connection check for validation purposes
        throw new Error(`ECOTRACK connection is currently ${settings.connectionStatus}. Check your token.`);
    }

    // Enforce rate limiting
    await checkRateLimits(settings);

    const url = `${settings.apiUrl}${endpoint}`;

    const config = {
        method: method,
        url: url,
        headers: {
            'Authorization': `Bearer ${settings.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: data
    };

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`ECOTRACK API Error [${method} ${endpoint}]:`, error.response ? error.response.data : error.message);
        throw error;
    }
};

module.exports = {
    ecotrackRequest,
    checkRateLimits
};
