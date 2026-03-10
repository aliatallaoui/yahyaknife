const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const exportController = require('../controllers/exportController');

// @route   POST /api/exports/orders
// @desc    Trigger a background CSV export of orders
// @access  Private
router.post('/orders', protect, exportController.enqueueOrderExport);

// @route   GET /api/exports/:jobId/status
// @desc    Poll the progress of an export job
// @access  Private
router.get('/:jobId/status', protect, exportController.getExportJobStatus);

module.exports = router;
