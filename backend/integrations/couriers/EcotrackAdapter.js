/**
 * EcotrackAdapter — concrete CourierAdapter for the ECOTRACK logistics API.
 *
 * Supports two modes:
 *   1. Per-courier (new EcotrackAdapter(courier)) — uses Courier model credentials directly.
 *      Used by dispatch flow where each courier has its own apiBaseUrl + apiToken.
 *   2. Singleton (require('./EcotrackAdapter')) — uses CourierSetting via ecotrackRequest.
 *      Used by tracker sync and other background operations.
 *
 * Ecotrack API reference:
 *   Base: {apiUrl}/api/v1/...
 *   Auth: Bearer token
 *   Most endpoints use query parameters (not JSON body), except create/batch.
 */

const axios = require('axios');
const CourierAdapter = require('./CourierAdapter');
const { ecotrackRequest } = require('../../utils/ecotrackRequest');
const logger = require('../../shared/logger');

class EcotrackAdapter extends CourierAdapter {
    /**
     * @param {object} [courier] - Optional Courier document with apiBaseUrl, apiToken, authType.
     *                             When provided, uses courier credentials directly.
     *                             When omitted, falls back to ecotrackRequest (CourierSetting).
     */
    constructor(courier) {
        super();
        this.courier = courier || null;
    }

    /**
     * Make a direct API call using the Courier model's credentials.
     * Bypasses CourierSetting/ecotrackRequest entirely.
     */
    async _directRequest(method, endpoint, data = null) {
        const courier = this.courier;
        if (!courier || !courier.apiBaseUrl || !courier.apiToken) {
            throw new Error('Courier API credentials are not configured. Please go to Courier Settings and add your API token and base URL.');
        }

        const baseUrl = courier.apiBaseUrl.replace(/\/+$/, '');
        const headers = courier.authType === 'API Key'
            ? { 'x-api-key': courier.apiToken, 'Content-Type': 'application/json', Accept: 'application/json' }
            : { Authorization: `Bearer ${courier.apiToken}`, 'Content-Type': 'application/json', Accept: 'application/json' };

        const config = { method, url: `${baseUrl}${endpoint}`, headers, timeout: 15000 };
        if (data) config.data = data;

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error({ method, endpoint, responseData: error.response?.data }, 'ECOTRACK Direct API Error');
            throw error;
        }
    }

    /**
     * Route to direct or CourierSetting-based request depending on adapter mode.
     */
    async _request(method, endpoint, data = null, tenantId = null) {
        if (this.courier) {
            return this._directRequest(method, endpoint, data);
        }
        return ecotrackRequest(method, endpoint, data, tenantId);
    }

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
     * @param {object} payload
     * @param {string|ObjectId} [tenantId]
     * @returns {{ trackingId: string }}
     */
    async createShipment(payload, tenantId) {
        const response = await this._request('POST', '/api/v1/create/order', payload, tenantId);
        const trackingId = response?.tracking || response?.tracking_id;
        if (!trackingId) {
            throw new Error('Courier accepted the request but did not return a tracking ID. Please contact your courier provider.');
        }
        return { trackingId };
    }

    /**
     * Validate / request pickup.
     * POST /api/v1/valid/order?tracking=X&ask_collection=Y
     */
    async validateShipment(trackingId, { askCollection = 1, tenantId } = {}) {
        await this._request('POST', `/api/v1/valid/order?tracking=${trackingId}&ask_collection=${askCollection}`, null, tenantId);
    }

    /**
     * Cancel/delete a shipment.
     * DELETE /api/v1/delete/order?tracking=X
     */
    async cancelShipment(trackingId, tenantId) {
        await this._request('DELETE', `/api/v1/delete/order?tracking=${encodeURIComponent(trackingId)}`, null, tenantId);
    }

    /**
     * Request a return for an in-transit shipment.
     * POST /api/v1/ask/for/order/return?tracking=X
     */
    async requestReturn(trackingId, tenantId) {
        await this._request('POST', `/api/v1/ask/for/order/return?tracking=${encodeURIComponent(trackingId)}`, null, tenantId);
    }

    /**
     * Get the label URL for a shipment.
     * GET /api/v1/get/order/label?tracking=X (returns PDF directly with Bearer auth)
     */
    async getLabelUrl(trackingId, tenantId) {
        if (this.courier) {
            const baseUrl = this.courier.apiBaseUrl.replace(/\/+$/, '');
            return `${baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(trackingId)}`;
        }
        const CourierSetting = require('../../models/CourierSetting');
        const query = { providerName: 'ECOTRACK' };
        if (tenantId) query.tenant = tenantId;
        const settings = await CourierSetting.findOne(query).lean();
        const baseUrl = settings?.apiUrl || 'https://api.ecotrack.dz';
        return `${baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(trackingId)}`;
    }

    /**
     * Fetch delivery fees for all wilayas from ECOTRACK.
     * GET /api/v1/get/fees
     */
    async fetchFees(tenantId) {
        return this._request('GET', '/api/v1/get/fees', null, tenantId);
    }

    /**
     * Fetch current tracking status from ECOTRACK (single tracking).
     * GET /api/v1/get/tracking/info?tracking=X
     */
    async getTrackingStatus(trackingId, tenantId) {
        const response = await this._request('GET', `/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingId)}`, null, tenantId);
        return {
            status: response?.status || response?.current_status || null,
            rawData: response,
        };
    }

    /**
     * Fetch statuses for multiple trackings in bulk (up to 100).
     * GET /api/v1/get/orders/status?trackings=X,Y,Z&status=all
     */
    async getBulkStatus(trackingIds, tenantId) {
        const trackingsParam = trackingIds.join(',');
        const response = await this._request('GET', `/api/v1/get/orders/status?trackings=${encodeURIComponent(trackingsParam)}&status=all`, null, tenantId);
        return response?.data || {};
    }
}

