const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { handleChat } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req, res) => {
        if (req.user && req.user._id) {
            return req.user._id.toString();
        }
        return ipKeyGenerator(req, res);
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many AI requests, please wait before sending more.' }
});

// Handle chat requests from the Copilot widget
router.post('/chat', protect, aiLimiter, handleChat);

module.exports = router;
