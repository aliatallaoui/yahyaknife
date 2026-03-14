/**
 * OrderService — all business logic for the COD order lifecycle.
 *
 * Controllers call this service and only deal with HTTP (req/res).
 * This service throws AppError for operational failures.
 */

const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const ProductVariant = require('../../models/ProductVariant');
const OrderItem = require('../../models/OrderItem');
const OrderStatusHistory = require('../../models/OrderStatusHistory');
const OrderNote = require('../../models/OrderNote');
const CourierPricing = require('../../models/CourierPricing');
const { assertTransition } = require('./order.statemachine');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const { logStockMovement } = require('../../controllers/stockController');
const { updateCustomerMetrics } = require('../../controllers/customerController');
const usageTracker = require('../../services/usageTracker');
const { eventBus, EVENTS } = require('../../shared/events/eventBus');
const { syncCourierCash, recalculateCourierKPIs } = require('../../controllers/courierController');
const cacheService = require('../../services/cacheService');
const { fireAndRetry } = require('../../shared/utils/retryAsync');
const { autoAssignOrder } = require('../call-center/assignment.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve or create a customer by phone, within a session (pre-transaction) */
async function resolveCustomer(tenantId, customerId, customerPhone, customerName) {
    if (customerId) {
        const c = await Customer.findOne({ _id: customerId, tenant: tenantId, deletedAt: null });
        if (c) return c;
    }
    if (!customerPhone) throw AppError.validationFailed({ customerPhone: 'Phone number is required' });

    let customer = await Customer.findOne({ phone: customerPhone, tenant: tenantId, deletedAt: null });
    if (!customer) {
        customer = await Customer.create({
            name: customerName || 'Unknown',
            phone: customerPhone,
            tenant: tenantId,
            acquisitionChannel: 'Direct Traffic'
        });
    } else if (customerName && customerName !== customer.name) {
        customer.name = customerName;
        await customer.save();
    }
    return customer;
}

/** Fetch variant costs in one query → { variantId: cost } */
async function fetchVariantCosts(tenantId, products) {
    const variantIds = products.filter(p => p.variantId).map(p => p.variantId);
    if (variantIds.length === 0) return {};

    const variants = await ProductVariant.find({ _id: { $in: variantIds }, tenant: tenantId }, { cost: 1, status: 1 });
    const inactive = variants.filter(v => v.status && v.status !== 'Active');
    if (inactive.length > 0) {
        throw AppError.validationFailed({ products: `Inactive product variant(s): ${inactive.map(v => v._id).join(', ')}` });
    }
    const map = {};
    variants.forEach(v => { map[v._id.toString()] = v.cost ?? 0; });
    return map;
}

/** Calculate Courier Fee based on pricing rules */
async function calculateCourierFee(courierId, wilayaCode, commune, tenantId) {
    if (!courierId) return null;

    const query = { courierId };
    if (tenantId) query.tenant = tenantId;
    const pricingRules = await CourierPricing.find(query).sort({ priority: -1 }).limit(500).lean();
    if (!pricingRules.length) return null;

    let matchedRule = null;
    for (const rule of pricingRules) {
        if (rule.ruleType === 'Wilaya+Commune' && rule.wilayaCode === wilayaCode && rule.commune === commune) {
            matchedRule = rule; break; // Exact match
        }
        if (rule.ruleType === 'Wilaya' && rule.wilayaCode === wilayaCode && !matchedRule) {
            matchedRule = rule; // Fallback to Wilaya
        }
        if (rule.ruleType === 'Flat' && !matchedRule) {
            matchedRule = rule; // Ultimate fallback
        }
    }
    return matchedRule ? matchedRule.price : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createOrder = async ({ tenantId, userId, body }) => {
    let {
        orderId, customerId, customerName, customerPhone,
        channel, products, status, paymentStatus,
        fulfillmentStatus, fulfillmentPipeline, notes,
        shipping, financials, courier, priority, tags, verificationStatus,
        salesChannelSource, externalOrderId, importMethod
    } = body;

    if (!orderId || !channel || !products || products.length === 0) {
        throw AppError.validationFailed({ orderId: 'orderId, channel, and products are required' });
    }

    // 1. Resolve customer
    const resolvedCustomer = await resolveCustomer(tenantId, customerId, customerPhone, customerName);
    const resolvedCustomerId = resolvedCustomer._id;

    // 1.5 Auto-Flagging for High Risk Customers
    let autoRiskNote = null;
    tags = tags || [];
    priority = priority || 'Normal';
    
    const isRisky = resolvedCustomer.blacklisted || 
                    (resolvedCustomer.refusalRate && resolvedCustomer.refusalRate > 30) || 
                    (resolvedCustomer.trustScore !== undefined && resolvedCustomer.trustScore < 50);

    if (isRisky) {
        if (!tags.includes('High Risk')) tags.push('High Risk');
        if (priority === 'Normal') priority = 'High Priority';
        autoRiskNote = `[SYSTEM WARNING] Customer automatically flagged as HIGH RISK. Trust Score: ${resolvedCustomer.trustScore || 100}, Refusal Rate: ${resolvedCustomer.refusalRate || 0}%. Please verify carefully.`;
    }

    // 2. Fetch costs
    const costMap = await fetchVariantCosts(tenantId, products);

    // 3. Compute financials
    let subtotalAmt = 0;
    let totalCOGS = 0;
    const processedProducts = products.map(item => {
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
            throw AppError.validationFailed({ products: 'Each product must have a positive integer quantity' });
        }
        if (!Number.isFinite(price) || price < 0) {
            throw AppError.validationFailed({ products: 'Each product must have a non-negative unitPrice' });
        }
        const cost = item.variantId ? (costMap[item.variantId.toString()] || 0) : 0;
        subtotalAmt += qty * price;
        totalCOGS += qty * cost;
        return { ...item, quantity: qty };
    });

    const codAmount = financials?.codAmount ?? 0;
    const discount = financials?.discount ?? 0;
    const gatewayFees = financials?.gatewayFees ?? 0;
    const marketplaceFees = financials?.marketplaceFees ?? 0;

    // Server-side Courier Fee Override
    let courierFee = financials?.courierFee ?? 0;
    if (courier && shipping?.wilayaCode) {
        const backendFee = await calculateCourierFee(courier, shipping.wilayaCode, shipping.commune, tenantId);
        if (backendFee !== null) courierFee = backendFee;
    }

    const finalTotal = subtotalAmt + courierFee - discount;
    const netProfit = finalTotal - totalCOGS - courierFee - gatewayFees - marketplaceFees;
    const mainStatus = status || 'New';

    // 4. Sequential write (Transactions disabled for local standalone MongoDB compatibility)
    let savedOrder;
    try {
        const created = await Order.create({
            tenant: tenantId,
            orderId,
            customer: resolvedCustomerId,
            channel,
            products: processedProducts,
            subtotal: subtotalAmt,
            discount,
            totalAmount: finalTotal,
            finalTotal,
            amountToCollect: codAmount || finalTotal,
            financials: { ...financials, cogs: totalCOGS, codAmount: codAmount || finalTotal, courierFee, netProfit },
            status: mainStatus,
            paymentStatus: paymentStatus || 'Unpaid',
            fulfillmentStatus: fulfillmentStatus || 'Unfulfilled',
            fulfillmentPipeline: fulfillmentPipeline || 'Pending',
            verificationStatus: verificationStatus || 'Pending',
            priority: priority,
            tags: tags,
            courier: courier || null,
            shipping: shipping || {},
            wilaya: shipping?.wilayaCode ? `${shipping.wilayaCode} - ${shipping.wilayaName}` : 'Unknown',
            commune: shipping?.commune || 'Unknown',
            notes: notes || '',
            salesChannelSource: salesChannelSource || undefined,
            ...(externalOrderId ? { externalOrderId } : {}),
            ...(importMethod ? { importMethod } : {}),
        });

        savedOrder = created;

        // OrderItems snapshot
        const orderItemDocs = processedProducts.map(p => ({
            orderId: savedOrder._id,
            tenant: tenantId,
            productId: p.productId || null,
            variantId: p.variantId || null,
            sku: p.sku || '',
            name: p.name || 'Unknown',
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            costPrice: p.variantId ? (costMap[p.variantId.toString()] || 0) : 0,
            lineTotal: p.quantity * p.unitPrice
        }));
        if (orderItemDocs.length > 0) {
            await OrderItem.insertMany(orderItemDocs);
        }

        await OrderStatusHistory.create({
            tenant: tenantId,
            orderId: savedOrder._id,
            status: mainStatus,
            changedBy: userId || null,
            note: 'Order created via COD Flow'
        });

        if (notes) {
            await OrderNote.create({
                orderId: savedOrder._id,
                tenant: tenantId,
                type: 'Call Center',
                content: notes,
                createdBy: userId || null
            });
        }

        if (autoRiskNote) {
            await OrderNote.create({
                orderId: savedOrder._id,
                tenant: tenantId,
                type: 'System Note',
                content: autoRiskNote,
                createdBy: userId || null
            });
        }
    } catch (error) {
        if (savedOrder && savedOrder._id) {
            // Attempt manual rollback for all related documents
            await Promise.allSettled([
                Order.findOneAndDelete({ _id: savedOrder._id, tenant: savedOrder.tenant }),
                OrderItem.deleteMany({ orderId: savedOrder._id }),
                OrderStatusHistory.deleteMany({ orderId: savedOrder._id }),
                OrderNote.deleteMany({ orderId: savedOrder._id }),
            ]).catch(e => logger.error({ err: e }, 'Rollback failed'));
        }
        throw error;
    }

    // 5. Post-commit side effects — stock mutations are synchronous to prevent drift
    const isFulfilled = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(savedOrder.status);
    const isActive = !['Refused', 'Returned', 'Cancelled', 'Cancelled by Customer'].includes(savedOrder.status);

    if (isFulfilled) {
        await Customer.findOneAndUpdate({ _id: resolvedCustomerId, tenant: tenantId }, { $inc: { lifetimeValue: savedOrder.totalAmount } });
    }

    for (const item of savedOrder.products) {
        if (!item.variantId) continue;
        if (isFulfilled) {
            await ProductVariant.findOneAndUpdate({ _id: item.variantId, tenant: tenantId }, { $inc: { totalStock: -item.quantity, totalSold: item.quantity } });
            await logStockMovement(item.variantId, -item.quantity, 'Sale', `Fulfilled Order ${savedOrder.orderId}`, savedOrder._id, 'Order', tenantId);
        } else if (isActive) {
            await ProductVariant.findOneAndUpdate({ _id: item.variantId, tenant: tenantId }, { $inc: { reservedStock: item.quantity, totalSold: item.quantity } });
            await logStockMovement(item.variantId, -item.quantity, 'Sale', `Reserved for Order ${savedOrder.orderId}`, savedOrder._id, 'Order', tenantId);
        }
    }

    fireAndRetry('updateCustomerMetrics:create', () => updateCustomerMetrics(resolvedCustomerId));

    // Invalidate dashboard cache for this tenant
    cacheService.flushByPrefix(`dash:${tenantId}:`);

    // Auto-assign new orders to least-loaded agent (fire-and-forget)
    if (mainStatus === 'New' && !savedOrder.assignedAgent) {
        fireAndRetry('autoAssignOrder', () => autoAssignOrder(savedOrder._id, tenantId));
    }

    // Track usage for billing
    usageTracker.increment(tenantId, 'orders').catch(() => {});

    // Emit domain event for webhook + other listeners
    eventBus.emit(EVENTS.ORDER_CREATED, {
        tenantId,
        orderId: savedOrder.orderId,
        _id: savedOrder._id.toString(),
        status: savedOrder.status,
        totalAmount: savedOrder.totalAmount,
        customerId: savedOrder.customer?.toString(),
    });

    return savedOrder;
};

// ─── Update ───────────────────────────────────────────────────────────────────

exports.updateOrder = async ({ orderId, tenantId, userId, updateData, bypassStateMachine = false }) => {
    const existingOrder = await Order.findOne({ _id: orderId, tenant: tenantId });
    if (!existingOrder) throw AppError.notFound('Order');

    if (updateData.products && Array.isArray(updateData.products)) {
        let totalAmount = 0;
        updateData.products.forEach(item => { totalAmount += item.quantity * item.unitPrice; });
        updateData.totalAmount = totalAmount;
    }

    // Server-Side Courier Pricing Override Update
    const activeCourierId = updateData.courier || existingOrder.courier;
    const activeWilayaCode = updateData.shipping?.wilayaCode || existingOrder.shipping?.wilayaCode;
    const activeCommune = updateData.shipping?.commune || existingOrder.shipping?.commune;

    let backendFee = null;
    if (activeCourierId && activeWilayaCode) {
        backendFee = await calculateCourierFee(activeCourierId, activeWilayaCode, activeCommune);
    }

    // Recompute netProfit server-side if financials or totalAmount changed
    if (updateData.financials || updateData.totalAmount !== undefined || backendFee !== null) {
        const mergedFinancials = { ...existingOrder.financials?.toObject?.() || existingOrder.financials || {}, ...updateData.financials };
        
        if (backendFee !== null) {
            mergedFinancials.courierFee = backendFee;
            if (!updateData.financials) updateData.financials = {};
            updateData.financials.courierFee = backendFee;
        }

        let total = updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
        
        // If the fee changed externally (by backend override), update the totalAmount
        if (backendFee !== null && backendFee !== (existingOrder.financials?.courierFee ?? 0)) {
            let subtotalAmt = 0;
            const prods = updateData.products || existingOrder.products;
            prods.forEach(item => { subtotalAmt += item.quantity * item.unitPrice; });
            const discount = mergedFinancials.discount ?? 0;
            total = subtotalAmt + backendFee - discount;
            updateData.totalAmount = total;
            updateData.finalTotal = total;
            if (!updateData.financials) updateData.financials = {};
            updateData.financials.codAmount = total;
        }

        const cogs = mergedFinancials.cogs ?? 0;
        const cFee = mergedFinancials.courierFee ?? 0;
        const gFees = mergedFinancials.gatewayFees ?? 0;
        const mFees = mergedFinancials.marketplaceFees ?? 0;
        if (!updateData.financials) updateData.financials = {};
        updateData.financials.netProfit = total - cogs - cFee - gFees - mFees;
    }

    const oldMainStatus = existingOrder.status;
    const newMainStatus = updateData.status || oldMainStatus;

    // State machine guard
    if (updateData.status && updateData.status !== oldMainStatus) {
        assertTransition(oldMainStatus, newMainStatus, bypassStateMachine);
    }

    // Handle postponedUntil — must be a valid future date
    if (newMainStatus === 'Postponed') {
        if (!updateData.postponedUntil) throw AppError.validationFailed({ postponedUntil: 'A future date is required when postponing' });
        const postponedDate = new Date(updateData.postponedUntil);
        if (isNaN(postponedDate.getTime()) || postponedDate <= new Date()) {
            throw AppError.validationFailed({ postponedUntil: 'postponedUntil must be a valid future date' });
        }
        updateData.postponedUntil = postponedDate;
    } else if (oldMainStatus === 'Postponed' && newMainStatus !== 'Postponed') {
        updateData.postponedUntil = null;
    }

    // Inject delivery timestamps on relevant transitions
    if (updateData.status && newMainStatus !== oldMainStatus) {
        if (['Delivered', 'Paid'].includes(newMainStatus)) {
            updateData['deliveryStatus.deliveredAt'] = new Date();
        }
        if (newMainStatus === 'Refused' && updateData.refusalReason) {
            // refusalReason passed through from caller — already in updateData
        }
        if (newMainStatus === 'Returned') {
            updateData['deliveryStatus.returnedAt'] = new Date();
        }
    }

    const INACTIVE_STATUSES = ['Cancelled', 'Cancelled by Customer', 'Returned', 'Refused'];
    const FULFILLED_STATUSES = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'];

    const isOldActive    = !INACTIVE_STATUSES.includes(oldMainStatus);
    const isNewActive    = !INACTIVE_STATUSES.includes(newMainStatus);
    const isOldFulfilled = FULFILLED_STATUSES.includes(oldMainStatus);
    const isNewFulfilled = FULFILLED_STATUSES.includes(newMainStatus);

    // Inventory delta calculation
    const variantDeltas = {};

    if (isOldActive) {
        for (const item of existingOrder.products) {
            if (!item.variantId) continue;
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
        if (isOldFulfilled && existingOrder.customer) {
            await Customer.findOneAndUpdate({ _id: existingOrder.customer, tenant: tenantId }, { $inc: { lifetimeValue: -existingOrder.totalAmount } });
        }
    }

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
        if (isNewFulfilled && existingOrder.customer) {
            const updatedAmount = updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
            await Customer.findOneAndUpdate({ _id: existingOrder.customer, tenant: tenantId }, { $inc: { lifetimeValue: updatedAmount } });
        }
    }

    // Apply inventory deltas
    for (const [vId, delta] of Object.entries(variantDeltas)) {
        if (delta.reserved === 0 && delta.total === 0 && delta.sold === 0) continue;
        await ProductVariant.findOneAndUpdate({ _id: vId, tenant: tenantId }, {
            $inc: { reservedStock: delta.reserved, totalStock: delta.total, totalSold: delta.sold }
        });
        const moveInfo = [];
        if (delta.total !== 0) moveInfo.push(`Total: ${delta.total > 0 ? '+' : ''}${delta.total}`);
        if (delta.reserved !== 0) moveInfo.push(`Rsv: ${delta.reserved > 0 ? '+' : ''}${delta.reserved}`);
        await logStockMovement(
            vId,
            delta.total !== 0 ? delta.total : delta.reserved,
            'Sale',
            `Updated Order ${existingOrder.orderId} Delta (${moveInfo.join(', ')})`,
            existingOrder._id,
            'Order',
            tenantId
        );
    }

    // Courier cash liability sync
    const isOldCOD = ['Delivered', 'Paid'].includes(oldMainStatus);
    const isNewCOD = ['Delivered', 'Paid'].includes(newMainStatus);
    if (activeCourierId) {
        let delta = 0;
        if (isOldCOD) delta -= existingOrder.totalAmount;
        if (isNewCOD) delta += updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
        if (delta !== 0) await syncCourierCash(activeCourierId, delta, tenantId);
    }

    // Sync customer name/phone if edited
    if (existingOrder.customer && (updateData.customerName || updateData.customerPhone)) {
        const customerUpdates = {};
        if (updateData.customerName) customerUpdates.name = updateData.customerName;
        if (updateData.customerPhone) customerUpdates.phone = updateData.customerPhone;
        await Customer.findOneAndUpdate({ _id: existingOrder.customer, tenant: tenantId }, { $set: customerUpdates });
    }

    // Strip immutable / protected fields before persisting
    const { _id, tenant, createdAt, updatedAt, deletedAt, orderId: _oid, ...safeUpdate } = updateData;
    const updatedOrder = await Order.findOneAndUpdate({ _id: orderId, tenant: tenantId }, safeUpdate, { returnDocument: 'after', runValidators: true })
        .populate('customer', 'name phone email fraudProbability refusalRate totalOrders deliveredOrders totalRefusals trustScore')
        .populate('courier', 'name')
        .populate('assignedAgent', 'name')
        .populate({ path: 'products.variantId', select: 'sku name price cost productId', populate: { path: 'productId', select: 'name brand images' } });

    // Persist status change to audit trail
    if (updateData.status && newMainStatus !== oldMainStatus) {
        fireAndRetry('OrderStatusHistory:create', () => OrderStatusHistory.create({
            tenant: existingOrder.tenant,
            orderId: existingOrder._id,
            status: newMainStatus,
            previousStatus: oldMainStatus,
            changedBy: userId || null,
            note: updateData.statusNote || ''
        }));
    }

    // Post-update side effects (fire-and-forget with retry)
    if (updatedOrder.customer) fireAndRetry('updateCustomerMetrics:update', () => updateCustomerMetrics(updatedOrder.customer._id));
    if (activeCourierId) fireAndRetry('recalculateCourierKPIs', () => recalculateCourierKPIs(activeCourierId));

    // Invalidate dashboard cache for this tenant
    cacheService.flushByPrefix(`dash:${tenantId}:`);

    // Emit domain events for webhook listeners
    const statusChanged = updatedOrder.status !== oldMainStatus;
    if (statusChanged) {
        eventBus.emit(EVENTS.ORDER_STATUS_CHANGED, {
            tenantId,
            orderId: updatedOrder.orderId,
            _id: updatedOrder._id.toString(),
            oldStatus: existingOrder.status,
            newStatus: updatedOrder.status,
        });

        if (updatedOrder.status === 'Delivered') {
            eventBus.emit(EVENTS.ORDER_DELIVERED, { tenantId, orderId: updatedOrder.orderId, _id: updatedOrder._id.toString() });
        } else if (['Cancelled', 'Cancelled by Customer'].includes(updatedOrder.status)) {
            eventBus.emit(EVENTS.ORDER_CANCELLED, { tenantId, orderId: updatedOrder.orderId, _id: updatedOrder._id.toString() });
        } else if (updatedOrder.status === 'Returned') {
            eventBus.emit(EVENTS.ORDER_RETURNED, { tenantId, orderId: updatedOrder.orderId, _id: updatedOrder._id.toString() });
        }
    }

    return updatedOrder;
};
