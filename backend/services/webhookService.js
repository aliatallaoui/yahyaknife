const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');
const logger = require('../shared/logger');
const { validateWebhookUrl } = require('../shared/utils/validateUrl');

// Max consecutive failures before auto-disabling a webhook
const MAX_CONSECUTIVE_FAILURES = 10;

// Timeout for webhook HTTP calls (ms)
const DELIVERY_TIMEOUT_MS = 10_000;

// Retry config
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 5000, 30000]; // 1s, 5s, 30s

/**
 * Supported webhook events.
 * Add new events here as the platform grows.
 */
const WEBHOOK_EVENTS = [
    'order.created',
    'order.updated',
    'order.status_changed',
    'order.delivered',
    'order.cancelled',
    'order.returned',
    'shipment.created',
    'shipment.status_changed',
    'customer.created',
    'customer.updated',
];

/**
 * Dispatch a webhook event for a tenant.
 * Finds all active webhooks subscribed to the event and delivers asynchronously.
 *
 * @param {string} tenantId
 * @param {string} event    - e.g. 'order.created'
 * @param {Object} payload  - event data
 */
async function dispatch(tenantId, event, payload) {
    if (!tenantId || !event) return;

    try {
        const webhooks = await Webhook.find({
            tenant: tenantId,
            isActive: true,
            events: event,
            autoDisabledAt: null,
        }).select('+secret').lean();

        if (webhooks.length === 0) return;

        // Fire all deliveries concurrently (non-blocking)
        for (const webhook of webhooks) {
            deliverWithRetry(webhook, tenantId, event, payload, 1).catch(err => {
                logger.error({ err, webhookId: webhook._id, event }, 'Webhook delivery fire-and-forget error');
            });
        }
    } catch (err) {
        logger.error({ err, tenantId, event }, 'webhookService.dispatch error');
    }
}

/**
 * Deliver a webhook with retry logic.
 */
async function deliverWithRetry(webhook, tenantId, event, payload, attempt) {
    const delivery = await WebhookDelivery.create({
        webhook: webhook._id,
        tenant: tenantId,
        event,
        payload,
        attempt,
        status: 'pending',
    });

    const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
    });

    // Compute HMAC signature if secret is set
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Warsha-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': delivery._id.toString(),
    };

    if (webhook.secret) {
        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(body)
            .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Defense-in-depth: re-validate URL at delivery time (in case DB was tampered)
    const urlErr = validateWebhookUrl(webhook.url);
    if (urlErr) {
        logger.warn({ webhookId: webhook._id, url: webhook.url }, `Webhook delivery blocked: ${urlErr}`);
        await WebhookDelivery.findByIdAndUpdate(delivery._id, {
            status: 'failed', responseStatus: 0, durationMs: 0,
            error: `SSRF blocked: ${urlErr}`,
        });
        return;
    }

    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
        });

        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;
        const responseBody = await response.text().catch(() => '');

        if (response.ok) {
            // Success
            await WebhookDelivery.findByIdAndUpdate(delivery._id, {
                status: 'success',
                response: { statusCode: response.status, body: responseBody.substring(0, 500), durationMs },
            });

            await Webhook.findByIdAndUpdate(webhook._id, {
                $inc: { 'stats.totalDeliveries': 1, 'stats.successCount': 1 },
                'stats.lastDeliveredAt': new Date(),
                'stats.lastStatusCode': response.status,
                'stats.consecutiveFailures': 0,
            });
        } else {
            throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
        }
    } catch (err) {
        const durationMs = Date.now() - startTime;

        await WebhookDelivery.findByIdAndUpdate(delivery._id, {
            status: 'failed',
            error: err.message?.substring(0, 500),
            response: { durationMs },
        });

        // Update failure stats
        const updated = await Webhook.findByIdAndUpdate(webhook._id, {
            $inc: { 'stats.totalDeliveries': 1, 'stats.failureCount': 1, 'stats.consecutiveFailures': 1 },
            'stats.lastFailedAt': new Date(),
        }, { returnDocument: 'after' });

        // Auto-disable if too many consecutive failures
        if (updated && updated.stats.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await Webhook.findByIdAndUpdate(webhook._id, {
                isActive: false,
                autoDisabledAt: new Date(),
            });
            logger.warn({ webhookId: webhook._id, url: webhook.url, tenantId },
                `Webhook auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
            return; // Don't retry
        }

        // Retry
        if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAYS_MS[attempt - 1] || 30000;
            logger.info({ webhookId: webhook._id, attempt, nextIn: delay }, 'Scheduling webhook retry');
            setTimeout(() => {
                deliverWithRetry(webhook, tenantId, event, payload, attempt + 1).catch(() => {});
            }, delay);
        }
    }
}

module.exports = { dispatch, WEBHOOK_EVENTS };
