const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.get('/', protect, requirePermission(PERMS.WORKSHOP_VIEW), toolController.getTools);
router.post('/', protect, requirePermission(PERMS.WORKSHOP_EDIT), toolController.addTool);
router.put('/:id', protect, requirePermission(PERMS.WORKSHOP_EDIT), toolController.updateTool);
router.post('/:id/maintenance', protect, requirePermission(PERMS.WORKSHOP_EDIT), toolController.addMaintenanceNote);
router.delete('/:id', protect, requirePermission(PERMS.WORKSHOP_EDIT), toolController.deleteTool);

module.exports = router;
