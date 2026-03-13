/**
 * Webhook event listener — bridges the domain EventBus to the webhook delivery system.
 *
 * Listens for domain events and dispatches matching webhooks to subscribed tenants.
 * Register this listener once at app startup (called from server.js or scheduler.js).
 */
const { eventBus, EVENTS } = require('../shared/events/eventBus');
const { dispatch } = require('../services/webhookService');
const logger = require('../shared/logger');

/**
 * Map internal EventBus events → webhook event names.
 * Only events with a webhook mapping are forwarded.
 */
const EVENT_MAP = {
    [EVENTS.ORDER_CREATED]:        'order.created',
    [EVENTS.ORDER_STATUS_CHANGED]: 'order.status_changed',
    [EVENTS.ORDER_DELIVERED]:      'order.delivered',
    [EVENTS.ORDER_CANCELLED]:      'order.cancelled',
    [EVENTS.ORDER_RETURNED]:       'order.returned',
    [EVENTS.SHIPMENT_CREATED]:     'shipment.created',
};

function registerWebhookListeners() {
    for (const [busEvent, webhookEvent] of Object.entries(EVENT_MAP)) {
        eventBus.on(busEvent, async (payload) => {
            const tenantId = payload?.tenantId || payload?.tenant;
            if (!tenantId) {
                logger.warn({ busEvent, webhookEvent }, 'Webhook listener: no tenantId in payload, skipping');
                return;
            }

            // Strip internal fields, forward safe payload
            const safePayload = { ...payload };
            delete safePayload.tenantId;

            dispatch(tenantId, webhookEvent, safePayload).catch(err => {
                logger.error({ err, tenantId, webhookEvent }, 'Webhook dispatch error from event listener');
            });
        });
    }

    logger.info({ events: Object.keys(EVENT_MAP).length }, 'Webhook event listeners registered');
}

module.exports = { registerWebhookListeners };
