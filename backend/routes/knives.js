const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);
const ctrl = require('../controllers/knifeController');

// ── Knife Cards ──
router.get('/cards', requirePermission(PERMS.WORKSHOP_VIEW), paginate, ctrl.getAllKnifeCards);
router.post('/cards', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.createKnifeCard);
router.get('/cards/stats', requirePermission(PERMS.WORKSHOP_VIEW), ctrl.getKnifeStats);
router.get('/cards/:id', requirePermission(PERMS.WORKSHOP_VIEW), ctrl.getKnifeCardById);
router.put('/cards/:id', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.updateKnifeCard);
router.delete('/cards/:id', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.deleteKnifeCard);

// ── Stage management ──
router.post('/cards/:id/advance', requirePermission(PERMS.WORKSHOP_COMPLETE_STAGE), ctrl.advanceStatus);
router.put('/cards/:id/status', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.updateStatus);
router.post('/cards/:id/history', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.addHistoryEntry);
router.post('/cards/:id/consume', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.consumeMaterials);

// ── Knife Models (Library) ──
router.get('/models', requirePermission(PERMS.WORKSHOP_VIEW), ctrl.getAllKnifeModels);
router.post('/models', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.createKnifeModel);
router.put('/models/:id', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.updateKnifeModel);
router.delete('/models/:id', requirePermission(PERMS.WORKSHOP_EDIT), ctrl.deleteKnifeModel);

module.exports = router;
