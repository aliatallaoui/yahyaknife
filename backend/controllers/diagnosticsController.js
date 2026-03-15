const mongoose = require('mongoose');
const os = require('os');
const logger = require('../shared/logger');
const redis = require('../services/redisClient');
const { isRedisAvailable } = require('../services/redisClient');
const queueService = require('../services/queueService');
const { ecotrackBreaker } = require('../utils/ecotrackRequest');
const Order = require('../models/Order');
const Tenant = require('../models/Tenant');

// ─── Request metrics (in-process counters) ──────────────────────────────────

const metrics = {
    startTime: Date.now(),
    requestCount: 0,
    errorCount: 0,
    statusCodes: {},
    slowRequests: [],      // last 20 requests > 1s
    avgResponseTime: 0,
    _responseTimes: [],    // rolling window of last 500
};

const MAX_ROLLING = 500;
const SLOW_THRESHOLD_MS = 1000;
const MAX_SLOW_LOG = 20;

/**
 * Middleware to track request metrics.
 * Mount EARLY in the middleware chain.
 */
function requestMetricsMiddleware(req, res, next) {
    const start = Date.now();
    metrics.requestCount++;

    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        const code = res.statusCode;

        // Status code distribution
        const bucket = `${Math.floor(code / 100)}xx`;
        metrics.statusCodes[bucket] = (metrics.statusCodes[bucket] || 0) + 1;

        if (code >= 400) metrics.errorCount++;

        // Rolling response times
        metrics._responseTimes.push(duration);
        if (metrics._responseTimes.length > MAX_ROLLING) metrics._responseTimes.shift();
        metrics.avgResponseTime = Math.round(
            metrics._responseTimes.reduce((a, b) => a + b, 0) / metrics._responseTimes.length
        );

        // Slow request log
        if (duration > SLOW_THRESHOLD_MS && !req.url.includes('/health')) {
            metrics.slowRequests.push({
                method: req.method,
                url: req.originalUrl || req.url,
                duration,
                status: code,
                timestamp: new Date().toISOString(),
            });
            if (metrics.slowRequests.length > MAX_SLOW_LOG) metrics.slowRequests.shift();
        }

        originalEnd.apply(res, args);
    };

    next();
}

// ─── Diagnostics endpoint ───────────────────────────────────────────────────

