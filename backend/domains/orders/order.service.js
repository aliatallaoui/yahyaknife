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
const { assertTransition } = require('./order.statemachine');
const AppError = require('../../shared/errors/AppError');
const { logStockMovement } = require('../../controllers/stockController');
const { updateCustomerMetrics } = require('../../controllers/customerController');
const { syncCourierCash, recalculateCourierKPIs } = require('../../controllers/courierController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve or create a customer by phone, within a session (pre-transaction) */
async function resolveCustomer(tenantId, customerId, customerPhone, customerName) {
    if (customerId) return customerId;
    if (!customerPhone) throw AppError.validationFailed({ customerPhone: 'Phone number is required' });

    let customer = await Customer.findOne({ phone: customerPhone, tenant: tenantId });
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
    return customer._id;
}

/** Fetch variant costs in one query → { variantId: cost } */
async function fetchVariantCosts(products) {
    const variantIds = products.filter(p => p.variantId).map(p => p.variantId);
    if (variantIds.length === 0) return {};

    const variants = await ProductVariant.find({ _id: { $in: variantIds } }, { cost: 1 });
    const map = {};
    variants.forEach(v => { map[v._id.toString()] = v.cost || 0; });
    return map;
}

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createOrder = async ({ tenantId, userId, body }) => {
    const {
        orderId, customerId, customerName, customerPhone,
        channel, products, status, paymentStatus,
        fulfillmentStatus, fulfillmentPipeline, notes,
        shipping, financials, courier, priority, tags, verificationStatus
    } = body;

    if (!orderId || !channel || !products || products.length === 0) {
        throw AppError.validationFailed({ orderId: 'orderId, channel, and products are required' });
    }

    // 1. Resolve customer (outside transaction — idempotent)
    const resolvedCustomerId = await resolveCustomer(tenantId, customerId, customerPhone, customerName);

    // 2. Fetch costs
    const costMap = await fetchVariantCosts(products);

    // 3. Compute financials
    let subtotalAmt = 0;
    let totalCOGS = 0;
    const processedProducts = products.map(item => {
        if (!item.quantity || item.unitPrice === undefined) {
            throw AppError.validationFailed({ products: 'Each product must have quantity and unitPrice' });
        }
        const qty = Number(item.quantity);
        const cost = item.variantId ? (costMap[item.variantId.toString()] || 0) : 0;
        subtotalAmt += qty * item.unitPrice;
        totalCOGS += qty * cost;
        return { ...item, quantity: qty };
    });

    const codAmount = financials?.codAmount || 0;
    const courierFee = financials?.courierFee || 0;
    const discount = financials?.discount || 0;
    const finalTotal = subtotalAmt + courierFee - discount;
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
            financials: { ...financials, cogs: totalCOGS, codAmount: codAmount || finalTotal, courierFee },
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

        savedOrder = created;

        // OrderItems snapshot
        const orderItemDocs = processedProducts.map(p => ({
            orderId: savedOrder._id,
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
                type: 'Call Center',
                content: notes,
                createdBy: userId || null
            });
        }
    } catch (error) {
        if (savedOrder && savedOrder._id) {
            // Attempt manual rollback for the primary document
            await Order.findByIdAndDelete(savedOrder._id).catch(e => console.error("Rollback failed:", e));
        }
        throw error;
    }

    // 5. Post-commit side effects (fire-and-forget)
    const isFulfilled = ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(savedOrder.status);
    const isActive = !['Refused', 'Returned', 'Cancelled', 'Cancelled by Customer'].includes(savedOrder.status);

    if (isFulfilled) {
        Customer.findByIdAndUpdate(resolvedCustomerId, { $inc: { lifetimeValue: savedOrder.totalAmount } }).catch(console.error);
    }

    for (const item of savedOrder.products) {
        if (!item.variantId) continue;
        if (isFulfilled) {
            ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { totalStock: -item.quantity, totalSold: item.quantity } }).catch(console.error);
            logStockMovement(item.variantId, -item.quantity, 'Sale', `Fulfilled Order ${savedOrder.orderId}`, savedOrder._id).catch(console.error);
        } else if (isActive) {
            ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { reservedStock: item.quantity, totalSold: item.quantity } }).catch(console.error);
            logStockMovement(item.variantId, -item.quantity, 'Sale', `Reserved for Order ${savedOrder.orderId}`, savedOrder._id).catch(console.error);
        }
    }

    updateCustomerMetrics(resolvedCustomerId).catch(console.error);

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
            await Customer.findByIdAndUpdate(existingOrder.customer, { $inc: { lifetimeValue: -existingOrder.totalAmount } });
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
            await Customer.findByIdAndUpdate(existingOrder.customer, { $inc: { lifetimeValue: updatedAmount } });
        }
    }

    // Apply inventory deltas
    for (const [vId, delta] of Object.entries(variantDeltas)) {
        if (delta.reserved === 0 && delta.total === 0 && delta.sold === 0) continue;
        await ProductVariant.findByIdAndUpdate(vId, {
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
            existingOrder._id
        );
    }

    // Courier cash liability sync
    const isOldCOD = ['Delivered', 'Paid'].includes(oldMainStatus);
    const isNewCOD = ['Delivered', 'Paid'].includes(newMainStatus);
    const activeCourierId = updateData.courier || existingOrder.courier;
    if (activeCourierId) {
        let delta = 0;
        if (isOldCOD) delta -= existingOrder.totalAmount;
        if (isNewCOD) delta += updateData.totalAmount !== undefined ? updateData.totalAmount : existingOrder.totalAmount;
        if (delta !== 0) await syncCourierCash(activeCourierId, delta);
    }

    // Sync customer name/phone if edited
    if (existingOrder.customer && (updateData.customerName || updateData.customerPhone)) {
        const customerUpdates = {};
        if (updateData.customerName) customerUpdates.name = updateData.customerName;
        if (updateData.customerPhone) customerUpdates.phone = updateData.customerPhone;
        await Customer.findByIdAndUpdate(existingOrder.customer, { $set: customerUpdates });
    }

    // Strip immutable / protected fields before persisting
    const { _id, tenant, createdAt, updatedAt, deletedAt, orderId: _oid, ...safeUpdate } = updateData;
    const updatedOrder = await Order.findOneAndUpdate({ _id: orderId, tenant: tenantId }, safeUpdate, { new: true, runValidators: true })
        .populate('customer', 'name email')
        .populate({ path: 'products.variantId', populate: { path: 'productId' } });

    // Persist status change to audit trail
    if (updateData.status && newMainStatus !== oldMainStatus) {
        OrderStatusHistory.create({
            tenant: existingOrder.tenant,
            orderId: existingOrder._id,
            status: newMainStatus,
            previousStatus: oldMainStatus,
            changedBy: userId || null,
            note: updateData.statusNote || ''
        }).catch(console.error);
    }

    // Post-update side effects
    if (updatedOrder.customer) updateCustomerMetrics(updatedOrder.customer._id).catch(console.error);
    if (activeCourierId) recalculateCourierKPIs(activeCourierId).catch(console.error);

    return updatedOrder;
};
