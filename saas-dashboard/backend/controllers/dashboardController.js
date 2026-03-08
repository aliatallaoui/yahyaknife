const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const ProductVariant = require('../models/ProductVariant');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const KnifeCard = require('../models/KnifeCard');
const CustomOrder = require('../models/CustomOrder');
const { generateExecutiveInsights } = require('../utils/aiInsights');

const moment = require('moment');

exports.getDashboardData = async (req, res) => {
    try {
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

        const dateQuery = { date: { $gte: startPeriod.toDate(), $lte: endPeriod.toDate() } };

        // --- ORDER METRICS ---
        const orderStatusAgg = await Order.aggregate([
            { $match: dateQuery },
            { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, netProfit: { $sum: "$financials.netProfit" } } }
        ]);

        let totalOrders = 0;
        let awaitingConfirmation = 0;
        let awaitingDispatch = 0;
        let inDelivery = 0;
        let deliveredOrders = 0;
        let refusedOrders = 0;
        let returnedOrders = 0;

        let totalRevenue = 0;
        let realProfit = 0;
        let expectedRevenue = 0;
        let deliveredRevenue = 0;

        orderStatusAgg.forEach(s => {
            totalOrders += s.count;
            totalRevenue += s.totalAmount;
            realProfit += s.netProfit;

            if (s._id === 'New') awaitingConfirmation += s.count;
            if (['Confirmed', 'Preparing', 'Ready for Pickup'].includes(s._id)) awaitingDispatch += s.count;
            if (['Shipped', 'Out for Delivery'].includes(s._id)) {
                inDelivery += s.count;
                expectedRevenue += s.totalAmount;
            }
            if (['Delivered', 'Paid'].includes(s._id)) {
                deliveredOrders += s.count;
                if (s._id === 'Delivered') deliveredRevenue += s.totalAmount;
            }
            if (s._id === 'Refused') refusedOrders += s.count;
            if (s._id === 'Returned') returnedOrders += s.count;
        });

        // --- DELIVERY METRICS ---
        const Courier = require('../models/Courier');
        const couriers = await Courier.find();
        let globalDeliveryAttempts = deliveredOrders + refusedOrders;
        let deliverySuccessRate = globalDeliveryAttempts > 0 ? (deliveredOrders / globalDeliveryAttempts) * 100 : 0;
        let refusalRate = globalDeliveryAttempts > 0 ? (refusedOrders / globalDeliveryAttempts) * 100 : 0;

        // --- FINANCIAL METRICS ---
        let globalCashCollected = 0;
        let globalSettlementsPending = 0;
        couriers.forEach(c => {
            globalCashCollected += c.cashCollected;
            globalSettlementsPending += c.pendingRemittance;
        });

        // --- INVENTORY METRICS ---
        const variants = await ProductVariant.find({ status: 'Active' });
        let inventoryValue = 0;
        let totalReservedStock = 0;
        let totalAvailableStock = 0;
        let deadStockVariants = 0;

        variants.forEach(v => {
            inventoryValue += (v.cost * v.totalStock);
            totalReservedStock += v.reservedStock;
            totalAvailableStock += Math.max(0, v.totalStock - v.reservedStock);
            if (v.lifecycleStatus === 'Dead Stock') deadStockVariants++;
        });

        const data = {
            orderMetrics: {
                totalOrders,
                awaitingConfirmation,
                awaitingDispatch,
                inDelivery,
                deliveredOrders,
                refusedOrders,
                returnedOrders
            },
            deliveryMetrics: {
                deliverySuccessRate: deliverySuccessRate.toFixed(1),
                refusalRate: refusalRate.toFixed(1),
                averageDeliveryTime: "48 hours", // Placeholder for actual math
                courierPerformanceScore: couriers.length > 0 ? (couriers.reduce((acc, c) => acc + c.reliabilityScore, 0) / couriers.length).toFixed(1) : 100
            },
            financialMetrics: {
                expectedRevenue, // Revenue shipped but not delivered
                deliveredRevenue, // Delivered but cash not settled
                cashCollected: globalCashCollected,
                courierSettlementsPending: globalSettlementsPending,
                realProfit
            },
            inventoryMetrics: {
                inventoryValue,
                reservedStock: totalReservedStock,
                availableStock: totalAvailableStock,
                deadStock: deadStockVariants,
                inventoryTurnoverRate: 1.2 // Placeholder
            },
            workshopMetrics: {
                activeProduction: 0,
                completedThisMonth: 0,
                pendingCustomOrders: 0,
                valueInProduction: 0
            }
        };

        // --- WORKSHOP / BLADESMITH METRICS ---
        try {
            const [activeKnives, completedKnives, pendingCustoms] = await Promise.all([
                KnifeCard.find({ status: { $nin: ['Completed', 'Sold'] } }),
                KnifeCard.countDocuments({ status: { $in: ['Completed', 'Sold'] }, updatedAt: { $gte: startPeriod.toDate(), $lte: endPeriod.toDate() } }),
                CustomOrder.countDocuments({ status: { $in: ['Pending', 'Confirmed', 'In Production'] } })
            ]);

            data.workshopMetrics.activeProduction = activeKnives.length;
            data.workshopMetrics.completedThisMonth = completedKnives;
            data.workshopMetrics.pendingCustomOrders = pendingCustoms;
            data.workshopMetrics.valueInProduction = activeKnives.reduce((sum, k) => sum + (k.suggestedPrice || 0), 0);
        } catch (err) {
            console.error('Failed to fetch workshop metrics', err);
        }

        // Leverage AI Intelligence summaries here
        const [criticalStock, suspiciousCustomers] = await Promise.all([
            ProductVariant.countDocuments({ status: 'Active', $expr: { $lte: [{ $subtract: ["$totalStock", "$reservedStock"] }, "$reorderLevel"] } }),
            Customer.countDocuments({ isSuspicious: true })
        ]);

        const realInsights = [];
        if (criticalStock > 0) {
            realInsights.push(`Stockout Risk: ${criticalStock} variants require immediate restock.`);
        }
        if (suspiciousCustomers > 0) {
            realInsights.push(`Fraud Alert: ${suspiciousCustomers} customers flagged as Suspicious based on refusal behavior.`);
        }
        if (data.deliveryMetrics.refusalRate > 10) {
            realInsights.push(`High Refusal Rate (${data.deliveryMetrics.refusalRate}%). Consider enforcing Phone Confirmation.`);
        }

        data.aiSummary = realInsights.length > 0 ? realInsights : ["All systems operating normally. Outstanding balanced delivery active."];

        return res.json(data);
    } catch (error) {
        console.error("Error generating advanced dashboard metrics:", error);
        res.status(500).json({ error: error.message });
    }
};
