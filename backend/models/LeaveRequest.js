const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: {
        type: String,
        required: true,
        enum: ['Vacation', 'Sick Leave', 'Personal', 'Maternity/Paternity', 'Unpaid']
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    requestDate: { type: Date, default: Date.now }
}, { timestamps: true });

// --- Performance Indexes ---
leaveRequestSchema.index({ tenant: 1, employeeId: 1, status: 1 });   // Employee leave dashboard

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
