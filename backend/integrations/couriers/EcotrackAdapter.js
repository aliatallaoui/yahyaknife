/**
 * EcotrackAdapter — concrete CourierAdapter for the ECOTRACK logistics API.
 *
 * All ECOTRACK-specific payload mapping and API calls are isolated here.
 * Replace this file (or add a new adapter) to support another courier without
 * touching any business logic.
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
     * @returns {{ trackingId: string }}
     */
    async createShipment(payload) {
        const response = await ecotrackRequest('POST', '/api/v1/create/order', payload);
        const trackingId = response?.tracking_id || response?.tracking;
        if (!trackingId) {
            throw new Error('ECOTRACK did not return a tracking ID');
        }
        return { trackingId };
    }

    /**
     * Validate / request pickup.
     * @param {string} trackingId
     * @param {{ askCollection?: number }} [options]
     */
    async validateShipment(trackingId, { askCollection = 1 } = {}) {
        await ecotrackRequest('POST', '/api/v1/validate', {
            tracking: trackingId,
            ask_collection: askCollection
        });
    }

    /**
     * Cancel a shipment. Tries DELETE first, falls back to POST cancel.
     * @param {string} trackingId
     */
    async cancelShipment(trackingId) {
        try {
            await ecotrackRequest('DELETE', `/api/v1/delete/${trackingId}`);
        } catch {
            // Fallback to POST cancel endpoint
            await ecotrackRequest('POST', '/api/v1/cancel', { tracking: trackingId });
        }
    }

    /**
     * Request a return for an in-transit shipment.
     * @param {string} trackingId
     */
    async requestReturn(trackingId) {
        await ecotrackRequest('POST', `/api/v1/return/${trackingId}`);
    }

    /**
     * Fetch the label URL from ECOTRACK.
     * Falls back to the standard Ecotrack print URL if the API doesn't return one.
     * @param {string} trackingId
     * @returns {string}
     */
    async getLabelUrl(trackingId) {
        const response = await ecotrackRequest('GET', `/api/v1/label/${trackingId}`);
        return response?.url ?? `https://api.ecotrack.dz/v1/print/label/${trackingId}`;
    }

    /**
     * Fetch current tracking status from ECOTRACK.
     * @param {string} trackingId
     * @returns {{ status: string, rawData: object }}
     */
    async getTrackingStatus(trackingId) {
        const response = await ecotrackRequest('GET', `/api/v1/tracking/${trackingId}`);
        return {
            status: response?.status || response?.current_status || null,
            rawData: response,
        };
    }
}

module.exports = new EcotrackAdapter(); // Singleton — stateless, safe to share
