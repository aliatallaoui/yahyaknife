/**
 * LocationNormalizer — Resolves raw source location strings into canonical
 * internal geography (InternalWilaya + InternalCommune).
 *
 * Strategy (in priority order):
 *  1. Exact match on officialFrName / officialArName
 *  2. Alias match (aliases array on the document)
 *  3. Fuzzy match (Levenshtein-based, with confidence score)
 *  4. Unresolved — raw value could not be matched
 *
 * Supports Arabic and French variants, accent stripping, and noise removal.
 */

const InternalWilaya = require('../../models/InternalWilaya');
const InternalCommune = require('../../models/InternalCommune');
const { NORMALIZATION_STATUS, CONFIDENCE } = require('./logistics.constants');

// ─── Text Normalisation ──────────────────────────────────────────────────────

/** Strip diacritics / accents  (Béjaïa → Bejaia, Sétif → Setif) */
function stripAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Remove Arabic diacritics (tashkeel) */
function stripArabicDiacritics(str) {
    return str.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '');
}

/**
 * Produce a canonical key for comparison.
 * Strips accents, lowercases, removes noise characters.
 */
function normalizeKey(str) {
    if (!str) return '';
    let s = stripAccents(str);
    s = stripArabicDiacritics(s);
    s = s.toLowerCase();
    // Remove hyphens, apostrophes, dots, extra spaces
    s = s.replace(/[-'.,()\s]+/g, '');
    // Strip common prefixes that vary between sources
    s = s.replace(/^(el|al|ou|oued|ain|beni|bir|bou|dj|has|ksar)/i, (m) => m); // keep but normalize
    return s.trim();
}

/**
 * Levenshtein distance — simple implementation for short commune names.
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

/**
 * Similarity score (0–1) based on Levenshtein distance.
 */
function similarity(a, b) {
    const keyA = normalizeKey(a);
    const keyB = normalizeKey(b);
    if (!keyA || !keyB) return 0;
    if (keyA === keyB) return 1;
    const dist = levenshtein(keyA, keyB);
    const maxLen = Math.max(keyA.length, keyB.length);
    return 1 - (dist / maxLen);
}

// ─── Wilaya Normalization ────────────────────────────────────────────────────

/**
 * Resolve a raw wilaya string or code to an InternalWilaya document.
 *
 * @param {string|number} rawWilaya — wilaya name or code
 * @returns {Promise<{wilaya: Object, status: string, confidence: number} | null>}
 */
async function normalizeWilaya(rawWilaya) {
    if (!rawWilaya && rawWilaya !== 0) return null;

    const raw = String(rawWilaya).trim();
    if (!raw) return null;

    // 1. Try by numeric code first
    const numCode = parseInt(raw, 10);
    if (!isNaN(numCode) && numCode >= 1 && numCode <= 58) {
        const byCode = await InternalWilaya.findOne({ code: numCode }).lean();
        if (byCode) return { wilaya: byCode, status: NORMALIZATION_STATUS.EXACT_MATCH, confidence: CONFIDENCE.EXACT };
    }

    const key = normalizeKey(raw);

    // 2. Exact match on normalizedKey
    const exact = await InternalWilaya.findOne({ normalizedKey: key }).lean();
    if (exact) return { wilaya: exact, status: NORMALIZATION_STATUS.EXACT_MATCH, confidence: CONFIDENCE.EXACT };

    // 3. Exact match on official names (case-insensitive)
    const byName = await InternalWilaya.findOne({
        $or: [
            { officialFrName: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') } },
            { officialArName: raw }
        ]
    }).lean();
    if (byName) return { wilaya: byName, status: NORMALIZATION_STATUS.EXACT_MATCH, confidence: CONFIDENCE.EXACT };

    // 4. Alias match
    const byAlias = await InternalWilaya.findOne({
        aliases: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') }
    }).lean();
    if (byAlias) return { wilaya: byAlias, status: NORMALIZATION_STATUS.ALIAS_MATCH, confidence: CONFIDENCE.ALIAS };

    // 5. Fuzzy match — scan all wilayas (only 58)
    const allWilayas = await InternalWilaya.find().lean();
    let bestMatch = null;
    let bestScore = 0;

    for (const w of allWilayas) {
        const candidates = [w.officialFrName, w.officialArName, ...w.aliases].filter(Boolean);
        for (const name of candidates) {
            const score = similarity(raw, name);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = w;
            }
        }
    }

    if (bestMatch && bestScore >= CONFIDENCE.THRESHOLD) {
        return {
            wilaya: bestMatch,
            status: NORMALIZATION_STATUS.FUZZY_MATCH,
            confidence: Math.round(bestScore * 100) / 100
        };
    }

    return null;
}

// ─── Commune Normalization ───────────────────────────────────────────────────

/**
 * Resolve a raw commune string to an InternalCommune document.
 *
 * @param {string} rawCommune
 * @param {number} wilayaCode — narrows search to communes in this wilaya
 * @returns {Promise<{commune: Object, status: string, confidence: number} | null>}
 */
async function normalizeCommune(rawCommune, wilayaCode) {
    if (!rawCommune) return null;

    const raw = String(rawCommune).trim();
    if (!raw) return null;

    const key = normalizeKey(raw);
    const filter = wilayaCode ? { wilayaCode } : {};

    // 1. Exact match on normalizedKey within wilaya
    const exact = await InternalCommune.findOne({ ...filter, normalizedKey: key }).lean();
    if (exact) return { commune: exact, status: NORMALIZATION_STATUS.EXACT_MATCH, confidence: CONFIDENCE.EXACT };

    // 2. Exact match on official names (case-insensitive)
    const byName = await InternalCommune.findOne({
        ...filter,
        $or: [
            { officialFrName: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') } },
            { officialArName: raw }
        ]
    }).lean();
    if (byName) return { commune: byName, status: NORMALIZATION_STATUS.EXACT_MATCH, confidence: CONFIDENCE.EXACT };

    // 3. Alias match
    const byAlias = await InternalCommune.findOne({
        ...filter,
        aliases: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') }
    }).lean();
    if (byAlias) return { commune: byAlias, status: NORMALIZATION_STATUS.ALIAS_MATCH, confidence: CONFIDENCE.ALIAS };

    // 4. Fuzzy match — scan communes in wilaya (typically < 50)
    const candidates = await InternalCommune.find(filter).lean();
    let bestMatch = null;
    let bestScore = 0;

    for (const c of candidates) {
        const names = [c.officialFrName, c.officialArName, ...c.aliases].filter(Boolean);
        for (const name of names) {
            const score = similarity(raw, name);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = c;
            }
        }
    }

    if (bestMatch && bestScore >= CONFIDENCE.THRESHOLD) {
        return {
            commune: bestMatch,
            status: NORMALIZATION_STATUS.FUZZY_MATCH,
            confidence: Math.round(bestScore * 100) / 100
        };
    }

    // 5. If wilaya was specified, try without wilaya constraint (cross-wilaya match)
    if (wilayaCode) {
        const crossWilaya = await normalizeCommune(rawCommune, null);
        if (crossWilaya) {
            // Lower confidence because it's outside the expected wilaya
            crossWilaya.confidence = Math.min(crossWilaya.confidence, CONFIDENCE.FUZZY_LOW);
            crossWilaya.status = NORMALIZATION_STATUS.FUZZY_MATCH;
            return crossWilaya;
        }
    }

    return null;
}

// ─── Full Normalization ──────────────────────────────────────────────────────

/**
 * Normalize both wilaya and commune from raw source values.
 *
 * @param {Object} params
 * @param {string} params.rawWilaya   — raw wilaya (name or code)
 * @param {string} params.rawCommune  — raw commune name
 * @returns {Promise<Object>} normalization result
 */
async function normalizeLocation({ rawWilaya, rawCommune }) {
    const result = {
        wilayaId:            null,
        communeId:           null,
        wilayaDoc:           null,
        communeDoc:          null,
        normalizationStatus: NORMALIZATION_STATUS.UNRESOLVED,
        confidenceScore:     0
    };

    // Normalize wilaya
    const wilayaResult = await normalizeWilaya(rawWilaya);
    if (wilayaResult) {
        result.wilayaId = wilayaResult.wilaya._id;
        result.wilayaDoc = wilayaResult.wilaya;
    }

    // Normalize commune (scoped to wilaya if resolved)
    const wilayaCode = wilayaResult?.wilaya?.code || null;
    const communeResult = await normalizeCommune(rawCommune, wilayaCode);
    if (communeResult) {
        result.communeId = communeResult.commune._id;
        result.communeDoc = communeResult.commune;
    }

    // Determine overall status and confidence
    if (wilayaResult && communeResult) {
        // Both resolved — take the worst status
        const statuses = [wilayaResult.status, communeResult.status];
        if (statuses.includes(NORMALIZATION_STATUS.FUZZY_MATCH)) {
            result.normalizationStatus = NORMALIZATION_STATUS.FUZZY_MATCH;
        } else if (statuses.includes(NORMALIZATION_STATUS.ALIAS_MATCH)) {
            result.normalizationStatus = NORMALIZATION_STATUS.ALIAS_MATCH;
        } else {
            result.normalizationStatus = NORMALIZATION_STATUS.EXACT_MATCH;
        }
        result.confidenceScore = Math.min(wilayaResult.confidence, communeResult.confidence);
    } else if (wilayaResult) {
        // Only wilaya resolved
        result.normalizationStatus = NORMALIZATION_STATUS.FUZZY_MATCH;
        result.confidenceScore = wilayaResult.confidence * 0.5; // penalize partial match
    } else {
        result.normalizationStatus = NORMALIZATION_STATUS.UNRESOLVED;
        result.confidenceScore = 0;
    }

    return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    normalizeLocation,
    normalizeWilaya,
    normalizeCommune,
    normalizeKey,
    stripAccents,
    stripArabicDiacritics,
    similarity,
    levenshtein
};
