const cron = require('node-cron');
const Shipment = require('../models/Shipment');
const { ecotrackRequest } = require('../utils/ecotrackRequest');
const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');

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
        console.log('[CRON] Starting ECOTRACK Shipment Sync...');

        // Find shipments that are alive and moving
        const activeShipments = await Shipment.find({
            shipmentStatus: {
                $in: ['Validated', 'In Transit', 'Out for Delivery', 'Failed Attempt', 'Return Initiated']
            },
            externalTrackingId: { $exists: true, $ne: null }
        });

        if (activeShipments.length === 0) {
            console.log('[CRON] No active shipments to sync.');
            return;
        }

        let updatedCount = 0;

        for (const shipment of activeShipments) {
            try {
                // Adjust route based on specific Ecotrack API endpoint for tracking
                const trackingResponse = await ecotrackRequest('GET', `/api/v1/tracking/${shipment.externalTrackingId}`);

                // Assuming trackingResponse contains a 'status' or 'current_status' text
                const currentCourierStatus = trackingResponse.status || trackingResponse.current_status;

                if (currentCourierStatus) {
                    const { newShipmentStatus, newPaymentStatus, activityLog } = mapCourierStatusToInternal(currentCourierStatus, shipment);

                    if (activityLog) {
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

                        // Mirror status back to Internal Order if appropriate
                        if (newShipmentStatus === 'Delivered' || newShipmentStatus === 'Returned') {
                            const internalModel = shipment.internalOrderId && shipment.internalOrderId.startsWith('CUST-') ? CustomOrder : Order;

                            // Find the order using the correct reference field
                            const order = await internalModel.findById(shipment.internalOrderId || shipment.internalOrder);

                            if (order) {
                                // 1. Map to exact correct ERP statuses, not generic 'Completed' which breaks Finances
                                if (newShipmentStatus === 'Delivered') {
                                    order.status = 'Delivered';
                                    if (!order.deliveryStatus) order.deliveryStatus = {};
                                    order.deliveryStatus.deliveredAt = new Date();
                                } else if (newShipmentStatus === 'Returned') {
                                    order.status = 'Returned';
                                }

                                // 2. Map Payment COD statuses properly to Order financials
                                if (newPaymentStatus === 'Paid_and_Settled') {
                                    order.status = 'Paid';
                                    order.paymentStatus = 'Paid';
                                }

                                await order.save();
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`[CRON] Failed to sync shipment ${shipment.externalTrackingId}:`, err.message);
                // Continue to next shipment even if one fails
            }
        }

        console.log(`[CRON] ECOTRACK Sync Complete. Updated ${updatedCount} shipments.`);
    } catch (globalError) {
        console.error('[CRON] Critical Error during Tracking Sync:', globalError.message);
    }
};

// Initialize the cron routines
const initCronJobs = () => {
    // Cron scheduling disabled per user request, manual syncing only via Control Center
    console.log(`[CRON] Dispatch Tracking Sync scheduling disabled. Awaiting manual triggers.`);
};

module.exports = {
    initCronJobs,
    syncActiveShipments // exported for manual triggering if needed
};
