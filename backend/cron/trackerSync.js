const logger = require('../shared/logger');
const Shipment = require('../models/Shipment');
const Courier = require('../models/Courier');
const { ecotrackRequest } = require('../utils/ecotrackRequest');
const OrderService = require('../domains/orders/order.service');
const YalidineAdapter = require('../integrations/couriers/YalidineAdapter');
const { getAdapter } = require('../integrations/couriers/adapterFactory');

/**
 * Maps raw Ecotrack statuses to our Internal ERP Shipment status paradigm
 * and COD payment states.
 */
const mapEcotrackStatusToInternal = (courierStatus, currentShipment) => {
    let newShipmentStatus = currentShipment.shipmentStatus;
    let newPaymentStatus = currentShipment.paymentStatus;
    let activityLog = null;

    const lowerStatus = (courierStatus || '').toLowerCase();

    // 1. In Transit / Dispatch
    if (lowerStatus.includes('order_information_received') || lowerStatus.includes('accepted_by_carrier') || lowerStatus.includes('picked')) {
        newShipmentStatus = 'In Transit';
    }
    // 2. Out for delivery
    else if (lowerStatus.includes('dispatched_to_driver') || lowerStatus.includes('out_for_delivery')) {
        newShipmentStatus = 'Out for Delivery';
    }
    // 3. Failed Attempts
    else if (lowerStatus.includes('attempt_delivery') || lowerStatus.includes('pas_de_reponse')) {
        newShipmentStatus = 'Failed Attempt';
    }
    // 4. Delivered
    else if (lowerStatus.includes('livred') || lowerStatus.includes('delivered')) {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }
    // 5. COD Cash flows
    else if (lowerStatus.includes('encaissed') || lowerStatus.includes('collected')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Collected_Not_Paid';
    }
    else if (lowerStatus.includes('payed') || lowerStatus.includes('settled')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Paid_and_Settled';
    }
    // 6. Returns
    else if (lowerStatus.includes('return_asked') || lowerStatus.includes('retour_demandé')) {
        newShipmentStatus = 'Return Initiated';
    }
    else if (lowerStatus.includes('return_in_transit')) {
        newShipmentStatus = 'Return Initiated';
    }
    else if (lowerStatus.includes('return_received') || lowerStatus.includes('retour_recu')) {
        newShipmentStatus = 'Returned';
    }

    if (newShipmentStatus !== currentShipment.shipmentStatus || lowerStatus !== currentShipment.courierStatus) {
        activityLog = {
            status: newShipmentStatus,
            remarks: `Courier Status Updated: ${courierStatus}`
        };
    }

    return { newShipmentStatus, newPaymentStatus, activityLog };
};

/**
 * Get the status mapper function for a given provider.
 */
function getStatusMapper(provider) {
    const upper = (provider || 'ECOTRACK').toUpperCase();
    if (upper === 'YALIDIN') return YalidineAdapter.mapStatusToInternal;
    return mapEcotrackStatusToInternal;
}

/**
 * Apply status update to shipment + order (shared logic for all providers).
 */
async function applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, currentCourierStatus) {
    // Mirror status to Internal Order BEFORE saving shipment to prevent desync
    if (newShipmentStatus === 'Delivered' || newShipmentStatus === 'Returned' || newPaymentStatus === 'Paid_and_Settled') {
        const isCustom = shipment.internalOrderId && shipment.internalOrderId.startsWith('CUST-');

        if (!isCustom && shipment.internalOrder && shipment.tenant) {
            let targetStatus = null;
            const extraData = {};
            if (newPaymentStatus === 'Paid_and_Settled') {
                targetStatus = 'Paid';
                extraData.paymentStatus = 'Paid';
            } else if (newShipmentStatus === 'Delivered') {
                targetStatus = 'Delivered';
            } else if (newShipmentStatus === 'Returned') {
                targetStatus = 'Returned';
            }
            if (targetStatus) {
                await OrderService.updateOrder({
                    orderId: shipment.internalOrder.toString(),
                    tenantId: shipment.tenant,
                    updateData: { status: targetStatus, ...extraData },
                    bypassStateMachine: true
                });
                // If OrderService throws, shipment.save() below is skipped — no desync
            }
        }
    }

    shipment.courierStatus = currentCourierStatus;
    shipment.shipmentStatus = newShipmentStatus;
    shipment.paymentStatus = newPaymentStatus;

    // Lifecycle Timestamps
    if (newShipmentStatus === 'Delivered' && !shipment.deliveredDate) shipment.deliveredDate = new Date();
    if (newPaymentStatus === 'Collected_Not_Paid' && !shipment.codCollectedAt) shipment.codCollectedAt = new Date();
    if (newPaymentStatus === 'Paid_and_Settled' && !shipment.codPaidAt) shipment.codPaidAt = new Date();
    if (newShipmentStatus === 'Returned' && !shipment.returnReceivedAt) shipment.returnReceivedAt = new Date();

    shipment.activityHistory.push(activityLog);
    await shipment.save();
}

/**
 * Sync ECOTRACK shipments using the global CourierSetting credentials.
 */
