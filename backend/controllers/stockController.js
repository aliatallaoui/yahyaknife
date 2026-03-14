const logger = require('../shared/logger');
const StockMovementLedger = require('../models/StockMovementLedger');
const ProductVariant = require('../models/ProductVariant');

/**
 * Unified stock movement logger — writes to StockMovementLedger (single source of truth).
 * Called by OrderService, ProcurementController, InventoryController.
 *
 * @param {ObjectId} variantId
 * @param {Number} quantity (positive for additions, negative for deductions)
 * @param {String} type ('Sale', 'Purchase', 'Return', 'Damage', 'Adjustment', 'Reserved')
 * @param {String} reason
 * @param {ObjectId|String} referenceId (Order ID, PO ID, etc.)
 * @param {String} referenceModel ('Order', 'PurchaseOrder', 'Manual', 'Transfer')
 * @param {ObjectId|String} tenantId
 */
exports.logStockMovement = async (variantId, quantity, type, reason, referenceId = null, referenceModel = 'Order', tenantId = null) => {
    try {
        // Map caller-friendly types to StockMovementLedger enum
        const typeMapping = {
            'Sale':        quantity < 0 ? 'DEDUCTION' : 'RESTORATION',
            'Purchase':    'RECEIPT',
            'Production':  'RECEIPT',
            'Damage':      'ADJUSTMENT',
            'Adjustment':  'ADJUSTMENT',
            'Return':      'RESTORATION',
            'Returns':     'RESTORATION',
            'Shipped':     'DEDUCTION',
            'Reserved':    'RESERVATION'
        };

        const ledgerType = typeMapping[type] || 'ADJUSTMENT';

        const doc = {
            variantId,
            quantity,
            type: ledgerType,
            referenceId: referenceId ? referenceId.toString() : `SYS-${Date.now()}`,
            referenceModel: ['Order', 'PurchaseOrder', 'Manual', 'Transfer'].includes(referenceModel) ? referenceModel : 'Order',
            notes: reason
        };
        if (tenantId) doc.tenant = tenantId;
        await StockMovementLedger.create(doc);
    } catch (error) {
        logger.error({ err: error }, 'Failed to log stock movement in ledger');
    }
};

// @desc    Get stock movement ledger for a specific variant
// @route   GET /api/inventory/ledger/:variantId
// @access  Private
exports.getProductLedger = async (req, res) => {
    try {
        const { variantId } = req.params;

        const movements = await StockMovementLedger.find({ variantId, tenant: req.user.tenant })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json(movements);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching product ledger');
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Get entire recent stock movement ledger across all variants
// @route   GET /api/inventory/ledger
// @access  Private
exports.getGlobalLedger = async (req, res) => {
    try {
        const movements = await StockMovementLedger.find({ tenant: req.user.tenant })
            .populate({
                path: 'variantId',
                populate: { path: 'productId', select: 'name' }
            })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(movements);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching global stock ledger');
        res.status(500).json({ error: 'Server Error' });
    }
};
