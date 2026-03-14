/**
 * Commune / Wilaya Name Normalizer
 *
 * Each courier (Ecotrack, Yalidine) may spell commune and wilaya names
 * differently in their coverage data.  This utility matches an order's
 * commune/wilaya to the courier's version so the dispatch payload uses
 * exactly the name the courier API expects.
 *
 * Strategy:
 *  1. Exact match in CourierCoverage
 *  2. Case-insensitive + accent-stripped match
 *  3. Compressed match (remove spaces, hyphens, apostrophes)
 *  4. Return null if no match — caller decides what to do
 */

const CourierCoverage = require('../../models/CourierCoverage');
const { getWilayaByCode } = require('../constants/algeriaCommunes');

// ─── Text normalisation helpers ────────────────────────────────────────────

/** Strip diacritics / accents  (Béjaïa → Bejaia, Sétif → Setif) */
function stripAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Canonical form for fuzzy comparison */
function canonical(str) {
    return stripAccents(str)
        .toLowerCase()
        .replace(/[-'\s]+/g, '')   // remove hyphens, apostrophes, spaces
        .replace(/^el|^al/i, '')   // strip leading "el"/"al" for matching
        .trim();
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Find the courier-specific commune name that best matches the given commune.
 *
 * @param {string|ObjectId} courierId
 * @param {string|ObjectId} tenantId
 * @param {string}          wilayaCode   — "1"–"58"
 * @param {string}          communeName  — the commune as stored on the order
 * @returns {Promise<{commune:string, homeSupported:boolean, officeSupported:boolean}|null>}
 */
async function matchCommuneForCourier(courierId, tenantId, wilayaCode, communeName) {
    if (!courierId || !communeName) return null;

    const code = String(wilayaCode);

    // Fetch all communes for this courier + wilaya (typically < 50 rows)
    const coverageList = await CourierCoverage.find({
        courierId,
        tenant: tenantId,
        wilayaCode: code
    }).select('commune homeSupported officeSupported').lean();

    if (coverageList.length === 0) return null; // courier hasn't synced coverage

    // If all coverage records have null commune, this is wilaya-level coverage only.
    // The courier covers the entire wilaya — pass through with the first record's flags.
    const allNullCommune = coverageList.every(c => !c.commune);
    if (allNullCommune) {
        return { commune: communeName, homeSupported: coverageList[0].homeSupported, officeSupported: coverageList[0].officeSupported };
    }

    // 1. Exact match
    const exact = coverageList.find(c => c.commune === communeName);
    if (exact) return { commune: exact.commune, homeSupported: exact.homeSupported, officeSupported: exact.officeSupported };

    // 2. Case-insensitive + accent-stripped
    const inputLower = stripAccents(communeName).toLowerCase();
    const ci = coverageList.find(c => c.commune && stripAccents(c.commune).toLowerCase() === inputLower);
    if (ci) return { commune: ci.commune, homeSupported: ci.homeSupported, officeSupported: ci.officeSupported };

    // 3. Compressed match (ignore spaces, hyphens, apostrophes, el/al prefix)
    const inputCanon = canonical(communeName);
    const compressed = coverageList.find(c => c.commune && canonical(c.commune) === inputCanon);
    if (compressed) return { commune: compressed.commune, homeSupported: compressed.homeSupported, officeSupported: compressed.officeSupported };

    // 4. No match
    return null;
}

/**
 * Normalize an order's shipping fields to match the target courier's naming.
 *
 * Returns an object with the courier-compatible commune name (and coverage info),
 * or throws a descriptive error if the area is not covered.
 *
 * @param {Object} opts
 * @param {string|ObjectId} opts.courierId
 * @param {string|ObjectId} opts.tenantId
 * @param {string}          opts.wilayaCode
 * @param {string}          opts.wilayaName
 * @param {string}          opts.commune
 * @param {number}          opts.deliveryType  — 0=home, 1=stop desk
 * @returns {Promise<{commune:string, wilayaName:string}>}  courier-safe names
 */
async function normalizeForCourier({ courierId, tenantId, wilayaCode, wilayaName, commune, deliveryType }) {
    if (!courierId) {
        // No courier assigned — return as-is (global Ecotrack fallback uses codes)
        return { commune, wilayaName };
    }

    // Check if this courier has ANY synced coverage
    const hasCoverage = await CourierCoverage.exists({ courierId, tenant: tenantId });
    if (!hasCoverage) {
        // Courier hasn't synced coverage — pass through as-is, let courier API decide
        return { commune, wilayaName };
    }

    const match = await matchCommuneForCourier(courierId, tenantId, wilayaCode, commune);

    if (!match) {
        const location = commune && wilayaName ? `${commune}, ${wilayaName}` : wilayaName || `wilaya ${wilayaCode}`;
        const AppError = require('../errors/AppError');
        throw new AppError(
            `Courier does not cover "${location}". Please choose a different courier or update the delivery address.`,
            400,
            'AREA_NOT_COVERED'
        );
    }

    // Check delivery type support
    if (deliveryType === 1 && !match.officeSupported) {
        const AppError = require('../errors/AppError');
        throw new AppError(
            `Stop desk delivery is not available in ${match.commune}. Please switch to home delivery or choose a different commune.`,
            400,
            'STOP_DESK_NOT_AVAILABLE'
        );
    }

    // Return the courier's version of the commune name
    // Wilaya name: use the static reference (always correct)
    const wilaya = getWilayaByCode(wilayaCode);
    return {
        commune: match.commune,
        wilayaName: wilaya?.name || wilayaName
    };
}

module.exports = { matchCommuneForCourier, normalizeForCourier, canonical, stripAccents };
