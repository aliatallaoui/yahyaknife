const logger = require('../shared/logger');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Supplier = require('../models/Supplier');
const Warehouse = require('../models/Warehouse');
const StockMovementLedger = require('../models/StockMovementLedger');
const audit = require('../shared/utils/auditLog');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ tenant: req.user.tenant, isActive: true })
            .populate('supplier')
            .populate('category')
            .populate('variants')
            .limit(500)
            .lean();
        res.json(products);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching products');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, category, brand, description, supplier, variants } = req.body;

        // Basic validation
        if (!name || !category) {
            return res.status(400).json({ message: "Please provide required product fields (name, category)." });
        }

        // Collect image URLs from multer upload
        const images = req.files?.length
            ? req.files.map(f => `/uploads/products/${f.filename}`)
            : [];

        const newProduct = await Product.create({
            tenant: req.user.tenant, name, category, brand, description, supplier: supplier || null, images
        });

        // Parse variants from JSON string (multipart form sends strings)
        let parsedVariants = variants;
        if (typeof variants === 'string') {
            try { parsedVariants = JSON.parse(variants); } catch { parsedVariants = []; }
        }

        if (parsedVariants && Array.isArray(parsedVariants) && parsedVariants.length > 0) {
            await ProductVariant.insertMany(parsedVariants.map(v => ({
                tenant: req.user.tenant,
                productId: newProduct._id,
                sku: v.sku,
                attributes: v.attributes || {},
                price: v.price || 0,
                cost: v.cost || 0,
                totalStock: v.stock || 0,
                reorderLevel: v.reorderLevel || 10
            })));
        }

        // Populate to match get request format
        const populatedProduct = await Product.findById(newProduct._id)
            .populate('supplier')
            .populate('category')
            .populate('variants');

        res.status(201).json(populatedProduct);
    } catch (error) {
        logger.error({ err: error }, 'Error creating product');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product ID' });
        const { name, category, brand, description, supplier, existingImages } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (brand !== undefined) updates.brand = brand;
        if (description !== undefined) updates.description = description;
        if (supplier !== undefined) updates.supplier = supplier;

        // Merge existing kept images + newly uploaded images
        let kept = [];
        if (existingImages) {
            try { kept = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages; } catch { kept = []; }
        }
        const newUploads = req.files?.length ? req.files.map(f => `/uploads/products/${f.filename}`) : [];
        updates.images = [...kept, ...newUploads];

        // Clean up removed images from disk
        const product = await Product.findOne({ _id: id, tenant: req.user.tenant }).lean();
        if (product) {
            const keptSet = new Set(kept);
            const uploadsBase = path.resolve(__dirname, '..');
            for (const img of (product.images || [])) {
                if (!keptSet.has(img)) {
                    const filePath = path.resolve(__dirname, '..', img);
                    // Guard against path traversal — only delete files inside project root
                    if (!filePath.startsWith(uploadsBase + path.sep)) continue;
                    fs.unlink(filePath, () => {}); // fire-and-forget
                }
            }
        }

        const updated = await Product.findOneAndUpdate({ _id: id, tenant: req.user.tenant }, updates, { new: true, runValidators: true })
            .populate('supplier').populate('category').populate('variants');
        if (!updated) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json(updated);
    } catch (error) {
        logger.error({ err: error }, 'Error updating product');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product ID' });

        // Soft delete
        const product = await Product.findOneAndUpdate({ _id: id, tenant: req.user.tenant }, { isActive: false }, { new: true });

        // Also archive associated variants
        await ProductVariant.updateMany({ productId: id, tenant: req.user.tenant }, { status: 'Archived' });

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json({ message: "Product successfully archived." });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting product');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getInventoryMetrics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const [totalProducts, inventoryAgg] = await Promise.all([
            Product.countDocuments({ tenant: tenantId, isActive: true }),
            ProductVariant.aggregate([
                { $match: { tenant: new mongoose.Types.ObjectId(tenantId), status: 'Active' } },
                {
                    $group: {
                        _id: null,
                        totalInventoryValue: { $sum: { $multiply: ['$cost', '$totalStock'] } },
                        lowStockCount: {
                            $sum: {
                                $cond: [{ $lte: [{ $subtract: ['$totalStock', '$reservedStock'] }, '$reorderLevel'] }, 1, 0]
                            }
                        }
                    }
                }
            ])
        ]);

        const inv = inventoryAgg[0] || { totalInventoryValue: 0, lowStockCount: 0 };

        res.json({
            totalProducts,
            totalInventoryValue: inv.totalInventoryValue,
            lowStockCount: inv.lowStockCount
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching inventory metrics');
        res.status(500).json({ error: 'Server Error' });
    }
};

// Supplier CRUD — canonical implementation lives in procurementController (single source of truth)
const procurementCtrl = require('./procurementController');
exports.getSuppliers   = procurementCtrl.getSuppliers;
exports.createSupplier = procurementCtrl.createSupplier;
exports.updateSupplier = procurementCtrl.updateSupplier;
exports.deleteSupplier = procurementCtrl.deleteSupplier;

