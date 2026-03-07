const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// ----------------------------------------------------
// Analytics & Global Dashboards
// ----------------------------------------------------
router.get('/analytics', projectController.getProjectAnalytics);
router.get('/tasks/global', projectController.getGlobalTasks);

// ----------------------------------------------------
// Project CRUD operations
// ----------------------------------------------------
router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id', projectController.updateProject);

// ----------------------------------------------------
// Tasks operations
// ----------------------------------------------------
router.post('/:projectId/tasks', projectController.createTask);
router.put('/tasks/:taskId', projectController.updateTask);
router.post('/tasks/:taskId/comments', projectController.addTaskComment);

module.exports = router;
