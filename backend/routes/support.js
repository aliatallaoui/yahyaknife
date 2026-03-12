const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);
const supportController = require('../controllers/supportController');

// /api/support
router.get('/', requirePermission(PERMS.SUPPORT_VIEW), paginate, supportController.getTickets);
router.post('/', requirePermission(PERMS.SUPPORT_EDIT), supportController.createTicket);
router.get('/:id', requirePermission(PERMS.SUPPORT_VIEW), supportController.getTicketById);
router.post('/:id/messages', requirePermission(PERMS.SUPPORT_EDIT), supportController.addMessage);
router.put('/:id/status', requirePermission(PERMS.SUPPORT_EDIT), supportController.updateTicketStatus);

module.exports = router;
