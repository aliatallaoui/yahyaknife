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
router.get('/metrics', inventoryController.getInventoryMetrics);

// /api/inventory/suppliers
router.route('/suppliers')
    .get(inventoryController.getSuppliers)
    .post(inventoryController.createSupplier);

router.route('/suppliers/:id')
    .put(inventoryController.updateSupplier)
    .delete(inventoryController.deleteSupplier);

// /api/inventory/categories
router.route('/categories')
    .get(inventoryController.getCategories)
    .post(inventoryController.createCategory);

router.route('/categories/:id')
    .put(inventoryController.updateCategory)
    .delete(inventoryController.deleteCategory);

// /api/inventory/ledger (Original routes)
// router.get('/ledger', stockController.getGlobalLedger);
// router.get('/ledger/:productId', stockController.getProductLedger);

// New routes appended as per instruction
// router.get('/reports', analyticsController.downloadReport);
// router.post('/restock/:variantId', stockController.restockItem);

// --- New Enterprise Logistics Routes ---

// Warehouse CRUD
router.route('/warehouses')
    .get(inventoryController.getWarehouses)
    .post(inventoryController.createWarehouse);

router.route('/warehouses/:id')
    .put(inventoryController.updateWarehouse);

// Stock Ledger & Adjustments
router.post('/adjust-stock', inventoryController.adjustStock);
router.get('/ledger', inventoryController.getStockLedger); // This replaces the original /ledger route

// /api/inventory/sku-intelligence
router.get('/sku-intelligence', analyticsController.getSkuIntelligence);

// /api/inventory/supplier-intelligence
router.get('/supplier-intelligence', analyticsController.getSupplierIntelligence);

// /api/inventory/pos
router.route('/pos')
    .get(purchaseOrderController.getPurchaseOrders)
    .post(purchaseOrderController.createPurchaseOrder);

router.route('/pos/:id/status')
    .put(purchaseOrderController.updatePOStatus);

module.exports = router;
