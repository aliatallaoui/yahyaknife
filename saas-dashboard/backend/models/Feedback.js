const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    date: { type: Date, default: Date.now },
    category: {
        type: String,
        enum: ['Product Quality', 'Customer Service', 'Delivery', 'Website Experience', 'Other'],
        default: 'Other'
    },
    status: {
        type: String,
        enum: ['New', 'Reviewed', 'Resolved'],
        default: 'New'
    }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
