/**
 * YalidineAdapter — concrete CourierAdapter for the Yalidine logistics API.
 *
 * Yalidine API v1 (https://api.yalidine.app/v1)
 * Auth: X-API-ID + X-API-TOKEN headers (handled by yalidineRequest)
 * Rate limits: 5/sec, 50/min, 1000/hour, 10000/day
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
     *
     * Required by Yalidine API:
     *   order_id, firstname, familyname, contact_phone, address,
     *   to_commune_name, to_wilaya_name, product_list, price,
     *   do_insurance, declared_value, height, width, length, weight,
     *   freeshipping, is_stopdesk, has_exchange
     *
     * Conditional: stopdesk_id (when is_stopdesk=true), product_to_collect (when has_exchange=true)
     * Optional: from_wilaya_name (defaults to account's sender wilaya)
     */
    toPayload(shipment) {
        if (!shipment.codAmount && shipment.codAmount !== 0) {
            throw AppError.validationFailed({ codAmount: 'COD amount is required. Please verify the order has a valid total amount before dispatching.' });
        }

        // Split customerName into first/family if possible
        const nameParts = (shipment.customerName || '').trim().split(/\s+/);
        const firstname = nameParts[0] || 'Client';
        const familyname = nameParts.slice(1).join(' ') || '.';

        return {
            order_id:           shipment.internalOrderId,
            firstname,
            familyname,
            contact_phone:      shipment.phone1,
            address:            shipment.address || '.',
            to_commune_name:    shipment.commune,
            to_wilaya_name:     shipment.wilayaName,
            product_list:       shipment.productName || 'Mixed Items',
            price:              shipment.codAmount,
            do_insurance:       false,
            declared_value:     shipment.codAmount || 0,
            height:             10,
            width:              10,
            length:             10,
            weight:             shipment.weight || 1,
            freeshipping:       false,
            is_stopdesk:        shipment.deliveryType === 1,
            stopdesk_id:        shipment.deliveryType === 1 ? (shipment.stopDeskId || null) : null,
            has_exchange:       shipment.operationType === 2,
            product_to_collect: shipment.operationType === 2 ? (shipment.remark || 'Exchange item') : null,
        };
    }

    // ─── Shipment Lifecycle ──────────────────────────────────────────────────────

    /**
     * Create a parcel on Yalidine.
     * POST /v1/parcels/ — accepts array of parcels.
     * Response: { "ORDER_ID": { success, tracking, label, labels, message } }
     * @returns {{ trackingId: string, labelUrl: string|null }}
     */
    async createShipment(payload) {
        const response = await yalidineRequest('POST', '/parcels/', this.courier, [payload]);

        // Response is keyed by order_id
        let parcel;
        if (response && typeof response === 'object' && !Array.isArray(response) && !response.data) {
            const values = Object.values(response);
            parcel = values[0] && typeof values[0] === 'object' ? values[0] : response;
        } else if (Array.isArray(response?.data)) {
            parcel = response.data[0];
        } else if (Array.isArray(response)) {
            parcel = response[0];
        } else {
            parcel = response;
        }

        if (parcel?.success === false) {
            // Extract user-friendly message from Yalidine response
            const yalidineMsg = parcel.message || '';
            let userMsg = yalidineMsg;
            if (yalidineMsg.includes('commune') || yalidineMsg.includes('wilaya')) {
                userMsg = `Courier does not cover this area. ${yalidineMsg}`;
            } else if (yalidineMsg.includes('phone') || yalidineMsg.includes('contact')) {
                userMsg = `Invalid phone number format. ${yalidineMsg}`;
            } else if (!yalidineMsg) {
                userMsg = `Courier rejected the order. Response: ${JSON.stringify(response)}`;
            }
            throw new Error(userMsg);
        }

        const trackingId = parcel?.tracking || parcel?.tracking_id;
        if (!trackingId) {
            throw new Error(`Courier accepted the request but did not return a tracking ID. Please contact Yalidine support. (${parcel?.message || ''})`);
        }

        return { trackingId, labelUrl: parcel?.label || null };
    }

    /**
     * Yalidine auto-schedules pickup after creation — no separate validate endpoint.
     */
    async validateShipment(/* trackingId, options */) {
        // No-op — Yalidine auto-schedules pickup
    }

    /**
     * Edit a parcel on Yalidine (only when status is "En préparation").
     * PATCH /v1/parcels/:tracking
     * Note: Personal data is masked in response — do NOT use response to update local DB.
     * @param {string} trackingId
     * @param {object} updates - fields to update (order_id, firstname, price, etc.)
     */
    async updateShipment(trackingId, updates) {
        return yalidineRequest('PATCH', `/parcels/${trackingId}`, this.courier, updates);
    }

    /**
     * Cancel/delete parcels on Yalidine.
     * Only possible when last_status is "En préparation".
     * Supports single: DELETE /v1/parcels/:tracking
     * Supports bulk:   DELETE /v1/parcels/?tracking=X,Y,Z
     * @param {string|string[]} trackingIds - single tracking or array
     */
    async cancelShipment(trackingIds) {
        if (Array.isArray(trackingIds)) {
            const joined = trackingIds.join(',');
            return yalidineRequest('DELETE', `/parcels/?tracking=${joined}`, this.courier);
        }
        return yalidineRequest('DELETE', `/parcels/${trackingIds}`, this.courier);
    }

    /**
     * Yalidine does not have a dedicated return-request endpoint.
     * Returns are handled operationally by the courier.
     */
    async requestReturn(/* trackingId */) {
        // No-op — returns managed operationally, status updated via tracker sync
    }

    // ─── Tracking & Labels ───────────────────────────────────────────────────────

    /**
     * Get label URL for a parcel.
     * GET /v1/parcels/?tracking=X&fields=tracking,label
     * @param {string} trackingId
     * @returns {string} label URL
     */
    async getLabelUrl(trackingId) {
        const response = await yalidineRequest(
            'GET', `/parcels/?tracking=${trackingId}&fields=tracking,label`, this.courier
        );
        const parcel = Array.isArray(response?.data) ? response.data[0] : response;
        return parcel?.label || `https://yalidine.app/app/bordereau.php?tracking=${trackingId}`;
    }

    /**
     * Fetch current tracking status from Yalidine.
     * GET /v1/parcels/?tracking=X&fields=tracking,last_status,date_last_status,payment_status
     * @param {string} trackingId
     * @returns {{ status: string, paymentStatus: string, rawData: object }}
     */
    async getTrackingStatus(trackingId) {
        const response = await yalidineRequest(
            'GET', `/parcels/?tracking=${trackingId}&fields=tracking,last_status,date_last_status,payment_status`, this.courier
        );
        const parcel = Array.isArray(response?.data) ? response.data[0] : response;
        return {
            status: parcel?.last_status || null,
            paymentStatus: parcel?.payment_status || null,
            rawData: parcel,
        };
    }

    /**
     * Fetch tracking status for multiple parcels in bulk.
     * GET /v1/parcels/?tracking=X,Y,Z&fields=tracking,last_status,date_last_status,payment_status
     * Yalidine supports up to 1000 per page.
     * @param {string[]} trackingIds - array of tracking IDs
     * @returns {object[]} array of { tracking, last_status, payment_status, ... }
     */
    async getBulkStatus(trackingIds) {
        if (!trackingIds.length) return [];
        const joined = trackingIds.join(',');
        const response = await yalidineRequest(
            'GET', `/parcels/?tracking=${joined}&fields=tracking,last_status,date_last_status,payment_status&page_size=1000`, this.courier
        );
        return Array.isArray(response?.data) ? response.data : [];
    }

    /**
     * Fetch full status history for one or more parcels.
     * GET /v1/histories/?tracking=X,Y,Z
     * Returns detailed status changes with reasons and locations.
     * @param {string|string[]} trackingIds
     * @returns {object[]} array of history entries
     */
    async getHistories(trackingIds) {
        const ids = Array.isArray(trackingIds) ? trackingIds.join(',') : trackingIds;
        const response = await yalidineRequest(
            'GET', `/histories/?tracking=${ids}&page_size=1000`, this.courier
        );
        return Array.isArray(response?.data) ? response.data : [];
    }

    /**
     * Fetch delivery fees between two wilayas.
     * GET /v1/fees/?from_wilaya_id=X&to_wilaya_id=Y
     * @param {number} fromWilayaId
     * @param {number} toWilayaId
     * @returns {object} fees with per-commune breakdown
     */
    async getFees(fromWilayaId, toWilayaId) {
        return yalidineRequest(
            'GET', `/fees/?from_wilaya_id=${fromWilayaId}&to_wilaya_id=${toWilayaId}`, this.courier
        );
    }
}

