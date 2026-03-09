const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// Handle chat requests from the Copilot widget
router.post('/chat', protect, handleChat);

module.exports = router;
