const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    role: { type: String, required: true },
    department: {
        type: String,
        required: true,
        enum: ['Operations', 'Warehouse', 'Dispatch', 'Customer Support', 'Engineering', 'Finance', 'Sales', 'Marketing', 'HR', 'Design']
    },
    salary: { type: Number, required: true },
    performanceScore: { type: Number, default: 100, min: 0, max: 100 },
    leaveBalance: { type: Number, default: 21 }, // Standard 21 days
    joinDate: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['Active', 'On Leave', 'Terminated'],
        default: 'Active'
    },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

    // Contract Settings for Payroll & Attendance
    contractSettings: {
        monthlySalary: { type: Number, required: true, default: 0 },
        dailyRequiredMinutes: { type: Number, default: 480 }, // 8 hours
        schedule: {
            morningStart: { type: String, default: '08:00' },
            morningEnd: { type: String, default: '12:00' },
            eveningStart: { type: String, default: '13:00' },
            eveningEnd: { type: String, default: '17:00' }
        },
        overtimeEnabled: { type: Boolean, default: true },
        overtimeRateMultiplier: { type: Number, default: 1.5 },
        latenessGracePeriodMin: { type: Number, default: 15 },
        deductionRules: {
            missedMinutes: { type: Boolean, default: true } // Deduct missing minutes from base salary
        },
        workDays: {
            type: [String],
            default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'] // Typical Algerian/Middle-East Work week
        }
    }
}, { timestamps: true });

// --- Performance Indexes ---
employeeSchema.index({ tenant: 1, status: 1 });                      // Active employee lists
employeeSchema.index({ tenant: 1, email: 1 }, { unique: true });     // Tenant-scoped email uniqueness

module.exports = mongoose.model('Employee', employeeSchema);
