/**
 * ShipmentService — business logic for shipment lifecycle.
 *
 * Depends on:
 *   - adapterFactory for resolving the correct CourierAdapter per courier
 *   - Order / Shipment / Courier models for persistence
 *
 * Controllers call this service and only handle HTTP (req/res).
 */

const Shipment = require('../../models/Shipment');
const Order = require('../../models/Order');
const Courier = require('../../models/Courier');
const CourierCoverage = require('../../models/CourierCoverage');
const { getAdapter, getProviderName } = require('../../integrations/couriers/adapterFactory');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const { fireAndRetry } = require('../../shared/utils/retryAsync');
const OrderService = require('../orders/order.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the internal order */
async function resolveOrder(orderId, tenantId) {
    const query = { _id: orderId, deletedAt: null };
    if (tenantId) query.tenant = tenantId;
    const doc = await Order.findOne(query);
    if (!doc) throw AppError.notFound('Order');
    return doc;
}

/** Extract a user-friendly error message from a courier API error */
function extractCourierError(err) {
    const apiData = err.response?.data;
    if (apiData?.errors && typeof apiData.errors === 'object') {
        const fieldMap = {
            commune: 'Commune', code_wilaya: 'Wilaya code', telephone: 'Phone number',
            nom_client: 'Customer name', adresse: 'Address', montant: 'COD amount',
            produit: 'Product name', quantite: 'Quantity',
            to_commune_name: 'Commune', to_wilaya_name: 'Wilaya', contact_phone: 'Phone number',
            firstname: 'First name', familyname: 'Last name', price: 'COD amount'
        };
        const details = Object.entries(apiData.errors)
            .map(([field, msgs]) => `${fieldMap[field] || field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join(' | ');
        return `${apiData.message || 'Courier rejected the order'} — ${details}`;
    }
    if (apiData?.message) return apiData.message;
    if (err.message?.includes('circuit breaker')) return 'Courier service is temporarily unavailable. Please try again in a few minutes.';
    if (err.message?.includes('Rate limit')) return err.message;
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ETIMEDOUT') || err.message?.includes('timeout'))
        return 'Could not reach the courier service. Please check your internet connection and try again.';
    return err.message || 'Courier integration error. Please check courier settings and try again.';
}

/**
 * Resolve the courier for an order and return the appropriate adapter.
 * Falls back to Ecotrack global adapter if no courier is assigned.
 */
async function resolveAdapter(order, tenantId) {
    let courier = null;
    const courierId = order.courier?._id || order.courier;
    if (courierId) {
        courier = await Courier.findOne({ _id: courierId, tenant: tenantId, deletedAt: null });
    }
    const adapter = getAdapter(courier);
    const providerName = getProviderName(courier);
    return { adapter, courier, courierId, providerName };
}

/**
 * Check if the courier covers the given wilaya/commune using the synced
 * CourierCoverage collection. Throws a clear AppError if not covered.
 * Silently passes if no coverage data exists (courier may not have synced yet).
 */
async function checkCoverage(courierId, tenantId, { wilayaCode, commune, wilayaName, deliveryType }) {
    if (!courierId) return; // Ecotrack global — no local coverage data

    // Check if this courier has ANY coverage records (i.e. they synced)
    const hasCoverage = await CourierCoverage.exists({ courierId, tenant: tenantId });
    if (!hasCoverage) return; // No synced data — skip local check, let courier API decide

    // Check if the specific wilaya + commune is covered
    const coverage = await CourierCoverage.findOne({
        courierId, tenant: tenantId, wilayaCode: String(wilayaCode), commune
    }).lean();

    if (!coverage) {
        const location = commune && wilayaName ? `${commune}, ${wilayaName}` : wilayaName || `wilaya ${wilayaCode}`;
        throw new AppError(
            `Courier does not cover ${location}. Please choose a different courier or update the delivery address.`,
            400,
            'AREA_NOT_COVERED'
        );
    }

    // Check delivery type support (0 = home, 1 = stop desk)
    if (deliveryType === 1 && !coverage.officeSupported) {
        throw new AppError(
            `Stop desk delivery is not available in ${commune}. Please switch to home delivery or choose a different commune.`,
            400,
            'STOP_DESK_NOT_AVAILABLE'
        );
    }
}

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createShipment = async ({ orderId, shipmentData, tenantId }) => {
    const internalOrder = await resolveOrder(orderId, tenantId);

    // Resolve courier adapter
    const { adapter, providerName } = await resolveAdapter(internalOrder, tenantId);

    // Whitelist fields accepted from client — prevent mass-assignment of
    // paymentStatus, lifecycle timestamps, externalTrackingId, etc.
    const {
        customerName, phone1, phone2, address, commune, wilayaCode, wilayaName,
        postalCode, gpsLink, productName, quantity, weight, remark, boutique,
        operationType, deliveryType, stopDeskFlag, fragileFlag, codAmount, courierFee
    } = shipmentData;

    const newShipment = new Shipment({
        customerName, phone1, phone2, address, commune, wilayaCode, wilayaName,
        postalCode, gpsLink, productName, quantity, weight, remark, boutique,
        operationType, deliveryType, stopDeskFlag, fragileFlag, codAmount, courierFee,
        tenant: tenantId,
        internalOrder: orderId,
        internalOrderId: internalOrder.orderId,
        courierProvider: providerName,
        shipmentStatus: 'Created in Courier',
        activityHistory: [{ status: `Created in system, pending dispatch to ${providerName}`, remarks: 'Initial creation' }]
    });

    const payload = adapter.toPayload(newShipment);
    let trackingId = null;
    let courierError = null;

    try {
        const result = await adapter.createShipment(payload, tenantId);
        trackingId = result.trackingId;
    } catch (err) {
        logger.error({ err, provider: providerName }, 'Failed to dispatch to external courier API');
        courierError = extractCourierError(err);
    }

    if (trackingId) {
        newShipment.externalTrackingId = trackingId;
        newShipment.courierStatus = 'Created';
        newShipment.shipmentStatus = 'Created in Courier';
    } else {
        newShipment.shipmentStatus = 'Dispatch Failed';
        newShipment.activityHistory.push({ status: 'Dispatch Failed', remarks: `Courier Integration Error: ${courierError}` });
    }

    const savedShipment = await newShipment.save();

    // Sync order status through service to trigger inventory + audit trail
    if (tenantId) {
        const trackingInfo = trackingId
            ? { carrier: providerName, trackingNumber: trackingId }
            : { carrier: providerName, error: courierError };

        // Only update order status to 'Dispatched' on success.
        // On failure, leave order at its current status — 'Dispatch Failed' is not a valid order status.
        const updateData = { trackingInfo };
        if (trackingId) updateData.status = 'Dispatched';

        await OrderService.updateOrder({
            orderId: orderId.toString(),
            tenantId,
            updateData,
            bypassStateMachine: true
        });
    }

    return savedShipment;
};

// ─── Quick Dispatch ───────────────────────────────────────────────────────────

exports.quickDispatch = async (orderId, tenantId) => {
    const order = await Order.findOne({ _id: orderId, tenant: tenantId, deletedAt: null }).populate('customer', 'name phone').lean();
    if (!order) throw AppError.notFound('Order');

    // Validate each required field individually for clear user feedback
    const missing = [];
    if (!order.shipping?.phone1) missing.push('phone number');
    if (!order.shipping?.wilayaName) missing.push('wilaya');
    if (!order.shipping?.commune) missing.push('commune');
    if (!order.shipping?.address) missing.push('delivery address');
    if (!order.customer?.name && !order.shipping?.recipientName) missing.push('customer name');

    if (missing.length > 0) {
        throw new AppError(
            `Cannot dispatch: missing ${missing.join(', ')}. Please edit the order and fill in the required shipping details.`,
            400,
            'MISSING_SHIPPING_DETAILS'
        );
    }

    if (order.status === 'Dispatched') {
        throw new AppError('This order has already been dispatched to a courier.', 400, 'ALREADY_DISPATCHED');
    }

    if (order.totalAmount == null || order.totalAmount < 0) {
        throw new AppError('Order total amount is invalid. Please verify the order products and pricing.', 400, 'INVALID_AMOUNT');
    }

    // Resolve courier adapter
    const { adapter, courierId, providerName } = await resolveAdapter(order, tenantId);

    // Check coverage before hitting the courier API — instant clear feedback
    await checkCoverage(courierId, tenantId, {
        wilayaCode: order.shipping.wilayaCode,
        commune: order.shipping.commune,
        wilayaName: order.shipping.wilayaName,
        deliveryType: order.shipping.deliveryType || 0
    });

    const newShipment = new Shipment({
        tenant: tenantId,
        internalOrder: order._id,
        internalOrderId: order.orderId,
        courierProvider: providerName,
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
        activityHistory: [{ status: `Quick Dispatched via ${providerName}`, remarks: `Auto-created from order ${order.orderId}` }]
    });

    const payload = adapter.toPayload(newShipment);

    let trackingId = null;
    let courierError = null;

    try {
        const result = await adapter.createShipment(payload, tenantId);
        trackingId = result.trackingId;
    } catch (err) {
        logger.error({ err, provider: providerName }, 'Failed to quick-dispatch to external courier API');
        courierError = extractCourierError(err);
    }

    if (trackingId) {
        // SUCCESS — courier accepted the order
        newShipment.externalTrackingId = trackingId;
        newShipment.courierStatus = 'Created';
        newShipment.shipmentStatus = 'Created in Courier';

        const savedShipment = await newShipment.save();

        // Move order to Dispatched
        await OrderService.updateOrder({
            orderId: orderId.toString(),
            tenantId,
            updateData: {
                status: 'Dispatched',
                trackingInfo: { carrier: providerName, trackingNumber: trackingId },
            },
            bypassStateMachine: true
        });

        return savedShipment;
    }

    // FAILURE — courier rejected the order
    // Do NOT create a shipment record, do NOT change order status.
    // Throw a clear error so the caller (controller) can report it.
    throw new AppError(courierError, 422, 'COURIER_REJECTED');
};

// ─── Validate ─────────────────────────────────────────────────────────────────

exports.validateShipment = async (shipmentId, tenantId, { askCollection = 1, userId = null } = {}) => {
    const shipment = await Shipment.findOne({ _id: shipmentId, tenant: tenantId });
    if (!shipment) throw AppError.notFound('Shipment');

    if (!['Created in Courier', 'Draft'].includes(shipment.shipmentStatus)) {
        throw new AppError('Only newly created shipments can be validated.', 400, 'INVALID_SHIPMENT_STATE');
    }

    if (shipment.externalTrackingId) {
        const adapter = await resolveAdapterForShipment(shipment, tenantId);
        await adapter.validateShipment(shipment.externalTrackingId, { askCollection, tenantId });
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
            const adapter = await resolveAdapterForShipment(shipment, tenantId);
            await adapter.cancelShipment(shipment.externalTrackingId, tenantId);
            courierCancelled = true;
        } catch (err) {
            logger.warn({ err, provider: shipment.courierProvider }, 'Failed to cancel from courier (deleting locally anyway)');
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
            const adapter = await resolveAdapterForShipment(shipment, tenantId);
            await adapter.requestReturn(shipment.externalTrackingId, tenantId);
        } catch (err) {
            logger.warn({ err, provider: shipment.courierProvider }, 'Failed to request return via courier API');
            // Proceed to flag internally even if courier API fails
        }
    }

    shipment.returnRequestedAt = new Date();
    shipment.shipmentStatus = 'Return Initiated';
    shipment.activityHistory.push({
        status: 'Return Requested',
        remarks: `Admin manually requested return from ${shipment.courierProvider || 'courier'}.`,
        changedBy: userId
    });

    const updated = await shipment.save();

    // Sync internal order status to Returned (not Cancelled — item is coming back)
    if (shipment.internalOrder && shipment.tenant) {
        fireAndRetry('shipment:syncReturnStatus', () => OrderService.updateOrder({
            orderId: shipment.internalOrder.toString(),
            tenantId: shipment.tenant,
            updateData: { status: 'Returned' },
            bypassStateMachine: true
        }));
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

    const adapter = await resolveAdapterForShipment(shipment, tenantId);
    const url = await adapter.getLabelUrl(shipment.externalTrackingId, tenantId);

    shipment.labelUrl = url;
    await shipment.save();

    return url;
};

// ─── Internal Helper ──────────────────────────────────────────────────────────

/**
 * Resolve the correct adapter for an existing shipment by looking up
 * the courier from the linked order, or falling back based on courierProvider.
 */
async function resolveAdapterForShipment(shipment, tenantId) {
    // Try to find the courier via the linked order
    if (shipment.internalOrder) {
        const order = await Order.findOne({ _id: shipment.internalOrder, tenant: tenantId }).select('courier').lean();
        if (order?.courier) {
            const courier = await Courier.findOne({ _id: order.courier, tenant: tenantId, deletedAt: null });
            if (courier) return getAdapter(courier);
        }
    }

    // Fallback: use courierProvider field on shipment itself
    // For ECOTRACK, the singleton adapter works without a courier doc
    if (!shipment.courierProvider || shipment.courierProvider === 'ECOTRACK') {
        return getAdapter(null); // Returns ecotrack singleton
    }

    // For other providers, we need the courier doc to get credentials
    // Try to find any courier with matching provider for this tenant
    const courier = await Courier.findOne({
        tenant: tenantId,
        apiProvider: shipment.courierProvider === 'YALIDIN' ? 'Yalidin' : shipment.courierProvider,
        integrationType: 'API',
        deletedAt: null
    });
    if (courier) return getAdapter(courier);

    // Last resort: Ecotrack fallback
    logger.warn({ shipmentId: shipment._id, provider: shipment.courierProvider }, 'Could not resolve courier adapter, falling back to Ecotrack');
    return getAdapter(null);
}
