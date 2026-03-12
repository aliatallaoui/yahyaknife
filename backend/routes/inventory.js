const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const stockController = require('../controllers/stockController');
const analyticsController = require('../controllers/analyticsController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect); // Protect all inventory routes

// /api/inventory/products
router.route('/products')
    .get(requirePermission('inventory.read'), inventoryController.getProducts)
    .post(requirePermission('inventory.create_product'), inventoryController.createProduct);

router.route('/products/:id')
    .put(requirePermission('inventory.update_product'), inventoryController.updateProduct)
    .delete(requirePermission('inventory.export'), inventoryController.deleteProduct);

// /api/inventory/metrics
router.get('/metrics', requirePermission('inventory.read'), inventoryController.getInventoryMetrics);

// /api/inventory/suppliers
router.route('/suppliers')
    .get(requirePermission('inventory.view_supplier_data'), inventoryController.getSuppliers)
    .post(requirePermission('inventory.view_supplier_data'), inventoryController.createSupplier);

router.route('/suppliers/:id')
    .put(requirePermission('inventory.view_supplier_data'), inventoryController.updateSupplier)
    .delete(requirePermission('inventory.view_supplier_data'), inventoryController.deleteSupplier);

// /api/inventory/categories
router.route('/categories')
    .get(requirePermission('inventory.read'), inventoryController.getCategories)
    .post(requirePermission('inventory.create_product'), inventoryController.createCategory);

router.route('/categories/:id')
    .put(requirePermission('inventory.create_product'), inventoryController.updateCategory)
    .delete(requirePermission('inventory.create_product'), inventoryController.deleteCategory);

// --- New Enterprise Logistics Routes ---

// Warehouse CRUD
router.route('/warehouses')
    .get(requirePermission('warehouse.read'), inventoryController.getWarehouses)
    .post(requirePermission('warehouse.create'), inventoryController.createWarehouse);

router.route('/warehouses/:id')
    .put(requirePermission('warehouse.update'), inventoryController.updateWarehouse);

// Stock Ledger & Adjustments
router.post('/adjust-stock', requirePermission('inventory.adjust_stock'), inventoryController.adjustStock);
router.get('/ledger', requirePermission('inventory.read'), inventoryController.getStockLedger);

// /api/inventory/sku-intelligence
router.get('/sku-intelligence', requirePermission('analytics.view'), analyticsController.getSkuIntelligence);

// /api/inventory/supplier-intelligence
router.get('/supplier-intelligence', requirePermission('analytics.view'), analyticsController.getSupplierIntelligence);

// /api/inventory/pos
router.route('/pos')
    .get(requirePermission('procurement.read'), purchaseOrderController.getPurchaseOrders)
    .post(requirePermission('procurement.create_po'), purchaseOrderController.createPurchaseOrder);

router.route('/pos/:id/status')
    .put(requirePermission('procurement.update_po'), purchaseOrderController.updatePOStatus);

module.exports = router;
