const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payroll = require('../models/Payroll');
const Courier = require('../models/Courier');
const { ok } = require('../shared/utils/ApiResponse');

// Get financial overview metrics (total revenue, total expenses, net profit, profit margin)
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });

        // Optional date range — defaults to all-time if not provided
        let dateFilter = {};
        let txDateFilter = {};
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            const end   = new Date(req.query.endDate);
            if (!isNaN(start) && !isNaN(end)) {
                end.setHours(23, 59, 59, 999);
                dateFilter   = { createdAt: { $gte: start, $lte: end } };
                txDateFilter = { date:      { $gte: start.toISOString().slice(0, 10),
                                              $lte: end.toISOString().slice(0, 10) } };
            }
        }

        // 1. Manual Expenses & Revenues — scoped to tenant + optional date range
        const [expenseAgg, revenueAgg, payrollAgg, courierList] = await Promise.all([
            Expense.aggregate([
                { $match: { tenant: tenantId, ...txDateFilter } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Revenue.aggregate([
                { $match: { tenant: tenantId, ...txDateFilter } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            // Payroll is tenant-scoped — filter to current tenant's paid disbursements only
            Payroll.aggregate([
                { $match: { tenant: tenantId, status: { $in: ['Paid', 'Partially Paid'] }, ...dateFilter } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]),
            // Courier settlements — always all-time (COD remittance is not date-bound)
            Courier.find({ tenant: tenantId }).select('name pendingRemittance cashCollected reliabilityScore').lean()
        ]);

        const manualExpenses = expenseAgg[0]?.total || 0;
        const manualRevenue = revenueAgg[0]?.total || 0;
        const totalPayroll = payrollAgg[0]?.total || 0;

        // 2. Automated Orders P&L Pipeline
        const orderAgg = await Order.aggregate([
            { $match: { tenant: tenantId, status: { $ne: 'Cancelled' }, ...dateFilter } },
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

        // 4. Courier settlement summary
        const courierSettlements = courierList.map(c => ({
            _id:              c._id,
            name:             c.name,
            pendingRemittance: c.pendingRemittance || 0,
            cashCollected:    c.cashCollected || 0,
            reliabilityScore: c.reliabilityScore || null,
        })).filter(c => c.pendingRemittance > 0 || c.cashCollected > 0);

        const totalPendingSettlements = courierList.reduce((s, c) => s + (c.pendingRemittance || 0), 0);

        res.json(ok({
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
            profitMargin: profitMargin.toFixed(2),
            courierSettlements,
            totalPendingSettlements,
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ tenant: req.user.tenant }).sort({ date: -1 });
        res.json(ok(expenses));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRevenues = async (req, res) => {
    try {
        const revenues = await Revenue.find({ tenant: req.user.tenant }).sort({ date: -1 });
        res.json(ok(revenues));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
