const logger = require('../shared/logger');
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductVariant = require('../models/ProductVariant');
const { logStockMovement } = require('./stockController');

// @desc    Get all purchase orders
// @route   GET /api/inventory/pos
// @access  Private
exports.getPurchaseOrders = async (req, res) => {
    try {
        const pos = await PurchaseOrder.find()
            .populate('supplier')
            .populate({
                path: 'items.itemRef', // Changed from variant to itemRef
                populate: { path: 'productId' } // For ProductVariant cases
            })
            .sort({ createdAt: -1 })
            .lean();
        res.json(pos);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching purchase orders');
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Create a new Purchase Order
// @route   POST /api/inventory/pos
// @access  Private
exports.createPurchaseOrder = async (req, res) => {
    try {
        const { supplier, items, expectedDeliveryDate, notes } = req.body;

        if (!req.body || !supplier || !items || items.length === 0) {
            return res.status(400).json({ message: "Supplier and at least one item are required." });
        }

        const poNumber = `PO-${Math.floor(Math.random() * 1000000)}`;

        const newPO = await PurchaseOrder.create({
            poNumber,
            supplier,
            items,
            expectedDeliveryDate,
            notes,
            status: 'Draft'
        });

        const populatedPO = await PurchaseOrder.findById(newPO._id)
            .populate('supplier')
            .populate({
                path: 'items.itemRef', // Changed from variant to itemRef
                populate: { path: 'productId' }
            });

        res.status(201).json(populatedPO);
    } catch (error) {
        logger.error({ err: error }, 'Error creating purchase order');
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Update Purchase Order Status (Receiving PO)
// @route   PUT /api/inventory/pos/:id/status
// @access  Private
exports.updatePOStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid purchase order ID' });
        const { status } = req.body;

        const po = await PurchaseOrder.findById(id).populate({
            path: 'items.itemRef', // Changed from variant to itemRef
            populate: { path: 'productId' }
        });
        if (!po) return res.status(404).json({ message: "Purchase Order not found." });

        // Complex status handling with partial receipts
        if (['Received', 'Partial'].includes(status)) {
            const receivedItems = req.body.receivedItems || []; // array of { variantId, quantity }

            for (const item of po.items) {
                // Determine how much is newly received
                let newReceiveQty = 0;

                if (status === 'Received') {
                    // Force complete receipt if not tracking partials manually
                    newReceiveQty = item.quantity - item.receivedQuantity;
                } else if (status === 'Partial') {
                    // Extract from payload
                    const match = receivedItems.find(ri => ri.variantId && String(ri.variantId) === String(item.variant._id));
                    if (match) {
                        newReceiveQty = Number(match.quantity);
                        if (!Number.isInteger(newReceiveQty) || newReceiveQty <= 0) newReceiveQty = 0;
                    }
                }

                if (newReceiveQty > 0) {
                    item.receivedQuantity += newReceiveQty;

                    if (item.itemModel === 'ProductVariant') {
                        // Increment totalStock
                        await ProductVariant.findByIdAndUpdate(item.itemRef._id, {
                            $inc: { totalStock: newReceiveQty }
                        });

                        // Log movement in InventoryLedger
                        await logStockMovement(
                            item.itemRef._id,
                            newReceiveQty,
                            'Purchase', // Maps to 'Received'
                            `${status} PO ${po.poNumber}`,
                            po._id,
                            'PurchaseOrder'
                        );
                    }
                }
            }
            if (status === 'Received') {
                po.actualDeliveryDate = new Date();
            }
        }

        po.status = status;
        await po.save();

        const updatedPO = await PurchaseOrder.findById(id)
            .populate('supplier')
            .populate({
                path: 'items.itemRef', // Changed from variant to itemRef
                populate: { path: 'productId' }
            });

        res.json(updatedPO);
    } catch (error) {
        logger.error({ err: error }, 'Error updating purchase order status');
        res.status(500).json({ error: 'Server error' });
    }
};
