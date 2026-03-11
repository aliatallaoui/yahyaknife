const Order = require('../models/Order');
const Customer = require('../models/Customer');
const ProductVariant = require('../models/ProductVariant');
const OrderItem = require('../models/OrderItem');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const OrderNote = require('../models/OrderNote');
const { logStockMovement } = require('./stockController');
const { updateCustomerMetrics } = require('./customerController');
const { syncCourierCash, recalculateCourierKPIs } = require('./courierController');
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

        const query = { tenant: req.user.tenant };

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

        const { search, status, courier, agent, wilaya, channel, dateFrom, dateTo, sortField = 'date', sortOrder = 'desc', priority, tags, stage, cursor } = req.query;

        const query = { tenant: req.user.tenant };

        if (cursor) {
            const op = sortOrder === 'desc' ? '$lt' : '$gt';
            query[sortField === 'date' ? '_id' : sortField] = { [op]: cursor };
        }

        // 0. Stage Splitting Logic (Pre-Dispatch vs Post-Dispatch)
        if (stage) {
            if (stage === 'pre-dispatch') {
                query.status = { $in: ['New', 'Calling', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Cancelled'] };
            } else if (stage === 'post-dispatch') {
                query.status = { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'] };
            } else if (stage === 'returns') {
                query.status = { $in: ['Returned', 'Refused'] };
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
            query.date = {};
            if (dateFrom) query.date.$gte = new Date(dateFrom);
            if (dateTo) query.date.$lte = new Date(dateTo);
        }

        // 2. Search Logic (Utilizing blazing fast $text indexes instead of regex table scans)
        if (search) {
            // Find customers matching search within this tenant using text index
            const matchingCustomers = await Customer.find({
                tenant: req.user.tenant,
                $text: { $search: search }
            }).select('_id');
            const customerIds = matchingCustomers.map(c => c._id);

            if (customerIds.length > 0) {
                // If customers match the query, we return their orders OR orders that text match the tracking numbers
                query.$or = [
                    { $text: { $search: search } },
                    { customer: { $in: customerIds } }
                ];
            } else {
                // If no customers match, rely purely on the Order text index (Tracking #, Order ID)
                query.$text = { $search: search };
            }
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

        // Compute Tab Counts
        const stageCounts = cursor ? null : {
            preDispatch: await Order.countDocuments({ ...query, status: { $in: ['New', 'Calling', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Cancelled'] } }),
            postDispatch: await Order.countDocuments({ ...query, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'] } }),
            returns: await Order.countDocuments({ ...query, status: { $in: ['Returned', 'Refused'] } }),
            all: totalOrders // When stage filter is disabled
        };

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

        const updateDoc = {};

        switch (action) {
            case 'assign_agent':
                updateDoc.assignedAgent = payload.agentId === 'unassigned' ? null : payload.agentId;
                break;
            case 'change_status':
                updateDoc.status = payload.status;
                break;
            case 'assign_courier':
                updateDoc.courier = payload.courierId === 'unassigned' ? null : payload.courierId;
                break;
            default:
                return res.status(400).json({ message: 'Invalid bulk action' });
        }

        const result = await Order.updateMany(
            { _id: { $in: orderIds } },
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
        console.log("DEBUG getSalesPerformance: req.user is", req.user);
        const tenantId = req.user ? req.user.tenant : 'missing';
        const cacheKey = `tenant:${tenantId}:kpi:salesPerformance`;

        const cachedPerformance = await cacheService.getOrSet(cacheKey, async () => {
            const pipelineResult = await Order.aggregate([
                { $match: { tenant: tenantId } },
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
        const { orderId, customerId, customerName, customerPhone, channel, products, status, paymentStatus, fulfillmentStatus, fulfillmentPipeline, notes, shipping, financials, courier, priority, tags, verificationStatus } = req.body;

        if (!orderId || !channel || !products || products.length === 0) {
            return res.status(400).json({ message: 'Missing required order fields or products array is empty' });
        }

        // Auto-resolve customer: by ID, or find/create by phone
        let resolvedCustomerId = customerId;
        if (!resolvedCustomerId && customerPhone) {
            let customer = await Customer.findOne({ phone: customerPhone });
            if (!customer) {
                customer = await Customer.create({
                    name: customerName || 'Unknown',
                    phone: customerPhone,
                    tenant: req.user.tenant,
                    acquisitionChannel: 'Direct Traffic'
                });
            } else if (customerName && customerName !== customer.name) {
                // Update name if changed
                customer.name = customerName;
                await customer.save();
            }
            resolvedCustomerId = customer._id;
        }

        if (!resolvedCustomerId) {
            return res.status(400).json({ message: 'Customer phone number is required' });
        }

        // Calculate Subtotal and format products array
        let subtotalAmt = 0;
        const processedProducts = products.map(item => {
            if (!item.quantity || item.unitPrice === undefined) {
                throw new Error('Each product must have a quantity and unitPrice');
            }
            subtotalAmt += (item.quantity * item.unitPrice);
            return item;
        });

        // Use incoming financials or calculate fallback
        const codAmountIncoming = financials?.codAmount || 0;
        const courierFeeIncoming = financials?.courierFee || 0;
        const discountIncoming = financials?.discount || 0;
        const finalTotalAmt = subtotalAmt + courierFeeIncoming - discountIncoming;

        const mainStatus = status || 'New';

        // 1. Create the Order document
        const newOrder = new Order({
            tenant: req.user.tenant,
            orderId,
            customer: resolvedCustomerId,
            channel,
            products: processedProducts,
            subtotal: subtotalAmt,
            discount: discountIncoming,
            totalAmount: finalTotalAmt, // Legacy field sync
            finalTotal: finalTotalAmt,
            amountToCollect: codAmountIncoming || finalTotalAmt,
            financials: {
                ...financials,
                codAmount: codAmountIncoming || finalTotalAmt,
                courierFee: courierFeeIncoming
            },
            status: mainStatus,
            paymentStatus: paymentStatus || 'Unpaid',
            fulfillmentStatus: fulfillmentStatus || 'Unfulfilled',
            fulfillmentPipeline: fulfillmentPipeline || 'Pending',
            verificationStatus: verificationStatus || 'Pending',
            priority: priority || 'Normal',
            tags: tags || [],
            courier: courier || null,
            shipping: shipping || {},
            wilaya: shipping?.wilayaCode ? `${shipping.wilayaCode} - ${shipping.wilayaName}` : 'Unknown',
            commune: shipping?.commune || 'Unknown',
            notes: notes || ''
        });

        const savedOrder = await newOrder.save();

        // 2. Create OrderItems strictly mapped
        const orderItemDocs = processedProducts.map(p => ({
            orderId: savedOrder._id,
            productId: p.productId || null,
            variantId: p.variantId || null,
            sku: p.sku || '',
            name: p.name || 'Unknown',
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            lineTotal: p.quantity * p.unitPrice
        }));
        if (orderItemDocs.length > 0) {
            await OrderItem.insertMany(orderItemDocs);
        }

        // 3. Create Status History snapshot
        await OrderStatusHistory.create({
            tenant: req.user.tenant,
            orderId: savedOrder._id,
            status: mainStatus,
            changedBy: req.user?._id || null,
            note: 'Order originally created via COD Flow'
        });

        // 4. Create structured notes if provided
        if (notes) {
            await OrderNote.create({
                orderId: savedOrder._id,
                type: 'Call Center', // Defaulting to call center for new COD orders
                content: notes,
                createdBy: req.user?._id || null
            });
        }

        // PHASE 9: Increment Customer Lifetime Value tracking if created instantly fulfilled
        const isActive = !['Refused', 'Returned', 'Cancelled', 'Cancelled by Customer'].includes(savedOrder.status);
        const isFulfilled = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(savedOrder.status);

        if (isFulfilled && savedOrder.customer) {
            await Customer.findByIdAndUpdate(resolvedCustomerId, {
                $inc: { lifetimeValue: savedOrder.totalAmount }
            });
        }

        // PHASE 5 & 6: Inventory Sync - Reserve Stock on Variant Creation
        for (const item of savedOrder.products) {
            if (item.variantId) {
                if (isFulfilled) {
                    await ProductVariant.findByIdAndUpdate(item.variantId, {
                        $inc: { totalStock: -item.quantity, totalSold: item.quantity }
                    });
                    await logStockMovement(
                        item.variantId,
                        -item.quantity,
                        'Sale',
                        `Instantly Fulfilled Order ${savedOrder.orderId}`,
                        savedOrder._id
                    );
                } else if (isActive) {
                    await ProductVariant.findByIdAndUpdate(item.variantId, {
                        $inc: { reservedStock: item.quantity, totalSold: item.quantity }
                    });
                    await logStockMovement(
                        item.variantId,
                        -item.quantity,
                        'Sale',
                        `Reserved for Order ${savedOrder.orderId}`,
                        savedOrder._id
                    );
                }
            }
        }

        // Async update customer CRM metrics
        if (savedOrder.customer) {
            updateCustomerMetrics(savedOrder.customer._id).catch(console.error);
        }

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(400).json({ message: error.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.products && Array.isArray(updateData.products)) {
            let totalAmount = 0;
            updateData.products.forEach(item => {
                totalAmount += (item.quantity * item.unitPrice);
            });
            updateData.totalAmount = totalAmount;
        }

        const existingOrder = await Order.findById(id);
        if (!existingOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // PHASE 5 & 6: Dynamic Inventory Delta Sync
        const variantDeltas = {};

        // Track Main Status for accurate COD lifecycle
        const oldMainStatus = existingOrder.status;
        const newMainStatus = updateData.status || oldMainStatus;

        // An order is active ONLY if its main status is not cancelled/returned/refused
        const isOldActive = !['Cancelled', 'Returned', 'Refused'].includes(oldMainStatus);
        const isNewActive = !['Cancelled', 'Returned', 'Refused'].includes(newMainStatus);

        const isOldFulfilled = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(oldMainStatus);
        const isNewFulfilled = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(newMainStatus);

        // 1. Reverse the impact of the old order state
        if (isOldActive) {
            for (const item of existingOrder.products) {
                if (!item.variantId) continue;
                // Safely get string ID whether it's populated or not
                const vId = item.variantId._id ? item.variantId._id.toString() : item.variantId.toString();
                if (!variantDeltas[vId]) variantDeltas[vId] = { reserved: 0, total: 0, sold: 0 };

                if (isOldFulfilled) {
                    variantDeltas[vId].total += item.quantity;
                    variantDeltas[vId].sold -= item.quantity;
                } else {
                    variantDeltas[vId].reserved -= item.quantity;
                    variantDeltas[vId].sold -= item.quantity;
                }
            }

            // PHASE 9 CRM: Strip LTV if reversing a fulfilled order
            if (isOldFulfilled && existingOrder.customer) {
                await Customer.findByIdAndUpdate(existingOrder.customer, {
                    $inc: { lifetimeValue: -existingOrder.totalAmount }
                });
            }
        }

        // 2. Apply the impact of the new order state
        const newProducts = updateData.products || existingOrder.products;
        if (isNewActive) {
            for (const item of newProducts) {
                if (!item.variantId) continue;
                const vId = item.variantId._id ? item.variantId._id.toString() : item.variantId.toString();
                if (!variantDeltas[vId]) variantDeltas[vId] = { reserved: 0, total: 0, sold: 0 };

                const qty = Number(item.quantity) || 0;

                if (isNewFulfilled) {
                    variantDeltas[vId].total -= qty;
                    variantDeltas[vId].sold += qty;
                } else {
                    variantDeltas[vId].reserved += qty;
                    variantDeltas[vId].sold += qty;
                }
            }

            // PHASE 9 CRM: Grant LTV if newly transitioning to fulfilled
            if (isNewFulfilled && existingOrder.customer) {
                // Determine target amount. If updating amounts in same transaction, use it. Else old amount.
                const updatedAmount = updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
                await Customer.findByIdAndUpdate(existingOrder.customer, {
                    $inc: { lifetimeValue: updatedAmount }
                });
            }
        }

        // 3. Execute the calculated deltas
        for (const [vId, delta] of Object.entries(variantDeltas)) {
            if (delta.reserved === 0 && delta.total === 0 && delta.sold === 0) continue;

            await ProductVariant.findByIdAndUpdate(vId, {
                $inc: {
                    reservedStock: delta.reserved,
                    totalStock: delta.total,
                    totalSold: delta.sold
                }
            });

            let moveInfo = [];
            if (delta.total !== 0) moveInfo.push(`Total: ${delta.total > 0 ? '+' : ''}${delta.total}`);
            if (delta.reserved !== 0) moveInfo.push(`Rsv: ${delta.reserved > 0 ? '+' : ''}${delta.reserved}`);

            await logStockMovement(
                vId,
                delta.total !== 0 ? delta.total : delta.reserved, // Log primary qty change
                'Sale',
                `Updated Order ${existingOrder.orderId} Delta (${moveInfo.join(', ')})`,
                existingOrder._id
            );
        }

        // PHASE 27: COURIER LIABILITY SYNC
        const isOldCODCollected = ['Delivered', 'Paid'].includes(oldMainStatus);
        const isNewCODCollected = ['Delivered', 'Paid'].includes(newMainStatus);
        const activeCourierId = updateData.courier || existingOrder.courier;

        if (activeCourierId) {
            let courierCashDelta = 0;
            if (isOldCODCollected) courierCashDelta -= existingOrder.totalAmount;
            if (isNewCODCollected) {
                const newTotalAmount = updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
                courierCashDelta += newTotalAmount;
            }
            if (courierCashDelta !== 0) {
                await syncCourierCash(activeCourierId, courierCashDelta);
            }
        }

        // 4. Update underlying Customer details if provided from Edit Modal
        if (existingOrder.customer && (updateData.customerName || updateData.customerPhone)) {
            const customerUpdates = {};
            if (updateData.customerName) customerUpdates.name = updateData.customerName;
            if (updateData.customerPhone) customerUpdates.phone = updateData.customerPhone;
            
            await Customer.findByIdAndUpdate(existingOrder.customer, {
                $set: customerUpdates
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('customer', 'name email').populate({
            path: 'products.variantId',
            populate: { path: 'productId' }
        });

        // Update customer CRM metrics
        if (updatedOrder.customer) {
            updateCustomerMetrics(updatedOrder.customer._id).catch(console.error);
        }

        // Update Courier KPIs
        if (activeCourierId) {
            recalculateCourierKPIs(activeCourierId).catch(console.error);
        }

        res.json(updatedOrder);
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(400).json({ message: error.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedOrder = await Order.findByIdAndDelete(id);

        if (!deletedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Revert Inventory Impact
        const isMainActive = !['Cancelled', 'Returned', 'Refused'].includes(deletedOrder.status);

        if (isMainActive) {
            const isFulfilled = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(deletedOrder.status);

            if (isFulfilled && deletedOrder.customer) {
                await Customer.findByIdAndUpdate(deletedOrder.customer, {
                    $inc: { lifetimeValue: -deletedOrder.totalAmount }
                });
            }

            for (const item of deletedOrder.products) {
                if (!item.variantId) continue;
                const vId = item.variantId._id ? item.variantId._id.toString() : item.variantId.toString();

                const qty = Number(item.quantity) || 0;

                if (isFulfilled) {
                    await ProductVariant.findByIdAndUpdate(vId, {
                        $inc: { totalStock: qty, totalSold: -qty }
                    });
                    await logStockMovement(
                        vId,
                        qty,
                        'Returns',
                        `Order ${deletedOrder.orderId} Deleted`,
                        deletedOrder._id
                    );
                } else {
                    await ProductVariant.findByIdAndUpdate(vId, {
                        $inc: { reservedStock: -qty, totalSold: -qty }
                    });
                    await logStockMovement(
                        vId,
                        qty,
                        'Returns',
                        `Pending Order ${deletedOrder.orderId} Deleted`,
                        deletedOrder._id
                    );
                }
            }
        }

        // Update customer CRM metrics
        if (deletedOrder.customer) {
            updateCustomerMetrics(deletedOrder.customer).catch(console.error);
        }

        res.json({ message: 'Order deleted successfully', orderId: deletedOrder.orderId });
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ message: error.message });
    }
};
