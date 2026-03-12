/**
 * Migration: Add `tenant` field to Employee, Attendance, Payroll, LeaveRequest
 *
 * Run ONCE against the database after deploying the model changes.
 * Usage:
 *   node backend/scripts/migrate_hr_tenant.js
 *
 * What it does:
 *   1. Finds the first (and typically only) active Tenant in the DB.
 *   2. Bulk-sets tenant on all Employee, Attendance, Payroll, LeaveRequest documents
 *      that are currently missing it.
 *   3. Reports counts. Safe to re-run — uses $exists:false filter so already-migrated
 *      docs are skipped.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // Load Tenant model manually to avoid circular requires
    const Tenant = require('../models/Tenant');
    const Employee = require('../models/Employee');
    const Attendance = require('../models/Attendance');
    const Payroll = require('../models/Payroll');
    const LeaveRequest = require('../models/LeaveRequest');

    // Find the workshop tenant (the primary/first active tenant)
    const tenant = await Tenant.findOne({ isActive: true }).sort({ createdAt: 1 });
    if (!tenant) {
        console.error('ERROR: No active Tenant found. Create one first (run setupLocal.js).');
        process.exit(1);
    }
    console.log(`Using tenant: ${tenant.name} (${tenant._id})`);

    const filter = { tenant: { $exists: false } };
    const update = { $set: { tenant: tenant._id } };

    const [empRes, attRes, payRes, leaveRes] = await Promise.all([
        Employee.updateMany(filter, update),
        Attendance.updateMany(filter, update),
        Payroll.updateMany(filter, update),
        LeaveRequest.updateMany(filter, update),
    ]);

    console.log(`Employee:     ${empRes.modifiedCount} docs updated`);
    console.log(`Attendance:   ${attRes.modifiedCount} docs updated`);
    console.log(`Payroll:      ${payRes.modifiedCount} docs updated`);
    console.log(`LeaveRequest: ${leaveRes.modifiedCount} docs updated`);
    console.log('Migration complete.');
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
