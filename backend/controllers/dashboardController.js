const logger = require('../shared/logger');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const ProductVariant = require('../models/ProductVariant');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const cacheService = require('../services/cacheService');
const { generateExecutiveInsights } = require('../utils/aiInsights');

const moment = require('moment');

const DASHBOARD_CACHE_TTL = 300; // 5 minutes

exports.getDashboardData = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { startDate, endDate } = req.query;
        let startPeriod, endPeriod;
        if (startDate && endDate) {
            startPeriod = moment(startDate).startOf('day');
            endPeriod = moment(endDate).endOf('day');
        } else {
            const now = moment();
            startPeriod = now.clone().startOf('month');
            endPeriod = now.clone().endOf('month');
        }

        // Cache key includes tenant + date range for per-view caching
        const cacheKey = `dash:${tenantId}:${startPeriod.format('YYYYMMDD')}:${endPeriod.format('YYYYMMDD')}`;

        const data = await cacheService.getOrSet(cacheKey, async () => {
            const dateQuery = { tenant: tenantId, deletedAt: null, createdAt: { $gte: startPeriod.toDate(), $lte: endPeriod.toDate() } };

            // --- Parallel: order agg, courier list, inventory agg, delivery time, dispatch count, alerts ---
            const [orderStatusAgg, couriers, inventoryAgg, deliveryTimeAgg, dispatchCount, criticalStock, suspiciousCustomers, absentToday] = await Promise.all([
                Order.aggregate([
                    { $match: dateQuery },
                    {
                        $group: {
                            _id: "$status",
                            count:       { $sum: 1 },
                            totalAmount: { $sum: "$totalAmount" },
                            cogs:        { $sum: "$financials.cogs" },
                            courierFee:  { $sum: "$financials.courierFee" },
                            fees:        { $sum: { $add: ["$financials.gatewayFees", "$financials.marketplaceFees"] } }
                        }
                    }
                ]),
                Courier.find({ tenant: tenantId }).select('cashCollected pendingRemittance reliabilityScore').lean(),
                // Single aggregation replaces ProductVariant.find() full scan + loop
                ProductVariant.aggregate([
                    { $match: { status: 'Active' } },
                    {
                        $group: {
                            _id: null,
                            inventoryValue:     { $sum: { $multiply: ['$cost', '$totalStock'] } },
                            totalReservedStock: { $sum: '$reservedStock' },
                            totalAvailableStock:{ $sum: { $max: [0, { $subtract: ['$totalStock', '$reservedStock'] }] } },
                            deadStockVariants:  { $sum: { $cond: [{ $eq: ['$lifecycleStatus', 'Dead Stock'] }, 1, 0] } },
                            totalDemand30Days:  { $sum: { $ifNull: ['$analytics.historicalDemand30Days', 0] } },
                            totalStock:         { $sum: '$totalStock' }
                        }
                    }
                ]),
                Order.aggregate([
                    { $match: { tenant: tenantId, createdAt: dateQuery.createdAt, 'deliveryStatus.deliveryTimeMinutes': { $gt: 0 } } },
                    { $group: { _id: null, avgMinutes: { $avg: '$deliveryStatus.deliveryTimeMinutes' }, count: { $sum: 1 } } }
                ]),
                Order.countDocuments({ ...dateQuery, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'] } }),
                ProductVariant.countDocuments({ status: 'Active', $expr: { $lte: [{ $subtract: ["$totalStock", "$reservedStock"] }, "$reorderLevel"] } }),
                Customer.countDocuments({ tenant: tenantId, blacklisted: true }),
                (async () => {
                    try {
                        const Attendance = require('../models/Attendance');
                        const todayStr = new Date().toISOString().slice(0, 10);
                        return await Attendance.countDocuments({ tenant: tenantId, date: todayStr, status: 'Absent' });
                    } catch { return 0; }
                })()
            ]);

            // --- Process order status aggregation ---
            let totalOrders = 0, awaitingConfirmation = 0, awaitingDispatch = 0, inDelivery = 0;
            let deliveredOrders = 0, refusedOrders = 0, returnedOrders = 0;
            let totalRevenue = 0, realProfit = 0, expectedRevenue = 0, deliveredRevenue = 0;

            orderStatusAgg.forEach(s => {
                totalOrders += s.count;
                totalRevenue += s.totalAmount;
                if (['Delivered', 'Paid'].includes(s._id)) {
                    realProfit += s.totalAmount - (s.cogs || 0) - (s.courierFee || 0) - (s.fees || 0);
                }
                if (s._id === 'New') awaitingConfirmation += s.count;
                if (['Confirmed', 'Preparing', 'Ready for Pickup'].includes(s._id)) awaitingDispatch += s.count;
                if (['Shipped', 'Out for Delivery'].includes(s._id)) { inDelivery += s.count; expectedRevenue += s.totalAmount; }
                if (['Delivered', 'Paid'].includes(s._id)) { deliveredOrders += s.count; if (s._id === 'Delivered') deliveredRevenue += s.totalAmount; }
                if (s._id === 'Refused') refusedOrders += s.count;
                if (s._id === 'Returned') returnedOrders += s.count;
            });

            const deliverySuccessRate = dispatchCount > 0 ? (deliveredOrders / dispatchCount) * 100 : 0;
            const refusalRate = dispatchCount > 0 ? ((refusedOrders + returnedOrders) / dispatchCount) * 100 : 0;

            let globalCashCollected = 0, globalSettlementsPending = 0;
            couriers.forEach(c => { globalCashCollected += c.cashCollected || 0; globalSettlementsPending += c.pendingRemittance || 0; });

            const inv = inventoryAgg[0] || { inventoryValue: 0, totalReservedStock: 0, totalAvailableStock: 0, deadStockVariants: 0, totalDemand30Days: 0, totalStock: 0 };
            const avgDeliveryMinutes = deliveryTimeAgg[0]?.avgMinutes || null;
            const avgDeliveryTimeDisplay = avgDeliveryMinutes
                ? avgDeliveryMinutes >= 1440 ? `${(avgDeliveryMinutes / 1440).toFixed(1)} days` : `${Math.round(avgDeliveryMinutes / 60)} hours`
                : null;

            const inventoryTurnoverRate = inv.totalStock > 0
                ? parseFloat((inv.totalDemand30Days / inv.totalStock).toFixed(2))
                : null;

            const result = {
                orderMetrics: { totalOrders, awaitingConfirmation, awaitingDispatch, inDelivery, deliveredOrders, refusedOrders, returnedOrders },
                deliveryMetrics: {
                    deliverySuccessRate: deliverySuccessRate.toFixed(1),
                    refusalRate: refusalRate.toFixed(1),
                    averageDeliveryTime: avgDeliveryTimeDisplay,
                    courierPerformanceScore: couriers.length > 0 ? (couriers.reduce((acc, c) => acc + (c.reliabilityScore || 0), 0) / couriers.length).toFixed(1) : null
                },
                financialMetrics: {
                    totalSalesVolume: totalRevenue,
                    averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders) : 0,
                    expectedRevenue, deliveredRevenue,
                    cashCollected: globalCashCollected,
                    courierSettlementsPending: globalSettlementsPending,
                    realProfit
                },
                inventoryMetrics: {
                    inventoryValue: inv.inventoryValue,
                    reservedStock: inv.totalReservedStock,
                    availableStock: inv.totalAvailableStock,
                    deadStock: inv.deadStockVariants,
                    inventoryTurnoverRate
                },
            };

            // --- Insights ---
            const realInsights = [];
            if (criticalStock > 0) realInsights.push(`Stockout Risk: ${criticalStock} variants require immediate restock.`);
            if (suspiciousCustomers > 0) realInsights.push(`Fraud Alert: ${suspiciousCustomers} customers blacklisted based on refusal behavior.`);
            if (refusalRate > 10) realInsights.push(`High Refusal Rate (${refusalRate.toFixed(1)}%). Consider enforcing Phone Confirmation.`);

            result.aiSummary = realInsights.length > 0 ? realInsights : ["All systems operating normally. Outstanding balanced delivery active."];
            result.briefing = {
                awaitingConfirmation,
                pendingSettlements: globalSettlementsPending,
                lowStockVariants: criticalStock,
                absentToday,
            };

            return result;
        }, DASHBOARD_CACHE_TTL);

        return res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error generating advanced dashboard metrics');
        res.status(500).json({ error: 'Server Error' });
    }
};
