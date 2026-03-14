const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const OrderService = require('../domains/orders/order.service');
const { PRE_DISPATCH, POST_DISPATCH, RETURNS } = require('../shared/constants/orderStatuses');
const { syncActiveShipments } = require('../cron/trackerSync');
const cacheService = require('../services/cacheService');
const KPISnapshot = require('../models/KPISnapshot');

let lastCourierSyncTime = 0; // In-memory timestamp for rate limiting

exports.triggerEcotrackSync = async (req, res) => {
    try {
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;

        if (now - lastCourierSyncTime < oneHourMs) {
            const timeLeft = Math.ceil((oneHourMs - (now - lastCourierSyncTime)) / 60000);
            return res.status(429).json({ message: `You can only sync once per hour. Please wait ${timeLeft} minutes.` });
        }

        await syncActiveShipments();
        lastCourierSyncTime = Date.now();

        res.json({ message: 'Courier sync completed (all providers).', lastSync: lastCourierSyncTime });
    } catch (error) {
        logger.error({ err: error }, 'Manual Courier Sync Error');
        res.status(500).json({ message: 'Failed to sync couriers. Please try again.' });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 10), 100);
        let skip = (page - 1) * limit;

        const query = { tenant: req.user.tenant, deletedAt: null };

        // Opt-in Cursor Pagination for massive datasets
        if (req.query.lastId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.lastId))
                return res.status(400).json({ message: 'Invalid cursor.' });
            query._id = { $lt: new mongoose.Types.ObjectId(req.query.lastId) };
            skip = 0; // Disable offset when using cursor
        }

        // Use estimatedDocumentCount when there's no cursor to save total DB scan time
        const totalOrdersQuery = req.query.lastId ? null : Order.countDocuments({ tenant: req.user.tenant, deletedAt: null });
        
        const ordersQuery = Order.find(query)
            .populate('customer', 'name email')
            .populate({
                path: 'products.variantId',
                populate: { path: 'productId' }
            })
            .sort({ _id: -1 }) // Use _id sorting for index alignment (equivalent to date sort)
            .skip(skip)
            .limit(limit)
            .lean();

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
        logger.error({ err: error }, 'Error fetching orders');
        res.status(500).json({ message: 'Failed to load orders. Please try again.' });
    }
};

