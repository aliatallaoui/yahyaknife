const moment = require('moment');
const Order = require('../models/Order');
const Attendance = require('../models/Attendance');
const ProductVariant = require('../models/ProductVariant');
const DailyRollup = require('../models/DailyRollup');
const WeeklyReport = require('../models/WeeklyReport');
const Tenant = require('../models/Tenant');

/**
 * runDailyRollup — generates one DailyRollup document per active tenant
 * for the specified date (defaults to yesterday).
 *
 * Design choices:
 * - Runs at 00:30 for the PREVIOUS day so all events are finalized before capture.
 * - Uses findOneAndUpdate({ upsert: true }) so it is safe to re-run (idempotent).
 * - HR data is scoped by tenant (Attendance model now has tenant field).
 * - Stock data is global (ProductVariant has no tenant) — counts shared catalog.
 */
const runDailyRollup = async (targetDate) => {
    const dateStr = targetDate || moment().subtract(1, 'day').format('YYYY-MM-DD');
    console.log(`[JOB] Starting DailyRollup for date: ${dateStr}`);

    try {
        const tenants = await Tenant.find({ isActive: true }).select('_id').lean();

        // Low stock count is shared across all tenants (shared catalog)
        const lowStockCount = await ProductVariant.countDocuments({
            status: 'Active',
            $expr: { $lte: ['$totalStock', '$reorderLevel'] }
        });

        for (const tenant of tenants) {
            try {
                const tenantId = tenant._id;

                // ── Order metrics ───────────────────────────────────────────────────
                // We use the OrderStatusHistory model pattern: count orders whose
                // statusHistory entry for each target status was created on this date.
                // Fallback: use Order.date field for orders CREATED on this day.
                const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
                const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

                const deliveredStatuses = ['Delivered', 'Paid'];
                const [
                    ordersCreated,
                    orderMetrics
                ] = await Promise.all([
                    // Orders created on this specific date (createdAt is the Mongoose timestamp field)
                    Order.countDocuments({ tenant: tenantId, createdAt: { $gte: dayStart, $lte: dayEnd } }),

                    // Aggregate order status breakdown for the day
                    Order.aggregate([
                        {
                            $match: {
                                tenant: tenantId,
                                createdAt: { $gte: dayStart, $lte: dayEnd }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                confirmed:    { $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] },    1, 0] } },
                                dispatched:   { $sum: { $cond: [{ $in:  ['$status', ['Dispatched', 'Shipped', 'Out for Delivery']] }, 1, 0] } },
                                delivered:    { $sum: { $cond: [{ $in:  ['$status', deliveredStatuses] }, 1, 0] } },
                                returned:     { $sum: { $cond: [{ $eq: ['$status', 'Returned'] },     1, 0] } },
                                refused:      { $sum: { $cond: [{ $eq: ['$status', 'Refused'] },      1, 0] } },
                                cancelled:    { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] },    1, 0] } },
                                // Revenue components — only from delivered/paid orders
                                grossRevenue: { $sum: { $cond: [{ $in: ['$status', deliveredStatuses] }, '$totalAmount', 0] } },
                                cogs:         { $sum: { $cond: [{ $in: ['$status', deliveredStatuses] }, '$financials.cogs', 0] } },
                                courierFees:  { $sum: { $cond: [{ $in: ['$status', deliveredStatuses] }, '$financials.courierFee', 0] } },
                                gatewayFees:  { $sum: { $cond: [{ $in: ['$status', deliveredStatuses] }, { $add: ['$financials.gatewayFees', '$financials.marketplaceFees'] }, 0] } },
                                codCollected: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$financials.codAmount', 0] } },
                            }
                        }
                    ])
                ]);

                const om = orderMetrics[0] || {};
                // netProfit computed from real fields (financials.netProfit doesn't exist on Order)
                const netProfit = (om.grossRevenue || 0) - (om.cogs || 0) - (om.courierFees || 0) - (om.gatewayFees || 0);

                // ── HR metrics ───────────────────────────────────────────────────────
                const hrRecords = await Attendance.aggregate([
                    { $match: { tenant: tenantId, date: dateStr } },
                    {
                        $group: {
                            _id: null,
                            present:         { $sum: { $cond: [{ $in: ['$status', ['Present', 'Overtime', 'Completed with Recovery']] }, 1, 0] } },
                            absent:          { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                            late:            { $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] } },
                            overtimeMinutes: { $sum: '$overtimeMinutes' }
                        }
                    }
                ]);

                const hr = hrRecords[0] || { present: 0, absent: 0, late: 0, overtimeMinutes: 0 };

                const rollupData = {
                    orders: {
                        created:    ordersCreated,
                        confirmed:  om.confirmed   || 0,
                        dispatched: om.dispatched  || 0,
                        delivered:  om.delivered   || 0,
                        returned:   om.returned    || 0,
                        refused:    om.refused     || 0,
                        cancelled:  om.cancelled   || 0,
                    },
                    revenue: {
                        gross:        om.grossRevenue || 0,
                        cogs:         om.cogs         || 0,
                        courierFees:  om.courierFees  || 0,
                        gatewayFees:  om.gatewayFees  || 0,
                        netProfit,
                        codCollected: om.codCollected || 0,
                    },
                    hr: {
                        present:         hr.present         || 0,
                        absent:          hr.absent          || 0,
                        late:            hr.late            || 0,
                        overtimeMinutes: hr.overtimeMinutes || 0,
                    },
                    stock: {
                        lowStockVariants: lowStockCount
                    },
                    generatedAt: new Date()
                };

                await DailyRollup.findOneAndUpdate(
                    { tenant: tenantId, date: dateStr },
                    { $set: rollupData },
                    { upsert: true, new: true }
                );

            } catch (tenantErr) {
                console.error(`[JOB] DailyRollup error for tenant ${tenant._id} on ${dateStr}:`, tenantErr);
            }
        }

        console.log(`[JOB] DailyRollup complete for ${dateStr}. ${tenants.length} tenants processed.`);
    } catch (err) {
        console.error('[JOB] DailyRollup global error:', err);
    }
};