/**
 * Ecotrack status → internal shipment/payment status mapping.
 */
EcotrackAdapter.mapStatusToInternal = (courierStatus, currentShipment) => {
    let newShipmentStatus = currentShipment.shipmentStatus;
    let newPaymentStatus = currentShipment.paymentStatus;
    let activityLog = null;

    const lower = (courierStatus || '').toLowerCase();

    if (lower === 'prete_a_expedier' || lower === 'en_ramassage') {
        newShipmentStatus = 'Validated';
    } else if (
        lower === 'en_preparation_stock' || lower === 'vers_hub' ||
        lower === 'en_hub' || lower === 'vers_wilaya' || lower === 'en_preparation'
    ) {
        newShipmentStatus = 'In Transit';
    } else if (lower === 'en_livraison') {
        newShipmentStatus = 'Out for Delivery';
    } else if (lower === 'suspendu') {
        newShipmentStatus = 'Failed Attempt';
    } else if (lower === 'livre_non_encaisse') {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    } else if (lower === 'encaisse_non_paye' || lower === 'paiements_prets') {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Collected_Not_Paid';
    } else if (lower === 'paye_et_archive') {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Paid_and_Settled';
    } else if (lower === 'retour_chez_livreur' || lower === 'retour_transit_entrepot' || lower === 'retour_en_traitement') {
        newShipmentStatus = 'Return Initiated';
    } else if (lower === 'retour_recu' || lower === 'retour_archive') {
        newShipmentStatus = 'Returned';
    } else if (lower === 'annule') {
        newShipmentStatus = 'Returned';
    } else if (lower.includes('order_information_received') || lower.includes('accepted_by_carrier') || lower.includes('picked')) {
        newShipmentStatus = 'In Transit';
    } else if (lower.includes('dispatched_to_driver') || lower.includes('out_for_delivery')) {
        newShipmentStatus = 'Out for Delivery';
    } else if (lower.includes('attempt_delivery') || lower.includes('pas_de_reponse')) {
        newShipmentStatus = 'Failed Attempt';
    } else if (lower.includes('livred') || lower.includes('delivered')) {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    } else if (lower.includes('encaissed') || lower.includes('collected')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Collected_Not_Paid';
    } else if (lower.includes('payed') || lower.includes('settled')) {
        newShipmentStatus = 'Delivered';
        newPaymentStatus = 'Paid_and_Settled';
    } else if (lower.includes('return_asked') || lower.includes('retour_demandé') || lower.includes('retour_demande')) {
        newShipmentStatus = 'Return Initiated';
    } else if (lower.includes('return_in_transit')) {
        newShipmentStatus = 'Return Initiated';
    } else if (lower.includes('return_received') || lower.includes('retour_recu')) {
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

// Default singleton (no courier) — for tracker sync and backward compatibility
const ecotrackSingleton = new EcotrackAdapter();
ecotrackSingleton.mapStatusToInternal = EcotrackAdapter.mapStatusToInternal;

module.exports = ecotrackSingleton;
module.exports.EcotrackAdapter = EcotrackAdapter;
