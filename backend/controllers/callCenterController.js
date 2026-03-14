const mongoose = require('mongoose');
const logger = require('../shared/logger');
const Order = require('../models/Order');
const CallNote = require('../models/CallNote');
const Shipment = require('../models/Shipment');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const AgentProfile = require('../models/AgentProfile');
const User = require('../models/User');
const ProductVariant = require('../models/ProductVariant');
const cacheService = require('../services/cacheService');

const ShipmentService = require('../domains/dispatch/shipment.service');
const OrderService = require('../domains/orders/order.service');
const { sendMessage, getTemplates } = require('../services/messageService');
const { fireAndRetry } = require('../shared/utils/retryAsync');
const { ok } = require('../shared/utils/ApiResponse');
const { TERMINAL } = require('../shared/constants/orderStatuses');

// ─── Admin / Owner role check — these roles see ALL tenant orders ─────────────
const ADMIN_ROLES = new Set(['Super Admin', 'Owner / Founder']);
function isAdminUser(user) {
    const roleName = user.role?.name || user.role;
    return ADMIN_ROLES.has(roleName);
}

// ─── Actionable statuses (orders the call center actively works on) ───────────
const ACTIONABLE_STATUSES = ['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Postponed'];

// ─── Action → Status mapping (call center vocabulary → order status) ──────────
const ACTION_STATUS_MAP = {
    'Confirmed':        'Confirmed',
    'Cancelled':        'Cancelled by Customer',
    'Call 1':           'Call 1',
    'Call 2':           'Call 2',
    'Call 3':           'Call 3',
    'No Answer':        'No Answer',
    'Postponed':        'Postponed',
    'Wrong Number':     'Wrong Number',
    'Out of Coverage':  'Out of Coverage',
};

// --- AGENT DASHBOARD ---

exports.getAgentDashboard = async (req, res) => {
    try {
        const agentId = req.user._id;
        const tenantId = req.user.tenant;
        const isAdmin = isAdminUser(req.user);
        const cacheKey = `tenant:${tenantId}:agent:${agentId}:dashboard`;

        const dashboardData = await cacheService.getOrSet(cacheKey, async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const now = new Date();

            const baseFilter = { tenant: tenantId, deletedAt: null };
            if (!isAdmin) baseFilter.assignedAgent = agentId;

            const [
                totalAssigned,
                awaitingAction,
                deliveredTotal,
                confirmedToday,
                actionRequiredOrders,
                callsMadeToday,
                profile,
                cancelledToday,
                recentCallActions
            ] = await Promise.all([
                Order.countDocuments(baseFilter),
                Order.countDocuments({ ...baseFilter, status: { $in: ACTIONABLE_STATUSES } }),
                Order.countDocuments({ ...baseFilter, status: { $in: ['Delivered', 'Paid'] } }),
                Order.countDocuments({ ...baseFilter, status: 'Confirmed', updatedAt: { $gte: todayStart } }),
                // FIFO + priority aggregation: callbacks due → high priority → oldest first
                Order.aggregate([
                    { $match: { ...baseFilter, status: { $in: ACTIONABLE_STATUSES } } },
                    // Admins see all orders; agents only see unlocked or their own locked orders
                    ...(isAdmin ? [] : [{ $match: {
                        $or: [
                            { lockedBy: null },
                            { lockedBy: agentId },
                            { lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }
                        ]
                    }}]),
                    { $addFields: {
                        sortBucket: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$status', 'Postponed'] },
                                    { $ne: ['$postponedUntil', null] },
                                    { $lte: ['$postponedUntil', now] }
                                ]},
                                0,
                                { $cond: [
                                    { $in: ['$priority', ['VIP', 'Urgent', 'High', 'High Priority']] },
                                    1,
                                    2
                                ]}
                            ]
                        }
                    }},
                    { $sort: { sortBucket: 1, _id: 1 } },
                    { $limit: isAdmin ? 500 : 200 },
                    { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: '_cust' } },
                    { $unwind: { path: '$_cust', preserveNullAndEmptyArrays: true } },
                    // For admins: resolve assigned agent name
                    ...(isAdmin ? [
                        { $lookup: { from: 'users', localField: 'assignedAgent', foreignField: '_id', as: '_agent' } },
                        { $unwind: { path: '$_agent', preserveNullAndEmptyArrays: true } },
                    ] : []),
                    { $addFields: {
                        customer: {
                            _id: '$_cust._id',
                            name: '$_cust.name',
                            phone: '$_cust.phone',
                            trustScore: '$_cust.trustScore',
                            riskLevel: '$_cust.riskLevel',
                            blacklisted: '$_cust.blacklisted'
                        },
                        ...(isAdmin ? { assignedAgentName: '$_agent.name' } : {})
                    }},
                    { $project: { _cust: 0, _agent: 0 } }
                ]),
                CallNote.countDocuments({ agent: agentId, tenant: tenantId, createdAt: { $gte: todayStart } }),
                AgentProfile.findOne({ user: agentId, tenant: tenantId }).lean(),
                // Cancelled today (for confirm rate calc)
                Order.countDocuments({ ...baseFilter, status: { $in: ['Cancelled', 'Cancelled by Customer'] }, updatedAt: { $gte: todayStart } }),
                // Recent call actions for streak calculation (last 20)
                CallNote.find({ agent: agentId, tenant: tenantId, createdAt: { $gte: todayStart } })
                    .sort({ createdAt: -1 })
                    .select('actionType')
                    .limit(20)
                    .lean()
            ]);

            const commissionRate = profile ? profile.commissionPerDelivery : 0;
            const commissionEarnedToday = confirmedToday * commissionRate;

            // Calls per hour: calls today / hours elapsed since shift start
            const hoursElapsed = Math.max(1, (now - todayStart) / 3600000);
            const callsPerHour = parseFloat((callsMadeToday / hoursElapsed).toFixed(1));

            // Confirm rate today: confirmed / (confirmed + cancelled)
            const totalDecided = confirmedToday + cancelledToday;
            const confirmRateToday = totalDecided > 0 ? parseFloat(((confirmedToday / totalDecided) * 100).toFixed(1)) : 0;

            // Streak: consecutive confirmations from most recent action
            let streak = 0;
            for (const call of recentCallActions) {
                if (call.actionType === 'Confirmed') streak++;
                else break;
            }

            return {
                metrics: {
                    totalAssigned, awaitingAction, confirmedToday, deliveredTotal,
                    callsMadeToday, commissionEarnedToday,
                    callsPerHour, confirmRateToday, streak
                },
                orders: actionRequiredOrders
            };
        }, 60);

        res.json(dashboardData);
    } catch (error) {
        logger.error({ err: error }, 'Agent Dashboard Error');
        res.status(500).json({ message: 'Server Error loading agent dashboard' });
    }
};

// --- LOGGING & ORDER ACTION ---

