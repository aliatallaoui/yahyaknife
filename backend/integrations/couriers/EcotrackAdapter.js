/**
 * EcotrackAdapter — concrete CourierAdapter for the ECOTRACK logistics API.
 *
 * All ECOTRACK-specific payload mapping and API calls are isolated here.
 * Replace this file (or add a new adapter) to support another courier without
 * touching any business logic.
 *
 * Ecotrack API reference:
 *   Base: {apiUrl}/api/v1/...
 *   Auth: Bearer token
 *   Most endpoints use query parameters (not JSON body), except create/batch.
 */

const CourierAdapter = require('./CourierAdapter');
const { ecotrackRequest } = require('../../utils/ecotrackRequest');

class EcotrackAdapter extends CourierAdapter {
    /**
     * Maps internal shipment fields to ECOTRACK's required payload format.
     */
    toPayload(shipment) {
        return {
            reference:    shipment.internalOrderId,
            nom_client:   shipment.customerName,
            telephone:    shipment.phone1,
            telephone_2:  shipment.phone2 || '',
            adresse:      shipment.address,
            code_postal:  shipment.postalCode || '',
            commune:      shipment.commune,
            code_wilaya:  shipment.wilayaCode,
            montant:      shipment.codAmount,
            remarque:     shipment.remark || '',
            produit:      shipment.productName,
            quantite:     shipment.quantity || 1,
            type:         shipment.operationType || 1,        // 1 = delivery
            stop_desk:    shipment.deliveryType === 1 ? 1 : 0,// 0 = home, 1 = stop-desk
            poids:        shipment.weight || 1,
            fragile:      shipment.fragileFlag ? 1 : 0,
            gps_link:     shipment.gpsLink || '',
            boutique:     shipment.boutique || 'My Store'
        };
    }

    /**
     * Create a shipment on ECOTRACK.
     * POST /api/v1/create/order (JSON body)
     * Response: { success: true, tracking: "ECXXXXXX" }
     * @returns {{ trackingId: string }}
     */
    async createShipment(payload) {
        const response = await ecotrackRequest('POST', '/api/v1/create/order', payload);
        const trackingId = response?.tracking || response?.tracking_id;
        if (!trackingId) {
            throw new Error('ECOTRACK did not return a tracking ID');
        }
        return { trackingId };
    }

    /**
     * Validate / request pickup.
     * POST /api/v1/valid/order?tracking=X&ask_collection=Y
     * @param {string} trackingId
     * @param {{ askCollection?: number }} [options]
     */
    async validateShipment(trackingId, { askCollection = 1 } = {}) {
        await ecotrackRequest('POST', `/api/v1/valid/order?tracking=${trackingId}&ask_collection=${askCollection}`);
    }

    /**
     * Cancel/delete a shipment.
     * DELETE /api/v1/delete/order?tracking=X
     * @param {string} trackingId
     */
    async cancelShipment(trackingId) {
        await ecotrackRequest('DELETE', `/api/v1/delete/order?tracking=${encodeURIComponent(trackingId)}`);
    }

    /**
     * Request a return for an in-transit shipment.
     * POST /api/v1/ask/for/order/return?tracking=X
     * @param {string} trackingId
     */
    async requestReturn(trackingId) {
        await ecotrackRequest('POST', `/api/v1/ask/for/order/return?tracking=${encodeURIComponent(trackingId)}`);
    }

    /**
     * Get the label URL for a shipment.
     * GET /api/v1/get/order/label?tracking=X (returns PDF directly with Bearer auth)
     *
     * Since the Ecotrack label endpoint returns a PDF binary (requires auth),
     * we construct the full URL. The dispatch controller proxies the download.
     * @param {string} trackingId
     * @returns {string} Full URL to the label PDF
     */
    async getLabelUrl(trackingId) {
        // Build the full authenticated URL — the controller will proxy or
        // redirect as needed since Ecotrack requires Bearer auth for labels
        const CourierSetting = require('../../models/CourierSetting');
        const settings = await CourierSetting.findOne({ providerName: 'ECOTRACK' }).lean();
        const baseUrl = settings?.apiUrl || 'https://api.ecotrack.dz';
        return `${baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(trackingId)}`;
    }

    /**
     * Fetch current tracking status from ECOTRACK (single tracking).
     * GET /api/v1/get/tracking/info?tracking=X
     * @param {string} trackingId
     * @returns {{ status: string, rawData: object }}
     */
    async getTrackingStatus(trackingId) {
        const response = await ecotrackRequest('GET', `/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingId)}`);
        return {
            status: response?.status || response?.current_status || null,
            rawData: response,
        };
    }

    /**
     * Fetch statuses for multiple trackings in bulk (up to 100).
     * GET /api/v1/get/orders/status?trackings=X,Y,Z&status=all
     * Response: { data: { "TRACKING": { status, order_id, activity: [...] } } }
     * @param {string[]} trackingIds
     * @returns {object} Map of trackingId → { status, order_id, activity }
     */
    async getBulkStatus(trackingIds) {
        const trackingsParam = trackingIds.join(',');
        const response = await ecotrackRequest('GET', `/api/v1/get/orders/status?trackings=${encodeURIComponent(trackingsParam)}&status=all`);
        return response?.data || {};
    }
}

