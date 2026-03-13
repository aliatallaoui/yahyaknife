const logger = require('../shared/logger');
const cron = require('node-cron');
const Shipment = require('../models/Shipment');
const { ecotrackRequest } = require('../utils/ecotrackRequest');
const Order = require('../models/Order');
const OrderService = require('../domains/orders/order.service');

/**
 * Maps raw Ecotrack statuses to our Internal ERP Shipment status paradigm
 * and COD payment states. 
 */
const mapCourierStatusToInternal = (courierStatus, currentShipment) => {
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
 * Fetches updates for active shipments from ECOTRACK
 * Runs every 10 minutes (* /10 * * * *)
 */
const syncActiveShipments = async () => {
    try {
        logger.info('[CRON] Starting ECOTRACK Shipment Sync');

        // Find shipments that are alive and moving
        const activeShipments = await Shipment.find({
            shipmentStatus: {
                $in: ['Validated', 'In Transit', 'Out for Delivery', 'Failed Attempt', 'Return Initiated']
            },
            externalTrackingId: { $exists: true, $ne: null }
        }).select('externalTrackingId internalOrderId internalOrder tenant shipmentStatus paymentStatus courierStatus deliveredDate codCollectedAt codPaidAt returnReceivedAt activityHistory');

        if (activeShipments.length === 0) {
            logger.info('[CRON] No active shipments to sync');
            return;
        }

        let updatedCount = 0;

        // Process in chunks to prevent rate-limiting but speed up sequential blocking
        const CHUNK_SIZE = 10;
        for (let i = 0; i < activeShipments.length; i += CHUNK_SIZE) {
            const chunk = activeShipments.slice(i, i + CHUNK_SIZE);

            await Promise.allSettled(chunk.map(async (shipment) => {
                try {
                    // Adjust route based on specific Ecotrack API endpoint for tracking
                    const trackingResponse = await ecotrackRequest('GET', `/api/v1/tracking/${shipment.externalTrackingId}`);

                    // Assuming trackingResponse contains a 'status' or 'current_status' text
                    const currentCourierStatus = trackingResponse.status || trackingResponse.current_status;

                    if (currentCourierStatus) {
                        const { newShipmentStatus, newPaymentStatus, activityLog } = mapCourierStatusToInternal(currentCourierStatus, shipment);

                        if (activityLog) {
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
                            updatedCount++;
                        }
                    }
                } catch (err) {
                    logger.error({ err, trackingId: shipment.externalTrackingId }, '[CRON] Failed to sync shipment');
                }
            }));
            
            // Brief pause between chunks to respect hypothetical courier rate limits
            if (i + CHUNK_SIZE < activeShipments.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        logger.info({ updatedCount }, '[CRON] ECOTRACK Sync Complete');
    } catch (globalError) {
        logger.error({ err: globalError }, '[CRON] Critical Error during Tracking Sync');
    }
};

// Initialize the cron routines
const initCronJobs = () => {
    // Cron scheduling disabled per user request, manual syncing only via Control Center
    logger.info('[CRON] Dispatch Tracking Sync scheduling disabled. Awaiting manual triggers');
};

module.exports = {
    initCronJobs,
    syncActiveShipments // exported for manual triggering if needed
};