exports.logCallAction = async (req, res) => {
    try {
        const { orderId, actionType, note, newAddress, newWilaya, newCommune, postponedUntil } = req.body;
        const agentId = req.user._id;
        const tenantId = req.user.tenant;

        // Tenant-scoped fetch
        const order = await Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Agents can only act on orders assigned to them (managers are exempt)
        if (order.assignedAgent && order.assignedAgent.toString() !== agentId.toString()) {
            return res.status(403).json({ message: 'Order is assigned to another agent' });
        }

        const statusBefore = order.status;

        // Apply state transition if the action maps to a status change
        const newStatus = ACTION_STATUS_MAP[actionType];
        if (newStatus && newStatus !== order.status) {
            assertTransition(order.status, newStatus);
            order.status = newStatus;
            if (newStatus === 'Confirmed') {
                order.verificationStatus = 'Phone Confirmed';
                order.confirmedBy = agentId;
            }
            if (newStatus === 'Postponed') {
                if (!postponedUntil) return res.status(400).json({ message: 'postponedUntil is required when postponing' });
                const postponedDate = new Date(postponedUntil);
                if (isNaN(postponedDate.getTime()) || postponedDate <= new Date()) {
                    return res.status(400).json({ message: 'postponedUntil must be a valid future date' });
                }
                order.postponedUntil = postponedDate;
            } else {
                order.postponedUntil = null;
            }
        }

        // Count how many call attempts have been made on this order (tenant-scoped via order reference)
        const prevAttempts = await CallNote.countDocuments({ order: orderId, tenant: tenantId });

        await CallNote.create({
            tenant: tenantId,
            order: orderId,
            agent: agentId,
            actionType,
            note: note || '',
            callDurationSeconds: req.body.callDurationSeconds || 0,
            statusBefore,
            statusAfter: order.status,
            callAttemptNumber: prevAttempts + 1
        });

        // Address correction (no status change involved)
        if (actionType === 'Address_Updated') {
            if (newAddress && order.shipping) order.shipping.address = newAddress;
            if (newWilaya) order.wilaya = newWilaya;
            if (newCommune) order.commune = newCommune;
        }

        await order.save();

        // Invalidate relevant caches
        cacheService.del(`tenant:${tenantId}:agent:${agentId}:dashboard`);
        cacheService.del(`tenant:${tenantId}:orderIntel:${orderId}`);
        cacheService.del(`tenant:${tenantId}:managerOps`);

        // Audit trail: record status change in OrderStatusHistory
        if (newStatus && newStatus !== statusBefore) {
            fireAndRetry('OrderStatusHistory:callCenter', () => OrderStatusHistory.create({
                tenant: tenantId,
                orderId: order._id,
                status: newStatus,
                previousStatus: statusBefore,
                changedBy: agentId,
                note: `Call center action: ${actionType}${note ? ` — ${note}` : ''}`
            }));
        }

        // Post-save side effects for status changes
        if (newStatus && newStatus !== statusBefore) {
            // Restore reserved stock when order is cancelled via call center
            if (['Cancelled', 'Cancelled by Customer'].includes(newStatus) &&
                !['Cancelled', 'Cancelled by Customer', 'Returned', 'Refused'].includes(statusBefore)) {
                for (const item of order.products) {
                    if (!item.variantId) continue;
                    fireAndRetry('restoreStock:callCenter', () => ProductVariant.findOneAndUpdate(
                        { _id: item.variantId, tenant: tenantId },
                        { $inc: { reservedStock: -item.quantity, totalSold: -item.quantity } }
                    ));
                }
            }
            // Update customer metrics on any status change
            if (order.customer) fireAndRetry('updateCustomerMetrics:callCenter', () => updateCustomerMetrics(order.customer));
        }

        res.status(200).json({ message: 'Call logged successfully', order });
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'Log Call Error');
        res.status(500).json({ message: 'Server Error logging call' });
    }
};

// --- MANAGER ACTIONS ---

exports.assignOrders = async (req, res) => {
    try {
        const { mode, targetAgentId, orderIds, region, reason } = req.body;
        const tenantId = req.user.tenant;
        const changedBy = req.user._id;

        // Validate targetAgentId belongs to this tenant
        if (targetAgentId) {
            const agentUser = await User.findOne({ _id: targetAgentId, tenant: tenantId }).lean();
            if (!agentUser) return res.status(400).json({ message: 'Target agent not found in this workspace' });
        }

        if (mode === 'Manual') {
            if (!targetAgentId || !orderIds?.length) return res.status(400).json({ message: 'targetAgentId and orderIds required for manual mode' });
            let count = 0;
            for (const oid of orderIds) {
                await assignmentService.reassignOrder(oid, tenantId, targetAgentId, changedBy, reason || 'Manual assignment by manager');
                count++;
            }
            return res.json(ok({ message: `${count} orders assigned manually.`, count }));
        }

        if (mode === 'Region') {
            if (!targetAgentId || !region) return res.status(400).json({ message: 'targetAgentId and region required' });
            const orders = await Order.find({ tenant: tenantId, wilaya: region, status: 'New', assignedAgent: null, deletedAt: null }, { _id: 1 }).limit(5000).lean();
            let count = 0;
            for (const o of orders) {
                await assignmentService.assignOrder(o._id, tenantId, targetAgentId, 'manual', changedBy, `Region assignment: ${region}`);
                count++;
            }
            return res.json(ok({ message: `${count} regional orders assigned.`, count }));
        }

        if (mode === 'Auto_Distribute' || mode === 'Auto_RoundRobin') {
            // Uses the priority resolver (product → store → round-robin)
            const count = await assignmentService.distributeUnassignedOrders(tenantId, changedBy);
            return res.json(ok({ message: `${count} orders auto-distributed using priority rules.`, count }));
        }

        return res.status(400).json({ message: 'Invalid assignment mode. Use: Manual, Region, Auto_Distribute' });
    } catch (error) {
        logger.error({ err: error }, 'Assignment Error');
        res.status(500).json({ message: 'Server Error assigning orders' });
    }
};

exports.getOrderCallHistory = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId } = req.params;

        if (!require('mongoose').Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: 'Invalid order ID' });

        const calls = await CallNote.find({ order: orderId, tenant: tenantId })
            .populate('agent', 'name email')
            .sort({ createdAt: 1 })
            .limit(500)
            .lean();

        res.json({ orderId, totalAttempts: calls.length, calls });
    } catch (error) {
        logger.error({ err: error }, 'Call history fetch error');
        res.status(500).json({ message: 'Server Error fetching call history' });
    }
};

