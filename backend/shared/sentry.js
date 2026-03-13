const Sentry = require('@sentry/node');

function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return;

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
        // Filter out noisy or irrelevant errors
        ignoreErrors: ['TokenExpiredError', 'JsonWebTokenError'],
    });
}

module.exports = { initSentry, Sentry };
