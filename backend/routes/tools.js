const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, toolController.getTools);
router.post('/', protect, toolController.addTool);
router.put('/:id', protect, toolController.updateTool);
router.post('/:id/maintenance', protect, toolController.addMaintenanceNote);
router.delete('/:id', protect, toolController.deleteTool);

module.exports = router;