exports.getManagerAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agents = await AgentProfile.find({ tenant: tenantId, isActive: true }).populate('user', 'name email').lean()
            .then(profiles => profiles.filter(p => p.user)); // null-safety: skip orphaned profiles

        if (agents.length === 0) return res.json({ leaderboard: [] });

        const agentIds = agents.map(a => a.user._id);

        // Single aggregation for Order counts — replaces N×4 individual countDocuments calls
        const [orderStats, callStats] = await Promise.all([
            Order.aggregate([
                { $match: { tenant: tenantId, assignedAgent: { $in: agentIds }, deletedAt: null } },
                {
                    $group: {
                        _id: '$assignedAgent',
                        totalAssigned: { $sum: 1 },
                        totalConfirmed: { $sum: { $cond: [{ $not: [{ $in: ['$status', ['New', 'Refused']] }] }, 1, 0] } },
                        totalDelivered: { $sum: { $cond: [{ $in:  ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                        totalCancelled: { $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Cancelled by Customer']] }, 1, 0] } },
                        totalReturned: { $sum: { $cond: [{ $in: ['$status', ['Returned', 'Refused']] }, 1, 0] } }
                    }
                }
            ]),
            CallNote.aggregate([
                { $match: { tenant: tenantId, agent: { $in: agentIds } } },
                { $group: { _id: '$agent', totalCalls: { $sum: 1 } } }
            ])
        ]);

        // Build O(1) lookup maps
        const orderMap = {};
        orderStats.forEach(s => { orderMap[s._id.toString()] = s; });
        const callMap = {};
        callStats.forEach(s => { callMap[s._id.toString()] = s.totalCalls; });

        const leaderboard = agents.map(profile => {
            const agentId = profile.user._id;
            const key = agentId.toString();
            const stats = orderMap[key] || { totalAssigned: 0, totalConfirmed: 0, totalDelivered: 0, totalCancelled: 0, totalReturned: 0 };
            const totalCalls = callMap[key] || 0;

            const confirmedRate = stats.totalAssigned > 0
                ? ((stats.totalConfirmed / stats.totalAssigned) * 100).toFixed(1)
                : 0;
            const cancellationRate = stats.totalAssigned > 0
                ? parseFloat(((stats.totalCancelled / stats.totalAssigned) * 100).toFixed(1))
                : 0;
            const returnRate = stats.totalDelivered > 0
                ? parseFloat(((stats.totalReturned / stats.totalDelivered) * 100).toFixed(1))
                : 0;

            let commissionEarned = 0;
            if (profile.compensationModel === 'Commission' || profile.compensationModel === 'Hybrid') {
                commissionEarned = stats.totalDelivered * profile.commissionPerDelivery;
            }

            return {
                agentId,
                name: profile.user.name || profile.user.email,
                totalAssigned:  stats.totalAssigned,
                totalConfirmed: stats.totalConfirmed,
                confirmedRate:  parseFloat(confirmedRate),
                totalDelivered: stats.totalDelivered,
                totalCalls,
                totalCancelled: stats.totalCancelled,
                cancellationRate,
                totalReturned: stats.totalReturned,
                returnRate,
                commissionEarned,
                baseSalary: profile.baseSalary
            };
        });

        res.json({ leaderboard });
    } catch (error) {
        logger.error({ err: error }, 'Manager Analytics Error');
        res.status(500).json({ message: 'Server Error generating analytics' });
    }
};

// --- ORDER INTELLIGENCE (agent pre-call card) ---

exports.getOrderIntel = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ message: 'Invalid order ID' });

        const cacheKey = `tenant:${tenantId}:orderIntel:${orderId}`;
        const intel = await cacheService.getOrSet(cacheKey, async () => {
            const order = await Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null })
                .populate('customer', 'name phone totalOrders deliveredOrders totalRefusals cancelledOrders trustScore riskLevel segment deliverySuccessRate blacklisted')
                .populate('products.variantId', 'callScript')
                .select('customer shipping products')
                .lean();

            if (!order) return null;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [callHistory, duplicateCount] = await Promise.all([
                CallNote.find({ order: orderId, tenant: tenantId })
                    .populate('agent', 'name')
                    .sort({ createdAt: 1 })
                    .lean(),
                order.shipping?.phone1
                    ? Order.countDocuments({
                        tenant: tenantId,
                        'shipping.phone1': order.shipping.phone1,
                        deletedAt: null,
                        status: { $nin: TERMINAL },
                        _id: { $ne: orderId },
                        createdAt: { $gte: sevenDaysAgo }
                    })
                    : 0
            ]);

            const callScripts = order.products
                ?.map(p => ({
                    name: p.name,
                    script: p.variantId?.callScript
                }))
                .filter(p => p.script);

            return {
                customer: order.customer || null,
                callHistory,
                duplicateCount,
                callScripts
            };
        }, 30);

        if (!intel) return res.status(404).json({ message: 'Order not found' });
        res.json(ok(intel));
    } catch (error) {
        logger.error({ err: error }, 'Order Intel Error');
        res.status(500).json({ message: 'Server Error fetching order intelligence' });
    }
};

// --- MANAGER OPERATIONS DASHBOARD ---

exports.getManagerOperations = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const cacheKey = `tenant:${tenantId}:managerOps`;

        const ops = await cacheService.getOrSet(cacheKey, async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const now = new Date();
            const HOUR = 3600000;

            const [result] = await Order.aggregate([
                { $match: { tenant: tenantId, deletedAt: null } },
                { $facet: {
                    queueDepth: [
                        { $match: { status: { $in: ACTIONABLE_STATUSES } } },
                        { $count: 'count' }
                    ],
                    confirmedToday: [
                        { $match: { status: 'Confirmed', updatedAt: { $gte: todayStart } } },
                        { $count: 'count' }
                    ],
                    cancelledToday: [
                        { $match: { status: { $in: ['Cancelled', 'Cancelled by Customer'] }, updatedAt: { $gte: todayStart } } },
                        { $count: 'count' }
                    ],
                    postponedWaiting: [
                        { $match: { status: 'Postponed' } },
                        { $count: 'count' }
                    ],
                    noAnswerTotal: [
                        { $match: { status: 'No Answer' } },
                        { $count: 'count' }
                    ],
                    avgTimeToConfirm: [
                        { $match: { status: 'Confirmed', updatedAt: { $gte: todayStart } } },
                        { $project: { diff: { $subtract: ['$updatedAt', '$createdAt'] } } },
                        { $group: { _id: null, avgMs: { $avg: '$diff' } } }
                    ],
                    queueAge: [
                        { $match: { status: { $in: ACTIONABLE_STATUSES } } },
                        { $project: { ageMs: { $subtract: [now, '$createdAt'] } } },
                        { $group: {
                            _id: null,
                            over1h:  { $sum: { $cond: [{ $gte: ['$ageMs', 1  * HOUR] }, 1, 0] } },
                            over4h:  { $sum: { $cond: [{ $gte: ['$ageMs', 4  * HOUR] }, 1, 0] } },
                            over12h: { $sum: { $cond: [{ $gte: ['$ageMs', 12 * HOUR] }, 1, 0] } },
                            over24h: { $sum: { $cond: [{ $gte: ['$ageMs', 24 * HOUR] }, 1, 0] } }
                        }}
                    ],
                    agentWorkload: [
                        { $match: { status: { $in: ACTIONABLE_STATUSES }, assignedAgent: { $ne: null } } },
                        { $group: { _id: '$assignedAgent', count: { $sum: 1 } } },
                        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
                        { $unwind: '$agent' },
                        { $project: { _id: 0, agentId: '$_id', name: '$agent.name', count: 1 } },
                        { $sort: { count: -1 } }
                    ]
                }}
            ]);

            const extract = (arr) => arr[0]?.count || 0;

            return {
                queueDepth:       extract(result.queueDepth),
                confirmedToday:   extract(result.confirmedToday),
                cancelledToday:   extract(result.cancelledToday),
                postponedWaiting: extract(result.postponedWaiting),
                noAnswerTotal:    extract(result.noAnswerTotal),
                avgTimeToConfirmMs: result.avgTimeToConfirm[0]?.avgMs || 0,
                queueAge: result.queueAge[0] || { over1h: 0, over4h: 0, over12h: 0, over24h: 0 },
                agentWorkload: result.agentWorkload
            };
        }, 60);

        res.json(ok(ops));
    } catch (error) {
        logger.error({ err: error }, 'Manager Operations Error');
        res.status(500).json({ message: 'Server Error fetching operations dashboard' });
    }
};

