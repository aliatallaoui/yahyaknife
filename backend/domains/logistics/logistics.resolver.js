/**
 * LogisticsResolver — Orchestrates the full logistics resolution pipeline:
 *
 *   raw source → normalize → assign courier → map to courier → validate →
 *   calculate price → determine resolution status → store result
 *
 * This is the single entry point for resolving order logistics. It is called:
 *   1. When a new order is created (from any channel)
 *   2. When a courier is changed on an existing order
 *   3. When manually re-resolving from the UI
 */

const Courier = require('../../models/Courier');
const CourierPricing = require('../../models/CourierPricing');
const { normalizeLocation } = require('./location.normalizer');
const { mapToCourier, hasCourierMappings } = require('./courier.mapper');
const {
    NORMALIZATION_STATUS,
    LOGISTICS_STATUS,
    CONFIDENCE,
    DELIVERY_TYPE
} = require('./logistics.constants');
const logger = require('../../shared/logger');

/**
 * Full logistics resolution for an order.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.tenantId
 * @param {string}          params.rawWilaya    — raw wilaya name or code from source
 * @param {string}          params.rawCommune   — raw commune name from source
 * @param {string}          params.rawAddress   — raw address from source
 * @param {string|ObjectId} params.courierId    — assigned courier (null if none)
 * @param {number}          params.deliveryType — 0=home, 1=stop desk
 * @param {string|ObjectId} [params.fallbackCourierId] — optional fallback courier
 * @param {boolean}         [params.autoAssign] — whether to auto-assign courier
 * @param {string|ObjectId} [params.defaultCourierId] — default courier from channel
 * @returns {Promise<Object>} complete resolution result
 */
