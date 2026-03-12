const Order = require('../models/Order');
const Customer = require('../models/Customer');
const OrderService = require('../domains/orders/order.service');
const { PRE_DISPATCH, POST_DISPATCH, RETURNS } = require('../shared/constants/orderStatuses');
const { syncActiveShipments } = require('../cron/trackerSync');
const cacheService = require('../services/cacheService');
const KPISnapshot = require('../models/KPISnapshot');

let lastEcotrackSyncTime = 0; // In-memory timestamp for rate limiting

exports.triggerEcotrackSync = async (req, res) => {
    try {
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;

        if (now - lastEcotrackSyncTime < oneHourMs) {
            const timeLeft = Math.ceil((oneHourMs - (now - lastEcotrackSyncTime)) / 60000);
            return res.status(429).json({ error: `You can only sync once per hour. Please wait ${timeLeft} minutes.` });
        }

        await syncActiveShipments();
        lastEcotrackSyncTime = Date.now();

        res.json({ message: 'ECOTRACK sync sequence manually fired and completed.', lastSync: lastEcotrackSyncTime });
    } catch (error) {
        console.error('Manual ECOTRACK Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        let skip = (page - 1) * limit;

        const query = { tenant: req.user.tenant, deletedAt: null };

        // Opt-in Cursor Pagination for massive datasets
        if (req.query.lastId) {
            query._id = { $lt: req.query.lastId };
            skip = 0; // Disable offset when using cursor
        }

        // Use estimatedDocumentCount when there's no cursor to save total DB scan time
        const totalOrdersQuery = req.query.lastId ? null : Order.countDocuments({ tenant: req.user.tenant });
        
        const ordersQuery = Order.find(query)
            .populate('customer', 'name email')
            .populate({
                path: 'products.variantId',
                populate: { path: 'productId' }
            })
            .sort({ _id: -1 }) // Use _id sorting for index alignment (equivalent to date sort)
            .skip(skip)
            .limit(limit);

        const [totalOrders, orders] = req.query.lastId 
            ? [null, await ordersQuery]
            : await Promise.all([totalOrdersQuery, ordersQuery]);

        const totalPages = totalOrders ? Math.ceil(totalOrders / limit) : null;

        res.json({
            orders,
            currentPage: req.query.lastId ? null : page,
            totalPages,
            totalOrders,
            nextCursor: orders.length > 0 ? orders[orders.length - 1]._id : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAdvancedOrders = async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        let queryLimit = parseInt(limit);

        const ALLOWED_SORT_FIELDS = new Set(['_id', 'totalAmount', 'createdAt', 'status', 'priority', 'date']);
        let { search, status, courier, agent, wilaya, channel, dateFrom, dateTo, sortField = 'date', sortOrder = 'desc', priority, tags, stage, cursor } = req.query;
        if (!ALLOWED_SORT_FIELDS.has(sortField)) sortField = 'date';

        const query = { tenant: req.user.tenant };

        if (cursor) {
            const op = sortOrder === 'desc' ? '$lt' : '$gt';
            query[sortField === 'date' ? '_id' : sortField] = { [op]: cursor };
        }

        // 0. Stage Splitting Logic
        if (stage === 'trash') {
            // Trash view: only show soft-deleted orders
            query.deletedAt = { $ne: null };
        } else {
            // All normal views: exclude trashed orders
            query.deletedAt = null;
            if (stage === 'pre-dispatch') {
                query.status = { $in: PRE_DISPATCH };
            } else if (stage === 'post-dispatch') {
                query.status = { $in: POST_DISPATCH };
            } else if (stage === 'returns') {
                query.status = { $in: RETURNS };
            }
        }

        // 1. Advanced Filters
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
        if (courier) query.courier = courier === 'unassigned' ? null : courier;
        if (agent) query.assignedAgent = agent === 'unassigned' ? null : agent;
        if (wilaya) query.wilaya = wilaya;
        if (channel) query.channel = channel;

        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        // 2. Search Logic — regex for partial matching (orderId prefix, phone, tracking, customer name)
        if (search) {
            const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            // Find matching customers by name or phone
            const matchingCustomers = await Customer.find({
                tenant: req.user.tenant,
                $or: [
                    { name: searchRegex },
                    { phone: searchRegex }
                ]
            }).select('_id');
            const customerIds = matchingCustomers.map(c => c._id);

            const orConditions = [
                { orderId: searchRegex },
                { 'shipping.phone1': searchRegex },
                { 'trackingInfo.trackingNumber': searchRegex },
            ];
            if (customerIds.length > 0) {
                orConditions.push({ customer: { $in: customerIds } });
            }
            query.$or = orConditions;
        }

        const sortObj = { [sortField === 'date' ? '_id' : sortField]: sortOrder === 'desc' ? -1 : 1 }; // map date to _id for indexed sorting

        // For heavy cursor pagination, we can skip total counts if we rely entirely on infinite scroll.
        // For backwards compatibility, we calculate it if it's the first page (no cursor).
        const totalOrdersQuery = cursor ? null : Order.countDocuments(query);
        
        // Fetch 1 extra to determine if there's a next page
        const ordersQuery = Order.find(query)
            .populate('customer', 'name phone email fraudProbability refusalRate totalOrders deliveredOrders totalRefusals trustScore')
            .populate('courier', 'name')
            .populate('assignedAgent', 'name')
            .populate({
                path: 'products.variantId',
                populate: { path: 'productId' }
            })
            .sort(sortObj)
            .limit(queryLimit + 1);

        const [totalOrders, results] = cursor 
            ? [null, await ordersQuery]
            : await Promise.all([totalOrdersQuery, ordersQuery]);

        let hasNextPage = false;
        let nextCursor = null;

        if (results.length > queryLimit) {
            hasNextPage = true;
            results.pop(); // Remove the extra item
            const lastItem = results[results.length - 1];
            nextCursor = sortField === 'date' ? lastItem._id : lastItem[sortField];
        }

        // Promote due-postponed orders to top (only on first page load, not during infinite scroll)
        // Orders with postponedUntil <= now that are still in Postponed status rise to the top
        if (!cursor && (stage === 'pre-dispatch' || !stage)) {
            const now = new Date();
            const duePostponed = [];
            const others = [];
            for (const o of results) {
                if (o.status === 'Postponed' && o.postponedUntil && new Date(o.postponedUntil) <= now) {
                    duePostponed.push(o);
                } else {
                    others.push(o);
                }
            }
            results.length = 0;
            results.push(...duePostponed, ...others);
        }

        // Compute Tab Counts — run all 5 counts in parallel
        const baseQuery = { tenant: req.user.tenant };
        let stageCounts = null;
        if (!cursor) {
            const [preDispatch, postDispatch, returns, all, trash] = await Promise.all([
                Order.countDocuments({ ...baseQuery, deletedAt: null, status: { $in: PRE_DISPATCH } }),
                Order.countDocuments({ ...baseQuery, deletedAt: null, status: { $in: POST_DISPATCH } }),
                Order.countDocuments({ ...baseQuery, deletedAt: null, status: { $in: RETURNS } }),
                Order.countDocuments({ ...baseQuery, deletedAt: null }),
                Order.countDocuments({ ...baseQuery, deletedAt: { $ne: null } })
            ]);
            stageCounts = { preDispatch, postDispatch, returns, all, trash };
        }

        res.json({
            orders: results,
            nextCursor,
            hasNextPage,
            totalOrders,
            stageCounts: stageCounts || undefined
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBulkOrders = async (req, res) => {
    try {
        const { orderIds, action, payload } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'No orders selected' });
        }

        const tenantId = req.user.tenant;

        if (action === 'change_status') {
            // Must go through order service to enforce state machine + inventory
            const bypass = req.user?.computedPermissions?.includes('orders.override_status');
            const results = { updated: 0, failed: [] };
            for (const orderId of orderIds) {
                try {
                    await OrderService.updateOrder({
                        orderId,
                        tenantId,
                        userId: req.user._id,
                        updateData: { status: payload.status },
                        bypassStateMachine: bypass
                    });
                    results.updated++;
                } catch (err) {
                    results.failed.push({ orderId, reason: err.message });
                }
            }
            return res.json({
                message: `${results.updated} orders updated, ${results.failed.length} failed`,
                ...results
            });
        }

        const updateDoc = {};
        switch (action) {
            case 'assign_agent':
                updateDoc.assignedAgent = payload.agentId === 'unassigned' ? null : payload.agentId;
                break;
            case 'assign_courier':
                updateDoc.courier = payload.courierId === 'unassigned' ? null : payload.courierId;
                break;
            default:
                return res.status(400).json({ message: 'Invalid bulk action' });
        }

        const result = await Order.updateMany(
            { _id: { $in: orderIds }, tenant: tenantId },
            { $set: updateDoc }
        );

        res.json({ message: `${result.modifiedCount} orders updated successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOrdersKPIs = async (req, res) => {
    try {
        const tenantId = req.user.tenant;

        // O(1) Fast Read from Materialized View Dashboard Analytics Cache Instead of O(N) Table Scan
        const snapshot = await KPISnapshot.findOne({ tenant: tenantId, type: 'operations' }).lean();

        if (snapshot && snapshot.metrics) {
            return res.json(snapshot.metrics);
        }

        // Fallback default if background worker hasn't run yet
        res.json({
            newOrdersToday: 0,
            pendingConfirmation: 0,
            confirmedOrders: 0,
            readyForDispatch: 0,
            sentToCourier: 0,
            shippedToday: 0,
            deliveredToday: 0,
            returnRate: 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSalesPerformance = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const cacheKey = `tenant:${tenantId}:kpi:salesPerformance`;

        const cachedPerformance = await cacheService.getOrSet(cacheKey, async () => {
            const pipelineResult = await Order.aggregate([
                { $match: { tenant: tenantId, deletedAt: null } },
                {
                    $facet: {
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    totalOrders: { $sum: 1 },
                                    totalSalesVolume: { $sum: "$totalAmount" }
                                }
                            }
                        ],
                        channels: [
                            {
                                $group: {
                                    _id: "$channel",
                                    count: { $sum: 1 },
                                    revenue: { $sum: "$totalAmount" }
                                }
                            }
                        ]
                    }
                }
            ]);

            const totals = pipelineResult[0]?.totals[0] || { totalOrders: 0, totalSalesVolume: 0 };
            const { totalOrders, totalSalesVolume } = totals;
            const averageOrderValue = totalOrders > 0 ? totalSalesVolume / totalOrders : 0;

            const channelDistribution = {};
            pipelineResult[0]?.channels.forEach(ch => {
                const channelName = ch._id || 'Unknown';
                channelDistribution[channelName] = {
                    count: ch.count,
                    revenue: ch.revenue
                };
            });

            return {
                totalOrders,
                totalSalesVolume,
                averageOrderValue,
                channelDistribution
            };
        }, 3600); // 1-hour TTL for complex historical sales reports

        res.json(cachedPerformance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const order = await OrderService.createOrder({
            tenantId: req.user.tenant,
            userId: req.user._id,
            body: req.body
        });
        res.status(201).json(order);
    } catch (error) {
        const status = error.isOperational ? (error.statusCode || 400) : 500;
        if (!error.isOperational) console.error('Error creating order:', error);
        res.status(status).json({ message: error.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        // Verify order belongs to this tenant before delegating to service
        const owned = await Order.exists({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null });
        if (!owned) return res.status(404).json({ message: 'Order not found' });

        const bypass = req.user?.role?.name === 'Super Admin' ||
                       req.user?.computedPermissions?.includes('orders.override_status');
        const updatedOrder = await OrderService.updateOrder({
            orderId: req.params.id,
            tenantId: req.user.tenant,
            userId: req.user._id,
            updateData: req.body,
            bypassStateMachine: bypass
        });
        res.json(updatedOrder);
    } catch (error) {
        const status = error.isOperational ? (error.statusCode || 400) : 500;
        if (!error.isOperational) console.error('Error updating order:', error);
        res.status(status).json({ message: error.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete — same as bulkDeleteOrders. Permanent removal goes through purgeOrders.
        const order = await Order.findOneAndUpdate(
            { _id: id, tenant: req.user.tenant, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order moved to trash', orderId: order.orderId });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.bulkDeleteOrders = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'orderIds array is required' });
        }

        // Soft delete: set deletedAt timestamp (keeps data, moves to trash)
        const result = await Order.updateMany(
            { _id: { $in: orderIds }, tenant: req.user.tenant, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user._id } }
        );

        res.json({ message: `${result.modifiedCount} order(s) moved to trash`, trashedCount: result.modifiedCount });
    } catch (error) {
        console.error("Error moving orders to trash:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.restoreOrders = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'orderIds array is required' });
        }

        const result = await Order.updateMany(
            { _id: { $in: orderIds }, tenant: req.user.tenant, deletedAt: { $ne: null } },
            { $set: { deletedAt: null, deletedBy: null } }
        );

        res.json({ message: `${result.modifiedCount} order(s) restored`, restoredCount: result.modifiedCount });
    } catch (error) {
        console.error("Error restoring orders:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.purgeOrders = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'orderIds array is required' });
        }

        // Only allow permanently deleting already-trashed orders
        const result = await Order.deleteMany({ _id: { $in: orderIds }, tenant: req.user.tenant, deletedAt: { $ne: null } });
        res.json({ message: `${result.deletedCount} order(s) permanently deleted`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error("Error purging orders:", error);
        res.status(500).json({ message: error.message });
    }
};