// --- AUTO-ASSIGN is now handled by assignment.service.js ---
// Kept as a re-export for backward compatibility
const assignmentService = require('../domains/call-center/assignment.service');
exports.autoAssignOrder = assignmentService.autoAssignOrder;

// --- SUPERVISOR REVIEW QUEUE (escalated/flagged orders needing attention) ---

exports.getSupervisorQueue = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const cacheKey = `tenant:${tenantId}:supervisorQueue`;

        const queue = await cacheService.getOrSet(cacheKey, async () => {
            // Find orders that need supervisor attention:
            // 1. Tagged 'Escalated' (3+ failed call attempts)
            // 2. Tagged 'Overdue Callback' (postponed 24h+ past due)
            // 3. Blacklisted customer orders still in queue
            // 4. High-value orders (>10000 DZD) stuck in No Answer
            const [escalated, overdueCallbacks, blacklistedOrders, highValueStuck] = await Promise.all([
                Order.find({
                    tenant: tenantId, deletedAt: null,
                    tags: 'Escalated',
                    status: { $in: ACTIONABLE_STATUSES }
                })
                .populate('customer', 'name phone trustScore riskLevel blacklisted')
                .populate('assignedAgent', 'name')
                .select('orderId status wilaya totalAmount tags priority assignedAgent customer createdAt updatedAt')
                .sort({ updatedAt: 1 })
                .limit(50)
                .lean(),

                Order.find({
                    tenant: tenantId, deletedAt: null,
                    tags: 'Overdue Callback',
                    status: 'Postponed'
                })
                .populate('customer', 'name phone')
                .populate('assignedAgent', 'name')
                .select('orderId status wilaya totalAmount tags priority assignedAgent customer postponedUntil createdAt')
                .sort({ postponedUntil: 1 })
                .limit(50)
                .lean(),

                Order.find({
                    tenant: tenantId, deletedAt: null,
                    status: { $in: ACTIONABLE_STATUSES }
                })
                .populate({ path: 'customer', match: { blacklisted: true }, select: 'name phone blacklisted trustScore' })
                .populate('assignedAgent', 'name')
                .select('orderId status wilaya totalAmount assignedAgent customer createdAt')
                .sort({ createdAt: 1 })
                .limit(100)
                .lean()
                .then(orders => orders.filter(o => o.customer)),

                Order.find({
                    tenant: tenantId, deletedAt: null,
                    status: 'No Answer',
                    totalAmount: { $gte: 10000 }
                })
                .populate('customer', 'name phone')
                .populate('assignedAgent', 'name')
                .select('orderId status wilaya totalAmount assignedAgent customer createdAt updatedAt')
                .sort({ totalAmount: -1 })
                .limit(30)
                .lean()
            ]);

            return {
                escalated,
                overdueCallbacks,
                blacklistedOrders,
                highValueStuck,
                counts: {
                    escalated: escalated.length,
                    overdueCallbacks: overdueCallbacks.length,
                    blacklistedOrders: blacklistedOrders.length,
                    highValueStuck: highValueStuck.length,
                    total: escalated.length + overdueCallbacks.length + blacklistedOrders.length + highValueStuck.length
                }
            };
        }, 60);

        res.json(ok(queue));
    } catch (error) {
        logger.error({ err: error }, 'Supervisor Queue Error');
        res.status(500).json({ message: 'Server Error fetching supervisor queue' });
    }
};

// --- BEST TIME TO CALL PER WILAYA ---

exports.getBestTimeToCall = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const cacheKey = `tenant:${tenantId}:bestTimeToCall`;

        const data = await cacheService.getOrSet(cacheKey, async () => {
            // Analyze CallNotes where outcome was Confirmed, grouped by hour and wilaya
            const results = await CallNote.aggregate([
                { $match: { tenant: tenantId, actionType: 'Confirmed' } },
                { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'ord' } },
                { $unwind: '$ord' },
                { $match: { 'ord.tenant': tenantId, 'ord.deletedAt': null } },
                { $group: {
                    _id: { wilaya: '$ord.wilaya', hour: { $hour: '$createdAt' } },
                    confirmations: { $sum: 1 }
                }},
                { $sort: { '_id.wilaya': 1, confirmations: -1 } },
                { $limit: 500 }
            ]);

            // Group by wilaya, pick top 3 hours
            const byWilaya = {};
            for (const r of results) {
                const w = r._id.wilaya || 'Unknown';
                if (!byWilaya[w]) byWilaya[w] = [];
                if (byWilaya[w].length < 3) {
                    byWilaya[w].push({ hour: r._id.hour, confirmations: r.confirmations });
                }
            }

            return byWilaya;
        }, 3600); // Cache 1 hour — this data changes slowly

        res.json(ok(data));
    } catch (error) {
        logger.error({ err: error }, 'Best Time To Call Error');
        res.status(500).json({ message: 'Server Error fetching best time to call' });
    }
};

// --- CALL CENTER ANALYTICS (deep reporting for managers) ---

