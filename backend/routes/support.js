const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);
const supportController = require('../controllers/supportController');
const wrap = require('../shared/middleware/asyncHandler');

// /api/support
router.get('/', requirePermission(PERMS.SUPPORT_VIEW), paginate, wrap(supportController.getTickets));
router.post('/', requirePermission(PERMS.SUPPORT_EDIT), wrap(supportController.createTicket));
router.get('/:id', requirePermission(PERMS.SUPPORT_VIEW), wrap(supportController.getTicketById));
router.post('/:id/messages', requirePermission(PERMS.SUPPORT_EDIT), wrap(supportController.addMessage));
router.put('/:id/status', requirePermission(PERMS.SUPPORT_EDIT), wrap(supportController.updateTicketStatus));

module.exports = router;