async function resolveLogistics({
    tenantId,
    rawWilaya,
    rawCommune,
    rawAddress,
    courierId,
    deliveryType = 0,
    fallbackCourierId = null,
    autoAssign = false,
    defaultCourierId = null
}) {
    const resolution = {
        // Raw source (preserved)
        rawSource: {
            wilaya:  rawWilaya || '',
            commune: rawCommune || '',
            address: rawAddress || ''
        },

        // Internal geography
        internalGeography: {
            wilayaId:            null,
            communeId:           null,
            normalizationStatus: null,
            confidenceScore:     0
        },

        // Courier assignment
        selectedCourierId: courierId || null,
        courierName: '',

        // Courier-specific geography
        courierGeography: {
            courierWilayaName:  '',
            courierWilayaCode:  '',
            courierCommuneName: '',
            courierCommuneCode: '',
            stopDeskAvailable:  null,
            nearestOfficeCommuneId:   null,
            nearestOfficeCommuneName: ''
        },

        // Pricing
        deliveryFee: null,

        // Resolution
        logistics: {
            resolutionStatus: LOGISTICS_STATUS.PENDING,
            warningMessage:   '',
            fallbackCourierUsed: false,
            fallbackCourierId:   null,
            resolvedAt: null
        },

        // Shipping fields to update on order
        shippingUpdates: {}
    };

    try {
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Normalize raw location → internal geography
        // ═══════════════════════════════════════════════════════════════════════
        const normResult = await normalizeLocation({
            rawWilaya:  rawWilaya,
            rawCommune: rawCommune
        });

        resolution.internalGeography = {
            wilayaId:            normResult.wilayaId,
            communeId:           normResult.communeId,
            normalizationStatus: normResult.normalizationStatus,
            confidenceScore:     normResult.confidenceScore
        };

        // Update shipping with normalized names
        if (normResult.wilayaDoc) {
            resolution.shippingUpdates.wilayaCode = String(normResult.wilayaDoc.code);
            resolution.shippingUpdates.wilayaName = normResult.wilayaDoc.officialFrName;
        }
        if (normResult.communeDoc) {
            resolution.shippingUpdates.commune = normResult.communeDoc.officialFrName;
        }

        // If normalization failed, mark as unresolved early
        if (normResult.normalizationStatus === NORMALIZATION_STATUS.UNRESOLVED) {
            resolution.logistics.resolutionStatus = LOGISTICS_STATUS.NEEDS_REVIEW;
            resolution.logistics.warningMessage = 'Could not match wilaya or commune to internal geography. Manual review needed.';
            return resolution;
        }

        // Low confidence warning
        if (normResult.confidenceScore < CONFIDENCE.THRESHOLD) {
            resolution.logistics.resolutionStatus = LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH;
            resolution.logistics.warningMessage = `Location matched with low confidence (${Math.round(normResult.confidenceScore * 100)}%). Please verify.`;
            // Don't return early — continue to try courier mapping
        }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Assign courier (if auto-assign enabled and none assigned)
        // ═══════════════════════════════════════════════════════════════════════
        if (!resolution.selectedCourierId && autoAssign && defaultCourierId) {
            resolution.selectedCourierId = defaultCourierId;
        }

        if (!resolution.selectedCourierId) {
            resolution.logistics.resolutionStatus = LOGISTICS_STATUS.NO_COURIER_ASSIGNED;
            resolution.logistics.warningMessage = 'No courier assigned. Assign a courier to complete logistics resolution.';
            return resolution;
        }

        // Fetch courier name
        const courier = await Courier.findOne({
            _id: resolution.selectedCourierId,
            tenant: tenantId,
            deletedAt: null
        }).select('name').lean();
        if (courier) resolution.courierName = courier.name;

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: Map internal geography → courier-specific geography
        // ═══════════════════════════════════════════════════════════════════════
        const hasMappings = await hasCourierMappings(resolution.selectedCourierId, tenantId);

        if (hasMappings) {
            const mappingResult = await mapToCourier({
                courierId:        resolution.selectedCourierId,
                tenantId,
                internalWilayaId:  normResult.wilayaId,
                internalCommuneId: normResult.communeId,
                deliveryType
            });

            resolution.courierGeography = {
                courierWilayaName:  mappingResult.courierWilayaName,
                courierWilayaCode:  mappingResult.courierWilayaCode,
                courierCommuneName: mappingResult.courierCommuneName,
                courierCommuneCode: mappingResult.courierCommuneCode,
                stopDeskAvailable:  mappingResult.stopDeskAvailable,
                nearestOfficeCommuneId:   mappingResult.nearestOfficeCommuneId,
                nearestOfficeCommuneName: mappingResult.nearestOfficeCommuneName
            };

            // ═══════════════════════════════════════════════════════════════════
            // STEP 4: Validate coverage
            // ═══════════════════════════════════════════════════════════════════
            if (!mappingResult.wilayaSupported) {
                // Try fallback courier
                const fallbackResult = await tryFallbackCourier({
                    tenantId, fallbackCourierId,
                    internalWilayaId: normResult.wilayaId,
                    internalCommuneId: normResult.communeId,
                    deliveryType, resolution
                });
                if (fallbackResult) return fallbackResult;

                resolution.logistics.resolutionStatus = LOGISTICS_STATUS.UNSUPPORTED_WILAYA;
                resolution.logistics.warningMessage = 'Courier does not cover this wilaya.';
                return resolution;
            }

            if (!mappingResult.communeSupported) {
                const fallbackResult = await tryFallbackCourier({
                    tenantId, fallbackCourierId,
                    internalWilayaId: normResult.wilayaId,
                    internalCommuneId: normResult.communeId,
                    deliveryType, resolution
                });
                if (fallbackResult) return fallbackResult;

                resolution.logistics.resolutionStatus = LOGISTICS_STATUS.UNSUPPORTED_COMMUNE;
                resolution.logistics.warningMessage = `Courier does not cover this commune.${mappingResult.nearestOfficeCommuneName ? ` Nearest office: ${mappingResult.nearestOfficeCommuneName}.` : ''}`;
                return resolution;
            }

            if (!mappingResult.deliveryTypeSupported) {
                if (deliveryType === DELIVERY_TYPE.STOP_DESK && !mappingResult.stopDeskAvailable) {
                    resolution.logistics.resolutionStatus = LOGISTICS_STATUS.STOP_DESK_NOT_AVAILABLE;
                    resolution.logistics.warningMessage = `Stop desk not available in this commune.${
                        mappingResult.nearestOfficeCommuneName ? ` Nearest office: ${mappingResult.nearestOfficeCommuneName}.` : ''
                    }${mappingResult.homeDeliveryAvailable ? ' Home delivery is available as alternative.' : ''}`;

                    if (mappingResult.nearestOfficeCommuneId) {
                        resolution.logistics.resolutionStatus = LOGISTICS_STATUS.NEAREST_OFFICE_SUGGESTED;
                    }
                    return resolution;
                }

                resolution.logistics.resolutionStatus = LOGISTICS_STATUS.UNSUPPORTED_DELIVERY_TYPE;
                resolution.logistics.warningMessage = mappingResult.warnings.join(' ');
                return resolution;
            }

            // Override shipping with courier-specific names
            if (mappingResult.courierWilayaName) {
                resolution.shippingUpdates.wilayaName = mappingResult.courierWilayaName;
            }
            if (mappingResult.courierCommuneName) {
                resolution.shippingUpdates.commune = mappingResult.courierCommuneName;
            }
        }
        // If no mappings exist, skip courier mapping validation (pass-through)

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: Calculate delivery fee
        // ═══════════════════════════════════════════════════════════════════════
        const fee = await calculateDeliveryFee({
            courierId: resolution.selectedCourierId,
            tenantId,
            wilayaCode: resolution.shippingUpdates.wilayaCode || String(normResult.wilayaDoc?.code || ''),
            commune:    resolution.shippingUpdates.commune || normResult.communeDoc?.officialFrName || '',
            deliveryType
        });

        resolution.deliveryFee = fee;

        if (fee === null) {
            // No pricing rule — still allow resolution but warn
            const currentStatus = resolution.logistics.resolutionStatus;
            if (currentStatus === LOGISTICS_STATUS.PENDING || currentStatus === LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH) {
                resolution.logistics.resolutionStatus = LOGISTICS_STATUS.NO_PRICING_RULE;
                resolution.logistics.warningMessage = (resolution.logistics.warningMessage
                    ? resolution.logistics.warningMessage + ' '
                    : '') + 'No pricing rule found for this route. Delivery fee must be set manually.';
            }
            return resolution;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: Mark as resolved
        // ═══════════════════════════════════════════════════════════════════════
        if (resolution.logistics.resolutionStatus === LOGISTICS_STATUS.PENDING) {
            resolution.logistics.resolutionStatus = LOGISTICS_STATUS.RESOLVED;
        }
        resolution.logistics.resolvedAt = new Date();

        // If low confidence, keep that status but still proceed
        if (normResult.confidenceScore < CONFIDENCE.THRESHOLD) {
            resolution.logistics.resolutionStatus = LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH;
        }

    } catch (err) {
        logger.error({ err }, 'LogisticsResolver: unexpected error during resolution');
        resolution.logistics.resolutionStatus = LOGISTICS_STATUS.NEEDS_REVIEW;
        resolution.logistics.warningMessage = 'Logistics resolution encountered an error. Manual review needed.';
    }

    return resolution;
}

// ─── Fallback Courier Logic ──────────────────────────────────────────────────

/**
 * Attempt to resolve logistics using the fallback courier.
 * Returns a modified resolution if fallback works, null if it doesn't.
 */
async function tryFallbackCourier({ tenantId, fallbackCourierId, internalWilayaId, internalCommuneId, deliveryType, resolution }) {
    if (!fallbackCourierId) return null;

    const fallbackCourier = await Courier.findOne({
        _id: fallbackCourierId,
        tenant: tenantId,
        deletedAt: null
    }).select('name').lean();
    if (!fallbackCourier) return null;

    const hasMappings = await hasCourierMappings(fallbackCourierId, tenantId);
    if (!hasMappings) return null;

    const mappingResult = await mapToCourier({
        courierId: fallbackCourierId,
        tenantId,
        internalWilayaId,
        internalCommuneId,
        deliveryType
    });

    if (!mappingResult.wilayaSupported || !mappingResult.communeSupported || !mappingResult.deliveryTypeSupported) {
        return null; // Fallback also can't serve this location
    }

    // Fallback works — update resolution
    resolution.selectedCourierId = fallbackCourierId;
    resolution.courierName = fallbackCourier.name;
    resolution.logistics.fallbackCourierUsed = true;
    resolution.logistics.fallbackCourierId = fallbackCourierId;

    resolution.courierGeography = {
        courierWilayaName:  mappingResult.courierWilayaName,
        courierWilayaCode:  mappingResult.courierWilayaCode,
        courierCommuneName: mappingResult.courierCommuneName,
        courierCommuneCode: mappingResult.courierCommuneCode,
        stopDeskAvailable:  mappingResult.stopDeskAvailable,
        nearestOfficeCommuneId:   mappingResult.nearestOfficeCommuneId,
        nearestOfficeCommuneName: mappingResult.nearestOfficeCommuneName
    };

    // Update shipping
    if (mappingResult.courierWilayaName) {
        resolution.shippingUpdates.wilayaName = mappingResult.courierWilayaName;
    }
    if (mappingResult.courierCommuneName) {
        resolution.shippingUpdates.commune = mappingResult.courierCommuneName;
    }

    // Calculate fee with fallback courier
    const fee = await calculateDeliveryFee({
        courierId: fallbackCourierId,
        tenantId,
        wilayaCode: resolution.shippingUpdates.wilayaCode || '',
        commune:    resolution.shippingUpdates.commune || '',
        deliveryType
    });

    resolution.deliveryFee = fee;
    resolution.logistics.resolutionStatus = LOGISTICS_STATUS.FALLBACK_COURIER_SUGGESTED;
    resolution.logistics.warningMessage = `Default courier does not cover this area. Fallback courier "${fallbackCourier.name}" assigned automatically.`;
    resolution.logistics.resolvedAt = new Date();

    return resolution;
}

// ─── Delivery Fee Calculation ────────────────────────────────────────────────

/**
 * Calculate delivery fee based on courier pricing rules.
 * Priority: Wilaya+Commune > Wilaya > Flat.
 *
 * @returns {Promise<number|null>} fee amount or null if no rule
 */
async function calculateDeliveryFee({ courierId, tenantId, wilayaCode, commune, deliveryType }) {
    if (!courierId || !tenantId) return null;

    // Find best matching pricing rule (ordered by priority)
    const rules = await CourierPricing.find({
        tenant: tenantId,
        courierId
    }).sort({ priority: -1 }).lean();

    if (rules.length === 0) return null;

    // 1. Wilaya+Commune exact match with delivery type
    let match = rules.find(r =>
        r.ruleType === 'Wilaya+Commune' &&
        r.wilayaCode === wilayaCode &&
        r.commune === commune &&
        (r.deliveryType === deliveryType || r.deliveryType == null)
    );
    if (match) return match.price;

    // 2. Wilaya exact match with delivery type
    match = rules.find(r =>
        r.ruleType === 'Wilaya' &&
        r.wilayaCode === wilayaCode &&
        (r.deliveryType === deliveryType || r.deliveryType == null)
    );
    if (match) return match.price;

    // 3. Flat rate
    match = rules.find(r => r.ruleType === 'Flat');
    if (match) return match.price;

    return null;
}

/**
 * Re-resolve logistics for an existing order when courier changes.
 * Keeps raw source and internal geography intact, only re-maps courier + validates.
 */
async function reResolveForCourierChange({
    tenantId,
    internalWilayaId,
    internalCommuneId,
    rawWilaya,
    rawCommune,
    rawAddress,
    newCourierId,
    deliveryType,
    fallbackCourierId = null
}) {
    // Re-run full resolution but with already-known internal geography
    return resolveLogistics({
        tenantId,
        rawWilaya,
        rawCommune,
        rawAddress,
        courierId: newCourierId,
        deliveryType,
        fallbackCourierId
    });
}

module.exports = {
    resolveLogistics,
    reResolveForCourierChange,
    calculateDeliveryFee
};