const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ tenant: req.user.tenant, isActive: true }).lean();
        res.json(categories);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching categories');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required.' });
        const newCategory = await Category.create({ tenant: req.user.tenant, name, description, isActive });
        res.status(201).json(newCategory);
    } catch (error) {
        logger.error({ err: error }, 'Error creating category');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid category ID' });
        const { name, description, isActive } = req.body;
        const category = await Category.findOneAndUpdate({ _id: id, tenant: req.user.tenant }, { name, description, isActive }, { new: true, runValidators: true });
        if (!category) return res.status(404).json({ message: "Category not found." });
        res.json(category);
    } catch (error) {
        logger.error({ err: error }, 'Error updating category');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid category ID' });
        const category = await Category.findOneAndUpdate({ _id: id, tenant: req.user.tenant }, { isActive: false }, { new: true });
        if (!category) return res.status(404).json({ message: "Category not found." });
        res.json({ message: "Category archived." });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting category');
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Warehouse Management ---

exports.getWarehouses = async (req, res) => {
    try {
        const warehouses = await Warehouse.find({ status: { $ne: 'Closed' } }).lean();
        res.json(warehouses);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching warehouses');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.createWarehouse = async (req, res) => {
    try {
        const { name, code, location, manager, capacity, status } = req.body;
        if (!name || !code) return res.status(400).json({ message: 'Warehouse name and code are required.' });
        const w = await Warehouse.create({ name, code, location, manager, capacity, status });
        res.status(201).json(w);
    } catch (error) {
        logger.error({ err: error }, 'Error creating warehouse');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateWarehouse = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { name, code, location, manager, capacity, status } = req.body;
        const w = await Warehouse.findByIdAndUpdate(req.params.id, { name, code, location, manager, capacity, status }, { new: true });
        res.json(w);
    } catch (error) {
        logger.error({ err: error }, 'Error updating warehouse');
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Advanced Stock Management ---

exports.adjustStock = async (req, res) => {
    try {
        const { variantId, warehouseId, adjustmentQuantity, notes } = req.body;

        if (!adjustmentQuantity) return res.status(400).json({ message: "Adjustment quantity required." });
        if (!variantId || !mongoose.Types.ObjectId.isValid(variantId))
            return res.status(400).json({ message: "Valid variantId is required." });
        if (warehouseId && !mongoose.Types.ObjectId.isValid(warehouseId))
            return res.status(400).json({ message: "Invalid warehouseId." });

        const variant = await ProductVariant.findOne({ _id: variantId, tenant: req.user.tenant });
        if (!variant) return res.status(404).json({ message: "Variant not found." });

        // Update overall total stock
        variant.totalStock += adjustmentQuantity;

        // Update specific warehouse stock if provided
        if (warehouseId) {
            const whLoc = variant.warehouseLocations.find(l => l.warehouseId.toString() === warehouseId);
            if (whLoc) {
                whLoc.stock += adjustmentQuantity;
            } else {
                variant.warehouseLocations.push({ warehouseId, stock: adjustmentQuantity });
            }
        }
        await variant.save();

        // Create immutable ledger entry
        const ledger = await StockMovementLedger.create({
            variantId,
            warehouseId: warehouseId || null,
            type: 'ADJUSTMENT',
            quantity: adjustmentQuantity,
            referenceId: `ADJ-${Math.floor(Math.random() * 100000)}`,
            referenceModel: 'Manual',
            notes: notes || 'Manual Inventory Readjustment'
        });

        audit({
            tenant: req.user?.tenant,
            actorUserId: req.user?._id,
            action: 'ADJUST_STOCK_MANUAL',
            module: 'inventory',
            metadata: { variantId, adjustmentQuantity, notes, ledgerId: ledger._id }
        });

        res.json({ message: "Stock adjusted successfully", variant, ledger });
    } catch (error) {
        logger.error({ err: error }, 'Error adjusting stock');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getStockLedger = async (req, res) => {
    try {
        const { variantId, warehouseId } = req.query;
        let query = {};
        if (variantId) query.variantId = variantId;
        if (warehouseId) query.warehouseId = warehouseId;

        const ledger = await StockMovementLedger.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('variantId')
            .populate('warehouseId');

        res.json(ledger);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching stock ledger');
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- RTO (Return to Origin) Processing ---
const Order = require('../models/Order');

exports.processRTO = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const tenantId = req.user.tenant;
        const { searchKey } = req.body; // Can be Order ID or Tracking ID
        const userId = req.user._id;

        if (!searchKey) throw new Error('Tracking ID or Order ID required');

        // Find the order by internal orderId or tracking number
        const order = await Order.findOne({
            tenant: tenantId,
            $or: [{ orderId: searchKey }, { 'trackingInfo.trackingNumber': searchKey }]
        }).session(session);

        if (!order) throw new Error(`Order/Shipment not found for query: ${searchKey}`);

        if (order.status === 'Returned' && order.fulfillmentStatus === 'Returned') {
            throw new Error('This order has already been processed and restocked.');
        }

        // Increment stock for each item
        for (const item of order.products) {
            if (!item.variantId) continue;
            
            const variant = await ProductVariant.findById(item.variantId).session(session);
            if (variant) {
                variant.totalStock += item.quantity;
                await variant.save({ session });

                // Log movement
                await StockMovementLedger.create([{
                    tenant: tenantId,
                    variantId: variant._id,
                    type: 'RESTOCK_RTO',
                    quantity: item.quantity,
                    referenceId: order.orderId,
                    referenceModel: 'Order',
                    notes: `RTO Restock for Order ${order.orderId}`
                }], { session });
            }
        }

        // Update Order
        order.status = 'Returned';
        order.fulfillmentStatus = 'Returned';
        order.paymentStatus = 'No_COD';
        order.deliveryStatus = order.deliveryStatus || {};
        order.deliveryStatus.returnedAt = new Date();
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Let the client know the restock details
        res.json({ message: 'RTO Processed & Restocked', orderId: order.orderId, items: order.products });
        
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        logger.error({ err: error }, 'Error processing RTO');
        res.status(400).json({ message: error.message || 'Error processing RTO' });
    }
};

