const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Project Manager
    department: {
        type: String,
        enum: ['Manufacturing', 'Warehouse', 'Dispatch', 'Customer Support', 'Engineering', 'Finance', 'Sales', 'Marketing', 'HR', 'Design', 'General'],
        default: 'General'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    startDate: { type: Date },
    deadline: { type: Date },
    status: {
        type: String,
        enum: ['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'],
        default: 'Planned'
    },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    healthIndicator: {
        type: String,
        enum: ['On Track', 'At Risk', 'Off Track'],
        default: 'On Track'
    },

    // Cross-module linking
    linkedModule: {
        type: String,
        enum: ['Sales', 'Manufacturing', 'Inventory', 'Logistics', 'Finance', 'HR', 'None'],
        default: 'None'
    },
    linkedEntityId: { type: mongoose.Schema.Types.ObjectId }, // e.g., ProductionOrderId

    tags: [{ type: String }],
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
