const mongoose = require('mongoose');

const workerProductivitySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, default: Date.now },
    tasksCompleted: { type: Number, default: 0 },
    operations: [{
        operationName: { type: String, required: true }, // e.g., 'Grinding', 'Handle Shaping'
        quantity: { type: Number, default: 1 },
        qualityScore: { type: Number, min: 1, max: 5, default: 4 },
        timeSpentHours: { type: Number }
    }],
    dailyScore: { type: Number, default: 0 }, // Computed from operations and quality
    notes: { type: String }
}, { timestamps: true });

// Index for fast querying by employee and date
workerProductivitySchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('WorkerProductivity', workerProductivitySchema);
