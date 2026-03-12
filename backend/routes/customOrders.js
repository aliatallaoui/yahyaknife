const express = require('express');
const router = express.Router();
const customOrderController = require('../controllers/customOrderController');
const paginate = require('../shared/middleware/paginate');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect);

router.get('/', requirePermission(PERMS.WORKSHOP_VIEW), paginate, customOrderController.getCustomOrders);
router.post('/', requirePermission(PERMS.WORKSHOP_EDIT), customOrderController.createCustomOrder);
router.put('/:id', requirePermission(PERMS.WORKSHOP_EDIT), customOrderController.updateCustomOrder);
router.delete('/:id', requirePermission(PERMS.WORKSHOP_EDIT), customOrderController.deleteCustomOrder);

module.exports = router;
