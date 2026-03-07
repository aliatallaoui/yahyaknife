const InventoryLedger = require('../models/InventoryLedger');
const ProductVariant = require('../models/ProductVariant');

/**
 * Utility function to log a stock movement centrally.
 * Can be called by other controllers (Sales, Production, PO).
 * 
 * @param {ObjectId} variantId 
 * @param {Number} quantity (positive or negative)
 * @param {String} type ('Purchase', 'Sale', 'Return', 'Damage', 'Adjustment', 'Production')
 * @param {String} reason 
 * @param {String} referenceId (optional Order ID, PO ID, etc.)
 */
exports.logStockMovement = async (variantId, quantity, type, reason, referenceId = null, referenceModel = 'Order') => {
    try {
        // Map legacy types to new structured enum
        const typeMapping = {
            'Sale': quantity < 0 ? 'Shipped' : 'Returned',
            'Purchase': 'Received',
            'Production': 'Received',
            'Damage': 'Adjusted',
            'Adjustment': 'Adjusted',
            'Return': 'Returned',
            'Returns': 'Returned',
            'Shipped': 'Shipped',
            'Reserved': 'Reserved'
        };

        const ledgerType = typeMapping[type] || 'Adjusted';

        await InventoryLedger.create({
            variantId,
            changeAmount: quantity,
            type: ledgerType,
            referenceId,
            referenceModel,
            notes: reason
        });
    } catch (error) {
        console.error("Failed to log stock movement in ledger:", error);
    }
};

// @desc    Get stock movement ledger for a specific variant
// @route   GET /api/inventory/ledger/:variantId
// @access  Private
exports.getProductLedger = async (req, res) => {
    try {
        const { variantId } = req.params;

        const movements = await InventoryLedger.find({ variantId })
            .sort({ createdAt: -1 })
            .limit(100); // Limit to last 100 for performance

        res.json(movements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get entire recent stock movement ledger across all variants
// @route   GET /api/inventory/ledger
// @access  Private
exports.getGlobalLedger = async (req, res) => {
    try {
        const movements = await InventoryLedger.find()
            .populate({
                path: 'variantId',
                populate: { path: 'productId', select: 'name' }
            })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(movements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
