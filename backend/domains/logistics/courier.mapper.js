/**
 * CourierMapper — Maps internal canonical geography to courier-specific geography,
 * validates coverage, stop desk support, and suggests nearest offices.
 *
 * This is the bridge between the platform's internal geography and what each
 * courier API expects. Each courier may spell names differently, use different
 * codes, and have different coverage areas.
 */

const CourierWilayaMapping = require('../../models/CourierWilayaMapping');
const CourierCommuneMapping = require('../../models/CourierCommuneMapping');
const InternalCommune = require('../../models/InternalCommune');
const { DELIVERY_TYPE } = require('./logistics.constants');

/**
 * Map an internal wilaya+commune to courier-specific geography and validate coverage.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.courierId
 * @param {string|ObjectId} params.tenantId
 * @param {string|ObjectId} params.internalWilayaId
 * @param {string|ObjectId} params.internalCommuneId
 * @param {number}          params.deliveryType — 0=home, 1=stop desk
 * @returns {Promise<Object>} mapping result
 */
async function mapToCourier({ courierId, tenantId, internalWilayaId, internalCommuneId, deliveryType = 0 }) {
    const result = {
        courierWilayaName:  '',
        courierWilayaCode:  '',
        courierCommuneName: '',
        courierCommuneCode: '',
        stopDeskAvailable:  false,
        homeDeliveryAvailable: false,
        wilayaSupported:    false,
        communeSupported:   false,
        deliveryTypeSupported: false,
        nearestOfficeCommuneId:   null,
        nearestOfficeCommuneName: '',
        officeCount:        0,
        warnings:           []
    };

    if (!courierId || !tenantId) return result;

    // ── Wilaya Mapping ───────────────────────────────────────────────────────
    if (internalWilayaId) {
        const wilayaMapping = await CourierWilayaMapping.findOne({
            tenant: tenantId,
            courierId,
            internalWilaya: internalWilayaId
        }).lean();

        if (wilayaMapping) {
            result.wilayaSupported = true;
            result.courierWilayaName = wilayaMapping.courierWilayaName;
            result.courierWilayaCode = wilayaMapping.courierWilayaCode;
        } else {
            result.warnings.push('Courier does not have a mapping for this wilaya');
            return result;
        }
    }

    // ── Commune Mapping ──────────────────────────────────────────────────────
    if (internalCommuneId) {
        const communeMapping = await CourierCommuneMapping.findOne({
            tenant: tenantId,
            courierId,
            internalCommune: internalCommuneId
        }).lean();

        if (communeMapping) {
            result.communeSupported = true;
            result.courierCommuneName = communeMapping.courierCommuneName;
            result.courierCommuneCode = communeMapping.courierCommuneCode || '';
            result.stopDeskAvailable = communeMapping.supportsStopDesk;
            result.homeDeliveryAvailable = communeMapping.supportsHomeDelivery;
            result.officeCount = communeMapping.officeCount || 0;

            // Validate delivery type
            if (deliveryType === DELIVERY_TYPE.STOP_DESK) {
                if (communeMapping.supportsStopDesk) {
                    result.deliveryTypeSupported = true;
                } else {
                    result.deliveryTypeSupported = false;
                    result.warnings.push('Stop desk delivery is not available in this commune');

                    // Suggest nearest office if available
                    if (communeMapping.nearestOfficeCommune) {
                        result.nearestOfficeCommuneId = communeMapping.nearestOfficeCommune;
                        const nearestCommune = await InternalCommune.findById(communeMapping.nearestOfficeCommune)
                            .select('officialFrName').lean();
                        if (nearestCommune) {
                            result.nearestOfficeCommuneName = nearestCommune.officialFrName;
                            result.warnings.push(`Nearest stop desk office: ${nearestCommune.officialFrName}`);
                        }
                    }

                    // Suggest home delivery if supported
                    if (communeMapping.supportsHomeDelivery) {
                        result.warnings.push('Home delivery is available as an alternative');
                    }
                }
            } else {
                // Home delivery
                result.deliveryTypeSupported = communeMapping.supportsHomeDelivery;
                if (!communeMapping.supportsHomeDelivery) {
                    result.warnings.push('Home delivery is not available in this commune');
                    if (communeMapping.supportsStopDesk) {
                        result.warnings.push('Stop desk delivery is available as an alternative');
                    }
                }
            }
        } else {
            result.warnings.push('Courier does not cover this commune');

            // Try to find nearest communes with stop desk support in same wilaya
            if (deliveryType === DELIVERY_TYPE.STOP_DESK && internalWilayaId) {
                const nearestOffice = await findNearestOffice(courierId, tenantId, internalCommuneId);
                if (nearestOffice) {
                    result.nearestOfficeCommuneId = nearestOffice._id;
                    result.nearestOfficeCommuneName = nearestOffice.officialFrName;
                    result.warnings.push(`Nearest stop desk office: ${nearestOffice.officialFrName}`);
                }
            }
        }
    }

    return result;
}

/**
 * Check if a courier has any mapping data for a tenant.
 * Used to decide whether to run mapping validation or skip it.
 */
async function hasCourierMappings(courierId, tenantId) {
    const count = await CourierCommuneMapping.countDocuments({
        tenant: tenantId,
        courierId
    });
    return count > 0;
}

/**
 * Find the nearest commune with stop desk support from the same wilaya.
 * Simple approach: find any commune with officeCount > 0 in the same wilaya.
 *
 * @param {string|ObjectId} courierId
 * @param {string|ObjectId} tenantId
 * @param {string|ObjectId} communeId — the commune without stop desk
 * @returns {Promise<Object|null>} InternalCommune document or null
 */
async function findNearestOffice(courierId, tenantId, communeId) {
    // Get the wilaya of the target commune
    const commune = await InternalCommune.findById(communeId).select('wilayaCode').lean();
    if (!commune) return null;

    // Find communes in same wilaya that have stop desk with this courier
    const mappingsWithOffice = await CourierCommuneMapping.find({
        tenant: tenantId,
        courierId,
        supportsStopDesk: true
    }).select('internalCommune').lean();

    if (mappingsWithOffice.length === 0) return null;

    const communeIds = mappingsWithOffice.map(m => m.internalCommune);

    // Find one from the same wilaya
    const nearest = await InternalCommune.findOne({
        _id: { $in: communeIds },
        wilayaCode: commune.wilayaCode
    }).select('officialFrName wilayaCode').lean();

    return nearest;
}

module.exports = {
    mapToCourier,
    hasCourierMappings,
    findNearestOffice
};
