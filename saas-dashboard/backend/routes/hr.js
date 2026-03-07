const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');

// /api/hr/metrics
router.get('/metrics', hrController.getHRMetrics);

// /api/hr/employees
router.get('/employees', hrController.getEmployees);

// /api/hr/leaves
router.get('/leaves', hrController.getLeaveRequests);

module.exports = router;