exports.getCallCenterAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const range = parseInt(req.query.days, 10) || 7;
        const days = Math.min(Math.max(range, 1), 90);

        const since = new Date();
        since.setDate(since.getDate() - days);
        since.setHours(0, 0, 0, 0);

        const cacheKey = `tenant:${tenantId}:ccAnalytics:${days}`;
        const analytics = await cacheService.getOrSet(cacheKey, async () => {
            const [
                hourlyActivity,
                confirmationFunnel,
                wilayaBreakdown,
                agentRankings,
                dailyTrend
            ] = await Promise.all([
                // 1. Hourly call activity (heatmap data: hour × day-of-week)
                CallNote.aggregate([
                    { $match: { tenant: tenantId, createdAt: { $gte: since } } },
                    { $group: {
                        _id: { hour: { $hour: '$createdAt' }, dow: { $dayOfWeek: '$createdAt' } },
                        count: { $sum: 1 }
                    }},
                    { $sort: { '_id.dow': 1, '_id.hour': 1 } }
                ]),

                // 2. Confirmation funnel: how orders flow through statuses
                Order.aggregate([
                    { $match: { tenant: tenantId, deletedAt: null, createdAt: { $gte: since } } },
                    { $group: {
                        _id: null,
                        total: { $sum: 1 },
                        contacted: { $sum: { $cond: [{ $in: ['$status', ['Call 1', 'Call 2', 'Call 3', 'No Answer', 'Postponed', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                        confirmed: { $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                        dispatched: { $sum: { $cond: [{ $in: ['$status', ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                        delivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Cancelled by Customer']] }, 1, 0] } },
                        refused: { $sum: { $cond: [{ $eq: ['$status', 'Refused'] }, 1, 0] } }
                    }}
                ]),

                // 3. Wilaya breakdown: answer rates and confirm rates per region
                Order.aggregate([
                    { $match: { tenant: tenantId, deletedAt: null, createdAt: { $gte: since } } },
                    { $group: {
                        _id: '$wilaya',
                        total: { $sum: 1 },
                        confirmed: { $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                        noAnswer: { $sum: { $cond: [{ $eq: ['$status', 'No Answer'] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Cancelled by Customer']] }, 1, 0] } },
                        delivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                        refused: { $sum: { $cond: [{ $eq: ['$status', 'Refused'] }, 1, 0] } }
                    }},
                    { $addFields: {
                        confirmRate: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$confirmed', '$total'] }, 100] }, 1] }, 0] },
                        answerRate: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$total', '$noAnswer'] }, '$total'] }, 100] }, 1] }, 0] }
                    }},
                    { $sort: { total: -1 } },
                    { $limit: 48 }
                ]),

                // 4. Agent rankings (best & worst by confirm rate, min 5 orders)
                Order.aggregate([
                    { $match: { tenant: tenantId, deletedAt: null, assignedAgent: { $ne: null }, createdAt: { $gte: since } } },
                    { $group: {
                        _id: '$assignedAgent',
                        total: { $sum: 1 },
                        confirmed: { $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Cancelled by Customer']] }, 1, 0] } },
                        delivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } }
                    }},
                    { $match: { total: { $gte: 5 } } },
                    { $addFields: {
                        confirmRate: { $round: [{ $multiply: [{ $divide: ['$confirmed', '$total'] }, 100] }, 1] },
                        cancelRate: { $round: [{ $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] }, 1] }
                    }},
                    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
                    { $unwind: '$agent' },
                    { $project: { _id: 0, agentId: '$_id', name: '$agent.name', total: 1, confirmed: 1, cancelled: 1, delivered: 1, confirmRate: 1, cancelRate: 1 } },
                    { $sort: { confirmRate: -1 } }
                ]),

                // 5. Daily trend: calls + confirmations per day
                CallNote.aggregate([
                    { $match: { tenant: tenantId, createdAt: { $gte: since } } },
                    { $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        totalCalls: { $sum: 1 },
                        confirmed: { $sum: { $cond: [{ $eq: ['$actionType', 'Confirmed'] }, 1, 0] } },
                        noAnswer: { $sum: { $cond: [{ $eq: ['$actionType', 'No Answer'] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $eq: ['$actionType', 'Cancelled'] }, 1, 0] } }
                    }},
                    { $sort: { _id: 1 } }
                ])
            ]);

            // Build hourly heatmap: 7 × 24 grid
            const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
            for (const h of hourlyActivity) {
                const dow = h._id.dow - 1; // MongoDB $dayOfWeek: 1=Sunday
                heatmap[dow][h._id.hour] = h.count;
            }

            const funnel = confirmationFunnel[0] || { total: 0, contacted: 0, confirmed: 0, dispatched: 0, delivered: 0, cancelled: 0, refused: 0 };

            return {
                period: { days, since },
                heatmap, // [dow][hour] = count
                funnel,
                wilayaBreakdown,
                agentRankings: {
                    best: agentRankings.slice(0, 5),
                    worst: [...agentRankings].reverse().slice(0, 5)
                },
                dailyTrend
            };
        }, 120);

        res.json(ok(analytics));
    } catch (error) {
        logger.error({ err: error }, 'Call Center Analytics Error');
        res.status(500).json({ message: 'Server Error generating call center analytics' });
    }
};

// --- BULK STATUS CHANGE ---

exports.bulkUpdateOrders = async (req, res) => {
    try {
        const { orderIds, action, targetAgentId } = req.body;
        const tenantId = req.user.tenant;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'orderIds must be a non-empty array' });
        }
        if (orderIds.length > 500) {
            return res.status(400).json({ message: 'Cannot process more than 500 orders at once' });
        }

        // Validate ObjectIds
        for (const id of orderIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: `Invalid order ID: ${id}` });
            }
        }

        const filter = { _id: { $in: orderIds }, tenant: tenantId, deletedAt: null };

        if (action === 'reassign') {
            if (!targetAgentId || !mongoose.Types.ObjectId.isValid(targetAgentId)) {
                return res.status(400).json({ message: 'Valid targetAgentId is required for reassignment' });
            }
            const agentUser = await User.findOne({ _id: targetAgentId, tenant: tenantId }).lean();
            if (!agentUser) return res.status(400).json({ message: 'Target agent not found in this workspace' });

            const result = await Order.updateMany(filter, { $set: { assignedAgent: targetAgentId } });
            return res.json(ok({ modifiedCount: result.modifiedCount, action: 'reassign' }));
        }

        if (action === 'cancel') {
            const cancelFilter = { ...filter, status: { $in: ACTIONABLE_STATUSES } };
            const ordersToCancelIds = await Order.find(cancelFilter).select('_id').lean();
            let successCount = 0;
            const errors = [];
            for (const { _id } of ordersToCancelIds) {
                try {
                    await OrderService.updateOrder(
                        _id,
                        { status: 'Cancelled by Customer' },
                        req.user._id,
                        { bypassStateMachine: true }
                    );
                    successCount++;
                } catch (err) {
                    logger.error({ err, orderId: _id }, 'Bulk cancel: failed to cancel order');
                    errors.push({ orderId: _id.toString(), message: err.message });
                }
            }
            return res.json(ok({ modifiedCount: successCount, failedCount: errors.length, errors, action: 'cancel' }));
        }

        if (action === 'unassign') {
            const result = await Order.updateMany(filter, { $set: { assignedAgent: null } });
            return res.json(ok({ modifiedCount: result.modifiedCount, action: 'unassign' }));
        }

        return res.status(400).json({ message: 'Invalid action. Supported: reassign, cancel, unassign' });
    } catch (error) {
        logger.error({ err: error }, 'Bulk Update Error');
        res.status(500).json({ message: 'Server Error performing bulk update' });
    }
};

// --- PEER/PESSIMISTIC LOCKING ---

exports.lockOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenant;
        const agentId = req.user._id;

        // Lock if not locked by someone else, or if lock is stale (> 5 mins)
        const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
        
        const order = await Order.findOneAndUpdate({
            _id: id,
            tenant: tenantId,
            deletedAt: null,
            $or: [
                { lockedBy: null },
                { lockedBy: agentId },
                { lockedAt: { $lt: staleThreshold } }
            ]
        }, {
            $set: {
                lockedBy: agentId,
                lockedAt: new Date()
            }
        }, { returnDocument: 'after' });

        if (!order) {
            const exists = await Order.findOne({ _id: id, tenant: tenantId, deletedAt: null }).lean();
            if (!exists) return res.status(404).json({ message: 'Order not found' });
            return res.status(409).json({ message: 'Order is currently locked by another user' });
        }

        res.json({ message: 'Order locked successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Lock Order Error');
        res.status(500).json({ message: 'Server Error locking order' });
    }
};

exports.unlockOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenant;
        const agentId = req.user._id;

        await Order.updateOne({
            _id: id,
            tenant: tenantId,
            lockedBy: agentId
        }, {
            $set: {
                lockedBy: null,
                lockedAt: null
            }
        });

        res.json({ message: 'Order unlocked successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Unlock Order Error');
        res.status(500).json({ message: 'Server Error unlocking order' });
    }
};

// --- AGENT PERFORMANCE DRILL-DOWN ---

exports.getAgentPerformanceDetail = async (req, res) => {
    try {
        const { agentId } = req.params;
        const tenantId = req.user.tenant;
        const { period = '30d' } = req.query;

        let days = parseInt(period, 10) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const agent = await User.findOne({ _id: agentId, tenant: tenantId }).select('name email role isActive').lean();
        if (!agent) return res.status(404).json({ message: 'Agent not found' });

        // Fetch recent confirmed orders
        const confirmedOrders = await Order.find({
            tenant: tenantId,
            deletedAt: null,
            confirmedBy: agentId,
            updatedAt: { $gte: since }
        }).select('orderId status totalAmount date shipping.wilayaName customer').populate('customer', 'name phone').sort({ updatedAt: -1 }).limit(50).lean();

        // Calculate specific agent stats for the period
        const stats = await Order.aggregate([
            { $match: { tenant: tenantId, deletedAt: null, assignedAgent: new mongoose.Types.ObjectId(agentId), updatedAt: { $gte: since } } },
            { $group: {
                _id: null,
                totalAssigned: { $sum: 1 },
                totalConfirmed: { $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] }, 1, 0] } },
                totalCancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled by Customer'] }, 1, 0] } },
                totalDelivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                totalReturned: { $sum: { $cond: [{ $in: ['$status', ['Refused', 'Returned']] }, 1, 0] } },
                commissionEarned: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, { $multiply: ['$totalAmount', 0.02] }, 0] } } // Example commission logic
            }}
        ]);

        const agentStats = stats[0] || {
            totalAssigned: 0, totalConfirmed: 0, totalCancelled: 0, totalDelivered: 0, totalReturned: 0, commissionEarned: 0
        };

        const confirmRate = agentStats.totalAssigned > 0 ? ((agentStats.totalConfirmed / agentStats.totalAssigned) * 100).toFixed(1) : 0;
        const returnRate = agentStats.totalDelivered + agentStats.totalReturned > 0 
            ? ((agentStats.totalReturned / (agentStats.totalDelivered + agentStats.totalReturned)) * 100).toFixed(1) 
            : 0;

        res.json(ok({
            agent,
            stats: { ...agentStats, confirmRate, returnRate },
            recentConfirmedOrders: confirmedOrders
        }));

    } catch (error) {
        logger.error({ err: error }, 'Agent Performance Detail Error');
        res.status(500).json({ message: 'Server Error loading agent performance details' });
    }
};