// ─── Status Mapping ──────────────────────────────────────────────────────────
//
// Complete Yalidine status list (34 statuses from API docs):
//
// Pre-dispatch:
//   Pas encore expédié, A vérifier, En préparation,
//   Pas encore ramassé, Prêt à expédier, En passation
//
// Pickup:
//   Ramassé
//
// Blocked:
//   Bloqué, Débloqué
//
// Transit:
//   Transfert, Expédié, Centre, En localisation,
//   Vers Wilaya, En transit, Reçu à Wilaya
//
// Delivery:
//   En attente du client, Prêt pour livreur, Sorti en livraison,
//   En attente
//
// Terminal - Success:
//   Livré
//
// Terminal - Cancelled:
//   Annulé
//
// Alert:
//   En alerte, Alerte résolue
//
// Failed:
//   Tentative échouée, Echèc livraison
//
// Returns:
//   Retour vers centre, Retourné au centre, Retour transfert,
//   Retour groupé, Retour à retirer, Retour vers vendeur,
//   Retourné au vendeur
//
// Exchange:
//   Echange échoué
//
// Payment statuses: not-ready, ready, receivable, payed
//
// Failure reasons:
//   Téléphone injoignable, Client ne répond pas, Faux numéro,
//   Client absent (reporté), Client absent (échoué),
//   Annulé par le client, Commande double, Le client n'a pas commandé,
//   Produit erroné, Produit manquant, Produit cassé ou défectueux,
//   Client incapable de payer, Wilaya erronée, Commune erronée,
//   Client no-show, Adresse non livrable

