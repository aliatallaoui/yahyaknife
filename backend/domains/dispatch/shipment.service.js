/**
 * ShipmentService — business logic for shipment lifecycle.
 *
 * Depends on:
 *   - EcotrackAdapter (or any CourierAdapter) for courier API calls
 *   - Order / Shipment models for persistence
 *
 * Controllers call this service and only handle HTTP (req/res).
 */

const Shipment = require('../../models/Shipment');
const Order = require('../../models/Order');
const ecotrackAdapter = require('../../integrations/couriers/EcotrackAdapter');
const AppError = require('../../shared/errors/AppError');
const OrderService = require('../orders/order.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the internal order */
async function resolveOrder(orderId, tenantId) {
    const query = { _id: orderId };
    if (tenantId) query.tenant = tenantId;
    const doc = await Order.findOne(query);
    if (!doc) throw AppError.notFound('Order');
    return doc;
}

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createShipment = async ({ orderId, shipmentData, tenantId }) => {
    const internalOrder = await resolveOrder(orderId, tenantId);

    const newShipment = new Shipment({
        ...shipmentData,
        tenant: tenantId,
        internalOrder: orderId,
        internalOrderId: internalOrder.orderId,
        shipmentStatus: 'Created in Courier',
        activityHistory: [{ status: 'Created in system, pending dispatch to ECOTRACK', remarks: 'Initial creation' }]
    });

    const payload = ecotrackAdapter.toPayload(newShipment);
    const { trackingId } = await ecotrackAdapter.createShipment(payload);

    newShipment.externalTrackingId = trackingId;
    newShipment.courierStatus = 'Created';

    const savedShipment = await newShipment.save();

    // Sync order status through service to trigger inventory + audit trail
    if (tenantId) {
        await OrderService.updateOrder({
            orderId: orderId.toString(),
            tenantId,
            updateData: { status: 'Dispatched', trackingInfo: { carrier: 'ECOTRACK', trackingNumber: savedShipment.externalTrackingId } },
            bypassStateMachine: true
        });
    }

    return savedShipment;
};

// ─── Quick Dispatch ───────────────────────────────────────────────────────────

exports.quickDispatch = async (orderId, tenantId) => {
    const order = await Order.findOne({ _id: orderId, tenant: tenantId }).populate('customer', 'name phone');
    if (!order) throw AppError.notFound('Order');

    if (!order.shipping?.phone1 || !order.shipping?.wilayaName || !order.shipping?.commune) {
        throw new AppError('Order is missing shipping details (phone, wilaya, commune). Please edit the order first.', 400, 'MISSING_SHIPPING_DETAILS');
    }

    if (order.status === 'Dispatched') {
        throw new AppError('Order has already been dispatched.', 400, 'ALREADY_DISPATCHED');
    }

    const newShipment = new Shipment({
        tenant: tenantId,
        internalOrder: order._id,
        internalOrderId: order.orderId,
        customerName:  order.shipping.recipientName || order.customer?.name || 'Unknown',
        phone1:        order.shipping.phone1,
        phone2:        order.shipping.phone2 || '',
        wilayaCode:    order.shipping.wilayaCode,
        wilayaName:    order.shipping.wilayaName,
        commune:       order.shipping.commune,
        address:       order.shipping.address || '',
        productName:   order.products?.map(p => p.name).join(', ') || 'Mixed Items',
        quantity:      order.products?.reduce((sum, p) => sum + (p.quantity || 1), 0) || 1,
        weight:        order.shipping.weight || 1,
        codAmount:     order.totalAmount,
        deliveryType:  order.shipping.deliveryType || 0,
        fragileFlag:   order.shipping.fragile || false,
        operationType: 1,
        shipmentStatus: 'Created in Courier',
        activityHistory: [{ status: 'Quick Dispatched from Sales Panel', remarks: `Auto-created from order ${order.orderId}` }]
    });

    const payload = ecotrackAdapter.toPayload(newShipment);
    const { trackingId } = await ecotrackAdapter.createShipment(payload);

    newShipment.externalTrackingId = trackingId;
    newShipment.courierStatus = 'Created';

    const savedShipment = await newShipment.save();

    // Sync order status through service to trigger inventory + audit trail
    await OrderService.updateOrder({
        orderId: orderId.toString(),
        tenantId,
        updateData: { status: 'Dispatched', trackingInfo: { carrier: 'ECOTRACK', trackingNumber: trackingId } },
        bypassStateMachine: true
    });

    return savedShipment;
};

// ─── Validate ─────────────────────────────────────────────────────────────────

exports.validateShipment = async (shipmentId, tenantId, { askCollection = 1, userId = null } = {}) => {
    const shipment = await Shipment.findOne({ _id: shipmentId, tenant: tenantId });
    if (!shipment) throw AppError.notFound('Shipment');

    if (!['Created in Courier', 'Draft'].includes(shipment.shipmentStatus)) {
        throw new AppError('Only newly created shipments can be validated.', 400, 'INVALID_SHIPMENT_STATE');
    }

    if (shipment.externalTrackingId) {
        await ecotrackAdapter.validateShipment(shipment.externalTrackingId, { askCollection });
    }

    shipment.shipmentStatus = 'Validated';
    shipment.activityHistory.push({
        status: 'Validated & Dispatched',
        remarks: `Pickup requested: ${askCollection === 1 ? 'Yes' : 'No'}`,
        changedBy: userId
    });

    return shipment.save();
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

exports.deleteShipment = async (shipmentId, tenantId) => {
    const shipment = await Shipment.findOne({ _id: shipmentId, tenant: tenantId });
    if (!shipment) throw AppError.notFound('Shipment');

    if (shipment.shipmentStatus === 'Delivered') {
        throw new AppError('Cannot delete a shipment that is already Delivered.', 403, 'SHIPMENT_DELIVERED');
    }

    let courierCancelled = false;
    if (shipment.externalTrackingId) {
        try {
            await ecotrackAdapter.cancelShipment(shipment.externalTrackingId);
            courierCancelled = true;
        } catch (err) {
            console.warn('Failed to cancel from ECOTRACK (deleting locally anyway):', err.message);
        }
    }

    // Revert internal order status
    if (shipment.internalOrder && shipment.tenant) {
        await OrderService.updateOrder({
            orderId: shipment.internalOrder.toString(),
            tenantId: shipment.tenant,
            updateData: { status: 'Confirmed' },
            bypassStateMachine: true
        }).catch(() => {}); // non-fatal — shipment deletion proceeds regardless
    }

    await Shipment.findOneAndDelete({ _id: shipmentId, tenant: tenantId });

    return { courierCancelled, revertedStatus: 'Confirmed' };
};

// ─── Return ───────────────────────────────────────────────────────────────────

exports.requestReturn = async (shipmentId, tenantId, userId = null) => {
    const shipment = await Shipment.findOne({ _id: shipmentId, tenant: tenantId });
    if (!shipment) throw AppError.notFound('Shipment');

    if (!['In Transit', 'Out for Delivery', 'Failed Attempt'].includes(shipment.shipmentStatus)) {
        throw new AppError('Returns can only be requested for active shipments not yet delivered.', 400, 'INVALID_SHIPMENT_STATE');
    }

    if (shipment.externalTrackingId) {
        try {
            await ecotrackAdapter.requestReturn(shipment.externalTrackingId);
        } catch (err) {
            console.warn('Failed to request return via Ecotrack:', err.message);
            // Proceed to flag internally even if courier API fails
        }
    }

    shipment.returnRequestedAt = new Date();
    shipment.shipmentStatus = 'Return Initiated';
    shipment.activityHistory.push({ status: 'Return Requested', remarks: 'Admin manually requested return from ECOTRACK.', changedBy: userId });

    const updated = await shipment.save();

    // Sync internal order status to Returned (not Cancelled — item is coming back)
    if (shipment.internalOrder && shipment.tenant) {
        await OrderService.updateOrder({
            orderId: shipment.internalOrder.toString(),
            tenantId: shipment.tenant,
            updateData: { status: 'Returned' },
            bypassStateMachine: true
        }).catch(console.error);
    }

    return updated;
};

// ─── Label ────────────────────────────────────────────────────────────────────

exports.getShipmentLabel = async (shipmentId, tenantId) => {
    const shipment = await Shipment.findOne({ _id: shipmentId, tenant: tenantId });
    if (!shipment) throw AppError.notFound('Shipment');
    if (!shipment.externalTrackingId) {
        throw new AppError('No external tracking ID found to generate label.', 400, 'NO_TRACKING_ID');
    }

    const url = await ecotrackAdapter.getLabelUrl(shipment.externalTrackingId);

    shipment.labelUrl = url;
    await shipment.save();

    return url;
};
