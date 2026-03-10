const CourierPricing = require('../models/CourierPricing');

/**
 * Calculates the delivery fee based on priority rules for a specific courier.
 * 
 * @param {Object} payload 
 * @param {String} payload.courierId
 * @param {String} payload.wilayaCode
 * @param {String} payload.commune
 * @param {Number} payload.deliveryType - 0 for Home, 1 for Office (Stop Desk)
 * @param {Array} payload.productIds - Array of ObjectIds of products in the order
 * @param {Number} payload.totalWeight - Total weight of the order in kg
 * @returns {Number} the calculated delivery fee
 */
async function calculateDeliveryFee({ courierId, wilayaCode, commune, deliveryType, productIds = [], totalWeight = 0 }) {
    if (!courierId) return 0; // Or throw error

    // Fetch all pricing rules for this courier, sorted by priority (descending)
    const rules = await CourierPricing.find({ courierId }).sort({ priority: -1 });

    if (!rules || rules.length === 0) {
        return 0; // No pricing rules exist, fallback to 0 or we could add a default Courier-level fallback price later.
    }

    // Evaluate rules from highest priority to lowest
    for (const rule of rules) {
        if (isMatch(rule, { wilayaCode, commune, deliveryType, productIds, totalWeight })) {
            return rule.price;
        }
    }

    // Fallback if no rules match
    // We could return a systemic default or 0
    return 0;
}

/**
 * Helper to determine if a rule matches the order payload.
 */
function isMatch(rule, payload) {
    const { ruleType } = rule;
    const { wilayaCode, commune, deliveryType, productIds, totalWeight } = payload;

    switch (ruleType) {
        case 'Flat':
            // Flat rule applies to EVERYTHING (used as a global fallback usually)
            return true;
            
        case 'Wilaya':
            if (rule.wilayaCode === wilayaCode) {
                // If delivery type is specified in the rule, it must match. Otherwise, applies to both.
                if (rule.deliveryType !== undefined && rule.deliveryType !== null) {
                    return rule.deliveryType === deliveryType;
                }
                return true;
            }
            return false;
            
        case 'Wilaya+Commune':
            if (rule.wilayaCode === wilayaCode && rule.commune === commune) {
                if (rule.deliveryType !== undefined && rule.deliveryType !== null) {
                    return rule.deliveryType === deliveryType;
                }
                return true;
            }
            return false;

        case 'Product':
            // Rule matches if ANY of the order's products are in the rule's productIds array
            if (rule.productIds && rule.productIds.length > 0 && productIds && productIds.length > 0) {
                const hasMatchingProduct = productIds.some(pid => 
                    rule.productIds.some(rpid => rpid.toString() === pid.toString())
                );
                
                if (hasMatchingProduct) {
                    // Check secondary geo limits if they exist
                    if (rule.wilayaCode && rule.wilayaCode !== wilayaCode) return false;
                    return true;
                }
            }
            return false;

        case 'Weight':
            const minW = rule.minWeight || 0;
            const maxW = rule.maxWeight || Infinity;
            
            if (totalWeight >= minW && totalWeight <= maxW) {
                // Check secondary geo limits if they exist
                if (rule.wilayaCode && rule.wilayaCode !== wilayaCode) return false;
                if (rule.deliveryType !== undefined && rule.deliveryType !== null && rule.deliveryType !== deliveryType) return false;
                return true;
            }
            return false;

        default:
            return false;
    }
}

module.exports = {
    calculateDeliveryFee
};
