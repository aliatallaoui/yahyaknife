const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const rateLimit = require('express-rate-limit');
const wrap = require('../shared/middleware/asyncHandler');

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many export requests from this IP, please try again after 15 minutes' }
});

router.get('/', protect, requirePermission(PERMS.SHIPMENTS_VIEW), wrap(shipmentController.getAllShipments));
router.get('/export/csv', protect, requirePermission(PERMS.SHIPMENTS_EXPORT), exportLimiter, wrap(shipmentController.exportShipments));
router.get('/export/manifest', protect, requirePermission(PERMS.SHIPMENTS_EXPORT), exportLimiter, wrap(shipmentController.generateManifest));
router.post('/', protect, requirePermission(PERMS.SHIPMENTS_CREATE), wrap(shipmentController.createShipment));
router.post('/quick-dispatch/:orderId', protect, requirePermission(PERMS.SHIPMENTS_CREATE), wrap(shipmentController.quickDispatch));
router.post('/bulk-dispatch', protect, requirePermission(PERMS.SHIPMENTS_CREATE), wrap(shipmentController.bulkQuickDispatch));
router.get('/:id', protect, requirePermission(PERMS.SHIPMENTS_VIEW), wrap(shipmentController.getShipmentById));
router.put('/:id', protect, requirePermission(PERMS.SHIPMENTS_EDIT), wrap(shipmentController.updateShipment));
router.delete('/:id', protect, requirePermission(PERMS.SHIPMENTS_CANCEL), wrap(shipmentController.deleteShipment));

router.post('/:id/validate', protect, requirePermission(PERMS.SHIPMENTS_CREATE), wrap(shipmentController.validateShipment));
router.get('/:id/label', protect, requirePermission(PERMS.SHIPMENTS_VIEW), wrap(shipmentController.getShipmentLabel));
router.post('/:id/return', protect, requirePermission(PERMS.SHIPMENTS_CANCEL), wrap(shipmentController.requestReturn));

module.exports = router;
