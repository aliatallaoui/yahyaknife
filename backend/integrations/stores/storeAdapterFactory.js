/**
 * Store Adapter Factory — resolves the correct StoreAdapter for a given SalesChannel.
 *
 * Mirrors the courier adapterFactory.js pattern.
 *
 * Usage:
 *   const { getStoreAdapter } = require('../../integrations/stores/storeAdapterFactory');
 *   const adapter = getStoreAdapter(salesChannel, decryptedConfig);
 *
 * To add a new store provider:
 *   1. Create a new adapter file extending StoreAdapter
 *   2. Add the channelType to the SalesChannel model enum
 *   3. Add the mapping below
 */

const WooCommerceAdapter = require('./WooCommerceAdapter');

// Channel types that have store adapters (as opposed to landing_page/manual)
const STORE_CHANNEL_TYPES = new Set(['woocommerce', 'shopify', 'tiktok_shop', 'facebook_shop', 'custom_api']);

/**
 * Returns a StoreAdapter instance for the given sales channel.
 *
 * @param {object} salesChannel - SalesChannel document
 * @param {object} decryptedConfig - Decrypted config object (from decryptSensitiveKeys)
 * @returns {StoreAdapter}
 * @throws {Error} if channel type has no adapter
 */
function getStoreAdapter(salesChannel, decryptedConfig) {
    const type = salesChannel.channelType;

    switch (type) {
        case 'woocommerce':
            return new WooCommerceAdapter(decryptedConfig, salesChannel._id);

        // Future providers:
        // case 'shopify':
        //     return new ShopifyAdapter(decryptedConfig, salesChannel._id);
        // case 'tiktok_shop':
        //     return new TikTokShopAdapter(decryptedConfig, salesChannel._id);

        default:
            throw new Error(`No store adapter for channel type: "${type}". Supported: woocommerce.`);
    }
}

/**
 * Check if a channel type has a store adapter (is an external integration).
 */
function isStoreChannel(channelType) {
    return STORE_CHANNEL_TYPES.has(channelType);
}

module.exports = {
    getStoreAdapter,
    isStoreChannel,
    STORE_CHANNEL_TYPES,
};
