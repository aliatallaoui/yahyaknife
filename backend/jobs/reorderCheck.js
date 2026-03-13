const ProductVariant = require('../models/ProductVariant');
const ReorderAlert = require('../models/ReorderAlert');
const Tenant = require('../models/Tenant');
const logger = require('../shared/logger');

/**
 * Scans all active variants per tenant and creates ReorderAlert documents
 * for any variant whose available stock (totalStock - reservedStock)
 * has dropped to or below its reorderLevel.
 *
 * Idempotent: skips variants that already have an 'Open' alert.
 * Suggested reorder quantity = 2 x reorderLevel - availableStock
 * (enough to bring stock to double the reorder threshold).
 */
async function runReorderCheck() {
    try {
        const tenants = await Tenant.find({ isActive: true }).select('_id').lean();
        let totalCreated = 0, totalSkipped = 0;

        for (const tenant of tenants) {
            const tenantId = tenant._id;

            // Find variants below reorder threshold for this tenant
            const lowStockVariants = await ProductVariant.find({
                tenant: tenantId,
                status: 'Active',
                $expr: { $lte: [{ $subtract: ['$totalStock', '$reservedStock'] }, '$reorderLevel'] }
            }).populate('productId', 'name supplier').lean();

            if (lowStockVariants.length === 0) continue;

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
                    tenant: tenantId,
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

            totalCreated += newAlerts.length;
            totalSkipped += existingAlerts.length;
        }

        if (totalCreated === 0 && totalSkipped === 0) {
            logger.info('[REORDER] No low-stock variants detected.');
        } else {
            logger.info({ created: totalCreated, skipped: totalSkipped }, '[REORDER] Reorder check complete');
        }
        return { created: totalCreated, skipped: totalSkipped };
    } catch (error) {
        logger.error({ err: error }, '[REORDER] Error running reorder check');
        throw error;
    }
}

module.exports = { runReorderCheck };
