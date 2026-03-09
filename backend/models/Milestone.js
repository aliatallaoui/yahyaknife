const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
    title: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    dueDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Missed'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
