const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
const ctrl = require('../controllers/knifeController');

// ── Knife Cards ──
router.get('/cards', ctrl.getAllKnifeCards);
router.post('/cards', ctrl.createKnifeCard);
router.get('/cards/stats', ctrl.getKnifeStats);
router.get('/cards/:id', ctrl.getKnifeCardById);
router.put('/cards/:id', ctrl.updateKnifeCard);
router.delete('/cards/:id', ctrl.deleteKnifeCard);

// ── Stage management ──
router.post('/cards/:id/advance', ctrl.advanceStatus);
router.put('/cards/:id/status', ctrl.updateStatus);
router.post('/cards/:id/history', ctrl.addHistoryEntry);
router.post('/cards/:id/consume', ctrl.consumeMaterials);

// ── Knife Models (Library) ──
router.get('/models', ctrl.getAllKnifeModels);
router.post('/models', ctrl.createKnifeModel);
router.put('/models/:id', ctrl.updateKnifeModel);
router.delete('/models/:id', ctrl.deleteKnifeModel);

module.exports = router;
