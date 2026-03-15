const dotenv = require('dotenv');
dotenv.config(); // Load env FIRST so Sentry DSN is available

const { initSentry, Sentry } = require('./shared/sentry');
initSentry(); // Must run before importing Express

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const dashboardRoutes = require('./routes/dashboard');
const financeRoutes = require('./routes/finance');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const customerRoutes = require('./routes/customerRoutes');
const hrRoutes = require('./routes/hr');
const roleRoutes = require('./routes/roles');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courierSettingsRoutes = require('./routes/courierSettings');
const shipmentRoutes = require('./routes/shipments');
const transactionRoutes = require('./routes/transactions');
const courierRoutes = require('./routes/couriers');
const intelligenceRoutes = require('./routes/intelligenceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const procurementRoutes = require('./routes/procurement');
const supportRoutes = require('./routes/support');
const aiRoutes = require('./routes/aiRoutes');
const exportRoutes = require('./routes/exportRoutes');
const callCenterRoutes = require('./routes/callCenterRoutes');
const salesChannelRoutes = require('./routes/salesChannels');
const tenantRoutes = require('./routes/tenants');
const platformAdminRoutes = require('./routes/platformAdmin');
const webhookRoutes = require('./routes/webhooks');
const storefrontRoutes = require('./routes/storefront');
const storeWebhookRoutes = require('./routes/storeWebhooks');
const logisticsRoutes = require('./routes/logistics');
const path = require('path');
const { initJobs } = require('./cron/scheduler');
const errorHandler = require('./shared/errors/errorHandler');
const logger = require('./shared/logger');
const requestId = require('./shared/middleware/requestId');

// ─── Startup Env Validation ──────────────────────────────────────────────────

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'CREDENTIAL_ENCRYPTION_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    logger.fatal({ missing }, 'Missing required environment variables');
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    logger.fatal('JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Determine which Mongo URI to use based on the environment
const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

// ─── Security ────────────────────────────────────────────────────────────────

// Trust Nginx reverse proxy so rate-limiter keys on real client IP
app.set('trust proxy', 1);

// Remove server fingerprint header
app.disable('x-powered-by');

// Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow static /exports to be fetched cross-origin
}));

// Compression handled by Nginx in production — only use in dev
if (!IS_PRODUCTION) {
    const compression = require('compression');
    app.use(compression());
}

// ─── CORS ────────────────────────────────────────────────────────────────────

if (IS_PRODUCTION && !process.env.CORS_ORIGIN) {
    logger.fatal('CORS_ORIGIN env var is required in production. Exiting.');
    process.exit(1);
}

const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173']; // dev-only whitelist

app.use(cors({ origin: corsOrigin, credentials: true }));

// ─── Request Correlation ID ──────────────────────────────────────────────────

app.use(requestId);

// ─── Request Logging ─────────────────────────────────────────────────────────

app.use(pinoHttp({
    logger,
    // pino-http reads req.id automatically as the correlation ID
    genReqId: (req) => req.id,
    autoLogging: {
        ignore: (req) => req.url === '/health', // don't spam logs with health checks
    },
    customProps(req) {
        return {
            requestId: req.id,
            tenant: req.user?.tenant,
            userId: req.user?._id,
        };
    },
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
            };
        },
        res(res) {
            return { statusCode: res.statusCode };
        },
    },
}));

// ─── Request Timeout ─────────────────────────────────────────────────────────

app.use((_req, res, next) => {
    res.setTimeout(30_000, () => {
        if (!res.headersSent) {
            res.status(408).json({ message: 'Request timed out. Please try again.' });
        }
    });
    next();
});

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Global Rate Limiter ─────────────────────────────────────────────────────

const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200,                 // 200 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ─── Per-Tenant Rate Limiter ────────────────────────────────────────────────
// Applied globally but only activates after auth populates req.user.tenant.
// Limits are derived from the tenant's plan tier (Free=60/min, Enterprise=1000/min).
const { tenantRateLimit } = require('./middleware/tenantRateLimit');
app.use('/api/', tenantRateLimit);

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1; // 1 = connected
    const { ecotrackBreaker } = require('./utils/ecotrackRequest');
    const circuitStatus = ecotrackBreaker.status();
    const workerId = process.env.NODE_APP_INSTANCE || 'single';

    if (dbReady) {
        res.status(200).json({
            status: 'ok',
            db: 'connected',
            uptime: process.uptime(),
            worker: workerId,
            circuits: { ecotrack: circuitStatus }
        });
    } else {
        res.status(503).json({ status: 'degraded', db: 'disconnected', worker: workerId, circuits: { ecotrack: circuitStatus } });
    }
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courier-settings', courierSettingsRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/call-center', callCenterRoutes);
app.use('/api/sales-channels', salesChannelRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/platform', platformAdminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/s', storefrontRoutes);  // Public storefront — no auth
app.use('/api/logistics', logisticsRoutes);
app.use('/api/integrations/webhooks', storeWebhookRoutes);  // Inbound store webhooks — no auth, HMAC verified

// Static files — in production, Nginx serves these directly (faster)
// /exports requires auth — contains tenant business data (CSV exports, GDPR data)
const { protect: staticProtect } = require('./middleware/authMiddleware');
app.use('/exports', staticProtect, (req, res, next) => {
    // Only allow downloading files that belong to the requesting tenant
    const fileName = req.path.replace(/^\//, '');
    const tenantId = req.user?.tenant?.toString();
    if (tenantId && !fileName.includes(tenantId)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
}, express.static(path.join(__dirname, 'public', 'exports')));
// /uploads is public — product images displayed on storefront
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global error handler — must be last
app.use(errorHandler);

// ─── Database & Server Start ─────────────────────────────────────────────────

let server;

// Connection pool + timeout tuning
mongoose.connect(MONGO_URI, {
    maxPoolSize: 20,            // max concurrent connections (default 5 too low for prod)
    minPoolSize: 2,             // keep warm connections ready
    serverSelectionTimeoutMS: 5000,  // fail fast if cluster unreachable
    socketTimeoutMS: 45000,          // kill stale sockets after 45s
    heartbeatFrequencyMS: 10000,     // detect topology changes faster
})
    .then(() => {
        logger.info('Connected to MongoDB');
        initJobs(); // Start background workers (only on primary worker in cluster mode)

        // Start BullMQ export worker
        const queueService = require('./services/queueService');
        queueService.startWorker();

        // Register webhook event listeners
        const { registerWebhookListeners } = require('./listeners/webhookListener');
        registerWebhookListeners();
    })
    .catch(err => {
        logger.fatal({ err }, 'MongoDB connection error');
        process.exit(1); // Fail fast if DB unreachable at startup
    });

// Mongoose connection event handlers
mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB runtime error');
});
mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — Mongoose will auto-reconnect');
});
mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
});

server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development', worker: process.env.NODE_APP_INSTANCE || 'single' }, 'Server started');
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function gracefulShutdown(signal) {
    logger.info({ signal }, 'Shutting down gracefully');
    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');
            try {
                // Close Redis connection
                const redis = require('./services/redisClient');
                await redis.quit();
                logger.info('Redis connection closed');
            } catch (e) {
                // Redis may not be initialized yet
            }
            try {
                await mongoose.connection.close(false);
                logger.info('MongoDB connection closed');
            } catch (e) {
                // ignore
            }
            process.exit(0);
        });
    }
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Process Crash Handlers ──────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    gracefulShutdown('uncaughtException');
});
