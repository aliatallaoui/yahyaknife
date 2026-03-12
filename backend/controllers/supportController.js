const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');
const { ok, created, paginated } = require('../shared/utils/ApiResponse');

exports.createTicket = async (req, res) => {
    try {
        const { customerId, orderId, subject, type, priority, initialMessage } = req.body;

        const ticketData = {
            customerId,
            orderId,
            subject,
            type,
            priority,
            messages: []
        };

        if (initialMessage) {
            ticketData.messages.push({
                sender: 'Customer',
                message: initialMessage,
                senderModel: 'Customer',
                senderId: customerId
            });
        }

        const ticket = new SupportTicket(ticketData);
        await ticket.save();

        res.status(201).json(created(ticket));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const { status, type, priority, customerId } = req.query;
        let query = {};

        const VALID_STATUSES = ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
        const VALID_TYPES    = ['General Inquiry', 'Shipping Issue', 'Product Defect', 'RMA Request'];
        const VALID_PRIORITY = ['Low', 'Medium', 'High', 'Urgent'];

        if (status) { if (VALID_STATUSES.includes(status)) query.status = status; else return res.status(400).json({ error: 'Invalid status filter' }); }
        if (type)   { if (VALID_TYPES.includes(type))     query.type = type;     else return res.status(400).json({ error: 'Invalid type filter' }); }
        if (priority) { if (VALID_PRIORITY.includes(priority)) query.priority = priority; else return res.status(400).json({ error: 'Invalid priority filter' }); }
        if (customerId) {
            if (!mongoose.Types.ObjectId.isValid(customerId)) return res.status(400).json({ error: 'Invalid customerId' });
            query.customerId = customerId;
        }

        const [tickets, total] = await Promise.all([
            SupportTicket.find(query)
                .populate('customerId', 'name email phone')
                .populate('orderId', 'orderId totalAmount status')
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 })
                .skip(req.skip).limit(req.limit),
            SupportTicket.countDocuments(query)
        ]);

        res.json(paginated(tickets, { total, hasNextPage: req.skip + tickets.length < total }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const ticket = await SupportTicket.findById(req.params.id)
            .populate('customerId', 'name email phone')
            .populate('orderId', 'orderId totalAmount status items')
            .populate('assignedTo', 'name')
            .populate('messages.senderId', 'name');

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        res.json(ok(ticket));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addMessage = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { message, sender, senderId } = req.body;

        if (!['Agent', 'Customer'].includes(sender))
            return res.status(400).json({ error: 'sender must be Agent or Customer' });

        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        ticket.messages.push({
            sender,
            message,
            senderId,
            senderModel: sender === 'Customer' ? 'Customer' : 'User'
        });

        // If an agent replies, and it was waiting on agent, we can change status
        if (sender === 'Agent' && ticket.status === 'Open') {
            ticket.status = 'In Progress';
        } else if (sender === 'Customer' && ticket.status === 'Waiting on Customer') {
            ticket.status = 'In Progress';
        }

        await ticket.save();

        // return the populated ticket so UI updates instantly
        const populatedTicket = await SupportTicket.findById(ticket._id)
            .populate('customerId', 'name email phone')
            .populate('orderId', 'orderId totalAmount status')
            .populate('assignedTo', 'name')
            .populate('messages.senderId', 'name');

        res.json(ok(populatedTicket));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { status, resolutionNotes } = req.body;
        const updateData = { status };

        if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
        if (status === 'Resolved') updateData.resolvedAt = new Date();
        if (status === 'Closed') updateData.closedAt = new Date();

        const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('customerId', 'name email phone')
            .populate('orderId', 'orderId totalAmount status items')
            .populate('assignedTo', 'name')
            .populate('messages.senderId', 'name');

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        res.json(ok(ticket));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
