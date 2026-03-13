const AppError = require('./AppError');
const logger = require('../logger');
const { Sentry } = require('../sentry');

/**
 * Global Express error handler.
 * Mount as the LAST middleware in server.js:
 *   app.use(errorHandler);
 *
 * All errors thrown from controllers/services land here.
 * Controllers should call next(error) or throw AppError — never write res.status(500) inline.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    // ── Operational errors (AppError) — safe to expose to client ─────────────
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {})
            }
        });
    }

    // ── Mongoose validation errors ────────────────────────────────────────────
    if (err.name === 'ValidationError') {
        const fields = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(422).json({
            success: false,
            error: { code: 'VALIDATION_FAILED', message: 'Validation failed', details: { fields } }
        });
    }

    // ── Mongoose cast error (e.g., invalid ObjectId in query) ────────────────
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ID', message: `Invalid value for field: ${err.path}` }
        });
    }

    // ── Mongoose duplicate key ────────────────────────────────────────────────
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_KEY', message: `${field} already exists`, details: { field } }
        });
    }

    // ── JWT errors ────────────────────────────────────────────────────────────
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
        });
    }

    // ── Unknown / programming errors — never leak stack to client ─────────────
    logger.error({ err, url: req.originalUrl, method: req.method, tenant: req.user?.tenant, requestId: req.id }, 'Unhandled error');
    Sentry.captureException(err, { extra: { url: req.originalUrl, method: req.method, tenant: req.user?.tenant, requestId: req.id } });
    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
            requestId: req.id
        }
    });
};

module.exports = errorHandler;