// ─── SEND MESSAGE TO CUSTOMER ────────────────────────────────────────────────

exports.sendCustomerMessage = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId, templateKey, lang, channel, customMessage } = req.body;

        if (!orderId || !templateKey) {
            return res.status(400).json({ message: 'orderId and templateKey are required' });
        }

        const order = await Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null })
            .populate('customer', 'name phone')
            .lean();
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const phone = order.shipping?.phone1 || order.customer?.phone;
        if (!phone) return res.status(400).json({ message: 'No phone number available for this customer' });

        const vars = {
            customerName: order.shipping?.recipientName || order.customer?.name || 'عميل',
            orderId: order.orderId,
            wilaya: order.shipping?.wilayaName || order.wilaya || '',
            courierName: 'شركة التوصيل',
            address: order.shipping?.address || '',
            message: customMessage || '',
        };

        const result = await sendMessage({
            phone,
            templateKey,
            vars,
            lang: lang || 'ar',
            channel: channel || 'sms',
        });

        // Log the message as a CallNote for audit trail
        await CallNote.create({
            tenant: tenantId,
            order: orderId,
            agent: req.user._id,
            actionType: 'General_Note',
            note: `📱 ${channel || 'SMS'} sent (${templateKey}): ${result.messageText}`,
            callDurationSeconds: 0,
            statusBefore: order.status,
            statusAfter: order.status,
        });

        // Invalidate caches
        cacheService.del(`orderIntel:${orderId}`);

        res.json(ok({
            sent: result.success,
            messageText: result.messageText,
            channel: result.channel,
            provider: result.provider,
            error: result.error || null,
        }));

    } catch (error) {
        logger.error({ err: error }, 'sendCustomerMessage error');
        res.status(500).json({ message: 'Failed to send message' });
    }
};

// ─── GET MESSAGE TEMPLATES ───────────────────────────────────────────────────

exports.getMessageTemplates = async (req, res) => {
    try {
        res.json(ok(getTemplates()));
    } catch (error) {
        logger.error({ err: error }, 'getMessageTemplates error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// ─── QUICK DISPATCH FROM CALL CENTER ─────────────────────────────────────────

exports.quickDispatchOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        const order = await Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null }).lean();
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.status !== 'Confirmed') {
            return res.status(400).json({ message: `Order must be in "Confirmed" status to dispatch. Current: ${order.status}` });
        }

        const shipment = await ShipmentService.quickDispatch(orderId, tenantId);

        // Log action as CallNote
        await CallNote.create({
            tenant: tenantId,
            order: orderId,
            agent: req.user._id,
            actionType: 'General_Note',
            note: `🚚 Quick dispatched to courier. Tracking: ${shipment.externalTrackingId || 'pending'}`,
            callDurationSeconds: 0,
            statusBefore: 'Confirmed',
            statusAfter: shipment.externalTrackingId ? 'Dispatched' : 'Dispatch Failed',
        });

        // Invalidate caches
        cacheService.del(`agentDash:${req.user._id}`);
        cacheService.del(`orderIntel:${orderId}`);
        cacheService.flushByPrefix('managerOps:');

        res.status(201).json(ok({
            shipmentId: shipment._id,
            trackingId: shipment.externalTrackingId,
            status: shipment.shipmentStatus,
        }));

    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'quickDispatchOrder error');
        res.status(502).json({ message: 'Courier Integration Error. Please check courier API credentials and try again.' });
    }
};

// ─── ORDER TRACKING TIMELINE ─────────────────────────────────────────────────

