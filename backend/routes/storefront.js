/**
 * Public Storefront Routes — no authentication required.
 *
 * These endpoints serve landing page data and accept COD orders
 * from the public-facing storefront pages.
 *
 * Rate-limited more aggressively than authenticated routes.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/salesChannelController');
const wrap = require('../shared/middleware/asyncHandler');

// ── Rate Limiters ───────────────────────────────────────────────────────────

const pageViewLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' }
});

const orderSubmitLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10, // Strict: 10 order submissions per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many order submissions. Please wait.' }
});

const eventLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' }
});

// ── Public Storefront Endpoints ─────────────────────────────────────────────

// Store homepage — list all published pages for a channel
router.get('/:channelSlug', pageViewLimiter, wrap(ctrl.getStorefrontHome));

// Get landing page data (product, variants, blocks, pixels)
router.get('/:channelSlug/:pageSlug', pageViewLimiter, wrap(ctrl.getStorefrontPage));

// Get courier coverage for a wilaya (used by COD form)
router.get('/:channelSlug/:pageSlug/coverage', pageViewLimiter, wrap(ctrl.getStorefrontCoverage));

// Calculate delivery price
router.get('/:channelSlug/:pageSlug/price', pageViewLimiter, wrap(ctrl.calculateStorefrontPrice));

// Submit COD order
router.post('/:channelSlug/:pageSlug/order', orderSubmitLimiter, wrap(ctrl.submitStorefrontOrder));

// Track analytics event
router.post('/:channelSlug/:pageSlug/event', eventLimiter, wrap(ctrl.trackEvent));

module.exports = router;
