const Order = require('../models/Order');
const Customer = require('../models/Customer');
const ProductVariant = require('../models/ProductVariant');
const { logStockMovement } = require('./stockController');
const { updateCustomerMetrics } = require('./customerController');
const { syncCourierCash, recalculateCourierKPIs } = require('./courierController');

exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find()
            .populate('customer', 'name email')
            .populate({
                path: 'products.variantId',
                populate: { path: 'productId' }
            })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            orders,
            currentPage: page,
            totalPages,
            totalOrders
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSalesPerformance = async (req, res) => {
    try {
        // Top selling products, channels, volume
        const orders = await Order.find();

        let totalSalesVolume = 0;
        const channelDistribution = {};

        orders.forEach(order => {
            totalSalesVolume += order.totalAmount;
            if (!channelDistribution[order.channel]) {
                channelDistribution[order.channel] = { count: 0, revenue: 0 };
            }
            channelDistribution[order.channel].count += 1;
            channelDistribution[order.channel].revenue += order.totalAmount;
        });

        const averageOrderValue = orders.length > 0 ? totalSalesVolume / orders.length : 0;

        res.json({
            totalOrders: orders.length,
            totalSalesVolume,
            averageOrderValue,
            channelDistribution
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { orderId, customerId, customerName, customerPhone, channel, products, status, paymentStatus, fulfillmentStatus, fulfillmentPipeline, notes, shipping } = req.body;

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

        let totalAmount = 0;
        const processedProducts = products.map(item => {
            if (!item.quantity || !item.unitPrice) {
                throw new Error('Each product must have a quantity and unitPrice');
            }
            totalAmount += (item.quantity * item.unitPrice);
            return item;
        });

        const newOrder = new Order({
            orderId,
            customer: resolvedCustomerId,
            channel,
            products: processedProducts,
            totalAmount,
            status: status || 'Pending',
            paymentStatus: paymentStatus || 'Unpaid',
            fulfillmentStatus: fulfillmentStatus || 'Unfulfilled',
            fulfillmentPipeline: fulfillmentPipeline || 'Pending',
            shipping: shipping || {},
            notes
        });

        const savedOrder = await newOrder.save();

        // PHASE 9: Increment Customer Lifetime Value tracking if created instantly fulfilled
        const isActive = !['Refused', 'Returned', 'Cancelled'].includes(savedOrder.status);
        const isFulfilled = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(savedOrder.status);

        if (isFulfilled && savedOrder.customer) {
            await Customer.findByIdAndUpdate(customerId, {
                $inc: { lifetimeValue: savedOrder.totalAmount }
            });
        }

        // PHASE 5 & 6: Inventory Sync - Reserve Stock on Variant Creation
        for (const item of savedOrder.products) {
            if (item.variantId) {
                if (isFulfilled) {
                    // Instantly deduct totalStock if created as fulfilled and increment totalSold
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
                    // Reserve stock for pending orders and increment totalSold
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
            updateCustomerMetrics(savedOrder.customer).catch(console.error);
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
