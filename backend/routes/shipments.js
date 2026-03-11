const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('shipments.view'), shipmentController.getAllShipments);
router.get('/export/csv', protect, requirePermission('shipments.export'), shipmentController.exportShipments);
router.post('/', protect, requirePermission('shipments.create'), shipmentController.createShipment);
router.post('/quick-dispatch/:orderId', protect, requirePermission('shipments.create'), shipmentController.quickDispatch);
router.get('/:id', protect, requirePermission('shipments.view'), shipmentController.getShipmentById);
router.put('/:id', protect, requirePermission('shipments.create'), shipmentController.updateShipment);
router.delete('/:id', protect, requirePermission('shipments.cancel'), shipmentController.deleteShipment);

router.post('/:id/validate', protect, requirePermission('shipments.create'), shipmentController.validateShipment);
router.get('/:id/label', protect, requirePermission('shipments.view'), shipmentController.getShipmentLabel);
router.post('/:id/return', protect, requirePermission('shipments.cancel'), shipmentController.requestReturn);

module.exports = router;
