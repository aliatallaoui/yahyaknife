const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const ctrl = require('../controllers/salesChannelController');
const wrap = require('../shared/middleware/asyncHandler');

// Multer config for page block images
const pageImageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'pages')),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `block-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
});
const uploadPageImage = multer({
    storage: pageImageStorage,
    fileFilter: (_req, file, cb) => {
        cb(null, /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

// All routes require authentication
router.use(protect);

// ── Sales Channels ──────────────────────────────────────────────────────────

router.get('/health/summary', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getChannelHealthSummary));
router.get('/', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.listChannels));
router.post('/', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.createChannel));
router.get('/:id', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getChannel));
router.put('/:id', requirePermission(PERMS.SALES_CHANNELS_EDIT), wrap(ctrl.updateChannel));
router.delete('/:id', requirePermission(PERMS.SALES_CHANNELS_DELETE), wrap(ctrl.deleteChannel));
router.get('/:id/analytics', requirePermission(PERMS.SALES_CHANNELS_ANALYTICS), wrap(ctrl.getChannelAnalytics));

// ── Store Integration ───────────────────────────────────────────────────────

router.post('/wc-auth/initiate', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.initiateWcOAuth));
router.post('/:id/wc-auth-url', requirePermission(PERMS.SALES_CHANNELS_INTEGRATE), wrap(ctrl.generateWcAuthUrl));
router.post('/:id/test-connection', requirePermission(PERMS.SALES_CHANNELS_INTEGRATE), wrap(ctrl.testConnection));
router.post('/:id/register-webhooks', requirePermission(PERMS.SALES_CHANNELS_INTEGRATE), wrap(ctrl.registerWebhooks));
router.post('/:id/sync-orders', requirePermission(PERMS.SALES_CHANNELS_INTEGRATE), wrap(ctrl.syncOrders));
router.get('/:id/sync-logs', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getSyncLogs));
router.get('/:id/product-mappings', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getProductMappings));
router.post('/:id/product-mappings', requirePermission(PERMS.SALES_CHANNELS_MAP), wrap(ctrl.createProductMapping));
router.delete('/:id/product-mappings/:mappingId', requirePermission(PERMS.SALES_CHANNELS_MAP), wrap(ctrl.deleteProductMapping));
router.get('/:id/external-products', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.fetchExternalProducts));

// ── AI Page Generator ────────────────────────────────────────────────────────

router.get('/ai/themes', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getThemeTemplates));
router.post('/:channelId/pages/ai-generate', express.json({ limit: '20mb' }), requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.generateAIPage));

// ── Block Image Upload ──────────────────────────────────────────────────────

router.post('/pages/upload-image', requirePermission(PERMS.SALES_CHANNELS_EDIT), uploadPageImage.single('image'), wrap((req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });
    res.json({ url: `/uploads/pages/${req.file.filename}` });
}));

// ── Landing Pages (nested under channel) ────────────────────────────────────

router.get('/:channelId/pages', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.listPages));
router.post('/:channelId/pages', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.createPage));
router.get('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.getPage));
router.put('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_EDIT), wrap(ctrl.updatePage));
router.delete('/:channelId/pages/:pageId', requirePermission(PERMS.SALES_CHANNELS_DELETE), wrap(ctrl.deletePage));
router.post('/:channelId/pages/:pageId/clone', requirePermission(PERMS.SALES_CHANNELS_CREATE), wrap(ctrl.clonePage));
router.post('/:channelId/pages/:pageId/publish', requirePermission(PERMS.SALES_CHANNELS_PUBLISH), wrap(ctrl.publishPage));
router.post('/:channelId/pages/:pageId/unpublish', requirePermission(PERMS.SALES_CHANNELS_PUBLISH), wrap(ctrl.unpublishPage));
router.get('/:channelId/pages/:pageId/preview', requirePermission(PERMS.SALES_CHANNELS_VIEW), wrap(ctrl.previewPage));
router.get('/:channelId/pages/:pageId/analytics', requirePermission(PERMS.SALES_CHANNELS_ANALYTICS), wrap(ctrl.getPageAnalytics));

module.exports = router;
