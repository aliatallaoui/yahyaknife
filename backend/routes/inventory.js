const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const stockController = require('../controllers/stockController');
const analyticsController = require('../controllers/analyticsController');
const ReorderAlert = require('../models/ReorderAlert');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect); // Protect all inventory routes

// /api/inventory/products
router.route('/products')
    .get(requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getProducts)
    .post(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.createProduct);

router.route('/products/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.updateProduct)
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.deleteProduct);

// /api/inventory/metrics
router.get('/metrics', requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getInventoryMetrics);

// /api/inventory/suppliers
router.route('/suppliers')
    .get(requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getSuppliers)
    .post(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.createSupplier);

router.route('/suppliers/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.updateSupplier)
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.deleteSupplier);

// /api/inventory/categories
router.route('/categories')
    .get(requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getCategories)
    .post(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.createCategory);

router.route('/categories/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.updateCategory)
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.deleteCategory);

// Warehouse CRUD
router.route('/warehouses')
    .get(requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getWarehouses)
    .post(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.createWarehouse);

router.route('/warehouses/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.updateWarehouse);

// Stock Ledger & Adjustments
router.post('/adjust-stock', requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.adjustStock);
router.get('/ledger', requirePermission(PERMS.INVENTORY_VIEW), inventoryController.getStockLedger);

// RTO Restocking (Requires inventory adjustment permission)
router.post('/process-rto', requirePermission(PERMS.INVENTORY_ADJUST), inventoryController.processRTO);

// /api/inventory/sku-intelligence
router.get('/sku-intelligence', requirePermission(PERMS.ANALYTICS_VIEW), analyticsController.getSkuIntelligence);

// /api/inventory/supplier-intelligence
router.get('/supplier-intelligence', requirePermission(PERMS.ANALYTICS_VIEW), analyticsController.getSupplierIntelligence);

// /api/inventory/pos
router.route('/pos')
    .get(requirePermission(PERMS.PROCUREMENT_VIEW), purchaseOrderController.getPurchaseOrders)
    .post(requirePermission(PERMS.PROCUREMENT_CREATE_PO), purchaseOrderController.createPurchaseOrder);

router.route('/pos/:id/status')
    .put(requirePermission(PERMS.PROCUREMENT_UPDATE_PO), purchaseOrderController.updatePOStatus);

// /api/inventory/reorder-alerts — Reorder point automation
router.get('/reorder-alerts', requirePermission(PERMS.INVENTORY_REORDER), async (req, res) => {
    try {
        const alerts = await ReorderAlert.find({ status: 'Open' })
            .populate('variantId', 'sku totalStock reservedStock reorderLevel')
            .populate('supplierId', 'name')
            .sort({ detectedAt: -1 })
            .limit(200);
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/reorder-alerts/:id/dismiss', requirePermission(PERMS.INVENTORY_REORDER), async (req, res) => {
    try {
        const alert = await ReorderAlert.findByIdAndUpdate(
            req.params.id,
            { status: 'Dismissed' },
            { new: true }
        );
        if (!alert) return res.status(404).json({ message: 'Alert not found' });
        res.json(alert);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
