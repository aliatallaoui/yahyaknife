const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Integrating with existing HR module
    department: { type: String, required: true },
    budget: { type: Number, required: true, default: 0 },
    spent: { type: Number, required: true, default: 0 },
    startDate: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    status: {
        type: String,
        enum: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'],
        default: 'Planning'
    },
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
