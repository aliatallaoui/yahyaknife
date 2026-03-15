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

    // Group shipments by tenant — each tenant has its own CourierSetting credentials
    const byTenant = new Map();
    for (const s of ecotrackShipments) {
        const tid = s.tenant?.toString();
        if (!tid) continue;
        if (!byTenant.has(tid)) byTenant.set(tid, []);
        byTenant.get(tid).push(s);
    }

    for (const [tenantId, tenantShipments] of byTenant) {
        for (let i = 0; i < tenantShipments.length; i += BULK_SIZE) {
            const chunk = tenantShipments.slice(i, i + BULK_SIZE);

            try {
                // Build tracking → shipment lookup
                const shipmentMap = new Map();
                for (const s of chunk) {
                    shipmentMap.set(s.externalTrackingId, s);
                }

                // Bulk status fetch — single API call for up to 100 trackings
                const bulkData = await EcotrackAdapter.getBulkStatus(
                    chunk.map(s => s.externalTrackingId),
                    tenantId
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
                logger.error({ err, chunkSize: chunk.length, tenantId }, '[SYNC] Failed bulk Ecotrack status fetch');

                // Fallback: try individual tracking for this chunk
                for (const shipment of chunk) {
                    try {
                        const { status: currentCourierStatus } = await EcotrackAdapter.getTrackingStatus(shipment.externalTrackingId, tenantId);
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

            if (i + BULK_SIZE < tenantShipments.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    return updatedCount;
}

/**
 * Sync YALIDINE shipments using bulk status endpoint.
 * Groups by tenant (each has different courier credentials),
 * then fetches up to 100 tracking IDs per API call via getBulkStatus.
 */
async function syncYalidineShipments(yalidineShipments) {
    let updatedCount = 0;

    // Group shipments by tenant
    const byTenant = new Map();
    for (const s of yalidineShipments) {
        const tid = s.tenant?.toString();
        if (!byTenant.has(tid)) byTenant.set(tid, []);
        byTenant.get(tid).push(s);
    }

    for (const [tenantId, shipments] of byTenant) {
        // Find courier credentials for this tenant
        const courier = await Courier.findOne({
            tenant: tenantId,
            apiProvider: 'Yalidin',
            integrationType: 'API',
            deletedAt: null
        }).select('+apiToken +apiId');

        if (!courier) {
            logger.warn({ tenant: tenantId, count: shipments.length }, '[SYNC] No Yalidine courier found for tenant');
            continue;
        }

        const adapter = new (require('../integrations/couriers/YalidineAdapter'))(courier);
        const BATCH_SIZE = 100; // Yalidine supports up to 1000, but we stay conservative

        // Build lookup map: trackingId → shipment
        const shipmentMap = new Map();
        for (const s of shipments) {
            shipmentMap.set(s.externalTrackingId, s);
        }

        const allTrackingIds = [...shipmentMap.keys()];

        for (let i = 0; i < allTrackingIds.length; i += BATCH_SIZE) {
            const batch = allTrackingIds.slice(i, i + BATCH_SIZE);

            try {
                const results = await adapter.getBulkStatus(batch);

                for (const parcel of results) {
                    const tracking = parcel.tracking;
                    const shipment = shipmentMap.get(tracking);
                    if (!shipment || !parcel.last_status) continue;

                    const { newShipmentStatus, newPaymentStatus, activityLog } =
                        YalidineAdapter.mapStatusToInternal(parcel.last_status, shipment, {
                            paymentStatus: parcel.payment_status,
                        });

                    if (activityLog) {
                        await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, parcel.last_status);
                        updatedCount++;
                    }
                }
            } catch (err) {
                logger.error({ err, tenant: tenantId, batchSize: batch.length }, '[SYNC] Yalidine bulk status fetch failed, falling back to individual');

                // Fallback: fetch individually
                for (const trackingId of batch) {
                    try {
                        const { status } = await adapter.getTrackingStatus(trackingId);
                        const shipment = shipmentMap.get(trackingId);
                        if (!shipment || !status) continue;

                        const { newShipmentStatus, newPaymentStatus, activityLog } =
                            YalidineAdapter.mapStatusToInternal(status, shipment);

                        if (activityLog) {
                            await applyStatusUpdate(shipment, newShipmentStatus, newPaymentStatus, activityLog, status);
                            updatedCount++;
                        }
                    } catch (innerErr) {
                        logger.error({ err: innerErr, trackingId }, '[SYNC] Failed to sync Yalidine shipment individually');
                    }
                }
            }

            // Respect rate limits between batches
            if (i + BATCH_SIZE < allTrackingIds.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
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
            externalTrackingId: { $exists: true, $ne: null },
            deletedAt: null
        }).select('externalTrackingId internalOrderId internalOrder tenant shipmentStatus paymentStatus courierStatus courierProvider deliveredDate codCollectedAt codPaidAt returnReceivedAt activityHistory').limit(10000);

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
