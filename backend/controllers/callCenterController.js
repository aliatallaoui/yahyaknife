const Order = require('../models/Order');
const CallNote = require('../models/CallNote');
const AgentProfile = require('../models/AgentProfile');
const User = require('../models/User');
const cacheService = require('../services/cacheService');

// --- AGENT DASHBOARD ---

// @desc    Get dashboard metrics for the logged-in agent
// @route   GET /api/call-center/agent-dashboard
// @access  Private (Call Center Agent)
exports.getAgentDashboard = async (req, res) => {
    try {
        const agentId = req.user._id;
        const tenantId = req.user.tenant;
        const cacheKey = `tenant:${tenantId}:agent:${agentId}:dashboard`;

        const dashboardData = await cacheService.getOrSet(cacheKey, async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Fetch metrics directly from database using counts
            const [
                totalAssigned,
                awaitingConfirmation,
                deliveredTotal,
                confirmedToday,
                actionRequiredOrders,
                callsMadeToday,
                profile
            ] = await Promise.all([
                Order.countDocuments({ tenant: tenantId, assignedAgent: agentId }),
                Order.countDocuments({ tenant: tenantId, assignedAgent: agentId, status: 'New' }),
                Order.countDocuments({ tenant: tenantId, assignedAgent: agentId, status: { $in: ['Delivered', 'Paid'] } }),
                Order.countDocuments({ tenant: tenantId, assignedAgent: agentId, status: 'Confirmed', updatedAt: { $gte: todayStart } }),
                Order.find({ tenant: tenantId, assignedAgent: agentId, status: 'New' }).sort({ _id: -1 }).limit(50), // Limit to top 50 needed
                CallNote.countDocuments({ agent: agentId, createdAt: { $gte: todayStart } }),
                AgentProfile.findOne({ user: agentId })
            ]);

            // Calculate Commission Earned Today
            const commissionRate = profile ? profile.commissionPerDelivery : 0;
            const commissionEarnedToday = confirmedToday * commissionRate; // Rough estimation

            return {
                metrics: {
                    totalAssigned,
                    awaitingConfirmation,
                    confirmedToday,
                    deliveredTotal,
                    callsMadeToday,
                    commissionEarnedToday
                },
                orders: actionRequiredOrders
            };
        }, 60); // 60-second TTL for agents, needs to be reasonably fresh but immune to refresh spam

        res.json(dashboardData);
    } catch (error) {
        console.error("Agent Dashboard Error", error);
        res.status(500).json({ message: 'Server Error loading agent dashboard' });
    }
};

// --- LOGGING & ORDER ACTION ---

// @desc    Log a call and potentially update order status
// @route   POST /api/call-center/log-call
// @access  Private (Call Center Agent)
exports.logCallAction = async (req, res) => {
    try {
        const { orderId, actionType, note, newAddress, newWilaya, newCommune } = req.body;
        const agentId = req.user._id;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Ensure the agent owns the order or is a Manager
        if (order.assignedAgent && order.assignedAgent.toString() !== agentId.toString()) {
            return res.status(403).json({ message: 'Order is assigned to another agent' });
        }

        // 1. Create Call Note
        await CallNote.create({
            order: orderId,
            agent: agentId,
            actionType,
            note: note || '',
            callDurationSeconds: 0 // Could be passed from frontend SIP integration
        });

        // 2. State Transitions based on the Action
        if (actionType === 'Confirmed') {
            order.status = 'Confirmed';
        } else if (actionType === 'Cancelled') {
            order.status = 'Refused';
            order.financials.paymentStatus = 'Failed';
        } else if (actionType === 'Address_Updated') {
            if (newAddress) order.shippingAddress = newAddress;
            if (newWilaya) order.wilaya = newWilaya;
            if (newCommune) order.commune = newCommune;
        }

        await order.save();

        res.status(200).json({ message: 'Call logged successfully', order });
    } catch (error) {
        console.error("Log Call Error", error);
        res.status(500).json({ message: 'Server Error logging call' });
    }
};

// --- MANAGER ACTIONS ---

// @desc    Assign unassigned orders to agents using different strategies
// @route   POST /api/call-center/assign-orders
// @access  Private (Admin / Manager)
exports.assignOrders = async (req, res) => {
    try {
        const { mode, targetAgentId, orderIds, region } = req.body;

        if (mode === 'Manual') {
            // Assign specific orders to a specific agent
            await Order.updateMany(
                { _id: { $in: orderIds } },
                { $set: { assignedAgent: targetAgentId } }
            );
            return res.json({ message: `${orderIds.length} orders assigned manually.` });
        }

        if (mode === 'Region') {
            // Assign all unassigned orders in a Wilaya to a specific Agent
            const result = await Order.updateMany(
                { wilaya: region, status: 'New', assignedAgent: { $exists: false } },
                { $set: { assignedAgent: targetAgentId } }
            );
            return res.json({ message: `${result.modifiedCount} regional orders assigned.` });
        }

        if (mode === 'Auto_RoundRobin') {
            // Find all active agents
            const activeProfiles = await AgentProfile.find({ isActive: true }).populate('user');
            if (activeProfiles.length === 0) return res.status(400).json({ message: 'No active agents available.' });

            const unassignedOrders = await Order.find({ status: 'New', assignedAgent: null });

            let agentIndex = 0;
            let assignedCount = 0;

            for (const order of unassignedOrders) {
                // Round robin distribution
                const agent = activeProfiles[agentIndex].user._id;
                order.assignedAgent = agent;
                await order.save();

                assignedCount++;
                agentIndex = (agentIndex + 1) % activeProfiles.length;
            }

            return res.json({ message: `Auto-distributed ${assignedCount} orders across ${activeProfiles.length} agents.` });
        }

        res.status(400).json({ message: 'Invalid assignment mode' });
    } catch (error) {
        console.error("Assignment Error", error);
        res.status(500).json({ message: 'Server Error assigning orders' });
    }
};

// @desc    Get Manager Analytics (Leaderboard & Global Stats)
// @route   GET /api/call-center/manager-analytics
// @access  Private (Admin / Manager)
exports.getManagerAnalytics = async (req, res) => {
    try {
        const agents = await AgentProfile.find({ isActive: true }).populate('user', 'firstName lastName email');

        const leaderboard = await Promise.all(agents.map(async (profile) => {
            const agentId = profile.user._id;

            const totalAssigned = await Order.countDocuments({ assignedAgent: agentId });
            const totalConfirmed = await Order.countDocuments({ assignedAgent: agentId, status: { $nin: ['New', 'Refused'] } });
            const totalDelivered = await Order.countDocuments({ assignedAgent: agentId, status: { $in: ['Delivered', 'Paid'] } });

            const confirmedRate = totalAssigned > 0 ? ((totalConfirmed / totalAssigned) * 100).toFixed(1) : 0;

            let commissionEarned = 0;
            if (profile.compensationModel === 'Commission' || profile.compensationModel === 'Hybrid') {
                commissionEarned = totalDelivered * profile.commissionPerDelivery;
            }

            const totalCalls = await CallNote.countDocuments({ agent: agentId });

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
        console.error("Manager Analytics Error", error);
        res.status(500).json({ message: 'Server Error generating analytics' });
    }
};
