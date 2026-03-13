const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD

    // Pointage Timestamps
    morningIn: { type: Date },
    morningOut: { type: Date },
    eveningIn: { type: Date },
    eveningOut: { type: Date },

    // Calculated Metrics (against Contract Settings)
    workedMinutes: { type: Number, default: 0 },
    requiredMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    missingMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },

    // Status interpretation
    status: {
        type: String,
        enum: ['Present', 'Late', 'Completed with Recovery', 'Incomplete', 'Absent', 'Overtime', 'Approved Leave'],
        default: 'Absent'
    },

    notes: { type: String }
}, { timestamps: true });

// Ensure one record per employee per day per tenant
attendanceSchema.index({ tenant: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ tenant: 1, date: 1 }); // Payroll aggregation date-range queries

module.exports = mongoose.model('Attendance', attendanceSchema);
