const logger = require('../shared/logger');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Order = require('../models/Order');
const Payroll = require('../models/Payroll');
const Courier = require('../models/Courier');
const { ok } = require('../shared/utils/ApiResponse');
const { fireAndRetry } = require('../shared/utils/retryAsync');

// Get financial overview metrics (total revenue, total expenses, net profit, profit margin)
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ error: 'Tenant context required' });

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
            Courier.find({ tenant: tenantId, deletedAt: null }).select('name pendingRemittance cashCollected reliabilityScore').lean()
        ]);

        const manualExpenses = expenseAgg[0]?.total || 0;
        const manualRevenue = revenueAgg[0]?.total || 0;
        const totalPayroll = payrollAgg[0]?.total || 0;

        // 2. Automated Orders P&L Pipeline
        const orderAgg = await Order.aggregate([
            { $match: { tenant: tenantId, deletedAt: null, status: { $ne: 'Cancelled' }, ...dateFilter } },
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
            // Only count COGS/fees for recognized revenue (Delivered/Paid) — cash-basis accounting
            if (['Delivered', 'Paid'].includes(o._id)) {
                totalCOGS += o.cogs;
                totalGatewayFees += (o.gatewayFees + o.marketplaceFees);
            }

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
        logger.error({ err: error }, 'Finance controller error');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const filter = { tenant: req.user.tenant };
        const [expenses, total] = await Promise.all([
            Expense.find(filter).sort({ date: -1 }).skip(req.skip).limit(req.limit).lean(),
            Expense.countDocuments(filter)
        ]);
        res.json(ok({ data: expenses, pagination: req.paginationMeta(total) }));
    } catch (error) {
        logger.error({ err: error }, 'Finance controller error');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getRevenues = async (req, res) => {
    try {
        const filter = { tenant: req.user.tenant };
        const [revenues, total] = await Promise.all([
            Revenue.find(filter).sort({ date: -1 }).skip(req.skip).limit(req.limit).lean(),
            Revenue.countDocuments(filter)
        ]);
        res.json(ok({ data: revenues, pagination: req.paginationMeta(total) }));
    } catch (error) {
        logger.error({ err: error }, 'Finance controller error');
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- COURIER CASH SETTLEMENT (LEDGER) ---

const CourierSettlement = require('../models/CourierSettlement');
const mongoose = require('mongoose');
const OrderService = require('../domains/orders/order.service');

exports.getCourierBalances = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const couriers = await Courier.find({ tenant: tenantId, deletedAt: null })
            .select('name phone integrationType pendingRemittance cashCollected cashSettled')
            .sort({ pendingRemittance: -1 })
            .lean();

        res.json(ok(couriers));
    } catch (error) {
        logger.error({ err: error }, 'Finance controller error fetching courier balances');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getCourierDeliveries = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { courierId } = req.params;

        // Fetch orders assigned to this courier that are Delivered
        const deliveries = await Order.find({
            tenant: tenantId,
            deletedAt: null,
            courier: courierId,
            status: 'Delivered',
            paymentStatus: { $in: ['Delivered_Not_Collected', 'COD_Expected'] }
        })
        .select('orderId date customer shipping financials.codAmount status paymentStatus')
        .populate('customer', 'name phone')
        .sort({ 'deliveryStatus.deliveredAt': 1 })
        .limit(1000)
        .lean();

        res.json(ok(deliveries));
    } catch (error) {
        logger.error({ err: error }, 'Finance controller error fetching deliveries');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.settleCourierCash = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    let committedOrders = null; // populated after transaction commits

    try {
        const tenantId = req.user.tenant;
        const { courierId, orderIds, amountPaid, notes } = req.body;
        const userId = req.user._id;

        if (!orderIds || !orderIds.length || !amountPaid) {
            throw new Error('Missing orderIds or amountPaid');
        }

        const courier = await Courier.findOne({ _id: courierId, tenant: tenantId, deletedAt: null }).session(session);
        if (!courier) throw new Error('Courier not found');

        const orders = await Order.find({
            _id: { $in: orderIds },
            tenant: tenantId,
            deletedAt: null,
            courier: courierId,
            status: 'Delivered',
            paymentStatus: { $in: ['Delivered_Not_Collected', 'COD_Expected'] }
        }).session(session);

        if (orders.length !== orderIds.length) {
            throw new Error('Some orders are invalid or already settled.');
        }

        let totalExpectedCash = 0;
        orders.forEach(o => {
            totalExpectedCash += (o.financials?.codAmount || 0);
        });

        // Prevent over-settlement: amount cannot exceed courier's pending remittance
        if (amountPaid > courier.pendingRemittance) {
            throw new Error(`Settlement amount (${amountPaid}) exceeds pending remittance (${courier.pendingRemittance})`);
        }

        const shortfall = totalExpectedCash - amountPaid;

        const settlement = new CourierSettlement({
            tenant: tenantId,
            courier: courierId,
            settledBy: userId,
            amountSettled: amountPaid,
            ordersSettled: orders.map(o => o._id),
            remainingAmount: shortfall > 0 ? shortfall : 0,
            previousPendingRemittance: courier.pendingRemittance,
            notes
        });

        await settlement.save({ session });

        courier.cashSettled += amountPaid;
        courier.pendingRemittance = courier.cashCollected - courier.cashSettled;
        await courier.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Mark for post-transaction order mutations
        committedOrders = { orders, tenantId, userId, settlement };

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        logger.error({ err: error }, 'Courier settlement error');
        return res.status(400).json({ message: error.message || 'Settlement failed' });
    }

    // Route order status mutations through OrderService (outside transaction
    // because OrderService doesn't accept a session — consistent with the
    // codebase pattern of disabled transactions for standalone MongoDB).
    // Each order gets its own fireAndRetry so a single transient failure
    // doesn't block the rest, and retries recover from DB blips.
    for (const order of committedOrders.orders) {
        fireAndRetry(`settlement:orderPaid:${order._id}`, () =>
            OrderService.updateOrder({
                orderId: order._id,
                tenantId: committedOrders.tenantId,
                userId: committedOrders.userId,
                updateData: {
                    status: 'Paid',
                    paymentStatus: 'Paid_and_Settled',
                    'deliveryStatus.codPaidAt': new Date(),
                    statusNote: 'Settled via courier cash settlement'
                },
                bypassStateMachine: true
            })
        );
    }

    res.json(ok({ message: 'Settlement processed successfully', settlement: committedOrders.settlement }));
};
