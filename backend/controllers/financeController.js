const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payroll = require('../models/Payroll');

// Get financial overview metrics (total revenue, total expenses, net profit, profit margin)
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;

        // 1. Manual Expenses & Revenues — scoped to tenant
        const [expenseAgg, revenueAgg, payrollAgg] = await Promise.all([
            Expense.aggregate([
                { $match: { tenant: tenantId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Revenue.aggregate([
                { $match: { tenant: tenantId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            // Payroll is workshop-internal (no tenant field) — aggregates all paid salary disbursements
            Payroll.aggregate([
                { $match: { status: { $in: ['Paid', 'Partially Paid'] } } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ])
        ]);

        const manualExpenses = expenseAgg[0]?.total || 0;
        const manualRevenue = revenueAgg[0]?.total || 0;
        const totalPayroll = payrollAgg[0]?.total || 0;

        // 2. Automated Orders P&L Pipeline
        const orderAgg = await Order.aggregate([
            { $match: { tenant: tenantId, status: { $ne: 'Cancelled' } } },
            {
                $group: {
                    _id: "$status",
                    grossSales: { $sum: '$totalAmount' },
                    cogs: { $sum: '$financials.cogs' },
                    gatewayFees: { $sum: '$financials.gatewayFees' },
                    marketplaceFees: { $sum: '$financials.marketplaceFees' }
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

        // 3. Consolidated P&L — payroll aggregated from Payroll model (status: Paid)
        const totalRevenue = manualRevenue + deliveredRevenue + settledRevenue; // Cash-basis: only delivered/paid recognized
        const totalOperatingExpenses = manualExpenses + totalGatewayFees + totalPayroll;
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
            payroll: totalPayroll,
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
        const expenses = await Expense.find({ tenant: req.user.tenant }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRevenues = async (req, res) => {
    try {
        const revenues = await Revenue.find({ tenant: req.user.tenant }).sort({ date: -1 });
        res.json(revenues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
