/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to the global error handler via next(err).
 *
 * Usage in route files:
 *   const wrap = require('../shared/middleware/asyncHandler');
 *   router.get('/foo', wrap(controller.getFoo));
 *
 * This eliminates the need for try/catch in every controller
 * and ensures all errors reach errorHandler.js → Sentry + structured logging.
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