exports.getOrderTracking = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        // Fetch order with status history
        const [order, statusHistory, shipment, callNotes] = await Promise.all([
            Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null })
                .populate('customer', 'name phone')
                .populate('assignedAgent', 'name')
                .populate('confirmedBy', 'name')
                .select('orderId status shipping wilaya commune totalAmount createdAt updatedAt confirmedBy assignedAgent verificationStatus')
                .lean(),
            OrderStatusHistory.find({ order: orderId, tenant: tenantId })
                .populate('changedBy', 'name')
                .sort({ createdAt: 1 })
                .lean(),
            Shipment.findOne({ internalOrder: orderId, tenant: tenantId })
                .select('externalTrackingId shipmentStatus courierStatus activityHistory dispatchDate deliveredDate labelUrl')
                .lean(),
            CallNote.find({ order: orderId, tenant: tenantId })
                .populate('agent', 'name')
                .sort({ createdAt: 1 })
                .select('actionType note createdAt agent callAttemptNumber')
                .lean(),
        ]);

        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Build unified timeline from all sources
        const timeline = [];

        // Order creation
        timeline.push({
            type: 'status',
            event: 'Order Created',
            status: 'New',
            date: order.createdAt,
            actor: null,
        });

        // Status changes from history
        for (const h of statusHistory) {
            timeline.push({
                type: 'status',
                event: `Status → ${h.newStatus}`,
                status: h.newStatus,
                previousStatus: h.previousStatus,
                date: h.createdAt,
                actor: h.changedBy?.name || 'System',
                reason: h.reason || null,
            });
        }

        // Call notes (filtered to avoid duplicating status changes)
        for (const cn of callNotes) {
            timeline.push({
                type: 'call',
                event: cn.actionType,
                note: cn.note,
                date: cn.createdAt,
                actor: cn.agent?.name || 'Agent',
                attempt: cn.callAttemptNumber,
            });
        }

        // Shipment activity
        if (shipment?.activityHistory) {
            for (const act of shipment.activityHistory) {
                timeline.push({
                    type: 'shipment',
                    event: act.status,
                    note: act.remarks,
                    date: act.date,
                    location: act.location || null,
                    actor: 'Courier',
                });
            }
        }

        // Sort all events chronologically
        timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(ok({
            order: {
                _id: order._id,
                orderId: order.orderId,
                status: order.status,
                customer: order.customer,
                shipping: order.shipping,
                wilaya: order.wilaya,
                commune: order.commune,
                totalAmount: order.totalAmount,
                assignedAgent: order.assignedAgent,
                confirmedBy: order.confirmedBy,
                verificationStatus: order.verificationStatus,
            },
            shipment: shipment ? {
                trackingId: shipment.externalTrackingId,
                status: shipment.shipmentStatus,
                courierStatus: shipment.courierStatus,
                dispatchDate: shipment.dispatchDate,
                deliveredDate: shipment.deliveredDate,
                labelUrl: shipment.labelUrl,
            } : null,
            timeline,
        }));

    } catch (error) {
        logger.error({ err: error }, 'getOrderTracking error');
        res.status(500).json({ message: 'Server Error loading tracking' });
    }
};

// ─── POST-DISPATCH FOLLOW-UP QUEUE ──────────────────────────────────────────

exports.getFollowUpQueue = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agentId = req.user._id;
        const isAdmin = isAdminUser(req.user);

        // Orders that are dispatched/shipped/out for delivery and assigned to this agent
        // These need follow-up calls (remind customer to answer delivery call, etc.)
        const POST_DISPATCH_FOLLOWUP = ['Dispatched', 'Shipped', 'Out for Delivery', 'Failed Attempt'];

        const followUpFilter = {
            tenant: tenantId,
            status: { $in: POST_DISPATCH_FOLLOWUP },
            deletedAt: null,
        };
        // Admins see all follow-up orders; agents see only theirs + unassigned
        if (!isAdmin) {
            followUpFilter.$or = [
                { assignedAgent: agentId },
                { assignedAgent: null },
            ];
        }

        const orders = await Order.find(followUpFilter)
            .populate('customer', 'name phone')
            .sort({ updatedAt: -1 })
            .limit(100)
            .lean();

        // Enrich with shipment info
        const orderIds = orders.map(o => o._id);
        const shipments = await Shipment.find({
            internalOrder: { $in: orderIds },
            tenant: tenantId,
        }).select('internalOrder shipmentStatus courierStatus externalTrackingId').lean();

        const shipmentMap = {};
        for (const s of shipments) {
            shipmentMap[s.internalOrder.toString()] = s;
        }

        const enriched = orders.map(o => ({
            ...o,
            shipment: shipmentMap[o._id.toString()] || null,
        }));

        res.json(ok(enriched));

    } catch (error) {
        logger.error({ err: error }, 'getFollowUpQueue error');
        res.status(500).json({ message: 'Server Error loading follow-up queue' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ASSIGNMENT SYSTEM — QUEUES, CLAIM, REASSIGN, RULES CRUD
// ═══════════════════════════════════════════════════════════════════════════════

const AssignmentRule = require('../models/AssignmentRule');
const AssignmentHistory = require('../models/AssignmentHistory');

// --- AGENT QUEUES (separated views) ---

/**
 * GET /my-queue — Orders assigned to the current agent, segmented.
 */
exports.getMyQueue = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agentId = req.user._id;
        const isAdmin = isAdminUser(req.user);
        const STALE_LOCK_MS = 5 * 60 * 1000;

        const baseFilter = {
            tenant: tenantId,
            deletedAt: null,
            status: { $nin: [...TERMINAL, 'Cancelled by Customer'] }
        };
        if (!isAdmin) baseFilter.assignedAgent = agentId;

        // Admin sees all; agent sees only unlocked/own-locked
        const assignedFilter = { ...baseFilter, status: { $in: ACTIONABLE_STATUSES } };
        if (!isAdmin) assignedFilter.$or = [{ lockedBy: null }, { lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } }];

        const inProgressFilter = { ...baseFilter };
        if (isAdmin) {
            inProgressFilter.lockedBy = { $ne: null };
            inProgressFilter.lockedAt = { $gte: new Date(Date.now() - STALE_LOCK_MS) };
        } else {
            inProgressFilter.lockedBy = agentId;
            inProgressFilter.lockedAt = { $gte: new Date(Date.now() - STALE_LOCK_MS) };
        }

        const [assigned, inProgress, followUp] = await Promise.all([
            // Assigned — actionable statuses
            Order.find(assignedFilter)
            .populate('customer', 'name phone trustScore blacklisted')
            .select('orderId status wilaya commune totalAmount priority tags assignmentMode assignedAgent channel createdAt updatedAt postponedUntil')
            .sort({ priority: -1, createdAt: 1 })
            .limit(isAdmin ? 500 : 100)
            .lean(),

            // In Progress — locked orders
            Order.find(inProgressFilter)
            .populate('customer', 'name phone trustScore blacklisted')
            .select('orderId status wilaya commune totalAmount priority tags assignmentMode assignedAgent channel createdAt updatedAt')
            .limit(200)
            .lean(),

            // Follow-up — postponed/no answer orders assigned to me
            Order.find({
                ...baseFilter,
                status: { $in: ['Postponed', 'No Answer', 'Wrong Number', 'Out of Coverage'] }
            })
            .populate('customer', 'name phone trustScore')
            .select('orderId status wilaya commune totalAmount priority tags assignmentMode postponedUntil createdAt updatedAt')
            .sort({ postponedUntil: 1, updatedAt: 1 })
            .limit(100)
            .lean()
        ]);

        res.json(ok({
            assigned: assigned.length,
            inProgress: inProgress.length,
            followUp: followUp.length,
            orders: { assigned, inProgress, followUp }
        }));
    } catch (error) {
        logger.error({ err: error }, 'getMyQueue error');
        res.status(500).json({ message: 'Server Error loading agent queue' });
    }
};

/**
 * GET /unassigned-queue — Unassigned orders (shared pool).
 * Requires CALLCENTER_VIEW_UNASSIGNED permission.
 */
