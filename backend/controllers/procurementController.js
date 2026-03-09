const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductVariant = require('../models/ProductVariant');
const RawMaterial = require('../models/RawMaterial');
const StockMovementLedger = require('../models/StockMovementLedger');
const mongoose = require('mongoose');

// --- SUPPLIER CRUD ---

exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort('-createdAt');
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const sup = new Supplier(req.body);
        await sup.save();
        res.status(201).json(sup);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const sup = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(sup);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// --- PURCHASE ORDERS ---

exports.getPurchaseOrders = async (req, res) => {
    try {
        const pos = await PurchaseOrder.find()
            .populate('supplier', 'name status reliabilityScore performanceMetrics')
            // Need to conditionally populate based on itemModel
            .populate({
                path: 'items.itemRef',
                select: 'sku name displayName currentStock stock costPerUnit unitOfMeasure'
            })
            .sort('-createdAt');

        res.json(pos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    try {
        // Auto-generate PO number
        const count = await PurchaseOrder.countDocuments();
        const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        const po = new PurchaseOrder({
            ...req.body,
            poNumber
        });

        await po.save();

        // Also update Supplier lead time metrics if delivery date is expected
        if (po.expectedDeliveryDate && po.supplier) {
            const startStr = req.body.orderDate || new Date();
            const daysLead = Math.ceil((new Date(po.expectedDeliveryDate) - new Date(startStr)) / (1000 * 60 * 60 * 24));

            // Basic rolling average approximation
            await Supplier.findByIdAndUpdate(po.supplier, {
                $inc: { 'performanceMetrics.averageLeadTimeDays': daysLead > 0 ? daysLead : 0 }
            });
        }

        res.status(201).json(po);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.receivePurchaseOrder = async (req, res) => {
    /**
     * Payload should contain:
     * {
     *   itemsReceived: [ { itemId: "subdoc_id", quantityReceivedThisBatch: Number } ],
     *   notes: "Shipment arrived via FedEx"
     * }
     */
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(req.params.id).session(session);
        if (!po) throw new Error("PO not found");
        if (po.status === 'Cancelled') throw new Error("Cannot receive a cancelled sequence");

        const { itemsReceived, notes } = req.body;
        let fullyReceived = true;

        for (const receivedItem of itemsReceived) {
            // Find the subdoc in the PO
            const poItem = po.items.id(receivedItem.itemId);
            if (!poItem) continue;

            if (receivedItem.quantityReceivedThisBatch > 0) {
                // Determine which database to inject stock into
                let ledgerRefId = null;
                let ledgerRefModel = null;
                let stockChange = receivedItem.quantityReceivedThisBatch;

                if (poItem.itemModel === 'ProductVariant') {
                    // Update Product Variant Stock
                    const pv = await ProductVariant.findById(poItem.itemRef).session(session);
                    if (pv) {
                        pv.stock += stockChange;
                        // Adjust rolling cost conceptually (simplified replacement strategy here)
                        pv.unitCost = poItem.unitCost;
                        await pv.save({ session });
                        ledgerRefId = pv._id;
                        ledgerRefModel = 'ProductVariant';
                    }
                } else if (poItem.itemModel === 'RawMaterial') {
                    // Update Raw Material Stock
                    const rm = await RawMaterial.findById(poItem.itemRef).session(session);
                    if (rm) {
                        rm.stockLevel += stockChange;
                        rm.costPerUnit = poItem.unitCost;
                        await rm.save({ session });
                        ledgerRefId = rm._id;
                        ledgerRefModel = 'RawMaterial';
                    }
                }

                // Create Global Inventory Ledger Entry
                if (ledgerRefId) {
                    await StockMovementLedger.create([{
                        referenceId: ledgerRefId,
                        referenceModel: ledgerRefModel,
                        type: 'IN',
                        quantity: stockChange,
                        reason: `Procurement - ${po.poNumber}`,
                        costBasis: poItem.unitCost,
                        sourceModel: 'PurchaseOrder',
                        sourceId: po._id
                    }], { session });
                }

                // Accumulate the PO's formal received total
                poItem.receivedQuantity += stockChange;
            }

            // Check if PO is fully closed out yet
            if (poItem.receivedQuantity < poItem.quantity) {
                fullyReceived = false;
            }
        }

        // Update the master PO document status based on receipt yields
        if (fullyReceived) {
            po.status = 'Received';
            po.actualDeliveryDate = new Date();
        } else {
            po.status = 'Partial';
        }

        if (notes) po.notes = (po.notes ? po.notes + "\n" : "") + new Date().toLocaleDateString() + ": " + notes;

        await po.save({ session });

        // Update Supplier Reliability Score if fully received
        if (fullyReceived && po.expectedDeliveryDate) {
            const sup = await Supplier.findById(po.supplier).session(session);
            if (sup) {
                const onTime = new Date(po.actualDeliveryDate) <= new Date(po.expectedDeliveryDate);
                // Move reliability slightly towards 100 or deduct if late
                sup.performanceMetrics.reliabilityScore = onTime
                    ? Math.min(100, sup.performanceMetrics.reliabilityScore + 2)
                    : Math.max(0, sup.performanceMetrics.reliabilityScore - 5);
                await sup.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "PO Received & Stock Distributed Successfully", status: po.status });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: error.message });
    }
};
