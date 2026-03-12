/**
 * paginate middleware
 *
 * Reads ?page=1&limit=20 from query string, attaches parsed values to req.
 * Controllers call:
 *   Model.find(filter).skip(req.skip).limit(req.limit)
 * and return via ApiResponse.paginated(items, req.paginationMeta(total))
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

module.exports = function paginate(req, res, next) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const skip  = (page - 1) * limit;

    req.page  = page;
    req.limit = limit;
    req.skip  = skip;

    /** Call after the DB query to build the meta block. */
    req.paginationMeta = (total) => ({
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
    });

    next();
};
