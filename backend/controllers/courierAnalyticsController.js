const Shipment = require('../models/Shipment');
const CourierSetting = require('../models/CourierSetting');
const moment = require('moment');

exports.getCourierKPIs = async (req, res) => {
    try {
        const { dateRange = 30 } = req.query;
        const startDate = moment().subtract(Number(dateRange), 'days').toDate();

        // 1. Overall Delivery Performance
        const shipments = await Shipment.find({
            createdAt: { $gte: startDate }
        });

        const total = shipments.length;
        const delivered = shipments.filter(s => s.shipmentStatus === 'Delivered').length;
        const returned = shipments.filter(s => ['Returned', 'Failed Attempt'].includes(s.shipmentStatus)).length;
        const inTransit = shipments.filter(s => ['In Transit', 'Out for Delivery'].includes(s.shipmentStatus)).length;

        const successRate = total > 0 ? ((delivered / (total - inTransit)) * 100).toFixed(1) : 0;
        const returnRate = total > 0 ? ((returned / (total - inTransit)) * 100).toFixed(1) : 0;

        // 2. Average Delivery Time
        let totalDeliveryDays = 0;
        let deliveredCount = 0;

        shipments.forEach(s => {
            if (s.shipmentStatus === 'Delivered' && s.deliveredDate) {
                totalDeliveryDays += moment(s.deliveredDate).diff(moment(s.createdAt), 'days');
                deliveredCount++;
            }
        });

        const avgDeliveryTimeDays = deliveredCount > 0 ? (totalDeliveryDays / deliveredCount).toFixed(1) : 0;

        // 3. Financial Reconciliation (COD)
        const financials = await Shipment.aggregate([
            { $match: { createdAt: { $gte: startDate }, shipmentStatus: 'Delivered' } },
            {
                $group: {
                    _id: "$paymentStatus",
                    totalAmount: { $sum: "$codAmount" }
                }
            }
        ]);

        let pendingCash = 0;
        let settledCash = 0;
        let uncollected = 0;

        financials.forEach(f => {
            if (f._id === 'Collected_Not_Paid') pendingCash += f.totalAmount;
            if (f._id === 'Paid_and_Settled') settledCash += f.totalAmount;
            if (f._id === 'Delivered_Not_Collected') uncollected += f.totalAmount;
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
                totalDeliveredCOD: pendingCash + settledCash + uncollected,
                pendingCourierClearance: pendingCash,
                settledToBank: settledCash,
                uncollectedFromCustomer: uncollected
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

        const regions = await Shipment.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: "$wilayaName",
                    total: { $sum: 1 },
                    delivered: {
                        $sum: { $cond: [{ $eq: ["$shipmentStatus", "Delivered"] }, 1, 0] }
                    },
                    returned: {
                        $sum: { $cond: [{ $in: ["$shipmentStatus", ["Returned", "Failed Attempt"]] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    wilaya: "$_id",
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
