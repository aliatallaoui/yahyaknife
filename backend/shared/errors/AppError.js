/**
 * AppError — operational errors that should be surfaced to the client.
 *
 * Usage:
 *   throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
 *   throw new AppError('Insufficient stock', 400, 'STOCK_INSUFFICIENT', { variantId, available });
 */
class AppError extends Error {
    /**
     * @param {string} message       - Human-readable message for the client
     * @param {number} statusCode    - HTTP status code (400, 403, 404, 409, 422, 500...)
     * @param {string} [code]        - Machine-readable error code for frontend handling
     * @param {object} [details]     - Optional structured details (field, context, etc.)
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true; // distinguishes AppError from programming errors
        Error.captureStackTrace(this, this.constructor);
    }

    // ─── Factory helpers ──────────────────────────────────────────────────────

    static notFound(resource = 'Resource') {
        return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
    }

    static forbidden(permission) {
        return new AppError(
            `Forbidden: missing permission '${permission}'`,
            403,
            'FORBIDDEN',
            { permission }
        );
    }

    static validationFailed(fields) {
        return new AppError('Validation failed', 422, 'VALIDATION_FAILED', { fields });
    }

    static unauthorized() {
        return new AppError('Not authorized', 401, 'UNAUTHORIZED');
    }

    static conflict(message, code = 'CONFLICT') {
        return new AppError(message, 409, code);
    }

    static invalidTransition(from, to) {
        return new AppError(
            `Invalid status transition: ${from} → ${to}`,
            409,
            'ORDER_INVALID_TRANSITION',
            { from, to }
        );
    }
}

module.exports = AppError;
