/**
 * ApiResponse — standardized HTTP response format for the entire API.
 *
 * All responses follow the shape:
 *   { success: true,  data: {...}, meta: {...} }
 *   { success: false, error: { code, message, details } }
 *
 * Usage in a controller:
 *   const { ok, created, paginated } = require('../shared/utils/ApiResponse');
 *
 *   res.json(ok(order));
 *   res.status(201).json(created(order));
 *   res.json(paginated(orders, { nextCursor, hasNextPage, total }));
 */

/** 200 success with optional meta */
const ok = (data, meta = null) => ({
    success: true,
    data,
    ...(meta ? { meta } : {})
});

/** 201 created */
const created = (data) => ({
    success: true,
    data
});

/** Paginated list response */
const paginated = (items, { nextCursor = null, hasNextPage = false, total = null, stageCounts = null } = {}) => ({
    success: true,
    data: items,
    meta: {
        pagination: {
            nextCursor,
            hasNextPage,
            ...(total !== null ? { total } : {}),
            ...(stageCounts ? { stageCounts } : {})
        }
    }
});

/** Simple message response (for mutations with no body to return) */
const message = (msg, extra = {}) => ({
    success: true,
    message: msg,
    ...extra
});

module.exports = { ok, created, paginated, message };
