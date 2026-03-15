const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
    registerUser,
    loginUser,
    getMe,
    logout,
    refreshAccessToken,
    forgotPassword,
    resetPassword,
    listUserTenants,
    switchTenant,
    completeOnboarding,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const wrap = require('../shared/middleware/asyncHandler');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                   // max 20 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts from this IP, please try again in 15 minutes.' }
});

router.post('/register', authLimiter, wrap(registerUser));
router.post('/login', authLimiter, wrap(loginUser));
router.post('/refresh', authLimiter, wrap(refreshAccessToken));
router.post('/forgot-password', authLimiter, wrap(forgotPassword));
router.put('/reset-password/:token', authLimiter, wrap(resetPassword));
router.post('/logout', protect, wrap(logout));
router.get('/me', protect, wrap(getMe));
router.get('/tenants', protect, wrap(listUserTenants));
router.post('/switch-tenant', protect, wrap(switchTenant));
router.patch('/onboarding', protect, wrap(completeOnboarding));

module.exports = router;