exports.getAdvancedOrders = async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        let queryLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);

        const ALLOWED_SORT_FIELDS = new Set(['_id', 'totalAmount', 'createdAt', 'status', 'priority', 'date', 'updatedAt']);
        let { search, status, courier, agent, wilaya, channel, salesChannelId, dateFrom, dateTo, sortField = 'date', sortOrder = 'desc', priority, tags, stage, cursor } = req.query;
        
        // Force sort by updatedAt descending for post-dispatch if default date is requested
        if (stage === 'post-dispatch' && (sortField === 'date' || !req.query.sortField)) {
            sortField = 'updatedAt';
            sortOrder = 'desc';
        }

        if (!ALLOWED_SORT_FIELDS.has(sortField)) sortField = 'date';

        const query = { tenant: req.user.tenant };

        if (cursor) {
            const op = sortOrder === 'desc' ? '$lt' : '$gt';
            const cursorField = sortField === 'date' ? '_id' : sortField;
            
            if (sortField === 'updatedAt' && cursor.includes('_')) {
                const [dateStr, idStr] = cursor.split('_');
                if (!mongoose.Types.ObjectId.isValid(idStr))
                    return res.status(400).json({ message: 'Invalid cursor.' });
                const cursorDate = new Date(dateStr);
                if (isNaN(cursorDate.getTime()))
                    return res.status(400).json({ message: 'Invalid cursor date.' });
                query.$or = [
                    { updatedAt: { [op]: cursorDate } },
                    { updatedAt: cursorDate, _id: { [op]: new mongoose.Types.ObjectId(idStr) } }
                ];
            } else if (cursorField === '_id') {
                if (!mongoose.Types.ObjectId.isValid(cursor))
                    return res.status(400).json({ message: 'Invalid cursor.' });
                query._id = { [op]: new mongoose.Types.ObjectId(cursor) };
            } else {
                // Numeric/string sort fields — use as-is (already whitelisted above)
                query[cursorField] = { [op]: cursor };
            }
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

        // 1. Advanced Filters — coerce to strings to prevent NoSQL operator injection
        if (status && typeof status === 'string') query.status = status;
        if (priority && typeof priority === 'string') query.priority = priority;
        if (tags) query.tags = { $in: (Array.isArray(tags) ? tags : [tags]).filter(t => typeof t === 'string').slice(0, 20) };
        if (courier && typeof courier === 'string') query.courier = courier === 'unassigned' ? null : courier;
        if (agent && typeof agent === 'string') query.assignedAgent = agent === 'unassigned' ? null : agent;
        if (wilaya && typeof wilaya === 'string') query.wilaya = wilaya;
        if (channel && typeof channel === 'string') query.channel = channel;
        if (salesChannelId && typeof salesChannelId === 'string' && mongoose.Types.ObjectId.isValid(salesChannelId)) {
            query['salesChannelSource.salesChannel'] = new mongoose.Types.ObjectId(salesChannelId);
        }

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
                deletedAt: null,
                $or: [
                    { name: searchRegex },
                    { phone: searchRegex }
                ]
            }).select('_id').lean();
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

        const sortDir = sortOrder === 'desc' ? -1 : 1;
        const sortObj = sortField === 'updatedAt' 
            ? { updatedAt: sortDir, _id: sortDir } 
            : { [sortField === 'date' ? '_id' : sortField]: sortDir };

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
            .limit(queryLimit + 1)
            .lean();

        const [totalOrders, results] = cursor
            ? [null, await ordersQuery]
            : await Promise.all([totalOrdersQuery, ordersQuery]);

        let hasNextPage = false;
        let nextCursor = null;

        if (results.length > queryLimit) {
            hasNextPage = true;
            results.pop(); // Remove the extra item
            const lastItem = results[results.length - 1];
            if (sortField === 'updatedAt') {
                nextCursor = `${lastItem.updatedAt.toISOString()}_${lastItem._id.toString()}`;
            } else {
                nextCursor = sortField === 'date' ? lastItem._id : lastItem[sortField];
            }
        }

        // Promote due-postponed orders to top
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
        logger.error({ err: error }, 'Error fetching advanced orders');
        res.status(500).json({ message: 'Failed to load orders. Please try again.' });
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

        // Validate all orderIds
        if (!orderIds.every(id => mongoose.Types.ObjectId.isValid(id)))
            return res.status(400).json({ message: 'One or more invalid order IDs' });

        const updateDoc = {};
        switch (action) {
            case 'assign_agent':
                if (payload.agentId && payload.agentId !== 'unassigned' && !mongoose.Types.ObjectId.isValid(payload.agentId))
                    return res.status(400).json({ message: 'Invalid agent ID' });
                updateDoc.assignedAgent = payload.agentId === 'unassigned' ? null : payload.agentId;
                break;
            case 'assign_courier':
                if (payload.courierId && payload.courierId !== 'unassigned' && !mongoose.Types.ObjectId.isValid(payload.courierId))
                    return res.status(400).json({ message: 'Invalid courier ID' });
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
        logger.error({ err: error }, 'Error in bulk order update');
        res.status(500).json({ message: 'Failed to update orders. Please try again.' });
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
        logger.error({ err: error }, 'Error fetching KPIs');
        res.status(500).json({ message: 'Failed to load KPIs. Please try again.' });
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
        logger.error({ err: error }, 'Error fetching sales performance');
        res.status(500).json({ message: 'Failed to load sales performance. Please try again.' });
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
        if (!error.isOperational) logger.error({ err: error }, 'Error creating order');
        res.status(status).json({ message: status >= 500 ? 'An unexpected error occurred. Please try again.' : error.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid order ID' });

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
        if (!error.isOperational) logger.error({ err: error }, 'Error updating order');
        res.status(status).json({ message: status >= 500 ? 'An unexpected error occurred. Please try again.' : error.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid order ID' });
        // Soft delete — same as bulkDeleteOrders. Permanent removal goes through purgeOrders.
        const order = await Order.findOneAndUpdate(
            { _id: id, tenant: req.user.tenant, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
            { returnDocument: 'after' }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order moved to trash', orderId: order.orderId });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting order');
        res.status(500).json({ message: 'Failed to delete order' });
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
        logger.error({ err: error }, 'Error moving orders to trash');
        res.status(500).json({ message: 'Failed to move orders to trash' });
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
        logger.error({ err: error }, 'Error restoring orders');
        res.status(500).json({ message: 'Failed to restore orders' });
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
        logger.error({ err: error }, 'Error purging orders');
        res.status(500).json({ message: 'Failed to purge orders' });
    }
};