exports.getUnassignedQueue = async (req, res) => {
    try {
        const tenantId = req.user.tenant;

        const orders = await Order.find({
            tenant: tenantId,
            assignedAgent: null,
            deletedAt: null,
            status: { $in: ['New', ...ACTIONABLE_STATUSES] }
        })
        .populate('customer', 'name phone trustScore blacklisted')
        .select('orderId status wilaya commune totalAmount priority tags channel salesChannelSource createdAt products')
        .sort({ priority: -1, createdAt: 1 })
        .limit(200)
        .lean();

        res.json(ok({ total: orders.length, orders }));
    } catch (error) {
        logger.error({ err: error }, 'getUnassignedQueue error');
        res.status(500).json({ message: 'Server Error loading unassigned queue' });
    }
};

/**
 * POST /claim/:orderId — Agent claims an unassigned order.
 */
exports.claimOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agentId = req.user._id;
        const { orderId } = req.params;

        const order = await assignmentService.claimOrder(orderId, tenantId, agentId);
        cacheService.del(`tenant:${tenantId}:agent:${agentId}:dashboard`);

        res.json(ok({ message: 'Order claimed successfully', orderId: order.orderId }));
    } catch (error) {
        logger.error({ err: error }, 'claimOrder error');
        res.status(400).json({ message: error.isOperational ? error.message : 'Failed to claim order' });
    }
};

/**
 * POST /reassign — Reassign an order to a different agent.
 * Requires CALLCENTER_REASSIGN permission.
 */
exports.reassignOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const changedBy = req.user._id;
        const { orderId, newAgentId, reason } = req.body;

        if (!orderId || !newAgentId) return res.status(400).json({ message: 'orderId and newAgentId required' });

        const agentUser = await User.findOne({ _id: newAgentId, tenant: tenantId }).lean();
        if (!agentUser) return res.status(400).json({ message: 'Target agent not found' });

        const order = await assignmentService.reassignOrder(orderId, tenantId, newAgentId, changedBy, reason || '');

        // Clear caches
        cacheService.del(`tenant:${tenantId}:managerOps`);

        res.json(ok({ message: 'Order reassigned', orderId: order.orderId, newAgent: agentUser.name }));
    } catch (error) {
        logger.error({ err: error }, 'reassignOrder error');
        res.status(400).json({ message: error.isOperational ? error.message : 'Failed to reassign order' });
    }
};

/**
 * GET /assignment-history/:orderId — Full reassignment audit trail for an order.
 */
exports.getAssignmentHistory = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { orderId } = req.params;
        const history = await assignmentService.getOrderAssignmentHistory(orderId, tenantId);
        res.json(ok(history));
    } catch (error) {
        logger.error({ err: error }, 'getAssignmentHistory error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ASSIGNMENT RULES CRUD (product-agent, store-agent mappings)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /assignment-rules — List all active rules for this tenant.
 */
exports.getAssignmentRules = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const rules = await AssignmentRule.find({ tenant: tenantId })
            .populate('agent', 'name email')
            .sort({ type: 1, createdAt: -1 })
            .lean();

        // Enrich with source names
        const Product = require('../models/Product');
        const SalesChannel = require('../models/SalesChannel');

        const productIds = [];
        const channelIds = [];
        for (const rule of rules) {
            if (rule.type === 'product' && rule.sourceId) productIds.push(rule.sourceId);
            else if (rule.type === 'store' && rule.sourceId) channelIds.push(rule.sourceId);
        }

        const [products, channels] = await Promise.all([
            productIds.length ? Product.find({ _id: { $in: productIds }, tenant: tenantId }).select('name').lean() : [],
            channelIds.length ? SalesChannel.find({ _id: { $in: channelIds }, tenant: tenantId }).select('name').lean() : [],
        ]);

        const nameMap = new Map();
        for (const p of products) nameMap.set(p._id.toString(), p.name);
        for (const s of channels) nameMap.set(s._id.toString(), s.name);

        const enriched = rules.map((rule) => {
            let sourceName = 'Unknown';
            if (rule.type === 'product') {
                sourceName = nameMap.get(rule.sourceId?.toString()) || 'Deleted Product';
            } else if (rule.type === 'store') {
                sourceName = nameMap.get(rule.sourceId?.toString()) || 'Deleted Channel';
            }
            return { ...rule, sourceName };
        });

        res.json(ok(enriched));
    } catch (error) {
        logger.error({ err: error }, 'getAssignmentRules error');
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * POST /assignment-rules — Create a new assignment rule.
 */
exports.createAssignmentRule = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { type, sourceId, agentId } = req.body;

        if (!['product', 'store'].includes(type)) return res.status(400).json({ message: 'type must be product or store' });
        if (!sourceId || !agentId) return res.status(400).json({ message: 'sourceId and agentId required' });
        if (!mongoose.Types.ObjectId.isValid(agentId)) return res.status(400).json({ message: 'Invalid agentId' });

        // Verify agent belongs to tenant
        const agentUser = await User.findOne({ _id: agentId, tenant: tenantId }).lean();
        if (!agentUser) return res.status(400).json({ message: 'Agent not found in this workspace' });

        const rule = await AssignmentRule.findOneAndUpdate(
            { tenant: tenantId, type, sourceId },
            { agent: agentId, isActive: true, createdBy: req.user._id },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(201).json(ok(rule));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'A rule for this source already exists' });
        logger.error({ err: error }, 'createAssignmentRule error');
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * PUT /assignment-rules/:id — Update a rule (change agent or toggle active).
 */
exports.updateAssignmentRule = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid rule ID' });
        const { agentId, isActive } = req.body;

        const updates = {};
        if (agentId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(agentId)) return res.status(400).json({ message: 'Invalid agentId' });
            const agentUser = await User.findOne({ _id: agentId, tenant: tenantId }).lean();
            if (!agentUser) return res.status(400).json({ message: 'Agent not found' });
            updates.agent = agentId;
        }
        if (isActive !== undefined) updates.isActive = isActive;

        const rule = await AssignmentRule.findOneAndUpdate(
            { _id: req.params.id, tenant: tenantId },
            updates,
            { returnDocument: 'after' }
        ).populate('agent', 'name email');

        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        res.json(ok(rule));
    } catch (error) {
        logger.error({ err: error }, 'updateAssignmentRule error');
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * DELETE /assignment-rules/:id — Remove a rule.
 */
exports.deleteAssignmentRule = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid rule ID' });
        const result = await AssignmentRule.findOneAndDelete({ _id: req.params.id, tenant: tenantId });
        if (!result) return res.status(404).json({ message: 'Rule not found' });
        res.json(ok({ message: 'Rule deleted' }));
    } catch (error) {
        logger.error({ err: error }, 'deleteAssignmentRule error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// --- AGENTS LIST (lightweight, no system.users perm needed) ---

/**
 * GET /agents — List all users in this tenant who can be assigned orders.
 * Returns only _id, name, email, role name. Used for agent dropdowns.
 */
exports.getAgentsList = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const users = await User.find({ tenant: tenantId, isActive: true })
            .select('name email role')
            .populate('role', 'name')
            .lean();
        res.json(ok(users));
    } catch (error) {
        logger.error({ err: error }, 'getAgentsList error');
        res.status(500).json({ message: 'Server Error' });
    }
};

