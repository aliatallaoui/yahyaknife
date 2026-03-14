/**
 * StoreAdapter — abstract interface all store/sales-channel integrations must implement.
 *
 * Mirrors the CourierAdapter pattern. Each method must be implemented by a concrete
 * adapter (e.g. WooCommerceAdapter, ShopifyAdapter).
 *
 * Usage:
 *   const { getStoreAdapter } = require('./storeAdapterFactory');
 *   const adapter = getStoreAdapter(salesChannel);
 *   const connected = await adapter.testConnection();
 */
class StoreAdapter {
    /**
     * Test the connection to the external store.
     * @returns {Promise<{ success: boolean, message: string, storeName?: string }>}
     */
    async testConnection() {
        throw new Error('StoreAdapter.testConnection() not implemented');
    }

    /**
     * Fetch orders from the external store.
     * @param {{ since?: Date, page?: number, perPage?: number }} options
     * @returns {Promise<{ orders: object[], hasMore: boolean, totalCount?: number }>}
     */
    // eslint-disable-next-line no-unused-vars
    async fetchOrders(options = {}) {
        throw new Error('StoreAdapter.fetchOrders() not implemented');
    }

    /**
     * Fetch a single order by external ID.
     * @param {string} externalOrderId
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line no-unused-vars
    async fetchOrder(externalOrderId) {
        throw new Error('StoreAdapter.fetchOrder() not implemented');
    }

    /**
     * Fetch products from the external store.
     * @param {{ page?: number, perPage?: number }} options
     * @returns {Promise<{ products: object[], hasMore: boolean }>}
     */
    // eslint-disable-next-line no-unused-vars
    async fetchProducts(options = {}) {
        throw new Error('StoreAdapter.fetchProducts() not implemented');
    }

    /**
     * Register a webhook on the external store.
     * @param {string} callbackUrl - Full URL for the webhook callback
     * @param {string[]} [topics] - Event topics to subscribe to
     * @returns {Promise<{ webhookId: string, secret?: string }>}
     */
    // eslint-disable-next-line no-unused-vars
    async registerWebhook(callbackUrl, topics) {
        throw new Error('StoreAdapter.registerWebhook() not implemented');
    }

    /**
     * Remove a webhook from the external store.
     * @param {string} webhookId
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async removeWebhook(webhookId) {
        throw new Error('StoreAdapter.removeWebhook() not implemented');
    }

    /**
     * Verify an incoming webhook signature.
     * @param {Buffer|string} rawBody - Raw request body
     * @param {string} signature - Signature from request headers
     * @returns {boolean}
     */
    // eslint-disable-next-line no-unused-vars
    verifyWebhookSignature(rawBody, signature) {
        throw new Error('StoreAdapter.verifyWebhookSignature() not implemented');
    }

    /**
     * Normalize an external order object into the standard import shape.
     * @param {object} externalOrder - Raw order from the external store
     * @returns {{ externalOrderId, customerName, customerPhone, customerEmail, items[], shipping, totalAmount, status, notes, createdAt }}
     */
    // eslint-disable-next-line no-unused-vars
    normalizeOrder(externalOrder) {
        throw new Error('StoreAdapter.normalizeOrder() not implemented');
    }

    /**
     * Normalize an external product into a standard shape for mapping.
     * @param {object} externalProduct
     * @returns {{ externalProductId, name, variants: [{ externalVariantId, sku, name, price }] }}
     */
    // eslint-disable-next-line no-unused-vars
    normalizeProduct(externalProduct) {
        throw new Error('StoreAdapter.normalizeProduct() not implemented');
    }
}

module.exports = StoreAdapter;
