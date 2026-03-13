const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const exportController = require('../controllers/exportController');
const rateLimit = require('express-rate-limit');

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 export requests per windowMs
    message: { message: 'Too many export requests from this IP, please try again after 15 minutes' }
});

// @route   POST /api/exports/orders
// @desc    Trigger a background CSV export of orders
// @access  Private
router.post('/orders', protect, requirePermission(PERMS.ORDERS_EXPORT), exportLimiter, exportController.enqueueOrderExport);

// @route   GET /api/exports/:jobId/status
// @desc    Poll the progress of an export job
// @access  Private
router.get('/:jobId/status', protect, exportController.getExportJobStatus);

module.exports = router;
