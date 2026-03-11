/**
 * OrderStateMachine — enforces valid status transitions for COD orders.
 *
 * Usage:
 *   const { canTransition, assertTransition } = require('./order.statemachine');
 *
 *   assertTransition('New', 'Confirmed');          // ok — throws AppError otherwise
 *   const ok = canTransition('Delivered', 'New');  // false
 *
 * Design:
 *   - TRANSITIONS maps each status to the set of statuses it may move to.
 *   - Terminal statuses map to empty sets (no egress).
 *   - Admin override (bypass = true) skips the check — for data corrections only.
 */

const AppError = require('../../shared/errors/AppError');

// ─── Valid transition table ────────────────────────────────────────────────────
const TRANSITIONS = {
    // Pre-dispatch confirmation loop
    'New':                  new Set(['Call 1', 'Call 2', 'Call 3', 'No Answer', 'Wrong Number', 'Postponed', 'Out of Coverage', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Call 1':               new Set(['Call 2', 'No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Call 2':               new Set(['Call 3', 'No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Call 3':               new Set(['No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'No Answer':            new Set(['Call 1', 'Call 2', 'Call 3', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Postponed':            new Set(['Call 1', 'Call 2', 'Call 3', 'Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Wrong Number':         new Set(['Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Out of Coverage':      new Set(['Confirmed', 'Cancelled', 'Cancelled by Customer']),
    'Cancelled by Customer':new Set(['Confirmed']), // Customer re-contacts and re-confirms

    // Pre-dispatch fulfillment
    'Confirmed':            new Set(['Preparing', 'Dispatched', 'Cancelled']),
    'Preparing':            new Set(['Ready for Pickup', 'Cancelled']),
    'Ready for Pickup':     new Set(['Dispatched', 'Cancelled']),

    // Post-dispatch delivery
    'Dispatched':           new Set(['Shipped', 'Out for Delivery', 'Returned', 'Refused']),
    'Shipped':              new Set(['Out for Delivery', 'Delivered', 'Returned', 'Refused']),
    'Out for Delivery':     new Set(['Delivered', 'Returned', 'Refused']),

    // Settlement
    'Delivered':            new Set(['Paid', 'Returned']), // Returned: courier couldn't collect cash
    'Paid':                 new Set([]),                   // Terminal

    // Terminal
    'Cancelled':            new Set([]),
    'Refused':              new Set([]),
    'Returned':             new Set([]),
};

/**
 * Returns true if `from` → `to` is a valid transition.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransition(from, to) {
    const allowed = TRANSITIONS[from];
    if (!allowed) return false; // unknown status
    return allowed.has(to);
}

/**
 * Asserts that `from` → `to` is valid; throws AppError.invalidTransition otherwise.
 * Pass `bypass = true` for admin data-correction overrides.
 * @param {string} from
 * @param {string} to
 * @param {boolean} [bypass=false]
 */
function assertTransition(from, to, bypass = false) {
    if (bypass) return;
    if (!canTransition(from, to)) {
        throw AppError.invalidTransition(from, to);
    }
}

/**
 * Returns all statuses reachable from `from` (for UI dropdown filtering).
 * @param {string} from
 * @returns {string[]}
 */
function allowedTransitions(from) {
    const allowed = TRANSITIONS[from];
    return allowed ? [...allowed] : [];
}

module.exports = { canTransition, assertTransition, allowedTransitions, TRANSITIONS };
