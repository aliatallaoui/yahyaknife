const logger = require('../shared/logger');
const MonthlyReport = require('../models/MonthlyReport');
const { runMonthlyReport } = require('../jobs/dailyRollup');
const { ok } = require('../shared/utils/ApiResponse');
const { fireAndRetry } = require('../shared/utils/retryAsync');

/**
 * GET /api/analytics/monthly?from=YYYY-MM&to=YYYY-MM
 *
 * Returns monthly report documents for a date range.
 * Max 36 months (3 years) per request.
 */
exports.getMonthlyReports = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { from, to } = req.query;

        if (!from || !to) return res.status(400).json({ message: 'From and to parameters are required (YYYY-MM)' });
        if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to))
            return res.status(400).json({ message: 'Dates must be in YYYY-MM format.' });
        if (from > to)
            return res.status(400).json({ message: 'Start date must be before end date.' });

        const reports = await MonthlyReport.find({ tenant, month: { $gte: from, $lte: to } })
            .populate('agents.topAgentId', 'name')
            .sort({ month: 1 })
            .limit(36)
            .lean();

        res.json(ok({ from, to, count: reports.length, reports }));
    } catch (err) {
        logger.error({ err }, 'Error fetching monthly reports');
        res.status(500).json({ message: 'Failed to load monthly reports. Please try again.' });
    }
};

/**
 * POST /api/analytics/monthly/trigger
 * Body: { month: 'YYYY-MM' } (optional — defaults to previous month)
 *
 * Manually triggers monthly report for a specific month.
 */
exports.triggerMonthlyReport = async (req, res) => {
    try {
        const { month } = req.body;

        if (month && !/^\d{4}-\d{2}$/.test(month))
            return res.status(400).json({ message: 'Month must be in YYYY-MM format.' });

        fireAndRetry('monthlyReport:trigger', () => runMonthlyReport(month));

        res.json(ok({ message: `MonthlyReport triggered for ${month || 'previous month'}` }));
    } catch (err) {
        logger.error({ err }, 'Error triggering monthly report');
        res.status(500).json({ message: 'Failed to generate monthly report. Please try again.' });
    }
};
