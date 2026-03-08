const express = require('express');
const router = express.Router();
const courierSettingsController = require('../controllers/courierSettingsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, courierSettingsController.getSettings);
router.put('/', protect, courierSettingsController.updateSettings);

module.exports = router;
