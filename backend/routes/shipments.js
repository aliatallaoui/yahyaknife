const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, shipmentController.getAllShipments);
router.get('/export/csv', protect, shipmentController.exportShipments);
router.post('/', protect, shipmentController.createShipment);
router.post('/quick-dispatch/:orderId', protect, shipmentController.quickDispatch);
router.get('/:id', protect, shipmentController.getShipmentById);
router.put('/:id', protect, shipmentController.updateShipment);
router.delete('/:id', protect, shipmentController.deleteShipment);

router.post('/:id/validate', protect, shipmentController.validateShipment);
router.get('/:id/label', protect, shipmentController.getShipmentLabel);
router.post('/:id/return', protect, shipmentController.requestReturn);

module.exports = router;
