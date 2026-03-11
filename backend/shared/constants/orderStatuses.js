/**
 * ORDER STATUS CONSTANTS — single source of truth for the entire backend.
 *
 * Frontend mirrors these via i18n keys.
 * The state machine (domains/orders/order.statemachine.js) enforces valid transitions.
 *
 * COD Lifecycle:
 *   PRE-DISPATCH  → DISPATCH → POST-DISPATCH → SETTLEMENT
 */

// ─── Pre-dispatch statuses ────────────────────────────────────────────────────
const PRE_DISPATCH = [
    'New',
    'Call 1',
    'Call 2',
    'Call 3',
    'No Answer',
    'Out of Coverage',
    'Postponed',
    'Wrong Number',
    'Cancelled by Customer',
    'Confirmed',
    'Preparing',
    'Ready for Pickup',
];

// ─── Post-dispatch statuses ───────────────────────────────────────────────────
const POST_DISPATCH = [
    'Dispatched',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Paid',
];

// ─── Terminal statuses (no further transitions) ───────────────────────────────
const TERMINAL = [
    'Cancelled',
    'Refused',
    'Returned',
];

// ─── All statuses (used for Mongoose enum) ────────────────────────────────────
const ALL_STATUSES = [...PRE_DISPATCH, ...POST_DISPATCH, ...TERMINAL];

// ─── Semantic groups (used in queries throughout the app) ─────────────────────

/** Orders whose cash has been physically collected by the courier */
const COD_COLLECTED = ['Delivered', 'Paid'];

/** Orders that are "active" — stock is reserved/deducted */
const INACTIVE = ['Cancelled', 'Cancelled by Customer', 'Returned', 'Refused'];

/** Orders whose stock has been physically deducted (fully fulfilled) */
const FULFILLED = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'];

/** Return-category orders */
const RETURNS = ['Returned', 'Refused'];

module.exports = {
    PRE_DISPATCH,
    POST_DISPATCH,
    TERMINAL,
    ALL_STATUSES,
    COD_COLLECTED,
    INACTIVE,
    FULFILLED,
    RETURNS,
};