async function syncEcotrackShipments(ecotrackShipments) {
    let updatedCount = 0;
    const CHUNK_SIZE = 10;

    for (let i = 0; i < ecotrackShipments.length; i += CHUNK_SIZE) {
        const chunk = ecotrackShipments.slice(i, i + CHUNK_SIZE);

        await Promise.allSettled(chunk.map(async (shipment) => {
            try {
                const trackingResponse = await ecotrackRequest('GET', `/api/v1/tracking/${shipment.externalTrackingId}`);
                const currentCourierStatus = trackingResponse.status || trackingResponse.current_status;

                if (currentCourierStatus) {
                    const { newShipmentStatus, newPaymentStatus, activityLog } = mapEcotrackStatusToInternal(currentCourierStatus, shipment);
                    if (activityLog) {
                        await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, currentCourierStatus);
                        updatedCount++;
                    }
                }
            } catch (err) {
                logger.error({ err, trackingId: shipment.externalTrackingId }, '[SYNC] Failed to sync Ecotrack shipment');
            }
        }));

        if (i + CHUNK_SIZE < ecotrackShipments.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return updatedCount;
}

/**
 * Sync YALIDINE shipments grouped by courier (each has different credentials).
 */
async function syncYalidineShipments(yalidineShipments) {
    let updatedCount = 0;

    // Group shipments by tenant to find the right courier credentials
    // We need to look up the Courier doc to get apiId/apiToken
    const courierCache = new Map();
    const CHUNK_SIZE = 5; // Yalidine has stricter rate limits (5/sec)

    for (let i = 0; i < yalidineShipments.length; i += CHUNK_SIZE) {
        const chunk = yalidineShipments.slice(i, i + CHUNK_SIZE);

        await Promise.allSettled(chunk.map(async (shipment) => {
            try {
                // Find the courier doc for this shipment's tenant
                const cacheKey = shipment.tenant?.toString();
                let courier = courierCache.get(cacheKey);
                if (!courier) {
                    courier = await Courier.findOne({
                        tenant: shipment.tenant,
                        apiProvider: 'Yalidin',
                        integrationType: 'API',
                        deletedAt: null
                    });
                    if (courier) courierCache.set(cacheKey, courier);
                }

                if (!courier) {
                    logger.warn({ shipmentId: shipment._id, tenant: shipment.tenant }, '[SYNC] No Yalidine courier found for tenant');
                    return;
                }

                const adapter = new (require('../integrations/couriers/YalidineAdapter'))(courier);
                const { status: currentCourierStatus } = await adapter.getTrackingStatus(shipment.externalTrackingId);

                if (currentCourierStatus) {
                    const { newShipmentStatus, newPaymentStatus, activityLog } = YalidineAdapter.mapStatusToInternal(currentCourierStatus, shipment);
                    if (activityLog) {
                        await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, currentCourierStatus);
                        updatedCount++;
                    }
                }
            } catch (err) {
                logger.error({ err, trackingId: shipment.externalTrackingId }, '[SYNC] Failed to sync Yalidine shipment');
            }
        }));

        // Yalidine rate limit: 5 req/sec → 200ms delay between chunks
        if (i + CHUNK_SIZE < yalidineShipments.length) {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }

    return updatedCount;
}

/**
 * Fetches updates for all active shipments across all courier providers.
 */
const syncActiveShipments = async () => {
    try {
        logger.info('[SYNC] Starting Multi-Provider Shipment Sync');

        // Find all active shipments with tracking IDs
        const activeShipments = await Shipment.find({
            shipmentStatus: {
                $in: ['Validated', 'In Transit', 'Out for Delivery', 'Failed Attempt', 'Return Initiated']
            },
            externalTrackingId: { $exists: true, $ne: null }
        }).select('externalTrackingId internalOrderId internalOrder tenant shipmentStatus paymentStatus courierStatus courierProvider deliveredDate codCollectedAt codPaidAt returnReceivedAt activityHistory');

        if (activeShipments.length === 0) {
            logger.info('[SYNC] No active shipments to sync');
            return;
        }

        // Partition by provider
        const ecotrackShipments = [];
        const yalidineShipments = [];

        for (const s of activeShipments) {
            const provider = (s.courierProvider || 'ECOTRACK').toUpperCase();
            if (provider === 'YALIDIN') {
                yalidineShipments.push(s);
            } else {
                ecotrackShipments.push(s);
            }
        }

        let totalUpdated = 0;

        // Sync each provider
        if (ecotrackShipments.length > 0) {
            logger.info({ count: ecotrackShipments.length }, '[SYNC] Syncing Ecotrack shipments');
            totalUpdated += await syncEcotrackShipments(ecotrackShipments);
        }

        if (yalidineShipments.length > 0) {
            logger.info({ count: yalidineShipments.length }, '[SYNC] Syncing Yalidine shipments');
            totalUpdated += await syncYalidineShipments(yalidineShipments);
        }

        logger.info({ totalUpdated, ecotrack: ecotrackShipments.length, yalidine: yalidineShipments.length }, '[SYNC] Multi-Provider Sync Complete');
    } catch (globalError) {
        logger.error({ err: globalError }, '[SYNC] Critical Error during Tracking Sync');
    }
};

// Initialize the cron routines
const initCronJobs = () => {
    // Cron scheduling disabled per user request, manual syncing only via Control Center
    logger.info('[CRON] Dispatch Tracking Sync scheduling disabled. Awaiting manual triggers');
};

module.exports = {
    initCronJobs,
    syncActiveShipments,          // exported for manual triggering
    mapEcotrackStatusToInternal,  // exported for testing
};
