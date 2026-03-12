const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);

// ----------------------------------------------------
// Analytics & Global Dashboards
// ----------------------------------------------------
router.get('/analytics', requirePermission(PERMS.PROJECTS_VIEW), projectController.getProjectAnalytics);
router.get('/tasks/global', requirePermission(PERMS.PROJECTS_VIEW), projectController.getGlobalTasks);

// ----------------------------------------------------
// Project CRUD operations
// ----------------------------------------------------
router.get('/', requirePermission(PERMS.PROJECTS_VIEW), projectController.getProjects);
router.post('/', requirePermission(PERMS.PROJECTS_EDIT), projectController.createProject);
router.get('/:id', requirePermission(PERMS.PROJECTS_VIEW), projectController.getProjectById);
router.put('/:id', requirePermission(PERMS.PROJECTS_EDIT), projectController.updateProject);

// ----------------------------------------------------
// Tasks operations
// ----------------------------------------------------
router.post('/:projectId/tasks', requirePermission(PERMS.PROJECTS_EDIT), projectController.createTask);
router.put('/tasks/:taskId', requirePermission(PERMS.PROJECTS_EDIT), projectController.updateTask);
router.post('/tasks/:taskId/comments', requirePermission(PERMS.PROJECTS_EDIT), projectController.addTaskComment);

module.exports = router;
