/**
 * YalidineAdapter — concrete CourierAdapter for the Yalidine logistics API.
 *
 * Yalidine API v1 (https://api.yalidine.com/v1)
 * Auth: X-API-ID + X-API-TOKEN headers (handled by yalidineRequest)
 * Rate limit: 5 req/sec (enforced in yalidineRequest)
 *
 * Unlike EcotrackAdapter (singleton), YalidineAdapter is instantiated per-request
 * because each courier has its own credentials (apiId + apiToken on the Courier doc).
 */

const CourierAdapter = require('./CourierAdapter');
const AppError = require('../../shared/errors/AppError');
const { yalidineRequest } = require('../../utils/yalidineRequest');

class YalidineAdapter extends CourierAdapter {
    /**
     * @param {object} courier - Courier document with apiId, apiToken
     */
    constructor(courier) {
        super();
        this.courier = courier;
    }

    /**
     * Maps internal shipment fields to Yalidine's parcel payload format.
     */
    toPayload(shipment) {
        if (!shipment.codAmount && shipment.codAmount !== 0) {
            throw AppError.validationFailed({ codAmount: 'COD amount is required for courier dispatch' });
        }
        return {
            order_id:           shipment.internalOrderId,
            firstname:          shipment.customerName,
            familyname:         '',
            contact_phone:      shipment.phone1,
            address:            shipment.address || '',
            to_commune_name:    shipment.commune,
            to_wilaya_name:     shipment.wilayaName,
            product_list:       shipment.productName || 'Mixed Items',
            price:              shipment.codAmount || 0,
            do_insurance:       false,
            declared_value:     0,
            height:             10,
            width:              10,
            length:             10,
            weight:             shipment.weight || 1,
            freeshipping:       false,
            is_stopdesk:        shipment.deliveryType === 1,
            stopdesk_id:        shipment.stopDeskId || null,
            has_exchange:       shipment.operationType === 2,
            product_to_collect: shipment.operationType === 2 ? (shipment.remark || '') : null,
        };
    }

    /**
     * Create a parcel on Yalidine.
     * Yalidine accepts an array of parcels; we send a single-item array.
     * @returns {{ trackingId: string }}
     */
    async createShipment(payload) {
        const response = await yalidineRequest('POST', '/parcels/', this.courier, [payload]);

        // Yalidine returns { data: [{ tracking: "...", ... }] } or similar
        const parcel = Array.isArray(response?.data) ? response.data[0]
                     : Array.isArray(response) ? response[0]
                     : response;

        const trackingId = parcel?.tracking || parcel?.tracking_id;
        if (!trackingId) {
            // Check for validation errors
            const errorMsg = parcel?.error || parcel?.message || JSON.stringify(response);
            throw new Error(`Yalidine did not return a tracking ID: ${errorMsg}`);
        }

        return { trackingId };
    }

    /**
     * Yalidine does not have a separate validate/pickup endpoint.
     * Parcels are automatically scheduled for pickup after creation.
     * This is a no-op for compatibility.
     */
    async validateShipment(/* trackingId, options */) {
        // No-op — Yalidine auto-schedules pickup
    }

    /**
     * Cancel/delete a parcel on Yalidine.
     * Only parcels not yet picked up can be deleted.
     * @param {string} trackingId
     */
    async cancelShipment(trackingId) {
        // Yalidine uses the parcel ID (which is the tracking) for deletion
        await yalidineRequest('DELETE', `/parcels/${trackingId}`, this.courier);
    }

    /**
     * Yalidine does not have a dedicated return-request endpoint.
     * Returns are handled operationally by the courier.
     * Log the attempt but do not fail.
     */
    async requestReturn(/* trackingId */) {
        // No dedicated API endpoint — returns are managed operationally
        // The shipment status will be updated via tracker sync when Yalidine marks it as returned
    }

