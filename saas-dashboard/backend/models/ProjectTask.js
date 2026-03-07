const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    createdAt: { type: Date, default: Date.now }
});

const attachmentSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true }
});

const projectTaskSchema = new mongoose.Schema({
    taskId: { type: String, required: true, unique: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: { type: String },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    department: { type: String },

    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'],
        default: 'To Do'
    },

    startDate: { type: Date },
    deadline: { type: Date },

    estimatedEffort: { type: Number, default: 0 }, // in hours
    actualEffort: { type: Number, default: 0 }, // in hours

    // Links & Dependencies
    linkedEntity: { type: mongoose.Schema.Types.ObjectId },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' }],

    // Embedded subdocs for speed
    comments: [commentSchema],
    attachments: [attachmentSchema]

}, { timestamps: true });

module.exports = mongoose.model('ProjectTask', projectTaskSchema);
