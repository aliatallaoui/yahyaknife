const UsageRecord = require('../models/UsageRecord');
const logger = require('../shared/logger');

/**
 * Usage tracker service — increments metered counters per tenant per billing period.
 *
 * Counters are accumulated in a single document per tenant/month using `$inc`
 * (upsert pattern — no read-modify-write race conditions).
 *
 * Usage:
 *   await usageTracker.increment(tenantId, 'orders');
 *   await usageTracker.increment(tenantId, 'smsSent', 3);
 *   const usage = await usageTracker.getUsage(tenantId);
 *   const usage = await usageTracker.getUsage(tenantId, '2026-03');
 */

function currentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const usageTracker = {
    /**
     * Increment a usage counter for the current billing period.
     * @param {string} tenantId
     * @param {'orders'|'smsSent'|'exports'|'apiCalls'|'storageBytes'} counter
     * @param {number} [amount=1]
     */
    async increment(tenantId, counter, amount = 1) {
        if (!tenantId || !counter) return;
        const period = currentPeriod();

        try {
            await UsageRecord.findOneAndUpdate(
                { tenant: tenantId, period },
                { $inc: { [`counters.${counter}`]: amount } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (err) {
            // Non-blocking — usage tracking should never break the request
            logger.error({ err, tenantId, counter, period }, 'usageTracker.increment failed');
        }
    },

    /**
     * Get usage for a tenant for a given period (defaults to current month).
     * @param {string} tenantId
     * @param {string} [period] - 'YYYY-MM' format
     */
    async getUsage(tenantId, period) {
        const p = period || currentPeriod();
        const record = await UsageRecord.findOne({ tenant: tenantId, period: p }).lean();
        return record ? record.counters : { orders: 0, smsSent: 0, exports: 0, apiCalls: 0, storageBytes: 0 };
    },

    /**
     * Get usage history for a tenant (last N months).
     * @param {string} tenantId
     * @param {number} [months=6]
     */
    async getHistory(tenantId, months = 6) {
        return UsageRecord.find({ tenant: tenantId })
            .sort({ period: -1 })
            .limit(months)
            .lean();
    },

    /**
     * Snapshot plan limits at period start. Called by monthly cron.
     * @param {string} tenantId
     * @param {string} planTier
     * @param {Object} limits
     */
    async snapshotPlan(tenantId, planTier, limits) {
        const period = currentPeriod();
        try {
            await UsageRecord.findOneAndUpdate(
                { tenant: tenantId, period },
                { $setOnInsert: { planTier, limits } },
                { upsert: true }
            );
        } catch (err) {
            logger.error({ err, tenantId }, 'usageTracker.snapshotPlan failed');
        }
    },

    currentPeriod,
};

module.exports = usageTracker;
