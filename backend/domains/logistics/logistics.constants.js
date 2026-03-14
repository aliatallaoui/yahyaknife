/**
 * Logistics Resolution Constants
 *
 * Canonical statuses, normalization outcomes, and delivery types
 * used across the logistics resolution pipeline.
 */

// ─── Normalization Status ────────────────────────────────────────────────────
// Outcome of matching raw source location → internal canonical geography

const NORMALIZATION_STATUS = {
    EXACT_MATCH:  'exact_match',
    ALIAS_MATCH:  'alias_match',
    FUZZY_MATCH:  'fuzzy_match',
    UNRESOLVED:   'unresolved'
};

// ─── Logistics Resolution Status ─────────────────────────────────────────────
// Overall logistics readiness of an order after courier assignment + validation

const LOGISTICS_STATUS = {
    RESOLVED:                       'resolved',
    NEEDS_REVIEW:                   'needs_review',
    UNSUPPORTED_WILAYA:             'unsupported_wilaya',
    UNSUPPORTED_COMMUNE:            'unsupported_commune',
    UNSUPPORTED_DELIVERY_TYPE:      'unsupported_delivery_type',
    STOP_DESK_NOT_AVAILABLE:        'stop_desk_not_available',
    NEAREST_OFFICE_SUGGESTED:       'nearest_office_suggested',
    FALLBACK_COURIER_SUGGESTED:     'fallback_courier_suggested',
    LOW_CONFIDENCE_LOCATION_MATCH:  'low_confidence_location_match',
    NO_COURIER_ASSIGNED:            'no_courier_assigned',
    NO_PRICING_RULE:                'no_pricing_rule',
    PENDING:                        'pending'
};

// Statuses that block dispatch
const BLOCKING_STATUSES = new Set([
    LOGISTICS_STATUS.UNSUPPORTED_WILAYA,
    LOGISTICS_STATUS.UNSUPPORTED_COMMUNE,
    LOGISTICS_STATUS.UNSUPPORTED_DELIVERY_TYPE,
    LOGISTICS_STATUS.STOP_DESK_NOT_AVAILABLE,
    LOGISTICS_STATUS.NO_COURIER_ASSIGNED
]);

// Statuses that warn but allow dispatch
const WARNING_STATUSES = new Set([
    LOGISTICS_STATUS.NEEDS_REVIEW,
    LOGISTICS_STATUS.NEAREST_OFFICE_SUGGESTED,
    LOGISTICS_STATUS.FALLBACK_COURIER_SUGGESTED,
    LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH,
    LOGISTICS_STATUS.NO_PRICING_RULE
]);

// ─── Delivery Types ──────────────────────────────────────────────────────────

const DELIVERY_TYPE = {
    HOME:      0,
    STOP_DESK: 1
};

// ─── Confidence Thresholds ───────────────────────────────────────────────────

const CONFIDENCE = {
    EXACT:     1.0,
    ALIAS:     0.9,
    FUZZY_HIGH: 0.75,
    FUZZY_LOW:  0.5,
    THRESHOLD:  0.6   // Below this → mark as low confidence
};

module.exports = {
    NORMALIZATION_STATUS,
    LOGISTICS_STATUS,
    BLOCKING_STATUSES,
    WARNING_STATUSES,
    DELIVERY_TYPE,
    CONFIDENCE
};
