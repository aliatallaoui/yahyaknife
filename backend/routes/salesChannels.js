const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const ctrl = require('../controllers/salesChannelController');
const wrap = require('../shared/middleware/asyncHandler');

// All routes require authentication
router.use(protect);

// ── Sales Channels ──────────────────────────────────────────────────────────

router.get('/', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.listChannels));
router.post('/', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.createChannel));
router.get('/:id', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getChannel));
router.put('/:id', requirePermission(PERMS.SALES_CHANNELS_EDIT), wrap(ctrl.updateChannel));
router.delete('/:id', requirePermission(PERMS.SALES_CHANNELS_DELETE), wrap(ctrl.deleteChannel));
router.get('/:id/analytics', requirePermission(PERMS.SALES_CHANNELS_ANALYTICS), wrap(ctrl.getChannelAnalytics));

// ── AI Page Generator ────────────────────────────────────────────────────────

router.get('/ai/themes', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getThemeTemplates));
router.post('/:channelId/pages/ai-generate', express.json({ limit: '20mb' }), requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.generateAIPage));

// ── Landing Pages (nested under channel) ────────────────────────────────────

router.get('/:channelId/pages', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.listPages));
router.post('/:channelId/pages', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.createPage));
router.get('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getPage));
router.put('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_EDIT), wrap(ctrl.updatePage));
router.delete('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_DELETE), wrap(ctrl.deletePage));
router.post('/:channelId/pages/:pageId/publish', requirePermission(PERMS.SALES_CHANNELS_PUBLISH), wrap(ctrl.publishPage));
router.post('/:channelId/pages/:pageId/unpublish', requirePermission(PERMS.SALES_CHANNELS_PUBLISH), wrap(ctrl.unpublishPage));
router.get('/:channelId/pages/:pageId/preview', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.previewPage));
router.get('/:channelId/pages/:pageId/analytics', requirePermission(PERMS.SALES_CHANNELS_ANALYTICS), wrap(ctrl.getPageAnalytics));

module.exports = router;
