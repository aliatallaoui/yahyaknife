/**
 * Store Webhook Routes — inbound webhook endpoints for external store integrations.
 *
 * These routes receive webhooks from WooCommerce, Shopify, etc.
 * NO authentication middleware — external stores cannot auth with our system.
 * Instead, we verify HMAC signatures per-adapter.
 *
 * Rate limited per channelId to prevent abuse.
 *
 * Mounted at: /api/integrations/webhooks
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const SalesChannel = require('../models/SalesChannel');
const { getStoreAdapter } = require('../integrations/stores/storeAdapterFactory');
const { decryptSensitiveKeys } = require('../shared/utils/credentialEncryption');
const { importOrder } = require('../domains/sales-channels/orderImport.service');
const SalesChannelSyncLog = require('../models/SalesChannelSyncLog');
const logger = require('../shared/logger');

// Rate limit: 60 webhook deliveries per minute per IP
const webhookLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many webhook requests' },
});

/**
 * WooCommerce Webhook Handler
 * POST /api/integrations/webhooks/:channelId/woocommerce
 *
 * WooCommerce sends:
 *   Headers: X-WC-Webhook-Signature, X-WC-Webhook-Topic, X-WC-Webhook-Source
 *   Body: raw JSON order/product payload
 */
router.post(
    '/:channelId/woocommerce',
    webhookLimiter,
    // Need raw body for HMAC verification
    express.json({
        verify: (req, _res, buf) => { req.rawBody = buf; }
    }),
    async (req, res) => {
        const startTime = Date.now();
        const { channelId } = req.params;

        try {
            // 1. Validate channelId
            if (!mongoose.Types.ObjectId.isValid(channelId)) {
                return res.status(400).json({ error: 'Invalid channel ID' });
            }

            // 2. Load sales channel
            const channel = await SalesChannel.findOne({
                _id: channelId,
                channelType: 'woocommerce',
                deletedAt: null,
            });

            if (!channel) {
                return res.status(404).json({ error: 'Channel not found' });
            }

            if (channel.status !== 'active' || !channel.integration?.syncEnabled) {
                return res.status(200).json({ message: 'Channel sync disabled, webhook ignored' });
            }

            // 3. Decrypt config and get adapter
            const decryptedConfig = decryptSensitiveKeys(channel.config);
            const adapter = getStoreAdapter(channel, decryptedConfig);

            // 4. Verify HMAC signature
            const signature = req.headers['x-wc-webhook-signature'];
            if (decryptedConfig.webhookSecret && signature) {
                const valid = adapter.verifyWebhookSignature(req.rawBody || JSON.stringify(req.body), signature);
                if (!valid) {
                    logger.warn({ channelId }, 'WooCommerce webhook signature verification failed');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }

            // 5. Parse topic
            const topic = req.headers['x-wc-webhook-topic'] || '';

            // WooCommerce sends a ping on webhook creation — respond 200
            if (topic === 'action.woocommerce_webhook_ping' || !req.body?.id) {
                return res.status(200).json({ message: 'Webhook ping received' });
            }

            // 6. Handle order events
            if (topic === 'order.created' || topic === 'order.updated') {
                const normalizedOrder = adapter.normalizeOrder(req.body);

                const result = await importOrder({
                    tenantId: channel.tenant,
                    salesChannelId: channel._id,
                    normalizedOrder,
                    importMethod: 'webhook',
                    salesChannel: channel,
                });

                // Log the webhook
                await SalesChannelSyncLog.create({
                    tenant: channel.tenant,
                    salesChannel: channel._id,
                    syncType: 'webhook_received',
                    status: result.skipped ? 'success' : 'success',
                    ordersImported: result.skipped ? 0 : 1,
                    ordersSkipped: result.skipped ? 1 : 0,
                    errors: result.error ? [{ message: result.error, externalOrderId: normalizedOrder.externalOrderId }] : [],
                    duration: Date.now() - startTime,
                    metadata: { topic, externalOrderId: normalizedOrder.externalOrderId },
                });

                return res.status(200).json({
                    message: result.skipped ? 'Order already exists, skipped' : 'Order imported successfully',
                    orderId: result.order?.orderId || null,
                });
            }

            // Unhandled topic — acknowledge anyway to prevent WC retries
            logger.info({ channelId, topic }, 'Unhandled WooCommerce webhook topic');
            return res.status(200).json({ message: `Topic ${topic} acknowledged but not processed` });

        } catch (error) {
            logger.error({ err: error, channelId }, 'WooCommerce webhook processing error');

            // Always return 200 for webhook endpoints to prevent infinite retries
            // Log the error for debugging
            try {
                if (mongoose.Types.ObjectId.isValid(channelId)) {
                    const channel = await SalesChannel.findById(channelId);
                    if (channel) {
                        await SalesChannel.updateOne(
                            { _id: channelId },
                            { $set: { 'integration.lastError': error.message?.substring(0, 500) } }
                        );
                    }
                }
            } catch (_) { /* ignore logging errors */ }

            return res.status(200).json({ message: 'Webhook received with errors', error: error.message });
        }
    }
);

module.exports = router;
