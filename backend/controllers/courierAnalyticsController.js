const Order = require('../models/Order');
const moment = require('moment');

exports.getCourierKPIs = async (req, res) => {
    try {
        const { dateRange = 30 } = req.query;
        const startDate = moment().subtract(Number(dateRange), 'days').toDate();

        // 1. Overall Delivery Performance (Fleet-wide)
        const dispatchStatuses = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'];
        const orders = await Order.find({
            createdAt: { $gte: startDate },
            status: { $in: dispatchStatuses }
        });

        const total = orders.length;
        const delivered = orders.filter(o => ['Delivered', 'Paid'].includes(o.status)).length;
        const returned = orders.filter(o => ['Returned', 'Refused'].includes(o.status)).length;
        const inTransit = orders.filter(o => ['Dispatched', 'Shipped', 'Out for Delivery'].includes(o.status)).length;

        const successRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : 0;
        const returnRate = total > 0 ? ((returned / total) * 100).toFixed(1) : 0;

        // 2. Average Delivery Time
        let totalDeliveryDays = 0;
        let deliveredCount = 0;

        orders.forEach(o => {
            if (['Delivered', 'Paid'].includes(o.status) && o.deliveryStatus && o.deliveryStatus.deliveredAt) {
                totalDeliveryDays += moment(o.deliveryStatus.deliveredAt).diff(moment(o.createdAt), 'days');
                deliveredCount++;
            }
        });

        const avgDeliveryTimeDays = deliveredCount > 0 ? (totalDeliveryDays / deliveredCount).toFixed(1) : 0;

        // 3. Financial Reconciliation (COD)
        let totalDeliveredCOD = 0;
        let pendingCourierClearance = 0;
        let settledToBank = 0;

        orders.forEach(o => {
            if (['Delivered', 'Paid'].includes(o.status)) {
                const amount = o.financials?.codAmount || o.totalAmount;
                totalDeliveredCOD += amount;
                if (o.paymentStatus === 'Paid' || o.status === 'Paid') {
                    settledToBank += amount;
                } else {
                    pendingCourierClearance += amount;
                }
            }
        });

        res.json({
            kpis: {
                totalShipments: total,
                delivered,
                returned,
                inTransit,
                successRate: Number(successRate),
                returnRate: Number(returnRate),
                avgDeliveryTimeDays: Number(avgDeliveryTimeDays)
            },
            financials: {
                totalDeliveredCOD,
                pendingCourierClearance,
                settledToBank,
                uncollectedFromCustomer: 0
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRegionalPerformance = async (req, res) => {
    try {
        const { dateRange = 30 } = req.query;
        const startDate = moment().subtract(Number(dateRange), 'days').toDate();

        const dispatchStatuses = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'];

        const regions = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate }, status: { $in: dispatchStatuses } } },
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

        res.json(regions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
