const logger = require('../shared/logger');
const Shipment = require('../models/Shipment');
const Courier = require('../models/Courier');
const OrderService = require('../domains/orders/order.service');
const YalidineAdapter = require('../integrations/couriers/YalidineAdapter');
const EcotrackAdapter = require('../integrations/couriers/EcotrackAdapter');

// Use the canonical status mapper from EcotrackAdapter
const mapEcotrackStatusToInternal = EcotrackAdapter.mapStatusToInternal;

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
 * Sync ECOTRACK shipments using the bulk status endpoint.
 * GET /api/v1/get/orders/status?trackings=X,Y,Z&status=all (up to 100 per call)
 */
async function syncEcotrackShipments(ecotrackShipments) {
    let updatedCount = 0;
    const BULK_SIZE = 100; // Ecotrack supports up to 100 trackings per bulk call

    for (let i = 0; i < ecotrackShipments.length; i += BULK_SIZE) {
        const chunk = ecotrackShipments.slice(i, i + BULK_SIZE);

        try {
            // Build tracking → shipment lookup
            const shipmentMap = new Map();
            for (const s of chunk) {
                shipmentMap.set(s.externalTrackingId, s);
            }

            // Bulk status fetch — single API call for up to 100 trackings
            const bulkData = await EcotrackAdapter.getBulkStatus(
                chunk.map(s => s.externalTrackingId)
            );

            // Process each result
            for (const [trackingId, info] of Object.entries(bulkData)) {
                const shipment = shipmentMap.get(trackingId);
                if (!shipment || !info?.status) continue;

                try {
                    const { newShipmentStatus, newPaymentStatus, activityLog } = mapEcotrackStatusToInternal(info.status, shipment);
                    if (activityLog) {
                        await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, info.status);
                        updatedCount++;
                    }
                } catch (err) {
                    logger.error({ err, trackingId }, '[SYNC] Failed to apply Ecotrack status update');
                }
            }
        } catch (err) {
            logger.error({ err, chunkSize: chunk.length }, '[SYNC] Failed bulk Ecotrack status fetch');

            // Fallback: try individual tracking for this chunk
            for (const shipment of chunk) {
                try {
                    const { status: currentCourierStatus } = await EcotrackAdapter.getTrackingStatus(shipment.externalTrackingId);
                    if (currentCourierStatus) {
                        const { newShipmentStatus, newPaymentStatus, activityLog } = mapEcotrackStatusToInternal(currentCourierStatus, shipment);
                        if (activityLog) {
                            await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, currentCourierStatus);
                            updatedCount++;
                        }
                    }
                } catch (innerErr) {
                    logger.error({ err: innerErr, trackingId: shipment.externalTrackingId }, '[SYNC] Failed individual Ecotrack sync');
                }
            }
        }

        if (i + BULK_SIZE < ecotrackShipments.length) {
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
