const cron = require('node-cron');
const ProductVariant = require('../models/ProductVariant');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const Supplier = require('../models/Supplier');
const moment = require('moment');
const { initCronJobs } = require('./trackerSync');
const { generateKPISnapshots } = require('../jobs/kpiGenerator');

// Background Worker Scheduler
const initJobs = () => {
    // 1. Daily Low Stock & Dead Stock Alert Scanning (Runs every day at Midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log("[CRON] Running Daily Inventory Health Check...");
        try {
            const variants = await ProductVariant.find({ status: 'Active' });
            let lowCount = 0;

            for (const v of variants) {
                if (v.totalStock <= v.reorderLevel) {
                    lowCount++;
                    // Dispatch Admin Alert / Notification here
                }
            }
            console.log(`[CRON] Inventory Scan Complete. Detected ${lowCount} low stock variants.`);
        } catch (err) {
            console.error("[CRON] Error (Inventory Check):", err);
        }
    });

    // 2. Weekly Financial Report (Runs every Sunday at 11:59 PM)
    cron.schedule('59 23 * * 0', async () => {
        console.log("[CRON] Compiling Weekly Financial Report...");
        try {
            const startOfWeek = moment().startOf('week').toDate();
            const endOfWeek = moment().endOf('week').toDate();

            const weeklySales = await Order.aggregate([
                { $match: { date: { $gte: startOfWeek, $lte: endOfWeek }, status: { $ne: 'Cancelled' } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 }, netProfit: { $sum: "$financials.netProfit" } } }
            ]);

            const report = {
                period: `${moment(startOfWeek).format('YYYY-MM-DD')} to ${moment(endOfWeek).format('YYYY-MM-DD')}`,
                grossSales: weeklySales[0]?.total || 0,
                orders: weeklySales[0]?.count || 0,
                netProfit: weeklySales[0]?.netProfit || 0
            };

            console.log("[CRON] Weekly Report Compiled:", report);
            // Save this to a 'Reports' collection or email the Admin
        } catch (err) {
            console.error("[CRON] Error (Weekly Report):", err);
        }
    });

    // 3. Daily Fraud Sweep & Courier Auto-Assignment logic (Runs at 1 AM)
    cron.schedule('0 1 * * *', async () => {
        console.log("[CRON] Running COD Fraud Sweep & Courier Sync...");
        try {
            // A. Fraud Sweep: Flag customers with refusal rate 30–50%, Blacklist > 50%
            const [flagged, blacklisted] = await Promise.all([
                Customer.updateMany(
                    { refusalRate: { $gt: 30, $lte: 50 }, totalRefusals: { $gte: 2 } },
                    { $set: { isSuspicious: true, requiresDeliveryVerification: true } }
                ),
                Customer.updateMany(
                    { refusalRate: { $gt: 50 }, totalRefusals: { $gte: 3 } },
                    { $set: { blacklisted: true, isSuspicious: true, segment: 'At Risk' } }
                )
            ]);

            console.log(`[CRON] Fraud Sweep complete. Flagged: ${flagged.modifiedCount}, Blacklisted: ${blacklisted.modifiedCount} accounts.`);

            // B. Mock Courier Assignment (e.g., auto assign based on region optimization)
            console.log(`[CRON] Recalculating Courier Regional performance weights for auto-dispatch.`);
        } catch (err) {
            console.error("[CRON] Error (Fraud/Courier):", err);
        }
    });

    // 4. Ecotrack API Status Syncer
    initCronJobs();

    // 5. High-Performance Dashboard Materialized View Generator (Runs every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
        // Also run it off-cycle to pre-warm the DB. In production we might detach this if workers scale horizontally.
        await generateKPISnapshots();
    });

    // Run the KPI generator immediately on boot to pre-warm the dashboard
    generateKPISnapshots();

    console.log("✅ Background Worker Scheduler Initialized.");
};

module.exports = { initJobs };
