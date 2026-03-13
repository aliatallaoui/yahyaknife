const { randomUUID } = require('crypto');

/**
 * Middleware that ensures every request carries a unique correlation ID.
 *
 * - If the client sends `X-Request-Id`, it is reused (useful for tracing across services).
 * - Otherwise a new UUID v4 is generated.
 * - The ID is attached to `req.id` (consumed by pino-http automatically)
 *   and echoed back in the `X-Request-Id` response header.
 */
function requestId(req, res, next) {
    const id = req.headers['x-request-id'] || randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = requestId;
