const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Supplier = require('../models/Supplier');
const Warehouse = require('../models/Warehouse');
const StockMovementLedger = require('../models/StockMovementLedger');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true })
            .populate('supplier')
            .populate('category')
            .populate('variants');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, category, brand, description, supplier, variants } = req.body;

        // Basic validation
        if (!name || !category) {
            return res.status(400).json({ message: "Please provide required product fields (name, category)." });
        }

        const newProduct = await Product.create({
            name, category, brand, description, supplier: supplier || null
        });

        if (variants && Array.isArray(variants)) {
            for (const v of variants) {
                await ProductVariant.create({
                    productId: newProduct._id,
                    sku: v.sku,
                    attributes: v.attributes || {},
                    price: v.price || 0,
                    cost: v.cost || 0,
                    totalStock: v.stock || 0,
                    reorderLevel: v.reorderLevel || 10
                });
            }
        }

        // Populate to match get request format
        const populatedProduct = await Product.findById(newProduct._id)
            .populate('supplier')
            .populate('category')
            .populate('variants');

        res.status(201).json(populatedProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const product = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).populate('supplier').populate('category');
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // Soft delete
        const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });

        // Also archive associated variants
        await ProductVariant.updateMany({ productId: id }, { status: 'Archived' });

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json({ message: "Product successfully archived." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getInventoryMetrics = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        const variants = await ProductVariant.find({ status: 'Active' });

        let totalInventoryValue = 0;
        let lowStockCount = 0;

        variants.forEach(v => {
            totalInventoryValue += (v.cost * v.totalStock);
            if (v.availableStock <= v.reorderLevel) {
                lowStockCount++;
            }
        });

        res.json({
            totalProducts: products.length,
            totalInventoryValue,
            lowStockCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find({ active: true });
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const newSupplier = await Supplier.create(req.body);
        res.status(201).json(newSupplier);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await Supplier.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!supplier) return res.status(404).json({ message: "Supplier not found." });
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await Supplier.findByIdAndUpdate(id, { active: false }, { new: true });
        if (!supplier) return res.status(404).json({ message: "Supplier not found." });
        res.json({ message: "Supplier archived." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const newCategory = await Category.create(req.body);
        res.status(201).json(newCategory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!category) return res.status(404).json({ message: "Category not found." });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!category) return res.status(404).json({ message: "Category not found." });
        res.json({ message: "Category archived." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Warehouse Management ---

exports.getWarehouses = async (req, res) => {
    try {
        const warehouses = await Warehouse.find({ status: { $ne: 'Closed' } });
        res.json(warehouses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createWarehouse = async (req, res) => {
    try {
        const w = await Warehouse.create(req.body);
        res.status(201).json(w);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateWarehouse = async (req, res) => {
    try {
        const w = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(w);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Advanced Stock Management ---

exports.adjustStock = async (req, res) => {
    try {
        const { variantId, warehouseId, adjustmentQuantity, notes } = req.body;

        if (!adjustmentQuantity) return res.status(400).json({ message: "Adjustment quantity required." });

        const variant = await ProductVariant.findById(variantId);
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

        res.json({ message: "Stock adjusted successfully", variant, ledger });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
};

