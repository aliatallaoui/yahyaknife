const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Get financial overview metrics (total revenue, total expenses, net profit, profit margin)
exports.getFinancialOverview = async (req, res) => {
    try {
        // 1. Manual Expenses & Revenues
        const expenses = await Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
        const revenues = await Revenue.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);

        const manualExpenses = expenses.length > 0 ? expenses[0].total : 0;
        const manualRevenue = revenues.length > 0 ? revenues[0].total : 0;

        // 2. Automated Orders P&L Pipeline
        const orderAgg = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            {
                $group: {
                    _id: "$status",
                    grossSales: { $sum: '$totalAmount' },
                    cogs: { $sum: '$financials.cogs' },
                    gatewayFees: { $sum: '$financials.paymentGatewayFee' },
                    marketplaceFees: { $sum: '$financials.marketplaceFee' }
                }
            }
        ]);

        let expectedRevenue = 0;
        let transitRevenue = 0;
        let deliveredRevenue = 0;
        let settledRevenue = 0;

        let totalCOGS = 0;
        let totalGatewayFees = 0;

        orderAgg.forEach(o => {
            totalCOGS += o.cogs;
            totalGatewayFees += (o.gatewayFees + o.marketplaceFees);

            if (['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(o._id)) expectedRevenue += o.grossSales;
            if (['Shipped', 'Out for Delivery'].includes(o._id)) transitRevenue += o.grossSales;
            if (o._id === 'Delivered') deliveredRevenue += o.grossSales;
            if (o._id === 'Paid') settledRevenue += o.grossSales;
        });

        // 3. Consolidated P&L
        const totalRevenue = manualRevenue + deliveredRevenue + settledRevenue; // Only count delivered/paid as actual recognized revenue
        const totalOperatingExpenses = manualExpenses + totalGatewayFees;
        const totalExpenses = totalCOGS + totalOperatingExpenses;

        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        res.json({
            pipeline: {
                expectedRevenue,
                transitRevenue,
                deliveredRevenue,
                settledRevenue
            },
            cogs: totalCOGS,
            operatingExpenses: totalOperatingExpenses,
            manualRevenue,
            manualExpenses,
            totalRecognizedRevenue: totalRevenue,
            totalExpenses,
            netProfit,
            profitMargin: profitMargin.toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRevenues = async (req, res) => {
    try {
        const revenues = await Revenue.find().sort({ date: -1 });
        res.json(revenues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
