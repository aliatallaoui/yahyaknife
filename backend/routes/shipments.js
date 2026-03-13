const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const rateLimit = require('express-rate-limit');

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many export requests from this IP, please try again after 15 minutes' }
});

router.get('/', protect, requirePermission(PERMS.SHIPMENTS_VIEW), shipmentController.getAllShipments);
router.get('/export/csv', protect, requirePermission(PERMS.SHIPMENTS_EXPORT), exportLimiter, shipmentController.exportShipments);
router.post('/', protect, requirePermission(PERMS.SHIPMENTS_CREATE), shipmentController.createShipment);
router.post('/quick-dispatch/:orderId', protect, requirePermission(PERMS.SHIPMENTS_CREATE), shipmentController.quickDispatch);
router.get('/:id', protect, requirePermission(PERMS.SHIPMENTS_VIEW), shipmentController.getShipmentById);
router.put('/:id', protect, requirePermission(PERMS.SHIPMENTS_CREATE), shipmentController.updateShipment);
router.delete('/:id', protect, requirePermission(PERMS.SHIPMENTS_CANCEL), shipmentController.deleteShipment);

router.post('/:id/validate', protect, requirePermission(PERMS.SHIPMENTS_CREATE), shipmentController.validateShipment);
router.get('/:id/label', protect, requirePermission(PERMS.SHIPMENTS_VIEW), shipmentController.getShipmentLabel);
router.post('/:id/return', protect, requirePermission(PERMS.SHIPMENTS_CANCEL), shipmentController.requestReturn);

// --- Manifest ---
router.get('/export/manifest', protect, requirePermission(PERMS.SHIPMENTS_EXPORT), exportLimiter, shipmentController.generateManifest);

module.exports = router;
