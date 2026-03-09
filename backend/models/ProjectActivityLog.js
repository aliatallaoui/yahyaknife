const mongoose = require('mongoose');

const projectActivityLogSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' }, // Optional, if the activity is task-specific
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    action: { type: String, required: true },
    details: { type: String },
    previousState: { type: mongoose.Schema.Types.Mixed }, // To store diffs (e.g., status changed from 'To Do' to 'In Progress')
    newState: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProjectActivityLog', projectActivityLogSchema);
