const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/logisticsController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const asyncHandler = require('../shared/middleware/asyncHandler');
const { PERMS } = require('../shared/constants/permissions');

// All routes require authentication
router.use(protect);

// Logistics resolution for individual orders
router.get('/orders/:orderId/resolution',   requirePermission(PERMS.ORDERS_VIEW),   asyncHandler(ctrl.getResolution));
router.post('/orders/:orderId/re-resolve',  requirePermission(PERMS.ORDERS_EDIT),   asyncHandler(ctrl.reResolve));
router.post('/orders/:orderId/override',    requirePermission(PERMS.ORDERS_EDIT),   asyncHandler(ctrl.overrideResolution));

// Review queue
router.get('/review-queue', requirePermission(PERMS.ORDERS_VIEW), asyncHandler(ctrl.getReviewQueue));

// Bulk operations
router.post('/bulk-re-resolve', requirePermission(PERMS.ORDERS_EDIT), asyncHandler(ctrl.bulkReResolve));

module.exports = router;
