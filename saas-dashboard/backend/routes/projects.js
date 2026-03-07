const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// /api/projects/metrics
router.get('/metrics', projectController.getProjectMetrics);

// /api/projects/list
router.get('/list', projectController.getProjects);

module.exports = router;
