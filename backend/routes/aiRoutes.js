const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { handleChat } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many AI requests, please wait before sending more.' }
});

// Handle chat requests from the Copilot widget
router.post('/chat', protect, aiLimiter, handleChat);

module.exports = router;