async function getDiagnostics(_req, res) {
    const now = Date.now();

    // 1. System info
    const system = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
        usedMemoryPct: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
        uptimeHours: Math.round(os.uptime() / 3600 * 10) / 10,
    };

    // 2. Process info
    const mem = process.memoryUsage();
    const processInfo = {
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        worker: process.env.NODE_APP_INSTANCE || 'single',
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        heapUsedPct: Math.round(mem.heapUsed / mem.heapTotal * 100),
    };

    // 3. MongoDB
    const mongoState = mongoose.connection.readyState;
    const mongoStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    let mongoDbStats = null;
    let mongoPoolInfo = null;

    if (mongoState === 1) {
        try {
            const admin = mongoose.connection.db.admin();
            const serverStatus = await admin.command({ serverStatus: 1, repl: 0, metrics: 0, wiredTiger: 0 });
            mongoDbStats = {
                version: serverStatus.version,
                connections: serverStatus.connections,
                opcounters: serverStatus.opcounters,
                network: {
                    bytesInMB: Math.round((serverStatus.network?.bytesIn || 0) / 1024 / 1024),
                    bytesOutMB: Math.round((serverStatus.network?.bytesOut || 0) / 1024 / 1024),
                    numRequests: serverStatus.network?.numRequests || 0,
                },
            };
        } catch (e) {
            // Atlas free tier may not support serverStatus
            mongoDbStats = { error: 'serverStatus not available (Atlas restriction)' };
        }

        try {
            const dbStats = await mongoose.connection.db.stats();
            mongoPoolInfo = {
                dbName: dbStats.db,
                collections: dbStats.collections,
                documents: dbStats.objects,
                dataSize: formatBytes(dbStats.dataSize),
                storageSize: formatBytes(dbStats.storageSize),
                indexes: dbStats.indexes,
                indexSize: formatBytes(dbStats.indexSize),
            };
        } catch (e) {
            mongoPoolInfo = { error: e.message };
        }
    }

    const mongodb = {
        status: mongoStates[mongoState] || 'unknown',
        poolSize: mongoose.connection.config?.maxPoolSize || 'unknown',
        serverStats: mongoDbStats,
        dbStats: mongoPoolInfo,
    };

    // 4. Redis
    let redisInfo = { available: false, mode: 'disabled' };
    if (isRedisAvailable()) {
        try {
            const info = await redis.info('memory');
            const keyspace = await redis.info('keyspace');
            const clients = await redis.info('clients');
            const dbSize = await redis.dbsize();

            redisInfo = {
                available: true,
                mode: 'active',
                keys: dbSize,
                memory: parseRedisInfo(info, 'used_memory_human'),
                peakMemory: parseRedisInfo(info, 'used_memory_peak_human'),
                connectedClients: parseRedisInfo(clients, 'connected_clients'),
                blockedClients: parseRedisInfo(clients, 'blocked_clients'),
                keyspaceHits: parseRedisInfo(keyspace, 'keyspace_hits'),
                keyspaceMisses: parseRedisInfo(keyspace, 'keyspace_misses'),
            };
        } catch (e) {
            redisInfo = { available: false, mode: 'error', error: e.message };
        }
    }

    // 5. BullMQ queue stats
    let queueStats = null;
    try {
        queueStats = await queueService.stats();
    } catch (e) {
        queueStats = { error: e.message };
    }

    // 6. Circuit breakers
    const circuits = {
        ecotrack: ecotrackBreaker.status(),
    };

    // 7. Request metrics
    const requestMetrics = {
        totalRequests: metrics.requestCount,
        totalErrors: metrics.errorCount,
        errorRate: metrics.requestCount > 0
            ? Math.round(metrics.errorCount / metrics.requestCount * 10000) / 100 + '%'
            : '0%',
        avgResponseTimeMs: metrics.avgResponseTime,
        statusDistribution: metrics.statusCodes,
        slowRequests: metrics.slowRequests.slice(-10).reverse(),
        metricsWindowSize: metrics._responseTimes.length,
    };

    // 8. Throughput (req/s estimate from rolling window)
    let throughput = 'N/A';
    if (metrics._responseTimes.length > 1) {
        const elapsed = (now - metrics.startTime) / 1000;
        throughput = Math.round(metrics.requestCount / elapsed * 100) / 100 + ' req/s';
    }

    // 9. Quick DB health pulse — count recent orders (last 24h)
    let recentActivity = null;
    if (mongoState === 1) {
        try {
            const oneDayAgo = new Date(now - 86400000);
            const [ordersToday, activeTenantsToday] = await Promise.all([
                Order.countDocuments({ createdAt: { $gte: oneDayAgo }, deletedAt: null }),
                Order.distinct('tenant', { createdAt: { $gte: oneDayAgo }, deletedAt: null }),
            ]);
            const totalTenants = await Tenant.countDocuments({ isActive: true });
            recentActivity = {
                ordersLast24h: ordersToday,
                activeTenantsLast24h: activeTenantsToday.length,
                totalActiveTenants: totalTenants,
            };
        } catch (e) {
            recentActivity = { error: e.message };
        }
    }

    // 10. Environment flags
    const environment = {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        sentryEnabled: !!process.env.SENTRY_DSN,
        redisConfigured: !!process.env.REDIS_URL,
        corsOrigin: process.env.CORS_ORIGIN || 'localhost defaults',
        pm2: !!process.env.NODE_APP_INSTANCE,
    };

    res.json({
        timestamp: new Date().toISOString(),
        system,
        process: processInfo,
        mongodb,
        redis: redisInfo,
        queues: queueStats,
        circuits,
        requestMetrics,
        throughput,
        recentActivity,
        environment,
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function parseRedisInfo(info, key) {
    const match = info.match(new RegExp(`${key}:(.+)`));
    return match ? match[1].trim() : null;
}

module.exports = { getDiagnostics, requestMetricsMiddleware };
