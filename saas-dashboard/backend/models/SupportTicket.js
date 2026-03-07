const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['Customer', 'Agent', 'System'],
        required: true
    },
    message: { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, refPath: 'senderModel' }, // Optional, links to User or Customer
    senderModel: { type: String, enum: ['User', 'Customer'] },
    timestamp: { type: Date, default: Date.now }
});

const supportTicketSchema = new mongoose.Schema({
    ticketNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Optional link to a specific order

    subject: { type: String, required: true },
    type: {
        type: String,
        enum: ['General Inquiry', 'Shipping Issue', 'Product Defect', 'RMA Request'],
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'],
        default: 'Open'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Agent handling the ticket
    messages: [messageSchema],
    resolutionNotes: { type: String },

    resolvedAt: { type: Date },
    closedAt: { type: Date }
}, { timestamps: true });

// Pre-validate hook to generate ticket number before validation rules apply
supportTicketSchema.pre('validate', async function () {
    if (this.isNew && !this.ticketNumber) {
        const count = await mongoose.model('SupportTicket').countDocuments();
        this.ticketNumber = `TKT-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;
    }
});


module.exports = mongoose.model('SupportTicket', supportTicketSchema);
