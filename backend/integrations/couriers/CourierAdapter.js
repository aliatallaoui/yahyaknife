/**
 * CourierAdapter — abstract interface all courier integrations must implement.
 *
 * Each method must be implemented by a concrete adapter (e.g. EcotrackAdapter).
 * Throw an Error (not AppError) for courier-side failures so callers can
 * translate them to 502 responses.
 *
 * Usage:
 *   const adapter = new EcotrackAdapter();
 *   const { trackingId } = await adapter.createShipment(payload);
 */
class CourierAdapter {
    /**
     * Create a shipment on the courier's platform.
     * @param {object} payload  - Normalized shipment data (use toPayload() to build)
     * @returns {Promise<{ trackingId: string }>}
     */
    // eslint-disable-next-line no-unused-vars
    async createShipment(payload) {
        throw new Error('CourierAdapter.createShipment() not implemented');
    }

    /**
     * Validate / request pickup for a shipment.
     * @param {string} trackingId
     * @param {{ askCollection?: number }} [options]
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async validateShipment(trackingId, options = {}) {
        throw new Error('CourierAdapter.validateShipment() not implemented');
    }

    /**
     * Cancel a shipment on the courier's platform.
     * @param {string} trackingId
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async cancelShipment(trackingId) {
        throw new Error('CourierAdapter.cancelShipment() not implemented');
    }

    /**
     * Request a return for an in-transit shipment.
     * @param {string} trackingId
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async requestReturn(trackingId) {
        throw new Error('CourierAdapter.requestReturn() not implemented');
    }

    /**
     * Get the shipping label URL for a shipment.
     * @param {string} trackingId
     * @returns {Promise<string>}  - URL to the label PDF
     */
    // eslint-disable-next-line no-unused-vars
    async getLabelUrl(trackingId) {
        throw new Error('CourierAdapter.getLabelUrl() not implemented');
    }

    /**
     * Normalize an internal order/shipment object into this courier's API payload format.
     * @param {object} shipment  - Internal shipment document fields
     * @returns {object}  - Courier-specific payload
     */
    // eslint-disable-next-line no-unused-vars
    toPayload(shipment) {
        throw new Error('CourierAdapter.toPayload() not implemented');
    }
}

module.exports = CourierAdapter;
