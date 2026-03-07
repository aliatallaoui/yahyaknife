const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
        type: String,
        enum: ['To Do', 'In Progress', 'In Review', 'Done'],
        default: 'To Do'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    dueDate: { type: Date },
    completedDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
