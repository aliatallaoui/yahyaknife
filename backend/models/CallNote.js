const mongoose = require('mongoose');

const callNoteSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    actionType: {
        type: String,
        enum: [
            'Called_NoAnswer',
            'Confirmed',
            'Cancelled',
            'Address_Updated',
            'General_Note'
        ],
        required: true
    },
    note: {
        type: String
    },
    callDurationSeconds: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CallNote', callNoteSchema);
