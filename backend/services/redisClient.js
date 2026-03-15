const Redis = require('ioredis');
const logger = require('../shared/logger');

const REDIS_URL = process.env.REDIS_URL; // Undefined means Redis not configured

let redis;
let redisAvailable = false;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 10) {
                logger.error('Redis: max retries reached, giving up');
                redisAvailable = false;
                return null;
            }
            return Math.min(times * 200, 5000);
        },
        enableReadyCheck: true,
        lazyConnect: false,
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('ready', () => { redisAvailable = true; logger.info('Redis ready'); });
    redis.on('error', (err) => logger.error({ err }, 'Redis error'));
    redis.on('close', () => { redisAvailable = false; logger.warn('Redis connection closed'); });
    redis.on('reconnecting', () => logger.info('Redis reconnecting...'));
} else {
    logger.warn('REDIS_URL not set — Redis features disabled (cache, BullMQ, tenant rate limit)');
    // No-op stub so callers don't crash
    redis = {
        get: async () => null,
        setex: async () => 'OK',
        set: async () => 'OK',
        del: async () => 0,
        expire: async () => 0,
        incr: async () => 1,
        ttl: async () => -1,
        flushdb: async () => 'OK',
        pipeline: () => ({
            incr: function () { return this; },
            ttl: function () { return this; },
            del: function () { return this; },
            exec: async () => [[null, 1], [null, -1]],
        }),
        scanStream: () => { const { Readable } = require('stream'); return Readable.from([]); },
        quit: async () => 'OK',
        status: 'stub',
    };
}

/**
 * Create a BullMQ-compatible Redis connection.
 * BullMQ requires maxRetriesPerRequest: null for blocking commands.
 * Returns null if Redis is not configured.
 */
function createBullMQConnection() {
    if (!REDIS_URL) return null;
    return new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
}

/**
 * Check if Redis is configured and available.
 */
function isRedisAvailable() {
    return !!REDIS_URL && redisAvailable;
}

module.exports = redis;
module.exports.createBullMQConnection = createBullMQConnection;
module.exports.isRedisAvailable = isRedisAvailable;
