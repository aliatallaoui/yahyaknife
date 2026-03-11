/**
 * ShipmentService — business logic for shipment lifecycle.
 *
 * Depends on:
 *   - EcotrackAdapter  (or any CourierAdapter) for courier API calls
 *   - Order / Shipment / CustomOrder models for persistence
 *
 * Controllers call this service and only handle HTTP (req/res).
 */

const Shipment = require('../../models/Shipment');
const Order = require('../../models/Order');
const CustomOrder = require('../../models/CustomOrder');
const ecotrackAdapter = require('../../integrations/couriers/EcotrackAdapter');
const AppError = require('../../shared/errors/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the internal order (regular or custom) */
async function resolveOrder(orderId, isCustomOrder, tenantId) {
    const query = { _id: orderId };
    if (tenantId) query.tenant = tenantId; // Allow non-tenant models if needed, but enforce if passed
    
    const doc = isCustomOrder
        ? await CustomOrder.findOne(query)
        : await Order.findOne(query);
    if (!doc) throw AppError.notFound(isCustomOrder ? 'Custom order' : 'Order');
    return doc;
}

/** Determine whether an orderId belongs to a custom order */
function isCustomOrderId(internalOrderId) {
    return typeof internalOrderId === 'string' && internalOrderId.startsWith('CUST-');
}

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createShipment = async ({ orderId, isCustomOrder, shipmentData, tenantId }) => {
    const internalOrder = await resolveOrder(orderId, isCustomOrder, tenantId);

    const newShipment = new Shipment({
        ...shipmentData,
        tenant: tenantId,
        internalOrder: orderId,
        internalOrderId: isCustomOrder ? internalOrder.customOrderId : internalOrder.orderId,
        shipmentStatus: 'Created in Courier',
        activityHistory: [{ status: 'Created in system, pending dispatch to ECOTRACK', remarks: 'Initial creation' }]
    });

    const payload = ecotrackAdapter.toPayload(newShipment);
    const { trackingId } = await ecotrackAdapter.createShipment(payload);

    newShipment.externalTrackingId = trackingId;
    newShipment.courierStatus = 'Created';

    const savedShipment = await newShipment.save();

    internalOrder.status = 'Dispatched';
    await internalOrder.save();

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

    order.status = 'Dispatched';
    order.trackingInfo = { carrier: 'ECOTRACK', trackingNumber: trackingId };
    await order.save();

    return savedShipment;
};

// ─── Validate ─────────────────────────────────────────────────────────────────

exports.validateShipment = async (shipmentId, tenantId, { askCollection = 1 } = {}) => {
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
        remarks: `Pickup requested: ${askCollection === 1 ? 'Yes' : 'No'}`
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
    const internalOrder = isCustomOrderId(shipment.internalOrderId)
        ? await CustomOrder.findById(shipment.internalOrder)
        : await Order.findById(shipment.internalOrder);

    if (internalOrder) {
        internalOrder.status = 'Confirmed';
        await internalOrder.save();
    }

    await Shipment.findOneAndDelete({ _id: shipmentId, tenant: tenantId });

    return { courierCancelled, revertedStatus: 'Confirmed' };
};

// ─── Return ───────────────────────────────────────────────────────────────────

exports.requestReturn = async (shipmentId, tenantId) => {
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
    shipment.activityHistory.push({ status: 'Return Requested', remarks: 'Admin manually requested return from ECOTRACK.' });

    const updated = await shipment.save();

    // Sync internal order status
    const internalOrder = isCustomOrderId(shipment.internalOrderId)
        ? await CustomOrder.findById(shipment.internalOrder)
        : await Order.findById(shipment.internalOrder);

    if (internalOrder) {
        internalOrder.status = 'Cancelled';
        await internalOrder.save();
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
