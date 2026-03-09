const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');

// /api/support
router.get('/', supportController.getTickets);
router.post('/', supportController.createTicket);
router.get('/:id', supportController.getTicketById);
router.post('/:id/messages', supportController.addMessage);
router.put('/:id/status', supportController.updateTicketStatus);

module.exports = router;
