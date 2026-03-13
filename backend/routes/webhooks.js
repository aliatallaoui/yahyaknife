const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const ctrl = require('../controllers/webhookController');
const wrap = require('../shared/middleware/asyncHandler');

// All webhook routes require auth
router.use(protect);

router.get('/events', requirePermission(PERMS.WEBHOOKS_VIEW), wrap(ctrl.listEvents));
router.get('/', requirePermission(PERMS.WEBHOOKS_VIEW), wrap(ctrl.listWebhooks));
router.post('/', requirePermission(PERMS.WEBHOOKS_MANAGE), wrap(ctrl.createWebhook));
router.patch('/:id', requirePermission(PERMS.WEBHOOKS_MANAGE), wrap(ctrl.updateWebhook));
router.delete('/:id', requirePermission(PERMS.WEBHOOKS_MANAGE), wrap(ctrl.deleteWebhook));
router.get('/:id/deliveries', requirePermission(PERMS.WEBHOOKS_VIEW), wrap(ctrl.getDeliveries));
router.post('/:id/test', requirePermission(PERMS.WEBHOOKS_MANAGE), wrap(ctrl.testWebhook));

module.exports = router;
