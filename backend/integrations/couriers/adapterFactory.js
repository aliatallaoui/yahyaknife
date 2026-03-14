/**
 * Courier Adapter Factory — resolves the correct CourierAdapter for a given courier.
 *
 * Usage:
 *   const Courier = require('../../models/Courier');
 *   const { getAdapter } = require('../../integrations/couriers/adapterFactory');
 *
 *   const courier = await Courier.findById(courierId);
 *   const adapter = getAdapter(courier);
 *   const { trackingId } = await adapter.createShipment(adapter.toPayload(shipment));
 *
 * To add a new courier provider:
 *   1. Create a new adapter file (e.g., ZRExpressAdapter.js) extending CourierAdapter
 *   2. Add the provider name to the Courier model's apiProvider enum
 *   3. Add the mapping below
 */

const ecotrackSingleton = require('./EcotrackAdapter'); // Singleton (no courier)
const { EcotrackAdapter } = require('./EcotrackAdapter');
const YalidineAdapter = require('./YalidineAdapter');

/**
 * Returns a CourierAdapter instance for the given courier document.
 *
 * @param {object} courier - Courier document (must have apiProvider, apiId, apiToken, etc.)
 * @returns {CourierAdapter}
 * @throws {Error} if courier has no API integration or unknown provider
 */
function getAdapter(courier) {
    // No courier assigned or manual integration → fall back to Ecotrack singleton
    if (!courier || courier.integrationType === 'Manual' || !courier.apiProvider) {
        return ecotrackSingleton;
    }

    const provider = courier.apiProvider;

    switch (provider) {
        case 'Ecotrack':
            // Per-courier instance — uses Courier model credentials directly
            return new EcotrackAdapter(courier);

        case 'Yalidin':
            return new YalidineAdapter(courier);

        default:
            throw new Error(`Unknown courier provider: "${provider}". Supported: Ecotrack, Yalidin.`);
    }
}

/**
 * Returns the provider name string for a courier.
 * Used for setting courierProvider on Shipment documents.
 */
function getProviderName(courier) {
    if (!courier || courier.integrationType === 'Manual' || !courier.apiProvider) {
        return 'ECOTRACK';
    }
    return courier.apiProvider.toUpperCase();
}

/**
 * Returns the status mapper function for a given provider.
 * Used by trackerSync to map courier-specific statuses to internal statuses.
 */
function getStatusMapper(providerName) {
    const upper = (providerName || '').toUpperCase();
    switch (upper) {
        case 'ECOTRACK':
            return ecotrackSingleton.mapStatusToInternal;
        case 'YALIDIN':
            return YalidineAdapter.mapStatusToInternal;
        default:
            return null;
    }
}

module.exports = {
    getAdapter,
    getProviderName,
    getStatusMapper,
};
