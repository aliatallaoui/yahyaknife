const mongoose = require('mongoose');

const workerRewardSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    dateAwarded: { type: Date, default: Date.now },
    type: {
        type: String,
        enum: ['Piece-Rate Bonus', 'Quality Bonus', 'Speed Bonus', 'Overtime Premium', 'Other'],
        required: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'DZD' },
    reason: { type: String },
    relatedProductivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkerProductivity' },
    isPaid: { type: Boolean, default: false } // Whether this reward has been cleared in a payroll run
}, { timestamps: true });

// Index for fast payroll aggregation
workerRewardSchema.index({ employeeId: 1, isPaid: 1 });

module.exports = mongoose.model('WorkerReward', workerRewardSchema);
