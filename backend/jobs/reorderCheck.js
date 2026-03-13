const ProductVariant = require('../models/ProductVariant');
const ReorderAlert = require('../models/ReorderAlert');
const logger = require('../shared/logger');

/**
 * Scans all active variants and creates ReorderAlert documents
 * for any variant whose available stock (totalStock - reservedStock)
 * has dropped to or below its reorderLevel.
 *
 * Idempotent: skips variants that already have an 'Open' alert.
 * Suggested reorder quantity = 2 × reorderLevel − availableStock
 * (enough to bring stock to double the reorder threshold).
 */
async function runReorderCheck() {
    try {
        // Find variants below reorder threshold
        const lowStockVariants = await ProductVariant.find({
            status: 'Active',
            $expr: { $lte: [{ $subtract: ['$totalStock', '$reservedStock'] }, '$reorderLevel'] }
        }).populate('productId', 'name supplier').lean();

        if (lowStockVariants.length === 0) {
            logger.info('[REORDER] No low-stock variants detected.');
            return { created: 0, skipped: 0 };
        }

        // Get existing open alerts to avoid duplicates
        const variantIds = lowStockVariants.map(v => v._id);
        const existingAlerts = await ReorderAlert.find({
            variantId: { $in: variantIds },
            status: 'Open'
        }).select('variantId').lean();

        const existingSet = new Set(existingAlerts.map(a => a.variantId.toString()));

        const newAlerts = [];
        for (const v of lowStockVariants) {
            if (existingSet.has(v._id.toString())) continue;

            const available = v.totalStock - (v.reservedStock || 0);
            const suggestedQty = Math.max(1, (2 * v.reorderLevel) - available);

            newAlerts.push({
                variantId: v._id,
                sku: v.sku,
                productName: v.productId?.name || 'Unknown',
                currentStock: v.totalStock,
                reservedStock: v.reservedStock || 0,
                availableStock: available,
                reorderLevel: v.reorderLevel,
                suggestedQuantity: suggestedQty,
                supplierId: v.supplierId || v.productId?.supplier || null,
                status: 'Open'
            });
        }

        if (newAlerts.length > 0) {
            await ReorderAlert.insertMany(newAlerts);
        }

        logger.info({ created: newAlerts.length, skipped: existingAlerts.length }, '[REORDER] Reorder check complete');
        return { created: newAlerts.length, skipped: existingAlerts.length };
    } catch (error) {
        logger.error({ err: error }, '[REORDER] Error running reorder check');
        throw error;
    }
}

module.exports = { runReorderCheck };
