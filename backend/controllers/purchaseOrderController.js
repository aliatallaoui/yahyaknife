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
        const pos = await PurchaseOrder.find({ tenant: req.user.tenant })
            .populate('supplier', 'name email phone')
            .populate({
                path: 'items.itemRef',
                populate: { path: 'productId', select: 'name sku' }
            })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        res.json(pos);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching purchase orders');
        res.status(500).json({ message: 'Failed to load purchase orders. Please try again.' });
    }
};

// @desc    Create a new Purchase Order
// @route   POST /api/inventory/pos
// @access  Private
exports.createPurchaseOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { supplier, items, expectedDeliveryDate, notes } = req.body;

        if (!req.body || !supplier || !items || items.length === 0) {
            return res.status(400).json({ message: "Supplier and at least one item are required." });
        }

        const poNumber = `PO-${Math.floor(Math.random() * 1000000)}`;

        const newPO = await PurchaseOrder.create({
            tenant: tenantId,
            poNumber,
            supplier,
            items,
            expectedDeliveryDate,
            notes,
            status: 'Draft'
        });

        const populatedPO = await PurchaseOrder.findOne({ _id: newPO._id, tenant: tenantId })
            .populate('supplier', 'name email phone')
            .populate({
                path: 'items.itemRef',
                populate: { path: 'productId', select: 'name sku' }
            })
            .lean();

        res.status(201).json(populatedPO);
    } catch (error) {
        logger.error({ err: error }, 'Error creating purchase order');
        res.status(500).json({ message: 'Failed to create purchase order. Please try again.' });
    }
};

// @desc    Update Purchase Order Status (Receiving PO)
// @route   PUT /api/inventory/pos/:id/status
// @access  Private
exports.updatePOStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid purchase order ID' });
        const { status } = req.body;

        const po = await PurchaseOrder.findOne({ _id: id, tenant: tenantId }).populate({
            path: 'items.itemRef',
            populate: { path: 'productId', select: 'name sku' }
        });
        if (!po) return res.status(404).json({ message: "Purchase Order not found." });

        // Complex status handling with partial receipts
        if (['Received', 'Partial'].includes(status)) {
            const receivedItems = req.body.receivedItems || [];

            for (const item of po.items) {
                let newReceiveQty = 0;

                if (status === 'Received') {
                    newReceiveQty = item.quantity - item.receivedQuantity;
                } else if (status === 'Partial') {
                    const match = receivedItems.find(ri => ri.variantId && String(ri.variantId) === String(item.variant._id));
                    if (match) {
                        newReceiveQty = Number(match.quantity);
                        if (!Number.isInteger(newReceiveQty) || newReceiveQty <= 0) newReceiveQty = 0;
                    }
                }

                if (newReceiveQty > 0) {
                    item.receivedQuantity += newReceiveQty;

                    if (item.itemModel === 'ProductVariant') {
                        await ProductVariant.findOneAndUpdate(
                            { _id: item.itemRef._id, tenant: tenantId },
                            { $inc: { totalStock: newReceiveQty } }
                        );

                        await logStockMovement(
                            item.itemRef._id,
                            newReceiveQty,
                            'Purchase',
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

        const updatedPO = await PurchaseOrder.findOne({ _id: id, tenant: tenantId })
            .populate('supplier', 'name email phone')
            .populate({
                path: 'items.itemRef',
                populate: { path: 'productId', select: 'name sku' }
            })
            .lean();

        res.json(updatedPO);
    } catch (error) {
        logger.error({ err: error }, 'Error updating purchase order status');
        res.status(500).json({ message: 'Failed to update purchase order. Please try again.' });
    }
};
