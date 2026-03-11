const Order = require('../models/Order');
const CallNote = require('../models/CallNote');
const AgentProfile = require('../models/AgentProfile');
const cacheService = require('../services/cacheService');
const { assertTransition } = require('../domains/orders/order.statemachine');

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

            const baseFilter = { tenant: tenantId, assignedAgent: agentId };

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

        await CallNote.create({ order: orderId, agent: agentId, actionType, note: note || '', callDurationSeconds: 0 });

        // Apply state transition if the action maps to a status change
        const newStatus = ACTION_STATUS_MAP[actionType];
        if (newStatus && newStatus !== order.status) {
            assertTransition(order.status, newStatus);
            order.status = newStatus;
            if (newStatus === 'Postponed' && postponedUntil) {
                order.postponedUntil = new Date(postponedUntil);
            } else if (newStatus !== 'Postponed') {
                order.postponedUntil = null;
            }
        }

        // Address correction (no status change involved)
        if (actionType === 'Address_Updated') {
            if (newAddress) order.shippingAddress = newAddress;
            if (newWilaya) order.wilaya = newWilaya;
            if (newCommune) order.commune = newCommune;
        }

        await order.save();

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

exports.getManagerAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const agents = await AgentProfile.find({ isActive: true }).populate('user', 'firstName lastName email');

        const leaderboard = await Promise.all(agents.map(async (profile) => {
            const agentId = profile.user._id;
            const baseFilter = { tenant: tenantId, assignedAgent: agentId };

            // Run all counts in parallel per agent
            const [totalAssigned, totalConfirmed, totalDelivered, totalCalls] = await Promise.all([
                Order.countDocuments(baseFilter),
                Order.countDocuments({ ...baseFilter, status: { $nin: ['New', 'Refused'] } }),
                Order.countDocuments({ ...baseFilter, status: { $in: ['Delivered', 'Paid'] } }),
                CallNote.countDocuments({ agent: agentId })
            ]);

            const confirmedRate = totalAssigned > 0 ? ((totalConfirmed / totalAssigned) * 100).toFixed(1) : 0;

            let commissionEarned = 0;
            if (profile.compensationModel === 'Commission' || profile.compensationModel === 'Hybrid') {
                commissionEarned = totalDelivered * profile.commissionPerDelivery;
            }

            return {
                agentId,
                name: `${profile.user.firstName} ${profile.user.lastName}`,
                totalAssigned,
                totalConfirmed,
                confirmedRate: parseFloat(confirmedRate),
                totalDelivered,
                totalCalls,
                commissionEarned,
                baseSalary: profile.baseSalary
            };
        }));

        res.json({ leaderboard });
    } catch (error) {
        console.error('Manager Analytics Error', error);
        res.status(500).json({ message: 'Server Error generating analytics' });
    }
};
