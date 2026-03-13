const logger = require('../shared/logger');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductVariant = require('../models/ProductVariant');
const StockMovementLedger = require('../models/StockMovementLedger');
const mongoose = require('mongoose');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');

// --- SUPPLIER CRUD ---

exports.getSuppliers = async (req, res) => {
    try {
        const [suppliers, total] = await Promise.all([
            Supplier.find().sort('-createdAt').skip(req.skip).limit(req.limit).lean(),
            Supplier.countDocuments()
        ]);
        res.json(paginated(suppliers, { total, hasNextPage: req.skip + suppliers.length < total }));
    } catch (error) {
        logger.error({ err: error }, 'Supplier list fetch error');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const { name, contactPerson, supplierCategory, materialsSupplied, address, status, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Supplier name is required.' });
        const sup = new Supplier({ name, contactPerson, supplierCategory, materialsSupplied, address, status, notes });
        await sup.save();
        res.status(201).json(created(sup));
    } catch (error) {
        logger.error({ err: error }, 'Procurement error'); res.status(400).json({ error: 'Invalid request' });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid supplier ID' });
        const { name, contactPerson, supplierCategory, materialsSupplied, address, status, notes } = req.body;
        const sup = await Supplier.findByIdAndUpdate(
            req.params.id,
            { name, contactPerson, supplierCategory, materialsSupplied, address, status, notes },
            { new: true, runValidators: true }
        );
        if (!sup) return res.status(404).json({ error: 'Supplier not found' });
        res.json(ok(sup));
    } catch (error) {
        logger.error({ err: error }, 'Procurement error'); res.status(400).json({ error: 'Invalid request' });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const sup = await Supplier.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
        if (!sup) return res.status(404).json({ error: 'Supplier not found' });
        res.json(message('Supplier archived'));
    } catch (error) {
        logger.error({ err: error }, 'Supplier archive error');
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- PURCHASE ORDERS ---

exports.getPurchaseOrders = async (req, res) => {
    try {
        const [pos, total] = await Promise.all([
            PurchaseOrder.find()
                .populate('supplier', 'name status reliabilityScore performanceMetrics')
                .populate({
                    path: 'items.itemRef',
                    select: 'sku name displayName currentStock stock costPerUnit unitOfMeasure'
                })
                .sort('-createdAt')
                .skip(req.skip).limit(req.limit)
                .lean(),
            PurchaseOrder.countDocuments()
        ]);

        res.json(paginated(pos, { total, hasNextPage: req.skip + pos.length < total }));
    } catch (error) {
        logger.error({ err: error }, 'Purchase order list fetch error');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    try {
        // Auto-generate PO number — sort-based to avoid race condition with countDocuments
        const year = new Date().getFullYear();
        const lastPo = await PurchaseOrder.findOne({ poNumber: new RegExp(`^PO-${year}-`) })
            .sort({ poNumber: -1 }).select('poNumber').lean();
        const lastSeq = lastPo ? parseInt(lastPo.poNumber.split('-')[2], 10) || 0 : 0;
        const poNumber = `PO-${year}-${String(lastSeq + 1).padStart(4, '0')}`;

        const { supplier, items, expectedDeliveryDate, notes, orderDate } = req.body;
        if (!supplier || !mongoose.Types.ObjectId.isValid(supplier))
            return res.status(400).json({ error: 'Valid supplier ID is required.' });
        if (!items || !Array.isArray(items) || items.length === 0)
            return res.status(400).json({ error: 'At least one item is required.' });
        const po = new PurchaseOrder({
            supplier,
            items: (items || []).map(({ itemModel, itemRef, quantity, unitCost }) => ({
                itemModel, itemRef, quantity, unitCost
            })),
            expectedDeliveryDate,
            notes,
            poNumber,
            status: 'Draft'
        });

        await po.save();

        // Update supplier lead time with exponential moving average
        if (po.expectedDeliveryDate && po.supplier) {
            const startStr = orderDate || new Date();
            const daysLead = Math.ceil((new Date(po.expectedDeliveryDate) - new Date(startStr)) / (1000 * 60 * 60 * 24));
            if (daysLead > 0) {
                const sup = await Supplier.findById(po.supplier).select('performanceMetrics');
                if (sup) {
                    const current = sup.performanceMetrics?.averageLeadTimeDays || 0;
                    // EMA: blend 70% existing average + 30% new observation (or set directly if first)
                    sup.performanceMetrics.averageLeadTimeDays = current > 0
                        ? Math.round(current * 0.7 + daysLead * 0.3)
                        : daysLead;
                    await sup.save();
                }
            }
        }

        res.status(201).json(created(po));
    } catch (error) {
        logger.error({ err: error }, 'Procurement error'); res.status(400).json({ error: 'Invalid request' });
    }
};

exports.receivePurchaseOrder = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
        return res.status(400).json({ error: 'Invalid ID' });
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
                    // Update Product Variant Stock (tenant-scoped to prevent cross-tenant mutations)
                    const pv = await ProductVariant.findOne({ _id: poItem.itemRef, tenant: req.user.tenant }).session(session);
                    if (pv) {
                        pv.totalStock += stockChange;
                        // Adjust rolling cost conceptually (simplified replacement strategy here)
                        pv.cost = poItem.unitCost;
                        await pv.save({ session });
                        ledgerRefId = pv._id;
                        ledgerRefModel = 'ProductVariant';
                    }
                }

                // Create Global Inventory Ledger Entry
                if (ledgerRefId) {
                    await StockMovementLedger.create([{
                        variantId: ledgerRefId,
                        referenceId: po._id.toString(),
                        referenceModel: 'PurchaseOrder',
                        type: 'RECEIPT',
                        quantity: stockChange,
                        notes: `Procurement - ${po.poNumber} (unit cost: ${poItem.unitCost})`
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

        res.json(ok({ message: "PO Received & Stock Distributed Successfully", status: po.status }));

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        logger.error({ err: error }, 'Procurement error'); res.status(400).json({ error: 'Invalid request' });
    }
};