    /**
     * Yalidine provides label URLs in the parcel response.
     * Construct the standard label URL.
     * @param {string} trackingId
     * @returns {string}
     */
    async getLabelUrl(trackingId) {
        // Fetch parcel details to get label
        const response = await yalidineRequest('GET', `/parcels/?tracking=${trackingId}`, this.courier);
        const parcel = Array.isArray(response?.data) ? response.data[0] : response;
        return parcel?.label || parcel?.label_url || `https://api.yalidine.com/v1/label/${trackingId}`;
    }

    /**
     * Fetch current tracking status from Yalidine.
     * @param {string} trackingId
     * @returns {{ status: string, rawData: object }}
     */
    async getTrackingStatus(trackingId) {
        const response = await yalidineRequest('GET', `/parcels/?tracking=${trackingId}`, this.courier);
        const parcel = Array.isArray(response?.data) ? response.data[0] : response;
        return {
            status: parcel?.state_display || parcel?.last_status || null,
            rawData: parcel,
        };
    }
}

/**
 * Yalidine status → internal shipment/payment status mapping.
 *
 * Yalidine raw statuses (French):
 *   En préparation, Lancé en expédition, En ramassage, Ramassé,
 *   En transfert, Reçu à Wilaya, En distribution, Livré,
 *   Echec livraison, En attente du client, Tentative échouée,
 *   Retour vers centre, Retour transfert, Retourné au centre,
 *   Retour reçu, Retourné, Echange
 */
YalidineAdapter.mapStatusToInternal = (courierStatus, currentShipment) => {
    let newShipmentStatus = currentShipment.shipmentStatus;
    let newPaymentStatus = currentShipment.paymentStatus;
    let activityLog = null;

    const lower = (courierStatus || '').toLowerCase();

    // 1. Preparing / Pickup
    if (lower.includes('en préparation') || lower.includes('en preparation')) {
        newShipmentStatus = 'Created in Courier';
    }
    // 2. Pickup phase
    else if (lower.includes('en ramassage') || lower.includes('ramassé') || lower.includes('ramasse')) {
        newShipmentStatus = 'Validated';
    }
    // 3. In Transit
    else if (
        lower.includes('en transfert') ||
        lower.includes('reçu à wilaya') || lower.includes('recu a wilaya') ||
        lower.includes('lancé en expédition') || lower.includes('lance en expedition')
    ) {
        newShipmentStatus = 'In Transit';
    }
    // 4. Out for Delivery
    else if (lower.includes('en distribution')) {
        newShipmentStatus = 'Out for Delivery';
    }
    // 5. Failed Attempt
    else if (
        lower.includes('echec livraison') || lower.includes('échec livraison') ||
        lower.includes('tentative échouée') || lower.includes('tentative echouee') ||
        lower.includes('en attente du client')
    ) {
        newShipmentStatus = 'Failed Attempt';
    }
    // 6. Delivered
    else if (lower.includes('livré') || lower.includes('livre')) {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }
    // 7. Returns
    else if (lower.includes('retour vers centre') || lower.includes('retour transfert')) {
        newShipmentStatus = 'Return Initiated';
    }
    else if (
        lower.includes('retourné au centre') || lower.includes('retourne au centre') ||
        lower.includes('retour reçu') || lower.includes('retour recu') ||
        lower.includes('retourné') || lower === 'retourne'
    ) {
        newShipmentStatus = 'Returned';
    }
    // 8. Exchange (treat as delivery variant)
    else if (lower.includes('echange') || lower.includes('échange')) {
        newShipmentStatus = 'Delivered';
    }

    if (newShipmentStatus !== currentShipment.shipmentStatus || lower !== (currentShipment.courierStatus || '').toLowerCase()) {
        activityLog = {
            status: newShipmentStatus,
            remarks: `Yalidine Status: ${courierStatus}`,
        };
    }

    return { newShipmentStatus, newPaymentStatus, activityLog };
};

module.exports = YalidineAdapter;
