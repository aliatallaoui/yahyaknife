const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    period: { type: String, required: true }, // Format: MM-YYYY (e.g., "03-2026")

    // Financial Calculation Breakdown
    baseSalary: { type: Number, required: true },

    metricsTotal: {
        totalWorkedMinutes: { type: Number, default: 0 },
        totalRequiredMinutes: { type: Number, default: 0 },
        totalLateMinutes: { type: Number, default: 0 },
        totalMissingMinutes: { type: Number, default: 0 },
        totalOvertimeMinutes: { type: Number, default: 0 }
    },

    // Monetary Adjustments
    overtimeAdditions: { type: Number, default: 0 },
    missingTimeDeductions: { type: Number, default: 0 },
    absenceDeductions: { type: Number, default: 0 },

    // Final Tally
    finalPayableSalary: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Draft', 'Pending Approval', 'Approved', 'Partially Paid', 'Paid'],
        default: 'Draft'
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }
}, { timestamps: true });

// Ensure one payroll generated per employee per month per tenant
payrollSchema.index({ tenant: 1, employeeId: 1, period: 1 }, { unique: true });
payrollSchema.index({ tenant: 1, period: 1 }); // Period-level listing (payroll dashboard)

module.exports = mongoose.model('Payroll', payrollSchema);