/**
 * Maps a Yalidine courier status to internal shipment + payment status.
 *
 * @param {string} courierStatus - Yalidine last_status value
 * @param {object} currentShipment - current shipment document
 * @param {object} [extra] - optional { reason, paymentStatus } from histories/parcels
 * @returns {{ newShipmentStatus, newPaymentStatus, activityLog }}
 */
YalidineAdapter.mapStatusToInternal = (courierStatus, currentShipment, extra = {}) => {
    let newShipmentStatus = currentShipment.shipmentStatus;
    let newPaymentStatus = currentShipment.paymentStatus;
    let activityLog = null;

    const s = (courierStatus || '').trim();
    const lower = s.toLowerCase();

    // ── Pre-dispatch ──
    if (
        lower === 'pas encore expédié' || lower === 'pas encore expedie' ||
        lower === 'a vérifier' || lower === 'a verifier' ||
        lower === 'en préparation' || lower === 'en preparation' ||
        lower === 'pas encore ramassé' || lower === 'pas encore ramasse' ||
        lower === 'prêt à expédier' || lower === 'pret a expedier' ||
        lower === 'en passation'
    ) {
        newShipmentStatus = 'Created in Courier';
    }
    // ── Pickup ──
    else if (lower === 'ramassé' || lower === 'ramasse') {
        newShipmentStatus = 'Validated';
    }
    // ── Blocked ──
    else if (lower === 'bloqué' || lower === 'bloque') {
        newShipmentStatus = 'On Hold';
    }
    else if (lower === 'débloqué' || lower === 'debloque') {
        // Unblocked — revert to previous transit-like state
        newShipmentStatus = 'In Transit';
    }
    // ── Transit ──
    else if (
        lower === 'transfert' ||
        lower === 'expédié' || lower === 'expedie' ||
        lower === 'centre' ||
        lower === 'en localisation' ||
        lower === 'vers wilaya' ||
        lower === 'en transit' ||
        lower === 'reçu à wilaya' || lower === 'recu a wilaya'
    ) {
        newShipmentStatus = 'In Transit';
    }
    // ── Out for Delivery ──
    else if (
        lower === 'prêt pour livreur' || lower === 'pret pour livreur' ||
        lower === 'sorti en livraison'
    ) {
        newShipmentStatus = 'Out for Delivery';
    }
    // ── Waiting ──
    else if (lower === 'en attente du client' || lower === 'en attente') {
        newShipmentStatus = 'Failed Attempt';
    }
    // ── Failed ──
    else if (
        lower === 'tentative échouée' || lower === 'tentative echouee' ||
        lower === 'echèc livraison' || lower === 'echec livraison' ||
        lower === 'échec livraison'
    ) {
        newShipmentStatus = 'Failed Attempt';
    }
    // ── Cancelled ──
    else if (lower === 'annulé' || lower === 'annule') {
        newShipmentStatus = 'Cancelled';
    }
    // ── Alert ──
    else if (lower === 'en alerte') {
        newShipmentStatus = 'On Hold';
    }
    else if (lower === 'alerte résolue' || lower === 'alerte resolue') {
        newShipmentStatus = 'In Transit';
    }
    // ── Delivered ──
    else if (lower === 'livré' || lower === 'livre') {
        newShipmentStatus = 'Delivered';
        if (newPaymentStatus === 'COD_Expected') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }
    // ── Returns (in progress) ──
    else if (
        lower === 'retour vers centre' ||
        lower === 'retour transfert' ||
        lower === 'retour groupé' || lower === 'retour groupe' ||
        lower === 'retour à retirer' || lower === 'retour a retirer' ||
        lower === 'retour vers vendeur'
    ) {
        newShipmentStatus = 'Return Initiated';
    }
    // ── Returns (completed) ──
    else if (
        lower === 'retourné au centre' || lower === 'retourne au centre' ||
        lower === 'retourné au vendeur' || lower === 'retourne au vendeur'
    ) {
        newShipmentStatus = 'Returned';
    }
    // ── Exchange failed ──
    else if (lower === 'echange échoué' || lower === 'echange echoue') {
        newShipmentStatus = 'Failed Attempt';
    }

    // ── Yalidine payment_status → internal paymentStatus ──
    if (extra.paymentStatus) {
        const ps = extra.paymentStatus.toLowerCase();
        if (ps === 'payed' && newShipmentStatus === 'Delivered') {
            newPaymentStatus = 'COD_Collected';
        } else if (ps === 'receivable' && newShipmentStatus === 'Delivered') {
            newPaymentStatus = 'Delivered_Not_Collected';
        }
    }

    // Build activity log if status changed
    const remarks = extra.reason
        ? `Yalidine: ${s} — ${extra.reason}`
        : `Yalidine: ${s}`;

    if (newShipmentStatus !== currentShipment.shipmentStatus || lower !== (currentShipment.courierStatus || '').toLowerCase()) {
        activityLog = { status: newShipmentStatus, remarks };
    }

    return { newShipmentStatus, newPaymentStatus, activityLog };
};

module.exports = YalidineAdapter;
