const logger = require('../shared/logger');
const WeeklyReport = require('../models/WeeklyReport');
const { ok } = require('../shared/utils/ApiResponse');

/**
 * GET /api/analytics/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns weekly report documents for a date range.
 * Queries by weekStart (ISO Monday date) — returns ascending order.
 * Max 104 weeks (~2 years) per request.
 */
exports.getWeeklyReports = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { from, to } = req.query;

        if (!from || !to) return res.status(400).json({ message: 'From and to date parameters are required (YYYY-MM-DD)' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
            return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format.' });
        if (from > to)
            return res.status(400).json({ message: 'Start date must be before end date.' });

        const reports = await WeeklyReport.find({ tenant, weekStart: { $gte: from, $lte: to } })
            .sort({ weekStart: 1 })
            .limit(104)
            .lean();

        res.json(ok({ from, to, count: reports.length, reports }));
    } catch (err) {
        logger.error({ err }, 'Error fetching weekly reports');
        res.status(500).json({ message: 'Failed to load weekly reports. Please try again.' });
    }
};
