const logger = require('../shared/logger');
const Order = require('../models/Order');
const moment = require('moment');
const cacheService = require('../services/cacheService');

exports.getCourierKPIs = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { dateRange = 30 } = req.query;
        const days = Math.min(Math.max(1, parseInt(dateRange, 10) || 30), 365);
        const cacheKey = `tenant:${tenantId}:courier:kpis:days:${days}`;

        const cachedKPIs = await cacheService.getOrSet(cacheKey, async () => {
            const startDate = moment().subtract(days, 'days').toDate();
            const dispatchStatuses = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'];

            const [kpiResult] = await Order.aggregate([
                {
                    $match: {
                        tenant: tenantId,
                        deletedAt: null,
                        createdAt: { $gte: startDate },
                        status: { $in: dispatchStatuses }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalShipments: { $sum: 1 },
                        delivered: {
                            $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, 1, 0] }
                        },
                        returned: {
                            $sum: { $cond: [{ $in: ["$status", ['Returned', 'Refused']] }, 1, 0] }
                        },
                        inTransit: {
                            $sum: { $cond: [{ $in: ["$status", ['Dispatched', 'Shipped', 'Out for Delivery']] }, 1, 0] }
                        },
                        totalDeliveryDays: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $in: ["$status", ['Delivered', 'Paid']] },
                                        { $ifNull: ["$deliveryStatus.deliveredAt", false] }
                                    ]},
                                    { $divide: [{ $subtract: ["$deliveryStatus.deliveredAt", "$createdAt"] }, 1000 * 60 * 60 * 24] },
                                    0
                                ]
                            }
                        },
                        deliveriesWithTime: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $in: ["$status", ['Delivered', 'Paid']] },
                                        { $ifNull: ["$deliveryStatus.deliveredAt", false] }
                                    ]},
                                    1, 0
                                ]
                            }
                        },
                        totalDeliveredCOD: {
                            $sum: {
                                $cond: [
                                    { $in: ["$status", ['Delivered', 'Paid']] },
                                    { $ifNull: ["$financials.codAmount", "$totalAmount"] },
                                    0
                                ]
                            }
                        },
                        settledToBank: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $in: ["$status", ['Delivered', 'Paid']] },
                                        { $in: ["$paymentStatus", ["Paid"]] } // If order is marked Paid, it's settled
                                    ]},
                                    { $ifNull: ["$financials.codAmount", "$totalAmount"] },
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            if (!kpiResult) {
                return {
                    kpis: { totalShipments: 0, delivered: 0, returned: 0, inTransit: 0, successRate: 0, returnRate: 0, avgDeliveryTimeDays: 0 },
                    financials: { totalDeliveredCOD: 0, pendingCourierClearance: 0, settledToBank: 0, uncollectedFromCustomer: 0 }
                };
            }

            const successRate = kpiResult.totalShipments > 0 ? ((kpiResult.delivered / kpiResult.totalShipments) * 100).toFixed(1) : 0;
            const returnRate = kpiResult.totalShipments > 0 ? ((kpiResult.returned / kpiResult.totalShipments) * 100).toFixed(1) : 0;
            const avgDeliveryTimeDays = kpiResult.deliveriesWithTime > 0 ? (kpiResult.totalDeliveryDays / kpiResult.deliveriesWithTime).toFixed(1) : 0;
            const pendingCourierClearance = kpiResult.totalDeliveredCOD - kpiResult.settledToBank;

            return {
                kpis: {
                    totalShipments: kpiResult.totalShipments,
                    delivered: kpiResult.delivered,
                    returned: kpiResult.returned,
                    inTransit: kpiResult.inTransit,
                    successRate: Number(successRate),
                    returnRate: Number(returnRate),
                    avgDeliveryTimeDays: Number(avgDeliveryTimeDays)
                },
                financials: {
                    totalDeliveredCOD: kpiResult.totalDeliveredCOD,
                    pendingCourierClearance,
                    settledToBank: kpiResult.settledToBank,
                    uncollectedFromCustomer: 0
                }
            };
        }, 300); // 5 minutes TTL

        res.json(cachedKPIs);
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

exports.getRegionalPerformance = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { dateRange = 30 } = req.query;
        const days = Math.min(Math.max(1, parseInt(dateRange, 10) || 30), 365);
        const cacheKey = `tenant:${tenantId}:courier:regional:days:${days}`;

        const cachedRegions = await cacheService.getOrSet(cacheKey, async () => {
            const startDate = moment().subtract(days, 'days').toDate();
            const dispatchStatuses = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'];

            return await Order.aggregate([
                { $match: { tenant: tenantId, deletedAt: null, createdAt: { $gte: startDate }, status: { $in: dispatchStatuses } } },
                {
                    $group: {
                        _id: "$shipping.wilaya",
                        total: { $sum: 1 },
                        delivered: {
                            $sum: { $cond: [{ $in: ["$status", ["Delivered", "Paid"]] }, 1, 0] }
                        },
                        returned: {
                            $sum: { $cond: [{ $in: ["$status", ["Returned", "Refused"]] }, 1, 0] }
                        }
                    }
                },
                {
                    $project: {
                        wilaya: { $ifNull: ["$_id", "Unknown"] },
                        total: 1,
                        delivered: 1,
                        returned: 1,
                        successRate: {
                            $cond: [
                                { $eq: ["$total", 0] },
                                0,
                                { $multiply: [{ $divide: ["$delivered", "$total"] }, 100] }
                            ]
                        }
                    }
                },
                { $sort: { total: -1 } },
                { $limit: 10 }
            ]);
        }, 1800); // 30-minute TTL for historical regional aggregates

        res.json(cachedRegions);
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};
