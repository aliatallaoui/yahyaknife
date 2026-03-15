const Redis = require('ioredis');
const logger = require('../shared/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 10) {
            logger.error('Redis: max retries reached, giving up');
            return null; // Stop retrying
        }
        return Math.min(times * 200, 5000); // Exponential backoff, max 5s
    },
    enableReadyCheck: true,
    lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('reconnecting', () => logger.info('Redis reconnecting...'));

module.exports = redis;
