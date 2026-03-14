const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const analyticsController = require('../controllers/analyticsController');
const ReorderAlert = require('../models/ReorderAlert');
const ProductVariant = require('../models/ProductVariant');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const { uploadProductImages } = require('../middleware/upload');
const { checkPlanLimit } = require('../middleware/planLimits');
const wrap = require('../shared/middleware/asyncHandler');

router.use(protect); // Protect all inventory routes

// /api/inventory/products
router.route('/products')
    .get(requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getProducts))
    .post(requirePermission(PERMS.INVENTORY_ADJUST), checkPlanLimit('products'), uploadProductImages.array('images', 8), wrap(inventoryController.createProduct));

router.route('/products/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), uploadProductImages.array('images', 8), wrap(inventoryController.updateProduct))
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.deleteProduct));

// /api/inventory/metrics
router.get('/metrics', requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getInventoryMetrics));

// /api/inventory/suppliers
router.route('/suppliers')
    .get(requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getSuppliers))
    .post(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.createSupplier));

router.route('/suppliers/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.updateSupplier))
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.deleteSupplier));

// /api/inventory/categories
router.route('/categories')
    .get(requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getCategories))
    .post(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.createCategory));

router.route('/categories/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.updateCategory))
    .delete(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.deleteCategory));

// Warehouse CRUD
router.route('/warehouses')
    .get(requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getWarehouses))
    .post(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.createWarehouse));

router.route('/warehouses/:id')
    .put(requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.updateWarehouse));

// Stock Ledger & Adjustments
router.post('/adjust-stock', requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.adjustStock));
router.get('/ledger', requirePermission(PERMS.INVENTORY_VIEW), wrap(inventoryController.getStockLedger));

// RTO Restocking (Requires inventory adjustment permission)
router.post('/process-rto', requirePermission(PERMS.INVENTORY_ADJUST), wrap(inventoryController.processRTO));

// /api/inventory/sku-intelligence
router.get('/sku-intelligence', requirePermission(PERMS.ANALYTICS_VIEW), wrap(analyticsController.getSkuIntelligence));

// /api/inventory/supplier-intelligence
router.get('/supplier-intelligence', requirePermission(PERMS.ANALYTICS_VIEW), wrap(analyticsController.getSupplierIntelligence));

// /api/inventory/pos
router.route('/pos')
    .get(requirePermission(PERMS.PROCUREMENT_VIEW), wrap(purchaseOrderController.getPurchaseOrders))
    .post(requirePermission(PERMS.PROCUREMENT_CREATE_PO), wrap(purchaseOrderController.createPurchaseOrder));

router.route('/pos/:id/status')
    .put(requirePermission(PERMS.PROCUREMENT_UPDATE_PO), wrap(purchaseOrderController.updatePOStatus));

// /api/inventory/reorder-alerts — Reorder point automation (scoped via tenant's variants)
router.get('/reorder-alerts', requirePermission(PERMS.INVENTORY_REORDER), wrap(async (req, res) => {
    const tenantVariantIds = await ProductVariant.find({ tenant: req.user.tenant })
        .select('_id').lean().then(docs => docs.map(d => d._id));
    const alerts = await ReorderAlert.find({ status: 'Open', variantId: { $in: tenantVariantIds } })
        .populate('variantId', 'sku totalStock reservedStock reorderLevel')
        .populate('supplierId', 'name')
        .sort({ detectedAt: -1 })
        .limit(200)
        .lean();
    res.json(alerts);
}));

router.put('/reorder-alerts/:id/dismiss', requirePermission(PERMS.INVENTORY_REORDER), wrap(async (req, res) => {
    // Verify the alert belongs to this tenant before dismissing
    const alert = await ReorderAlert.findById(req.params.id).populate('variantId', 'tenant').lean();
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (String(alert.variantId?.tenant) !== String(req.user.tenant))
        return res.status(403).json({ message: 'Not authorized' });
    const updated = await ReorderAlert.findByIdAndUpdate(
        req.params.id,
        { status: 'Dismissed' },
        { new: true }
    );
    res.json(updated);
}));

module.exports = router;
