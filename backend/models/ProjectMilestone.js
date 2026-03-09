const mongoose = require('mongoose');

const projectMilestoneSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    description: { type: String },
    deadline: { type: Date, required: true },
    responsibleTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('ProjectMilestone', projectMilestoneSchema);
