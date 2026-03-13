const logger = require('../shared/logger');
const DailyRollup = require('../models/DailyRollup');
const { runDailyRollup } = require('../jobs/dailyRollup');
const { ok } = require('../shared/utils/ApiResponse');
const { fireAndRetry } = require('../shared/utils/retryAsync');

/**
 * GET /api/analytics/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns daily rollup documents for a date range (max 366 days).
 * Frontend uses this to render trend line charts for orders, revenue, HR.
 */
exports.getDailyRollups = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { from, to } = req.query;

        if (!from || !to) return res.status(400).json({ error: 'from and to date params required (YYYY-MM-DD)' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
            return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
        if (from > to)
            return res.status(400).json({ error: 'from must be before to' });

        const rollups = await DailyRollup.find({ tenant, date: { $gte: from, $lte: to } })
            .sort({ date: 1 })
            .limit(366)
            .lean();

        res.json(ok({ from, to, count: rollups.length, rollups }));
    } catch (err) {
        logger.error({ err }, 'Error fetching daily rollups');
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * POST /api/analytics/daily/trigger
 * Body: { date: 'YYYY-MM-DD' } (optional — defaults to yesterday)
 *
 * Manually triggers rollup for a specific date.
 * Useful for backfilling historical data or re-running a failed job.
 */
exports.triggerDailyRollup = async (req, res) => {
    try {
        const { date } = req.body;

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
            return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });

        // Run async — don't await in request cycle for large datasets
        fireAndRetry('dailyRollup:trigger', () => runDailyRollup(date));

        res.json(ok({ message: `DailyRollup triggered for ${date || 'yesterday'}` }));
    } catch (err) {
        logger.error({ err }, 'Error triggering daily rollup');
        res.status(500).json({ error: 'Server error' });
    }
};
