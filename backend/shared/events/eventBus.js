/**
 * EventBus — lightweight in-process event emitter for domain decoupling.
 *
 * Domains emit events; other domains listen without direct coupling.
 * Replace with Redis Pub/Sub when horizontal scaling is needed.
 *
 * Usage (emitting):
 *   const eventBus = require('../shared/events/eventBus');
 *   eventBus.emit('order.confirmed', { tenantId, orderId, customerId, confirmedBy });
 *
 * Usage (listening — register in domain bootstrap or server.js):
 *   eventBus.on('order.confirmed', async (payload) => { ... });
 *
 * Event naming convention: "domain.action"  (e.g. order.dispatched, shipment.delivered)
 */

const { EventEmitter } = require('events');
const logger = require('../logger');

class DomainEventBus extends EventEmitter {
    /**
     * Emit a domain event. All errors in async listeners are caught and logged
     * so one bad listener never breaks the emitter.
     */
    emit(event, payload) {
        // Log all domain events in non-production environments for traceability
        if (process.env.NODE_ENV !== 'production') {
            logger.debug({ event, payload }, '[EVENT] Domain event emitted');
        }
        return super.emit(event, payload);
    }

    /**
     * Register an async listener. Errors are caught to prevent crashing the process.
     */
    on(event, listener) {
        const wrapped = async (payload) => {
            try {
                await listener(payload);
            } catch (err) {
                logger.error({ err, event }, `[EVENT ERROR] Handler for '${event}' failed`);
            }
        };
        return super.on(event, wrapped);
    }
}

// Singleton — the whole app shares one bus
const eventBus = new DomainEventBus();
eventBus.setMaxListeners(50); // increase from default 10 for multi-domain fan-out

// ─── Domain Event Name Constants ─────────────────────────────────────────────
const EVENTS = {
    // Orders
    ORDER_CREATED:          'order.created',
    ORDER_CONFIRMED:        'order.confirmed',
    ORDER_CANCELLED:        'order.cancelled',
    ORDER_DISPATCHED:       'order.dispatched',
    ORDER_DELIVERED:        'order.delivered',
    ORDER_RETURNED:         'order.returned',
    ORDER_STATUS_CHANGED:   'order.status.changed',

    // Shipments
    SHIPMENT_CREATED:       'shipment.created',
    SHIPMENT_IN_TRANSIT:    'shipment.inTransit',
    SHIPMENT_DELIVERED:     'shipment.delivered',
    SHIPMENT_RETURNED:      'shipment.returned',

    // Finance
    SETTLEMENT_RECORDED:    'settlement.recorded',
    COURIER_CASH_UPDATED:   'courier.cash.updated',

    // Customer
    CUSTOMER_RISK_UPDATED:  'customer.risk.updated',

    // Store Integrations
    STORE_ORDER_IMPORTED:   'store.order.imported',
    STORE_SYNC_COMPLETED:   'store.sync.completed',
    STORE_CONNECTION_ERROR:  'store.connection.error',

    // Analytics
    KPI_INVALIDATED:        'kpi.invalidated',
};

module.exports = { eventBus, EVENTS };
