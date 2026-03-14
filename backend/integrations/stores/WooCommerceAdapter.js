/**
 * WooCommerceAdapter — concrete StoreAdapter for WooCommerce REST API v3.
 *
 * Per-request instantiation (same pattern as YalidineAdapter).
 * Auth: Basic Auth via consumerKey:consumerSecret.
 *
 * Usage:
 *   const adapter = new WooCommerceAdapter(decryptedConfig, channelId);
 *   const { success } = await adapter.testConnection();
 */

const crypto = require('crypto');
const StoreAdapter = require('./StoreAdapter');
const { woocommerceRequest } = require('../../utils/woocommerceRequest');

class WooCommerceAdapter extends StoreAdapter {
    /**
     * @param {object} config - Decrypted config: { storeUrl, consumerKey, consumerSecret, webhookSecret, apiVersion }
     * @param {string} channelId - SalesChannel _id (used for rate limiting/circuit breaker keying)
     */
    constructor(config, channelId) {
        super();
        this.config = {
            storeUrl: config.storeUrl,
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
            channelId,
        };
        this.webhookSecret = config.webhookSecret || '';
        this.apiVersion = config.apiVersion || 'wc/v3';
    }

    _endpoint(path) {
        return `/wp-json/${this.apiVersion}${path}`;
    }

    // ─── Connection ───────────────────────────────────────────────────────────

    async testConnection() {
        try {
            const { data } = await woocommerceRequest(
                'GET', this._endpoint('/system_status'), this.config
            );
            return {
                success: true,
                message: 'Connected successfully',
                storeName: data?.environment?.site_title || data?.settings?.blogname || null,
            };
        } catch (err) {
            const status = err.response?.status;
            let message = 'Connection failed';
            if (status === 401) message = 'Invalid API credentials';
            else if (status === 404) message = 'WooCommerce REST API not found. Check store URL.';
            else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') message = 'Store URL unreachable';
            return { success: false, message };
        }
    }

    // ─── Orders ───────────────────────────────────────────────────────────────

    async fetchOrders({ since, page = 1, perPage = 50 } = {}) {
        const params = {
            page,
            per_page: Math.min(perPage, 100),
            orderby: 'date',
            order: 'desc',
        };
        if (since) params.after = since instanceof Date ? since.toISOString() : since;

        const { data, headers } = await woocommerceRequest(
            'GET', this._endpoint('/orders'), this.config, null, params
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || '1', 10);
        return {
            orders: Array.isArray(data) ? data : [],
            hasMore: page < totalPages,
            totalCount: parseInt(headers['x-wp-total'] || '0', 10),
        };
    }

    async fetchOrder(externalOrderId) {
        const { data } = await woocommerceRequest(
            'GET', this._endpoint(`/orders/${externalOrderId}`), this.config
        );
        return data;
    }

    // ─── Products ─────────────────────────────────────────────────────────────

    async fetchProducts({ page = 1, perPage = 50 } = {}) {
        const params = { page, per_page: Math.min(perPage, 100) };
        const { data, headers } = await woocommerceRequest(
            'GET', this._endpoint('/products'), this.config, null, params
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || '1', 10);
        return {
            products: Array.isArray(data) ? data : [],
            hasMore: page < totalPages,
        };
    }

    // ─── Webhooks ─────────────────────────────────────────────────────────────

    async registerWebhook(callbackUrl, topics = ['order.created', 'order.updated']) {
        const results = [];
        for (const topic of topics) {
            const { data } = await woocommerceRequest(
                'POST', this._endpoint('/webhooks'), this.config,
                {
                    name: `SaaS Integration: ${topic}`,
                    topic,
                    delivery_url: callbackUrl,
                    status: 'active',
                    secret: this.webhookSecret || undefined,
                }
            );
            results.push({ webhookId: String(data.id), topic });
        }
        // Return comma-separated IDs (we may register multiple webhooks)
        return {
            webhookId: results.map(r => r.webhookId).join(','),
            secret: this.webhookSecret,
        };
    }

    async removeWebhook(webhookId) {
        const ids = webhookId.split(',').filter(Boolean);
        for (const id of ids) {
            try {
                await woocommerceRequest(
                    'DELETE', this._endpoint(`/webhooks/${id}`), this.config, null, { force: true }
                );
            } catch (err) {
                // 404 = already deleted, ignore
                if (err.response?.status !== 404) throw err;
            }
        }
    }

    // ─── Webhook Verification ─────────────────────────────────────────────────

    verifyWebhookSignature(rawBody, signature) {
        if (!this.webhookSecret) return true; // No secret configured, skip verification
        const computed = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(rawBody, 'utf8')
            .digest('base64');
        return crypto.timingSafeEqual(
            Buffer.from(signature || ''),
            Buffer.from(computed)
        );
    }

    // ─── Normalizers ──────────────────────────────────────────────────────────

    /**
     * Normalize a WooCommerce order to the standard import shape.
     */
    normalizeOrder(wooOrder) {
        const billing = wooOrder.billing || {};
        const shipping = wooOrder.shipping || {};

        // Use shipping name if available, fall back to billing
        const firstName = shipping.first_name || billing.first_name || '';
        const lastName = shipping.last_name || billing.last_name || '';
        const customerName = `${firstName} ${lastName}`.trim() || 'Client';

        // Phone: prefer billing phone (WC stores phone there)
        const customerPhone = billing.phone || shipping.phone || '';

        // Map WC line items
        const items = (wooOrder.line_items || []).map(item => ({
            externalProductId: String(item.product_id),
            externalVariantId: item.variation_id ? String(item.variation_id) : null,
            name: item.name || 'Unknown',
            sku: item.sku || '',
            quantity: item.quantity ?? 1,
            unitPrice: parseFloat(item.price) || 0,
        }));

        // Shipping address
        const shippingAddress = [shipping.address_1, shipping.address_2].filter(Boolean).join(', ');

        return {
            externalOrderId: String(wooOrder.id),
            customerName,
            customerPhone,
            customerEmail: billing.email || '',
            items,
            shipping: {
                recipientName: customerName,
                phone1: customerPhone,
                address: shippingAddress || billing.address_1 || '',
                wilayaName: shipping.state || shipping.city || billing.state || '',
                commune: shipping.city || billing.city || '',
            },
            totalAmount: parseFloat(wooOrder.total) || 0,
            discount: parseFloat(wooOrder.discount_total) || 0,
            status: wooOrder.status || 'processing',
            notes: (wooOrder.customer_note || ''),
            createdAt: wooOrder.date_created ? new Date(wooOrder.date_created) : new Date(),
            currency: wooOrder.currency || 'DZD',
        };
    }

    normalizeProduct(wooProduct) {
        const variants = (wooProduct.variations || []).map(v => ({
            externalVariantId: String(v.id || v),
            sku: v.sku || '',
            name: v.name || wooProduct.name,
            price: parseFloat(v.price || v.regular_price || 0),
        }));

        // If no variations, treat the product itself as a single variant
        if (variants.length === 0) {
            variants.push({
                externalVariantId: String(wooProduct.id),
                sku: wooProduct.sku || '',
                name: wooProduct.name,
                price: parseFloat(wooProduct.price || wooProduct.regular_price || 0),
            });
        }

        return {
            externalProductId: String(wooProduct.id),
            name: wooProduct.name || 'Unknown Product',
            variants,
        };
    }
}

module.exports = WooCommerceAdapter;