/**
 * Ecotrack status → internal shipment/payment status mapping.
 *
 * Handles TWO status taxonomies:
 *
 * Order-level statuses (French slugs from get/orders, get/orders/status):
 *   prete_a_expedier, en_ramassage, en_preparation_stock, vers_hub, en_hub,
 *   vers_wilaya, en_preparation, en_livraison, suspendu, livre_non_encaisse,
 *   encaisse_non_paye, paiements_prets, paye_et_archive,
 *   retour_chez_livreur, retour_transit_entrepot, retour_en_traitement,
 *   retour_recu, retour_archive, annule
 *
 * Activity-level statuses (English from get/tracking/info):
 *   order_information_received_by_carrier, picked, accepted_by_carrier,
 *   dispatched_to_driver, attempt_delivery, return_asked, return_in_transit,
 *   Return_received, livred, encaissed, payed, notification_on_order
 */
EcotrackAdapter.mapStatusToInternal = (courierStatus, currentShipment) => {
    let newShipmentStatus = currentShipment.shipmentStatus;
    let newPaymentStatus = currentShipment.paymentStatus;
    let activityLog = null;

    const lower = (courierStatus || '').toLowerCase();

    // ── Order-level statuses (French slugs) ──────────────────────────────

    // 1. Ready / Awaiting pickup
    if (lower === 'prete_a_expedier' || lower === 'en_ramassage') {
        newShipmentStatus = 'Validated';
    }
    // 2. In transit phases
    else if (
        lower === 'en_preparation_stock' || lower === 'vers_hub' ||
        lower === 'en_hub' || lower === 'vers_wilaya' || lower === 'en_preparation'
    ) {
        newShipmentStatus = 'In Transit';
    }
    // 3. Out for delivery
    else if (lower === 'en_livraison') {
        newShipmentStatus = 'Out for Delivery';
    }
    // 4. Suspended (treat as failed attempt)
    else if (lower === 'suspendu') {
        newShipmentStatus = 'Failed Attempt';
    }
    // 5. Delivered but COD not collected
    else if (lower === 'livre_non_encaisse') {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }
    // 6. COD collected but not yet paid to merchant
    else if (lower === 'encaisse_non_paye' || lower === 'paiements_prets') {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Collected_Not_Paid';
    }
    // 7. Paid and archived
    else if (lower === 'paye_et_archive') {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Paid_and_Settled';
    }
    // 8. Return phases
    else if (lower === 'retour_chez_livreur' || lower === 'retour_transit_entrepot' || lower === 'retour_en_traitement') {
        newShipmentStatus = 'Return Initiated';
    }
    else if (lower === 'retour_recu' || lower === 'retour_archive') {
        newShipmentStatus = 'Returned';
    }
    // 9. Cancelled
    else if (lower === 'annule') {
        newShipmentStatus = 'Returned';
    }

    // ── Activity-level statuses (English from tracking/info) ─────────────

    // Pickup / carrier received
    else if (lower.includes('order_information_received') || lower.includes('accepted_by_carrier') || lower.includes('picked')) {
        newShipmentStatus = 'In Transit';
    }
    // Out for delivery
    else if (lower.includes('dispatched_to_driver') || lower.includes('out_for_delivery')) {
        newShipmentStatus = 'Out for Delivery';
    }
    // Failed attempt
    else if (lower.includes('attempt_delivery') || lower.includes('pas_de_reponse')) {
        newShipmentStatus = 'Failed Attempt';
    }
    // Delivered
    else if (lower.includes('livred') || lower.includes('delivered')) {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }
    // COD collected
    else if (lower.includes('encaissed') || lower.includes('collected')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Collected_Not_Paid';
    }
    // Paid / settled
    else if (lower.includes('payed') || lower.includes('settled')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Paid_and_Settled';
    }
    // Return requested
    else if (lower.includes('return_asked') || lower.includes('retour_demandé') || lower.includes('retour_demande')) {
        newShipmentStatus = 'Return Initiated';
    }
    // Return in transit
    else if (lower.includes('return_in_transit')) {
        newShipmentStatus = 'Return Initiated';
    }
    // Return received
    else if (lower.includes('return_received') || lower.includes('retour_recu')) {
        newShipmentStatus = 'Returned';
    }

    if (newShipmentStatus !== currentShipment.shipmentStatus || lower !== (currentShipment.courierStatus || '').toLowerCase()) {
        activityLog = {
            status: newShipmentStatus,
            remarks: `Ecotrack Status: ${courierStatus}`,
        };
    }

    return { newShipmentStatus, newPaymentStatus, activityLog };
};

const ecotrackSingleton = new EcotrackAdapter();

// Expose mapStatusToInternal on the singleton for convenience
ecotrackSingleton.mapStatusToInternal = EcotrackAdapter.mapStatusToInternal;

module.exports = ecotrackSingleton;
