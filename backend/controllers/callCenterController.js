const Order = require('../models/Order');
const CallNote = require('../models/CallNote');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const AgentProfile = require('../models/AgentProfile');
const User = require('../models/User');
const ProductVariant = require('../models/ProductVariant');
const cacheService = require('../services/cacheService');
const { assertTransition } = require('../domains/orders/order.statemachine');
const { updateCustomerMetrics } = require('./customerController');

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
        const cacheKey = `tenant:${tenantId}:agent:${agentId}:dashboard`;

        const dashboardData = await cacheService.getOrSet(cacheKey, async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const baseFilter = { tenant: tenantId, assignedAgent: agentId, deletedAt: null };

            const [
                totalAssigned,
                awaitingConfirmation,
                deliveredTotal,
                confirmedToday,
                actionRequiredOrders,
                callsMadeToday,
                profile
            ] = await Promise.all([
                Order.countDocuments(baseFilter),
                Order.countDocuments({ ...baseFilter, status: 'New' }),
                Order.countDocuments({ ...baseFilter, status: { $in: ['Delivered', 'Paid'] } }),
                Order.countDocuments({ ...baseFilter, status: 'Confirmed', updatedAt: { $gte: todayStart } }),
                Order.find({ ...baseFilter, status: 'New' }).sort({ _id: -1 }).limit(50),
                CallNote.countDocuments({ agent: agentId, createdAt: { $gte: todayStart } }),
                AgentProfile.findOne({ user: agentId })
            ]);

            const commissionRate = profile ? profile.commissionPerDelivery : 0;
            const commissionEarnedToday = confirmedToday * commissionRate;

            return {
                metrics: { totalAssigned, awaitingConfirmation, confirmedToday, deliveredTotal, callsMadeToday, commissionEarnedToday },
                orders: actionRequiredOrders
            };
        }, 60);

        res.json(dashboardData);
    } catch (error) {
        console.error('Agent Dashboard Error', error);
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
        const order = await Order.findOne({ _id: orderId, tenant: tenantId });
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

        // Audit trail: record status change in OrderStatusHistory
        if (newStatus && newStatus !== statusBefore) {
            OrderStatusHistory.create({
                tenant: tenantId,
                orderId: order._id,
                status: newStatus,
                previousStatus: statusBefore,
                changedBy: agentId,
                note: `Call center action: ${actionType}${note ? ` — ${note}` : ''}`
            }).catch(console.error);
        }

        // Post-save side effects for status changes
        if (newStatus && newStatus !== statusBefore) {
            // Restore reserved stock when order is cancelled via call center
            if (['Cancelled', 'Cancelled by Customer'].includes(newStatus) &&
                !['Cancelled', 'Cancelled by Customer', 'Returned', 'Refused'].includes(statusBefore)) {
                for (const item of order.products) {
                    if (!item.variantId) continue;
                    ProductVariant.findByIdAndUpdate(item.variantId, {
                        $inc: { reservedStock: -item.quantity, totalSold: -item.quantity }
                    }).catch(console.error);
                }
            }
            // Update customer metrics on any status change
            if (order.customer) updateCustomerMetrics(order.customer).catch(console.error);
        }

        res.status(200).json({ message: 'Call logged successfully', order });
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        console.error('Log Call Error', error);
        res.status(500).json({ message: 'Server Error logging call' });
    }
};

// --- MANAGER ACTIONS ---

exports.assignOrders = async (req, res) => {
    try {
        const { mode, targetAgentId, orderIds, region } = req.body;
        const tenantId = req.user.tenant;

        // Validate targetAgentId belongs to this tenant (for Manual and Region modes)
        if ((mode === 'Manual' || mode === 'Region') && targetAgentId) {
            const agentUser = await User.findOne({ _id: targetAgentId, tenant: tenantId });
            if (!agentUser) return res.status(400).json({ message: 'Target agent not found in this workspace' });
        }

        if (mode === 'Manual') {
            await Order.updateMany(
                { _id: { $in: orderIds }, tenant: tenantId },
                { $set: { assignedAgent: targetAgentId } }
            );
            return res.json({ message: `${orderIds.length} orders assigned manually.` });
        }

        if (mode === 'Region') {
            const result = await Order.updateMany(
                { tenant: tenantId, wilaya: region, status: 'New', assignedAgent: null },
                { $set: { assignedAgent: targetAgentId } }
            );
            return res.json({ message: `${result.modifiedCount} regional orders assigned.` });
        }

        if (mode === 'Auto_RoundRobin') {
            const activeProfiles = await AgentProfile.find({ isActive: true }).populate('user');
            if (activeProfiles.length === 0) return res.status(400).json({ message: 'No active agents available.' });

            const unassignedOrders = await Order.find(
                { tenant: tenantId, status: 'New', assignedAgent: null },
                { _id: 1 }
            );

            if (unassignedOrders.length === 0) {
                return res.json({ message: 'No unassigned orders to distribute.' });
            }

            // Partition order IDs across agents in round-robin slices
            const buckets = activeProfiles.map(() => []);
            unassignedOrders.forEach((o, i) => buckets[i % activeProfiles.length].push(o._id));

            // One updateMany per agent (not one save per order)
            await Promise.all(
                activeProfiles.map((profile, i) =>
                    buckets[i].length > 0
                        ? Order.updateMany(
                            { _id: { $in: buckets[i] }, tenant: tenantId },
                            { $set: { assignedAgent: profile.user._id } }
                          )
                        : Promise.resolve()
                )
            );

            return res.json({ message: `Auto-distributed ${unassignedOrders.length} orders across ${activeProfiles.length} agents.` });
        }

        res.status(400).json({ message: 'Invalid assignment mode' });
    } catch (error) {
        console.error('Assignment Error', error);
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
            .populate('agent', 'firstName lastName email')
            .sort({ createdAt: 1 });

        res.json({ orderId, totalAttempts: calls.length, calls });
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching call history' });
    }
};

exports.getManagerAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agents = await AgentProfile.find({ isActive: true }).populate('user', 'firstName lastName email');

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
                        totalConfirmed: { $sum: { $cond: [{ $nin: ['$status', ['New', 'Refused']] }, 1, 0] } },
                        totalDelivered: { $sum: { $cond: [{ $in:  ['$status', ['Delivered', 'Paid']] }, 1, 0] } }
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
            const stats = orderMap[key] || { totalAssigned: 0, totalConfirmed: 0, totalDelivered: 0 };
            const totalCalls = callMap[key] || 0;

            const confirmedRate = stats.totalAssigned > 0
                ? ((stats.totalConfirmed / stats.totalAssigned) * 100).toFixed(1)
                : 0;

            let commissionEarned = 0;
            if (profile.compensationModel === 'Commission' || profile.compensationModel === 'Hybrid') {
                commissionEarned = stats.totalDelivered * profile.commissionPerDelivery;
            }

            return {
                agentId,
                name: `${profile.user.firstName} ${profile.user.lastName}`,
                totalAssigned:  stats.totalAssigned,
                totalConfirmed: stats.totalConfirmed,
                confirmedRate:  parseFloat(confirmedRate),
                totalDelivered: stats.totalDelivered,
                totalCalls,
                commissionEarned,
                baseSalary: profile.baseSalary
            };
        });

        res.json({ leaderboard });
    } catch (error) {
        console.error('Manager Analytics Error', error);
        res.status(500).json({ message: 'Server Error generating analytics' });
    }
};