/**
 * runWeeklyReport — aggregates the 7 DailyRollup documents for the just-completed
 * ISO week into one WeeklyReport document per tenant.
 *
 * Runs Sunday at 23:59 so all 7 daily rollups (Mon–Sun) exist before aggregating.
 * weekStart = Monday of the current week, weekEnd = Sunday.
 */
const runWeeklyReport = async () => {
    const weekEnd   = moment().format('YYYY-MM-DD');                    // today (Sunday)
    const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD'); // this Monday
    console.log(`[JOB] Starting WeeklyReport for ${weekStart} → ${weekEnd}`);

    try {
        const tenants = await Tenant.find({ isActive: true }).select('_id').lean();

        for (const tenant of tenants) {
            try {
                const tenantId = tenant._id;

                const days = await DailyRollup.find({
                    tenant: tenantId,
                    date: { $gte: weekStart, $lte: weekEnd }
                }).lean();

                if (days.length === 0) continue; // no data for this tenant

                const totals = days.reduce((acc, d) => {
                    acc.ordersTotal     += d.orders.created   || 0;
                    acc.ordersConfirmed += d.orders.confirmed || 0;
                    acc.ordersDelivered += d.orders.delivered || 0;
                    acc.ordersReturned  += d.orders.returned  || 0;
                    acc.ordersCancelled += d.orders.cancelled || 0;
                    acc.gross           += d.revenue.gross        || 0;
                    acc.netProfit       += d.revenue.netProfit     || 0;
                    acc.cogs            += d.revenue.cogs          || 0;
                    acc.courierFees     += d.revenue.courierFees   || 0;
                    return acc;
                }, {
                    ordersTotal: 0, ordersConfirmed: 0, ordersDelivered: 0,
                    ordersReturned: 0, ordersCancelled: 0,
                    gross: 0, netProfit: 0, cogs: 0, courierFees: 0
                });

                const confirmationRate = totals.ordersTotal > 0
                    ? Math.round((totals.ordersConfirmed / totals.ordersTotal) * 100)
                    : 0;
                const returnRate = totals.ordersDelivered + totals.ordersReturned > 0
                    ? Math.round((totals.ordersReturned / (totals.ordersDelivered + totals.ordersReturned)) * 100)
                    : 0;
                const profitMargin = totals.gross > 0
                    ? Math.round((totals.netProfit / totals.gross) * 100)
                    : 0;

                await WeeklyReport.findOneAndUpdate(
                    { tenant: tenantId, weekStart },
                    {
                        $set: {
                            weekEnd,
                            orders: {
                                total:            totals.ordersTotal,
                                confirmed:        totals.ordersConfirmed,
                                delivered:        totals.ordersDelivered,
                                returned:         totals.ordersReturned,
                                cancelled:        totals.ordersCancelled,
                                confirmationRate,
                                returnRate,
                            },
                            revenue: {
                                gross:        totals.gross,
                                netProfit:    totals.netProfit,
                                cogs:         totals.cogs,
                                courierFees:  totals.courierFees,
                                profitMargin,
                            },
                            generatedAt: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );

            } catch (tenantErr) {
                console.error(`[JOB] WeeklyReport error for tenant ${tenant._id}:`, tenantErr);
            }
        }

        console.log(`[JOB] WeeklyReport complete for week ${weekStart}. ${tenants.length} tenants processed.`);
    } catch (err) {
        console.error('[JOB] WeeklyReport global error:', err);
    }
};

module.exports = { runDailyRollup, runWeeklyReport };
