const Redis = require('ioredis');
const logger = require('../shared/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Shared connection for cache, rate limiting, etc.
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 10) {
            logger.error('Redis: max retries reached, giving up');
            return null;
        }
        return Math.min(times * 200, 5000);
    },
    enableReadyCheck: true,
    lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('reconnecting', () => logger.info('Redis reconnecting...'));

/**
 * Create a BullMQ-compatible Redis connection.
 * BullMQ requires maxRetriesPerRequest: null for blocking commands.
 */
function createBullMQConnection() {
    return new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
}

module.exports = redis;
module.exports.createBullMQConnection = createBullMQConnection;
