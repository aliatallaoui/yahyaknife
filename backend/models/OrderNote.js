const mongoose = require('mongoose');

const orderNoteSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    type: { 
        type: String, 
        enum: ['Customer', 'Internal', 'Delivery', 'Call Center'], 
        default: 'Internal' 
    },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('OrderNote', orderNoteSchema);
