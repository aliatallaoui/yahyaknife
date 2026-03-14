const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Expense = require('../models/Expense');
const audit = require('../shared/utils/auditLog');

exports.generateMonthlyPayroll = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.body; // e.g., "03-2026"
        if (!period) return res.status(400).json({ error: 'Period is required (MM-YYYY)' });
        if (!/^\d{2}-\d{4}$/.test(period)) return res.status(400).json({ error: 'Period must be in MM-YYYY format' });

        const [month, year] = period.split('-');

        const employees = await Employee.find({ tenant, status: 'Active', deletedAt: null });
        const payrollResults = [];

        const paddedMonth = month.padStart(2, '0');
        const nextMonthNum = Number(month) === 12 ? 1 : Number(month) + 1;
        const nextYear = Number(month) === 12 ? String(Number(year) + 1) : year;
        const periodStart = `${year}-${paddedMonth}-01`;
        const periodEnd   = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-01`;

        // Pre-fetch already-locked payroll records for this period (Approved/Partially Paid/Paid)
        const lockedPayrolls = new Set(
            (await Payroll.find({ tenant, period, status: { $in: ['Approved', 'Partially Paid', 'Paid'] } }).select('employeeId').lean())
                .map(p => p.employeeId.toString())
        );

        // Single aggregate for all attendance records this period — eliminates N+1
        const attendanceAgg = await Attendance.aggregate([
            { $match: { tenant, date: { $gte: periodStart, $lt: periodEnd } } },
            { $group: {
                _id: '$employeeId',
                totalWorked:   { $sum: '$workedMinutes' },
                totalRequired: { $sum: '$requiredMinutes' },
                totalLate:     { $sum: '$lateMinutes' },
                totalMissing:  { $sum: '$missingMinutes' },
                totalOvertime: { $sum: '$overtimeMinutes' },
                daysAbsent:    { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } }
            }}
        ]);
        const attendanceMap = {};
        attendanceAgg.forEach(a => { attendanceMap[a._id.toString()] = a; });

        for (const emp of employees) {
            // Skip employees whose payroll for this period is already approved or paid
            if (lockedPayrolls.has(emp._id.toString())) continue;

            const settings = emp.contractSettings || {};
            const baseSalary = settings.monthlySalary || emp.salary || 0;

            const att = attendanceMap[emp._id.toString()] || { totalWorked: 0, totalRequired: 0, totalLate: 0, totalMissing: 0, totalOvertime: 0, daysAbsent: 0 };

            const standardMonthlyMinutes = 22 * (settings.dailyRequiredMinutes || 480);
            const ratePerMinute = baseSalary / standardMonthlyMinutes;

            let missingTimeDeductions = 0, overtimeAdditions = 0, absenceDeductions = 0;

            if (settings.deductionRules?.missedMinutes) {
                missingTimeDeductions = Math.round(att.totalMissing * ratePerMinute);
            }
            if (settings.overtimeEnabled) {
                const multiplier = settings.overtimeRateMultiplier || 1.5;
                overtimeAdditions = Math.round(att.totalOvertime * ratePerMinute * multiplier);
            }

            const dailyRate = baseSalary / 22;
            absenceDeductions = Math.round(att.daysAbsent * dailyRate);

            const finalPayableSalary = Math.round(baseSalary + overtimeAdditions - missingTimeDeductions - absenceDeductions);

            const payrollData = {
                tenant,
                employeeId: emp._id,
                period,
                baseSalary,
                metricsTotal: {
                    totalWorkedMinutes: att.totalWorked,
                    totalRequiredMinutes: att.totalRequired,
                    totalLateMinutes: att.totalLate,
                    totalMissingMinutes: att.totalMissing,
                    totalOvertimeMinutes: att.totalOvertime
                },
                overtimeAdditions,
                missingTimeDeductions,
                absenceDeductions,
                finalPayableSalary: Math.max(0, finalPayableSalary),
                status: 'Pending Approval'
            };

            const savedDoc = await Payroll.findOneAndUpdate(
                { tenant, employeeId: emp._id, period },
                { $set: payrollData },
                { returnDocument: 'after', upsert: true }
            );

            if (savedDoc) payrollResults.push(savedDoc);
        }

        audit({ tenant, actorUserId: req.user._id, action: 'GENERATE_PAYROLL', module: 'hr', metadata: { period, count: payrollResults.length } });
        res.json({ message: `Successfully generated payroll for ${period}`, count: payrollResults.length, data: payrollResults });
    } catch (err) {
        logger.error({ err }, 'Error generating monthly payroll');
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getPayrollRecords = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period, employeeId } = req.query;
        if (period && !/^\d{2}-\d{4}$/.test(period))
            return res.status(400).json({ error: 'Period must be in MM-YYYY format' });
        const query = { tenant };
        if (period) query.period = period;
        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId))
                return res.status(400).json({ error: 'Invalid employeeId' });
            query.employeeId = employeeId;
        }

        const records = await Payroll.find(query)
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role email' })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();
        res.json(records.filter(r => r.employeeId));
    } catch (err) {
        logger.error({ err }, 'Error fetching payroll records');
        res.status(500).json({ error: 'Server error' });
    }
};

// Approve payroll (Pending Approval → Approved): manager sign-off before payment
exports.approvePayroll = async (req, res) => {
    try {
        const { id } = req.params;

        // Atomic conditional update — prevents double-approval race
        const payroll = await Payroll.findOneAndUpdate(
            { _id: id, tenant: req.user.tenant, status: 'Pending Approval' },
            { $set: { status: 'Approved', approvedBy: req.user._id, approvedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!payroll) {
            const exists = await Payroll.findOne({ _id: id, tenant: req.user.tenant }).select('status').lean();
            if (!exists) return res.status(404).json({ error: 'Payroll record not found' });
            return res.status(400).json({ error: `Cannot approve payroll in '${exists.status}' status. Only 'Pending Approval' records can be approved.` });
        }

        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'APPROVE_PAYROLL', module: 'hr', metadata: { payrollId: id, employeeId: payroll.employeeId, period: payroll.period, amount: payroll.finalPayableSalary } });
        res.json(payroll);
    } catch (err) {
        logger.error({ err }, 'Error approving payroll');
        res.status(500).json({ error: 'Server error' });
    }
};

// Record payment (Approved → Partially Paid / Paid): finance team records disbursement
exports.recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        // Pre-read for validation (lightweight lean query)
        const existing = await Payroll.findOne({ _id: id, tenant: req.user.tenant }).select('status amountPaid finalPayableSalary').lean();
        if (!existing) return res.status(404).json({ error: 'Payroll record not found' });

        if (!['Approved', 'Partially Paid'].includes(existing.status)) {
            return res.status(400).json({ error: `Payroll must be 'Approved' before payment can be recorded. Current status: '${existing.status}'.` });
        }

        let paymentAmount = amount ? Number(amount) : (existing.finalPayableSalary - existing.amountPaid);
        if (paymentAmount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount.' });
        }

        // Atomic conditional update — prevents overpayment race
        // The condition ensures amountPaid + paymentAmount <= finalPayableSalary at write time
        const payroll = await Payroll.findOneAndUpdate(
            {
                _id: id,
                tenant: req.user.tenant,
                status: { $in: ['Approved', 'Partially Paid'] },
                $expr: { $lte: [{ $add: ['$amountPaid', paymentAmount] }, '$finalPayableSalary'] }
            },
            [
                { $set: { amountPaid: { $add: ['$amountPaid', paymentAmount] } } },
                { $set: { status: { $cond: [{ $gte: ['$amountPaid', '$finalPayableSalary'] }, 'Paid', 'Partially Paid'] } } }
            ],
            { returnDocument: 'after' }
        );

        if (!payroll) {
            // Re-check to give specific error message
            const recheck = await Payroll.findOne({ _id: id, tenant: req.user.tenant }).select('amountPaid finalPayableSalary status').lean();
            if (!recheck) return res.status(404).json({ error: 'Payroll record not found' });
            if (!['Approved', 'Partially Paid'].includes(recheck.status))
                return res.status(400).json({ error: `Payroll status changed to '${recheck.status}' — cannot record payment.` });
            return res.status(400).json({ error: `Cannot overpay. Maximum remaining balance is ${recheck.finalPayableSalary - recheck.amountPaid} DZD` });
        }

        // Sync payment to financial ledger
        try {
            const employee = await Employee.findOne({ _id: payroll.employeeId, tenant: req.user.tenant, deletedAt: null });
            const empName = employee?.name || 'Unknown Employee';
            await Expense.create({
                tenant: req.user.tenant,
                amount: paymentAmount,
                date: new Date(),
                description: `Salary payment — ${empName} (${payroll.period})${newStatus === 'Partially Paid' ? ' [Partial]' : ''}`,
                category: 'Human Resources',
                source: 'payroll_sync',
                linkedPayrollId: payroll._id
            });
        } catch (syncErr) {
            logger.warn({ err: syncErr }, 'Failed to sync payroll to Financial ledger');
        }

        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'RECORD_PAYROLL_PAYMENT', module: 'hr', metadata: { payrollId: id, employeeId: payroll.employeeId, period: payroll.period, paymentAmount, newStatus } });
        res.json(payroll);
    } catch (err) {
        logger.error({ err }, 'Error recording payroll payment');
        res.status(500).json({ error: 'Server error' });
    }
};
