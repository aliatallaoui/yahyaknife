const cron = require('node-cron');
const Customer = require('../models/Customer');
const Tenant = require('../models/Tenant');
const { initCronJobs } = require('./trackerSync');
const { generateKPISnapshots } = require('../jobs/kpiGenerator');
const { runDailyRollup, runWeeklyReport } = require('../jobs/dailyRollup');
const { runReorderCheck } = require('../jobs/reorderCheck');
const { runCallCenterFollowUp } = require('../jobs/callCenterFollowUp');
const logger = require('../shared/logger');

// Background Worker Scheduler
const initJobs = () => {
    // 1. Daily Reorder Point Check (Runs every day at Midnight)
    cron.schedule('0 0 * * *', async () => {
        logger.info("[CRON] Running Daily Reorder Point Check...");
        try {
            const result = await runReorderCheck();
            logger.info(`[CRON] Reorder Check Complete. Created ${result.created} alerts, skipped ${result.skipped} existing.`);
        } catch (err) {
            logger.error({ err }, '[CRON] Error (Reorder Check)');
        }
    });

    // 2. Daily Fraud Sweep & Courier Auto-Assignment logic (Runs at 1 AM)
    cron.schedule('0 1 * * *', async () => {
        logger.info("[CRON] Running COD Fraud Sweep & Courier Sync...");
        try {
            const tenants = await Tenant.find({ isActive: true }).select('_id').lean();
            let totalFlagged = 0;
            let totalBlacklisted = 0;

            for (const tenant of tenants) {
                try {
                    // A. Fraud Sweep: Flag customers with refusal rate 30–50%, Blacklist > 50%
                    const [flagged, blacklisted] = await Promise.all([
                        Customer.updateMany(
                            { tenant: tenant._id, refusalRate: { $gt: 30, $lte: 50 }, totalRefusals: { $gte: 2 } },
                            { $set: { requiresDeliveryVerification: true } }
                        ),
                        Customer.updateMany(
                            { tenant: tenant._id, refusalRate: { $gt: 50 }, totalRefusals: { $gte: 3 } },
                            { $set: { blacklisted: true, status: 'At Risk' } }
                        )
                    ]);
                    totalFlagged += flagged.modifiedCount;
                    totalBlacklisted += blacklisted.modifiedCount;
                } catch (tenantErr) {
                    logger.error({ err: tenantErr, tenantId: tenant._id }, '[CRON] Fraud sweep error for tenant');
                }
            }

            logger.info({ flagged: totalFlagged, blacklisted: totalBlacklisted, tenantCount: tenants.length },
                '[CRON] Fraud Sweep complete');
        } catch (err) {
            logger.error({ err }, '[CRON] Error (Fraud/Courier)');
        }
    });

    // 3. Nightly Daily Rollup (Runs at 00:30 — previous day is fully closed by then)
    cron.schedule('30 0 * * *', async () => {
        logger.info('[CRON] Running nightly DailyRollup');
        try {
            await runDailyRollup(); // defaults to yesterday
        } catch (err) {
            logger.error({ err }, '[CRON] Error (DailyRollup)');
        }
    });

    // 4. Weekly Report (Runs Sunday at 23:59 — aggregates Mon–Sun daily rollups)
    cron.schedule('59 23 * * 0', async () => {
        logger.info('[CRON] Running weekly WeeklyReport');
        try {
            await runWeeklyReport();
        } catch (err) {
            logger.error({ err }, '[CRON] Error (WeeklyReport)');
        }
    });

    // 5. Call Center Follow-Up (Runs every 2 hours — requeues No Answer, escalates stale orders)
    cron.schedule('0 */2 * * *', async () => {
        logger.info('[CRON] Running Call Center Follow-Up...');
        try {
            const result = await runCallCenterFollowUp();
            logger.info({ ...result }, '[CRON] Call Center Follow-Up complete');
        } catch (err) {
            logger.error({ err }, '[CRON] Error (Call Center Follow-Up)');
        }
    });

    // 6. Ecotrack API Status Syncer
    initCronJobs();

    // 7. High-Performance Dashboard Materialized View Generator (Runs every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
        try {
            await generateKPISnapshots();
        } catch (err) {
            logger.error({ err }, '[CRON] Error (KPI Snapshots)');
        }
    });

    // Run the KPI generator immediately on boot to pre-warm the dashboard
    generateKPISnapshots().catch(err => logger.error({ err }, '[CRON] Error (KPI boot pre-warm)'));

    logger.info("✅ Background Worker Scheduler Initialized.");
};

module.exports = { initJobs };
